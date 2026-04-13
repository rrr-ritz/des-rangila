# Des Rangila 2026 — Development Chronicle

*A complete account of the build session that brought the Des Rangila digital passport system to life, from first commit to post-event analytics.*

---

## The Vision

Des Rangila is the Indian Student Association's flagship cultural event at the University of Maryland — a "Tour of India" where 200+ attendees travel through 14 cultural stations representing regions of India, collecting stamps on a digital passport, tasting regional food, doing hands-on activities, and capturing memories at photo booths. Every interaction is tracked digitally: check-in, QR-coded passports, volunteer-operated scanning, real-time inventory, face-matched photo delivery, and a rich admin dashboard.

This document chronicles everything built in a single marathon development session.

---

## Timeline

### Phase 1: Foundation & Test Data

**Firestore Data Seeding**
The session began with seeding the Firestore database: 5 test attendees (Emily Johnson, Jake Mitchell, Sarah Thompson, Ryan Cooper, Megan Davis) and a dev volunteer account were created to enable end-to-end testing of the check-in flow.

**Dev Volunteer Login Bypass**
Firebase phone auth requires real SMS delivery, which was blocked by Twilio's toll-free verification process (IN_REVIEW status). For the dev account (`+11111111111`), we built a complete bypass: a `/api/dev-login` endpoint that looks up the volunteer by phone, creates a Firebase custom token with a stable UID, and signs in directly — zero SMS needed. This pattern proved critical later when ALL volunteers needed the same bypass.

---

### Phase 2: Volunteer Scanner & Redeem Flow

**Scan Modal Improvements**
The volunteer QR scanner needed redeem buttons. We added three options based on station type: "Redeem Activity", "Redeem Food", and "Redeem Both" (for stations offering both). The modal shows the attendee's selfie (64px circle), name, and food/activity status with colored indicators.

**Selfie Capture at Check-In**
The check-in page needed to capture attendee selfies for later face matching. The face API (`/api/attendees/[id]/face`) only accepted volunteer auth, but the check-in page runs under admin auth. We established a pattern that would recur throughout the session: **try volunteer auth, fallback to admin auth**. The `SelfieCapture` component was updated to accept an `authToken` prop.

**Auth Pattern Established**
Multiple APIs were volunteer-only but called from admin pages. The fix pattern became standard:
```typescript
try { authResult = await verifyAuth(request, "volunteer"); }
catch { authResult = await verifyAuth(request, "admin"); }
```
This was applied to: check-in, walk-in, face upload, and later to inventory, redemptions, by-qr, sync, and volunteer station assignment APIs.

---

### Phase 3: Photos & Visual Polish

**Photos Tab Fix**
The admin photos page was empty because it filtered by `photoType == "booth"` which excluded other types, and the Firestore query required a composite index that didn't exist. Added a try/catch fallback that drops the `orderBy` when the index is missing.

**Photo Lightbox Sizing**
The full-size photo lightbox was overflowing the viewport. Constrained to `max-width: 90vw; max-height: 80vh` with `object-contain` and added an X close button.

**Scan Modal Layout**
Refined the overlay to full-screen dark (`fixed inset-0 z-50 bg-black/85 backdrop-blur-md`), compact card with 64px avatar, and lowered the border flash z-index to prevent it from covering the modal.

---

### Phase 4: Station Data Corrections

**Station Types Fixed**
Originally, food stations were marked as `type: "both"` (offering both food and activity). This was corrected: each station is either `"food"` OR `"activity"`, never both. The "Redeem Both" button was removed entirely from the scan modal.

**New Stations Added**
- Motion Cafe changed from `type: "food"` to `type: "none"` (not stampable, no inventory)
- Photo Booth 1 and Photo Booth 2 added as `type: "none"`
- Old single `photo-booth` station removed

**Station Details Updated**
- West Bengal changed from "Polaroid Photo Booth" to "Incense" (activity)
- Odisha changed to "Mehendi"
- Kerala changed to "Pookalam"
- All activity names and food items corrected per the event planning document

**Stamp Passport Updated**
The attendee passport grid went from 15 stations to 14 (Motion Cafe removed since it's no longer stampable). The `ROTATIONS` array was trimmed to match.

---

### Phase 5: QR Scanner Fix

**The Bug**: The QR scanner detected codes (yellow brackets visible) but never advanced to the redeem modal. 

**Root Cause**: Check-in QR codes encode a full URL (`https://des-rangila.vercel.app/pass/XXXX`) but the scanner passed the entire URL to `/api/attendees/by-qr/${payload}`, which queries Firestore for `qrPayload == payload`. The full URL doesn't match the stored `qrPayload` (just the ID portion).

**The Fix**: Added regex extraction in `handleScan`:
```typescript
const passMatch = rawPayload.match(/\/pass\/([^/?#]+)/);
if (passMatch) payload = decodeURIComponent(passMatch[1]);
```

---

### Phase 6: Photo Booth

**Grayscale Filter**
The photo strip was rendering in color. The `ctx.filter = "grayscale(100%)"` Canvas API isn't supported in all browsers. Replaced with manual pixel-level luminance conversion using the standard formula: `gray = 0.299*R + 0.587*G + 0.114*B`.

**Aspect Ratio Fix**
Photos in the strip were stretched/distorted. Added center-crop logic in both the capture (`BoothCamera.tsx`) and the strip renderer (`PhotoStrip.tsx`): compare source and target aspect ratios, crop the wider/taller dimension from center, then draw.

**Start Button**
Previously, capture began automatically. Changed the flow: camera shows live feed with a large "Start" button overlay. User taps Start, first 5-second countdown begins. After photo 1, automatic 5-second countdown for photos 2 and 3.

**Countdown Change**
All countdowns changed from 3 seconds to 5 seconds for better posing time.

---

### Phase 7: Face-Matching Daemon (EC2)

**The Problem**: Photo booth photos needed to be matched against attendee selfies in near-real-time during the event. InsightFace (buffalo_l model, ArcFace R50) can't run on Vercel serverless — it needs a real server with ~1.5GB RAM for the model.

**The Daemon** (`scripts/match-daemon.py`):
- Polls Firestore every 30 seconds for new booth photos where `faceMatchProcessed != true`
- Downloads individual photos from `individualPhotos` URLs
- Runs InsightFace face detection + embedding extraction (512-dim vectors)
- Compares against cached attendee selfie embeddings using cosine similarity
- Auto-approves matches >0.3, marks 0.2-0.3 for review
- Updates photo `attendeeIds` for auto-approved matches (immediately visible on `/me` page)
- Writes to `face_match_queue` for admin review
- Refreshes selfie cache every 5 minutes (new attendees checking in)

**Docker + EC2 Deployment**:
- `Dockerfile` with pre-downloaded buffalo_l model (~300MB)
- Required `g++` for InsightFace Cython compilation
- Deployed to `t3.medium` spot instance (`i-028f6cc0d3da35fb2` at `23.22.74.153`)
- All done via CLI: `aws ec2 run-instances`, SCP files, `docker build`, `docker run -d --restart unless-stopped`
- Service account key mounted at runtime via Docker volume (never baked into image)

**Testing**: The daemon successfully processed 4 booth photos, matching Emily Johnson (sim 0.72-0.84), Sachin Thapar (sim 0.54-0.68), and Pari Gill (sim 0.32-0.39).

---

### Phase 8: Firestore Composite Index Crisis

**The Silent Killer**: Multiple Firestore queries across the entire app were silently failing because they combined `where()` + `orderBy()` on different fields, which requires composite indexes that were never created. Firestore throws `FAILED_PRECONDITION`, the API returns 500, and clients show empty data.

**Discovery**: The face-match dashboard showed "No auto-approved matches" even though 12 matches existed in Firestore. A debug endpoint confirmed the data was there. The real culprit: `MatchReview.tsx` never sent `Authorization` headers (the only admin component that forgot). But even after fixing auth, the composite index issue would have hit next.

**The Audit**: Found 8 endpoints with composite index dependencies:
1. `photos/by-attendee` — `array-contains` + `approved` + `orderBy`
2. `face-match/queue` — `where(status)` + `orderBy(createdAt)`
3. `redemptions/by-attendee` — `where` + `orderBy`
4. `redemptions/by-station` — `where` + `orderBy`
5. `audit-log` — `orderBy` + multiple `where`
6. `redemptions` (duplicate check) — triple `where`
7. `apple-wallet registrations` — double `where`
8. `admin/photos` — `orderBy` (already had fallback)

**The Fix Pattern**: Drop `orderBy` from Firestore queries entirely. Sort in JavaScript instead. The collections are small enough (hundreds of docs) that client-side sorting is instantaneous and eliminates all composite index dependencies.

---

### Phase 9: DoorList Import & Inventory Seeding

**167 Pre-Order Attendees Imported**
A comprehensive data update script (`scripts/update-event-data.js`) was created to:
- Update all 18 station docs with correct types and items
- Delete 8 old inventory items, seed 14 new ones at 150 each
- Delete 5 test attendees
- Import 167 pre-order attendees from the DoorList (names title-cased, no PINs — assigned at check-in)

**Inventory**: 150 servings per stampable station (7 food + 7 activity). Low stock threshold at 30 (20%).

---

### Phase 10: Event-Day Crisis — QR Code 404

**The Emergency**: During the live event, an attendee (Shriya Krishnan) was checked in and received a QR code, but scanning it gave a 404 error.

**Root Cause**: Pre-order attendees were imported with `pin: ""` and `qrPayload: ""`. The check-in API (`/api/attendees/[id]/check-in`) never generated these fields — it assumed they already existed. The QR code encoded `https://des-rangila.vercel.app/pass/` (empty path) which 404'd.

**Immediate Fix**: Directly updated Shriya's Firestore doc with a generated PIN (8389) and qrPayload (DR-MLJNWVGY).

**Systemic Fix**: Updated the check-in route to generate unique PINs and QR payloads on the fly if they're empty, with collision checking against all existing values. The frontend was also updated to use the fresh values from the API response instead of stale empty strings.

---

### Phase 11: Volunteer Login Crisis

**The Problem**: Sachin (volunteer) logged in and saw a blank screen. 

**Root Cause**: Firebase phone auth requires real SMS verification codes. Twilio's toll-free number was stuck IN_REVIEW, so Firebase couldn't send the SMS. The login attempt failed silently.

**The Fix**: Extended the custom token bypass (originally just for the dev account) to work for ALL registered volunteers. Volunteer enters phone number → API looks up their volunteer record → issues a custom token → instant login, no SMS needed. The entire SMS verification step was removed from the UI.

---

### Phase 12: Admin Dashboard Fixes

**Volunteer Station Assignment**: The "+ Assign" dropdown didn't work because the API endpoint only accepted volunteer auth (same pattern as before). Also, there was no way to unassign volunteers. Fixed by: adding admin auth fallback, allowing `null` stationId for unassigning, and adding X buttons next to volunteer names.

**Face Match Visibility**: The Face Match tab was hidden for `dhruvsuri312@gmail.com` via a hardcoded filter in the admin layout. Removed the filter.

**Attendees Table Cleanup**: Removed the Email and Pass columns (unused), updated stamp count from /15 to /14.

**Attendees List Truncated**: The API defaulted to 50 results, but we had 222 attendees. Raised to 500.

**Inventory Page Empty**: Same auth bug — the inventory API only accepted volunteer tokens.

---

### Phase 13: Volunteer Assignments

Throughout the event, various volunteer assignments were made directly via Firestore:
- Dhruv Suri → Jammu & Kashmir
- Karan Jain + Keshav Nair → Motion Cafe
- Ritvik Rangaraju + Jasmine Saluja → Check-In (added as new volunteer records)
- Akriti X. renamed to Akriti Mishra

---

### Phase 14: Post-Event Analytics

After the event concluded, a comprehensive "Spotify Wrapped"-style analytics report was generated (`scripts/analytics-report.py`). Key findings:

- **222 attendees** (167 pre-orders + 54 walk-ins), **90% check-in rate**
- **968 total redemptions** (808 food + 160 activity)
- **Biryani sold out** (150/150 consumed), Vada Pav and Uthappam nearly gone (148/150 each)
- **West Bengal (Incense)** dominated activities with 71 redemptions
- **Average 4.9 stamps** per attendee; nobody completed all 14
- **Prisha Ni** visited the most stations (10)
- **15 photo booth sessions** → 45 photos → 129 face matches (64% auto-approved)
- **Volunteer MVPs**: Atharva Bhalke and Yasmin Razak each processed 148 redemptions
- **93% selfie upload rate**

---

### Phase 15: Photographer Photo Matching

79 professional photographer photos were queued for face matching using the existing `match-photos.py` script. The script processes each photo through InsightFace, matches detected faces against 186 attendee selfies, uploads matched photos to Firebase Storage, and writes results to the `face_match_queue` for admin review. Results: 135 auto-approved matches, 107 needing review, across 79 photos.

---

## Architecture Summary

### Tech Stack
- **Frontend**: Next.js 14, React, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes on Vercel (auto-deploys from `main`)
- **Database**: Firebase Firestore (nam5/us-central)
- **Auth**: Firebase Auth (phone auth bypassed with custom tokens, email auth for admins)
- **Storage**: Firebase Cloud Storage (selfies, booth photos, photographer photos)
- **Face Matching**: InsightFace (buffalo_l, ArcFace R50) — Python daemon on EC2
- **Deployment**: Vercel (web app) + AWS EC2 t3.medium spot instance (face daemon)

### Key Design Patterns
1. **Volunteer-or-Admin Auth**: Every API endpoint accepts both roles
2. **No Composite Indexes**: All Firestore queries use single `where()` with JS-side sorting
3. **Custom Token Auth**: Bypasses Firebase phone SMS entirely for volunteer login
4. **QR URL Extraction**: Scanner handles both raw payloads and full URLs
5. **PIN/QR Generation at Check-In**: Pre-order attendees get credentials on first check-in

### File Count
- **API Routes**: 20+ endpoints in `app/api/`
- **Components**: 15+ in `components/`
- **Scripts**: 7 in `scripts/` (seed, update-event-data, match-photos, match-daemon, analytics-report, test-insightface, add-test-attendee)
- **Infrastructure**: Dockerfile, deploy-daemon.sh, requirements-daemon.txt

---

## Lessons Learned

1. **Firebase phone auth is unreliable for events** — Twilio toll-free verification can take weeks. Custom tokens are the way to go for controlled-access apps.

2. **Firestore composite indexes are a silent killer** — Queries that combine `where()` + `orderBy()` on different fields fail with no warning in the UI. Always test queries against production Firestore, or avoid `orderBy` entirely for small collections.

3. **Pre-order data needs complete fields** — Importing attendees with empty required fields (`pin`, `qrPayload`) causes downstream failures. Either generate all fields at import time, or ensure every consumer handles the empty case.

4. **Auth should be permissive by default** — The "volunteer-only" auth pattern broke 10+ endpoints. A better pattern: verify that the user is *authenticated* (any role), then check permissions per-action if needed.

5. **Face matching at scale needs infrastructure** — InsightFace with buffalo_l needs ~1.5GB RAM and can't run in serverless. A Docker container on a t3.medium spot instance ($0.01/hr) is the right call for event-day matching.

---

*Built with Claude Code during a single development session. Des Rangila 2026 — Tour of India.*
*University of Maryland · Indian Student Association*
