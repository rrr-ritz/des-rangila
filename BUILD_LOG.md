# Des Rangila 2026 — Build Log

*A chronological account of everything built, fixed, and shipped for the Des Rangila digital passport system on April 11, 2026 — the day of the event.*

---

## The System

Des Rangila is a digital passport system for an Indian cultural event hosted by the Indian Student Association at the University of Maryland. Attendees travel between 14 cultural stations representing regions of India, collecting stamps and redeeming food. Each attendee gets a QR-coded digital passport they can view on their phone, showing their stamps, food redemptions, and photo booth pictures.

**Tech stack:** Next.js 14 on Vercel, Firebase Firestore + Auth + Storage, InsightFace (Python) for face matching, Docker on AWS EC2.

---

## Chapter 1: Photo Booth Fixes

### Grayscale Filter Not Working
The photo strip was rendering in color. The `ctx.filter = "grayscale(100%)"` Canvas API isn't supported in all browsers. **Fix:** Replaced with manual pixel-level conversion using the luminance formula (`0.299R + 0.587G + 0.114B`), iterating over every pixel in the ImageData buffer.

### Aspect Ratio Distortion
Photos in the strip were stretched. `ctx.drawImage()` was scaling the full source image to a fixed 600×450 target without regard for aspect ratio. **Fix:** Added center-crop logic — compare source and target aspect ratios, crop the wider/taller dimension from center before drawing. Applied in both `BoothCamera.capturePhoto` (video→canvas) and `PhotoStrip` (image→canvas).

### Start Button Before Auto-Fire
The capture sequence began automatically with no user control. **Fix:** Added a `waitingForStart` state. The camera shows a live feed with a large "Start" button overlaid. Tapping Start begins the first countdown. Photos 2 and 3 auto-fire after a 1-second pause.

### Countdown Duration
Changed from 3 seconds to 5 seconds for all photos.

**Files:** `components/booth/PhotoStrip.tsx`, `components/booth/BoothCamera.tsx`

---

## Chapter 2: Face-Matching Daemon on AWS EC2

### The Daemon (`scripts/match-daemon.py`)
Built a continuously-running Python daemon that polls Firestore every 30 seconds for new booth photos. For each unmatched photo:
1. Downloads individual photo frames from Firebase Storage
2. Runs InsightFace (buffalo_l model, ArcFace R50) face detection
3. Compares detected faces against cached attendee selfie embeddings (512-dim vectors, cosine similarity)
4. Auto-approves matches >0.3 similarity (adds attendee to photo's `attendeeIds` array)
5. Marks borderline matches (0.2-0.3) for admin review

The daemon includes a `SelfieCache` class that refreshes every 5 minutes to pick up new check-ins, graceful SIGTERM handling for Docker, and retry logic (max 3 attempts per photo).

### Docker & Deployment
- `Dockerfile` with `python:3.11-slim`, g++ for Cython compilation, pre-downloaded InsightFace model (~300MB)
- `requirements-daemon.txt` using `opencv-python-headless` for Docker compatibility
- `deploy-daemon.sh` documenting the full EC2 setup

### AWS EC2 Deployment (Fully Automated via CLI)
1. Installed AWS CLI via Homebrew
2. Configured credentials
3. Created SSH key pair (`des-rangila-daemon`)
4. Created security group with SSH access
5. Launched `t3.medium` spot instance (Ubuntu 22.04, 20GB gp3)
6. SCP'd files to instance
7. Installed Docker, built image, ran container with `--restart unless-stopped`

**Result:** Daemon running at `23.22.74.153`, processing booth photos in real-time. Successfully matched Emily Johnson (0.84 similarity), Sachin Thapar (0.68), and Pari Gill (0.39) across 4 booth photos.

**Files:** `scripts/match-daemon.py`, `Dockerfile`, `requirements-daemon.txt`, `deploy-daemon.sh`

---

## Chapter 3: The Composite Index Crisis

### Discovery
The face-match dashboard showed "No auto-approved matches" despite the daemon successfully writing 12 match records to Firestore. Investigation revealed a cascade of silent failures.

### Root Cause #1: Missing Firestore Composite Indexes
Every Firestore query combining `where()` + `orderBy()` on different fields requires a composite index. None were created. The queries silently threw `FAILED_PRECONDITION` errors, APIs returned 500, and frontends showed empty data.

**Affected endpoints (8 total):**
- `photos/by-attendee` — attendee `/me` page showed "No photos yet"
- `face-match/queue` — dashboard showed no matches
- `redemptions/by-attendee` — attendee history broken
- `redemptions/by-station` — station history broken
- `admin/audit-log` — audit log empty
- `redemptions` (duplicate check) — triple `where()` for preventing double-redemptions
- `apple-wallet/registrations` — double `where()` for device lookups
- `admin/photos` — had a try/catch fallback already

**Fix pattern:** Removed `orderBy()` from all queries. Single `where()` queries don't need composite indexes. Sort in JavaScript after fetching — collections are small enough (hundreds of docs) that this is fine.

### Root Cause #2: Missing Auth Headers
`MatchReview.tsx` was the only admin component that never imported `useAuth()` and never sent `Authorization: Bearer` headers. The queue API returned 401, `res.ok` was false, `setMatches` was never called. **Fix:** Added `useAuth()` hook and Bearer token to both fetch and PATCH calls.

### Diagnosis Process
Deployed a temporary debug endpoint (`/api/debug-matches`) to production to verify the Firestore data was correct. Confirmed 12 docs existed with proper `status: "auto-approved"` and `photoId` fields. The data was always there — the client just couldn't reach it.

**Files:** 8 API route files, `components/face/MatchReview.tsx`

---

## Chapter 4: The Auth Pattern Problem

### Discovery
Multiple admin pages were broken because their API endpoints only accepted `verifyAuth(request, "volunteer")` but admin users don't have volunteer records in Firestore. The `verifyAuth` helper checks for a volunteer doc linked by Firebase UID — admins authenticate via email/password and have no such doc.

### Systematic Audit
Grepped for every `verifyAuth(request, "volunteer")` call and found 10 endpoints. Several already had admin fallbacks from earlier fixes. Six did not:
- `inventory` and `inventory/sync`
- `attendees/by-qr` and `attendees/sync`
- `redemptions` and `redemptions/by-attendee`

**Fix:** Added the try-volunteer-catch-try-admin pattern to all six, plus the `volunteers/[id]/station` endpoint (which was causing the station assignment dropdown to silently fail).

**Files:** 8 API route files

---

## Chapter 5: Station Data Overhaul

### Station Type Corrections
Every station was changed to be either food OR activity — never "both". The `StationType` union in `lib/types.ts` got a new `"none"` value for non-stampable stations.

**Station changes:**
- 7 food stations: Punjab (Paneer Tikka), Maharashtra (Vada Pav), Central India (Chai Latte), Seven Sisters (Momos), AP+Telangana (Biryani), Karnataka (Idli), Tamil Nadu (Uthappam)
- 7 activity stations: J&K (Hair Clip Making), HP+UK (Postcard Coloring), Haryana+Rajasthan (Block Printing), Gujarat (Dandiya Making), Odisha (Mehendi), West Bengal (Incense), Kerala (Pookalam)
- 3 non-stampable: Motion Cafe, Photo Booth 1, Photo Booth 2

### Inventory Seeding
14 inventory items created at 150 servings each (half-servings to stretch for the crowd).

### "Redeem Both" Button Removed
Since no station has both food and activity, the "Redeem Both" button in the volunteer scan modal was removed entirely. Food stations show only "Redeem Food", activity stations show only "Redeem Activity", and `type: "none"` stations show "This station does not have stamps."

### Stamp Passport Updated
Removed Motion Cafe from the passport grid. Now 14 stations, X/14 count.

### Admin Stations Page Redesigned
- Combined Type + Food/Activity into single "Item" column with emoji prefix (🍽/🎨)
- Inventory count shown inline (e.g., "142/150")
- Non-stampable stations separated into "Other Stations" section at bottom
- Tighter row spacing throughout

**Files:** `scripts/update-event-data.js`, `lib/types.ts`, `app/scan/page.tsx`, `components/scanner/ScanResult.tsx`, `components/attendee/StampPassport.tsx`, `scripts/seed.js`, `app/admin/stations/page.tsx`

---

## Chapter 6: DoorList Import (167 Attendees)

Created `scripts/update-event-data.js` that:
1. Updated all 18 station documents in Firestore
2. Deleted old inventory and seeded 14 new items
3. Deleted 5 test attendees (Emily Johnson, Jake Mitchell, Sarah Thompson, Ryan Cooper, Megan Davis)
4. Imported 167 pre-order attendees from the DoorList CSV with title-cased names, ticket counts, and all required fields (`checkedIn: false`, `preOrder: true`, no PIN/QR yet)

Names were normalized: `"aarushi soni"` → `"Aarushi Soni"`, `"SIMRAN GAWRI"` → `"Simran Gawri"`.

**File:** `scripts/update-event-data.js`

---

## Chapter 7: Admin Dashboard Fixes

### Volunteer Assignment
The "+ Assign" dropdown silently failed because the station assignment API only accepted volunteer auth. **Fix:** Added admin fallback. Also allowed `null` stationId for unassigning (was returning 400 "stationId is required"). Added X buttons next to volunteer names for one-click unassignment.

### Face Match Visibility
Removed the email-based filter that was hiding the Face Match tab from `dhruvsuri312@gmail.com`.

### Attendees Table
Removed Email and Pass columns. Updated stamp count from /15 to /14. Cleaned up unused `sendPass` function and related imports.

### Attendees API Limit
Default limit was 50 but we had 167+ attendees. Raised to 500.

**Files:** `app/api/volunteers/[id]/station/route.ts`, `app/admin/layout.tsx`, `app/admin/attendees/page.tsx`, `app/api/attendees/route.ts`, `app/admin/stations/page.tsx`

---

## Chapter 8: Volunteer Data Management

### Station Assignments (via Firestore)
- Dhruv Suri → Jammu & Kashmir
- Karan Jain + Keshav Nair → Motion Cafe
- Ritvik Rangaraju + Jasmine Saluja → Check-In (added as new volunteers)
- Akriti X. → renamed to Akriti Mishra

---

## Chapter 9: The QR Code 404 Crisis (Live Event)

### The Bug
During the live event, Shriya Krishnan was checked in and received a QR code. When she scanned it — 404. The QR code pointed to `https://des-rangila.vercel.app/pass/` (empty path).

### Root Cause
Pre-order attendees were imported with `pin: ""` and `qrPayload: ""`. The check-in API (`/api/attendees/[id]/check-in`) only set `checkedIn: true` — it never generated PIN or QR payload. The frontend then encoded `attendee.qrPayload` (empty string) into the QR code URL.

The walk-in route correctly generated these fields, but the check-in route was never updated for the pre-order flow.

### Emergency Fix
1. **Immediate:** Manually generated a PIN (8389) and QR payload (DR-MLJNWVGY) for Shriya directly in Firestore
2. **Code fix:** Updated the check-in API to generate unique PIN and QR payload on the fly if they're missing, with collision checking against all existing values
3. **Frontend fix:** Updated the check-in page to use `data.pin` and `data.qrPayload` from the API response instead of the stale empty values from the pre-search attendee data

**Files:** `app/api/attendees/[id]/check-in/route.ts`, `app/admin/check-in/page.tsx`

---

## Chapter 10: Volunteer Login Broken (Live Event)

### The Bug
Sachin (volunteer) logged in and saw a blank screen. The volunteer login page uses Firebase phone auth (`signInWithPhoneNumber`), which requires sending an SMS verification code via Twilio. But Twilio's toll-free number was IN_REVIEW — SMS couldn't be sent.

### Fix
Extended the custom token login (originally built for the dev test account `+11111111111`) to work for ALL registered volunteers. Now when any volunteer enters their phone number:
1. Frontend calls `/api/dev-login` with the phone number
2. API looks up the volunteer by phone (fuzzy matching on various formats)
3. Creates a stable Firebase custom token (`volunteer-{docId}`)
4. Frontend calls `signInWithCustomToken` — instant login, no SMS needed

Removed the SMS verification code step, `RecaptchaVerifier`, and `signInWithPhoneNumber` from the staff page entirely.

**Files:** `app/api/dev-login/route.ts`, `app/staff/page.tsx`

---

## Chapter 11: Live Event Support

### Quick Firestore lookups during the event
Multiple attendees needed their passport links looked up by PIN or name during the event:
- Palak Gupta (PIN 3406) → `https://des-rangila.vercel.app/pass/DR-CSC5LBAA`
- Arya Ram (PIN 5583) → `https://des-rangila.vercel.app/pass/DR-MQPY7ZHU`
- Arshia Mamidanna (PIN 4145) → `https://des-rangila.vercel.app/pass/DR-PHHNSEMK`

These were direct Firestore queries via Python one-liners, returning results in seconds.

---

## Chapter 12: Post-Event Analytics

### The Report (`scripts/analytics-report.py`)
Built a "Spotify Wrapped"-style analytics script that queries all 8 Firestore collections and produces a rich terminal + markdown report.

### Key Findings

**Attendance:** 222 total (167 pre-orders + 54 walk-ins), 90% check-in rate

**Food was king:** 808 food redemptions vs 160 activity redemptions. Biryani (AP+Telangana) sold out completely at 150/150. Vada Pav and Uthappam were 2 away from selling out.

**Station champion:** AP+Telangana (Biryani) led with 150 redemptions. West Bengal (Incense) dominated activities with 71.

**Passport engagement:** Average 4.9 stamps per attendee. 127 people (64%) visited 4-7 stations. Nobody completed all 14. Prisha Ni led with 10 stations.

**Volunteer MVPs:** Atharva Bhalke and Yasmin Razak each processed 148 redemptions.

**Photo booth:** 15 sessions, 45 individual photos, 129 face matches with 64% auto-approval rate. 30 attendees were matched to their photos.

**Digital adoption:** 93% selfie upload rate (185 of 199 checked-in attendees).

**Files:** `scripts/analytics-report.py`, `ANALYTICS_REPORT.md`

---

## Summary of All Commits (Chronological)

1. `fix: extract qrPayload from full URL in volunteer scanner` — QR scanner URL extraction
2. `fix: photo booth — grayscale, aspect ratio, start button, 5s countdown` — 4 booth fixes
3. `feat: add face-matching polling daemon for live event` — daemon + Docker + deploy script
4. `fix: use FieldFilter API and drop order_by to avoid composite index` — daemon query fix
5. `fix: add g++ to Dockerfile for InsightFace Cython compilation` — Docker build fix
6. `fix: fallback for missing composite index in face-match queue API` — first index fix attempt
7. `fix: remove orderBy from face-match queue to avoid composite index` — definitive queue fix
8. `fix: add missing auth headers to MatchReview API calls` — the real dashboard fix
9. `fix: remove composite index dependencies from all Firestore queries` — 6 endpoints fixed
10. `feat: station corrections, inventory seeding, DoorList import` — major data update
11. `fix: station assignment auth, face match visibility, attendees table` — admin fixes
12. `fix: add admin auth fallback to all volunteer-only endpoints` — 6 more endpoints
13. `fix: raise attendees API default limit from 50 to 500` — show all attendees
14. `fix: generate PIN and QR payload for pre-order attendees at check-in` — QR 404 fix
15. `fix: bypass Firebase phone auth for all volunteers` — volunteer login fix

---

## Architecture Decisions

### Why Custom Tokens Instead of Firebase Phone Auth?
Twilio's toll-free SMS number was stuck in A2P 10DLC review. Firebase phone auth requires sending SMS verification codes. Rather than wait (potentially weeks), we bypassed it entirely with Firebase custom tokens — the server creates a token tied to a stable UID, and the client signs in with `signInWithCustomToken`. Zero SMS needed.

### Why Drop orderBy Instead of Creating Composite Indexes?
Firestore composite indexes take minutes to create and require the Firebase Console (or CLI). During a live event, we needed instant fixes. Dropping `orderBy` and sorting in JavaScript is correct for small collections (hundreds of docs) and eliminates all index dependencies. The performance difference is negligible.

### Why a Polling Daemon Instead of Cloud Functions?
InsightFace requires ~1.5GB of memory for the buffalo_l model. Cloud Functions have a 2GB limit and cold starts would be brutal. A persistent daemon on EC2 keeps the model loaded in memory, processes photos in <2 seconds each, and runs reliably for the entire event.

### Why Not Just Use face-api.js in the Browser?
The browser-side face-api.js uses 128-dimensional descriptors. InsightFace uses 512-dimensional descriptors with a much more accurate ArcFace model. The daemon approach gives higher-quality matches and doesn't depend on the admin being online.

---

*Built with Claude Code on April 11, 2026. Event hosted by the Indian Student Association at the University of Maryland.*
