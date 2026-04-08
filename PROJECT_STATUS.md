# Des Rangila — Project Status & Handoff Document

**Last updated:** April 8, 2026
**Event date:** April 11, 2026 (5–8 PM)
**Location:** McKeldin Mall East, University of Maryland
**Expected attendees:** ~200
**Live URL:** https://des-rangila.vercel.app
**Branch:** `main` (only branch)

---

## What Is This?

Des Rangila Digital Passport is a full-stack event tech platform for UMD ISA's "Tour of India" festival. It replaces paper stamp cards with a digital experience: QR-based check-ins, Apple/Google Wallet passes, a photo booth with face recognition, offline-capable volunteer scanning, and a real-time admin dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui (new-york) |
| Database | Firebase Firestore (8 collections) |
| Auth | Firebase Auth (email/password for admins, phone SMS for volunteers) |
| Storage | Firebase Cloud Storage (photos, selfies) |
| Wallet | Apple Wallet (`passkit-generator`) + Google Wallet (JWT signing) |
| Email | Resend SDK |
| Face Recognition | `@vladmandic/face-api` (browser, TF.js) + InsightFace (Python, post-event) |
| Offline | IndexedDB (`idb`) + Service Worker (PWA) |
| QR | `qrcode` (generation) + `qr-scanner` (scanning) |
| Rate Limiting | Custom in-memory middleware (per-IP, per-route) |
| Deployment | Vercel |
| Node | v20 (pinned via `.nvmrc`) |

---

## What Has Been Built (All Complete)

### Core Systems

1. **Attendee Management** — CSV import, walk-in registration, 4-digit PIN + QR payload generation, duplicate detection
2. **QR Scanning** — Always-on 720p/15fps scanner, haptic feedback, autofocus lock, 5s dedup window, sunlight-optimized UI
3. **Check-in & Redemptions** — Volunteer scans QR → stamps station visit. Food redemptions tracked (max 7). Idempotent transactions prevent double-redemption
4. **Offline Support (PWA)** — IndexedDB caches attendee roster. Redemptions queue locally and flush every 10s. Service Worker with network-first API / cache-first static. Full offline scan + redeem workflow
5. **Apple Wallet Passes** — Signed `.pkpass` generation, eventTicket format, live web service endpoints for pass updates, base64 cert support for Vercel
6. **Google Wallet Passes** — JWT-signed save URLs, stamp count updates via API PATCH
7. **Email Distribution** — Individual + bulk pass send (5-batch, 500ms delay). Post-event memories email
8. **Photo Booth** — Camera with 3-2-1 countdown + flash. Canvas compositing (dark header, white borders, ISA branding). Upload strips + thumbnails + individual frames to Firebase Storage
9. **Face Recognition** — Client-side: face-api.js captures 128-dim descriptors at selfie. Server-side: match against all attendees (Euclidean distance < 0.6). Admin approval queue. InsightFace Python script for post-event batch matching
10. **Admin Dashboard** — KPI cards, station grid, activity feed, notification bell (30s refresh). Attendee table, station management, inventory gauges, volunteer table, photo gallery, audit log viewer
11. **Security** — Firestore rules, rate limiting (5/min PIN lookup, 10/min photo upload, 60/min general), auth middleware with role checking, append-only audit log

### Pages (16 total, 36 routes including dynamic)

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/admin` | Dashboard overview |
| `/admin/login` | Admin email/password login |
| `/admin/attendees` | Attendee management + CSV import |
| `/admin/stations` | 16-station configuration |
| `/admin/inventory` | Stock tracking + adjustment |
| `/admin/volunteers` | Volunteer management |
| `/admin/photos` | Photo gallery |
| `/admin/face-recognition` | Face match processing + review |
| `/admin/audit-log` | Searchable activity log |
| `/scan` | Volunteer QR scanner |
| `/me` | Attendee portal (PIN entry → stamps + photos) |
| `/booth` | Photo booth capture flow |
| `/pass/[qrPayload]` | Pass distribution page (wallet buttons + QR + PIN) |
| `/volunteer/register` | Volunteer self-registration |
| `/privacy` | Privacy policy |

### API Routes (36+ endpoints)

- `/api/attendees/*` — CRUD, CSV import, walk-in, sync, face upload, check-in, by-qr, by-pin
- `/api/redemptions/*` — Create (idempotent), by-attendee, by-station, recent
- `/api/inventory/*` — List, update, sync
- `/api/volunteers/*` — Register, list, assign station
- `/api/passes/*` — Apple/Google pass generation, individual/bulk email send
- `/api/apple-wallet/v1/*` — 5 Apple Wallet web service endpoints
- `/api/photos/*` — Upload, by-attendee, face-match (trigger, queue, review)
- `/api/qr/[payload]` — QR PNG generation (24h cache)
- `/api/email/post-event` — Post-event memories email
- `/api/admin/stats` — Dashboard KPIs
- `/api/admin/audit-log` — Audit trail query

### Firestore Collections (8)

1. `attendees` — name, email, pin, qrPayload, faceDescriptor, stamps, food redemptions, wallet status
2. `stations` — 16 regional booths with type (activity/food/both/registration/photo-booth)
3. `inventory` — per-station stock with low-stock threshold
4. `redemptions` — transaction log with idempotency keys
5. `volunteers` — registration + station assignment + role
6. `photos` — metadata + storage URLs + face match results
7. `audit_log` — append-only (action, actor, target, severity, timestamp)
8. `face_match_queue` — pending face matches for admin review

---

## Git History (Chronological)

| Commit | Description |
|--------|-------------|
| `56d08eb` | Repo setup |
| `0b78511` | **Initial commit:** All 11 phases implemented |
| `39eb22b` | Fix admin dashboard auth tokens + fetch real data |
| `d3250b2` | Fix seed script station slug IDs |
| `62afe70` | Add Send Pass button + test CSV |
| `4737bff` | Fix Google Wallet env var mismatch + CLASS_ID |
| `4133f04` | Event model overhaul: ticket → passport, remove tiers, add walk-in |
| `df9d1f1` | Integrate InsightFace for post-event photo matching |
| `990900c` | Fix PIN length: 6-digit → 4-digit everywhere |
| `61c9163` | Fix volunteer phone input: auto-format E.164 + +1 prefix |
| `8694f6c` | Fix volunteers page: missing auth token |
| `8d65f08` | Fix Node version conflicts + enhance Apple Wallet pass (eventTicket, base64 certs) |
| `af079ef` | Fix pass page: query Firestore directly instead of authed API route |

---

## Current Uncommitted Changes

```
Modified:  .claude/settings.local.json  (Claude Code permission allowlist updates)
Untracked: scripts/clear-attendees.js   (Firestore attendee wipe utility)
Untracked: scripts/list-attendees.js    (List attendees with QR + PIN)
```

**`scripts/clear-attendees.js`** — Deletes all attendees from Firestore using batch operations. Reads `.env.local` for credentials.

**`scripts/list-attendees.js`** — Lists all attendees with doc ID, name, QR payload, and PIN. Read-only.

These are utility scripts for testing/reset. Decide whether to commit or discard.

---

## The 16 Stations

| # | Region | Activity/Food |
|---|--------|---------------|
| 1 | Jammu & Kashmir + Ladakh | Hair Clip Making |
| 2 | Himachal + Uttarakhand | Postcard Coloring |
| 3 | Punjab | Mango Lassi Shots |
| 4 | Haryana + Rajasthan | Block Printing |
| 5 | Gujarat | Dandiya Making |
| 6 | Maharashtra | Vada Pav |
| 7 | Central India | Chai |
| 8 | Odisha | Mehendi/Henna |
| 9 | West Bengal | Polaroid Photo Booth |
| 10 | Seven Sisters + Sikkim | Momos |
| 11 | Andhra + Telangana | Biryani |
| 12 | Karnataka | Idli |
| 13 | Tamil Nadu | Uthappam |
| 14 | Kerala | Pookalam (Flower Rangoli) |
| 15 | — | Check-in / Registration |
| 16 | — | Photo Booth |

---

## Environment Variables Required

### Firebase Client (public)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Firebase Admin (server-only)
- `FIREBASE_SERVICE_ACCOUNT_KEY` — JSON service account blob

### Apple Wallet
- `APPLE_PASS_TYPE_IDENTIFIER` — e.g. `pass.it.ritvik.desrangila`
- `APPLE_TEAM_IDENTIFIER` — e.g. `G24QU993UF`
- `APPLE_PASS_CERT_PATH` / `APPLE_PASS_CERT_P12_BASE64` — signing cert
- `APPLE_PASS_CERT_PASSWORD`
- `APPLE_WWDR_CERT_PATH` / `APPLE_WWDR_CERT_BASE64` — WWDR intermediate cert

### Google Wallet
- `GOOGLE_WALLET_ISSUER_ID`
- `GOOGLE_WALLET_CLASS_ID`
- `GOOGLE_WALLET_SERVICE_ACCOUNT_KEY` — JSON service account

### Email
- `RESEND_API_KEY`
- `EMAIL_FROM`

### App
- `NEXT_PUBLIC_APP_URL` — e.g. `https://des-rangila.vercel.app`
- `ADMIN_EMAILS` — comma-separated admin emails

---

## Known Issues & Things to Flag

### Must Address Before Event (April 11)

1. **Test the full end-to-end flow** — Import attendees via CSV, send passes, have a volunteer scan QR codes, verify stamps appear on the attendee portal (`/me`), test offline redemption + sync
2. **Verify Apple Wallet passes work on real devices** — Cert signing can be finicky. Test on a physical iPhone
3. **Verify Google Wallet passes work** — Test the save URL redirect flow on an Android device
4. **Load test the offline sync** — With ~200 attendees cached in IndexedDB, verify scan performance stays < 50ms
5. **Test outdoor scanning** — QR scanning at 720p in direct sunlight. The UI is designed for it but hasn't been field-tested
6. **Seed production data** — Import the real attendee CSV, seed the 16 stations, set initial inventory counts
7. **Volunteer onboarding** — Volunteers need to register via `/volunteer/register` and be assigned stations by an admin

### Known Technical Notes

- **face-api.js build warning** — 1 harmless warning during `npm run build` from face-api.js dynamic `require`. Upstream issue, does not affect functionality
- **Rate limiting is in-memory** — Resets on Vercel cold starts. Fine for a single-event use case but not persistent
- **PIN is 4 digits** — Was originally 6, standardized to 4 across all surfaces in commit `990900c`. All references should be 4-digit now
- **Pass page queries Firestore directly** — The `/pass/[qrPayload]` page is a server component that queries Firestore via admin SDK, not through the API layer (fixed in `af079ef` because the API route required volunteer auth)
- **Lazy Firebase init** — Firebase client + admin SDKs use lazy initialization patterns to prevent build crashes when env vars are missing. This is intentional
- **InsightFace Python script** — `scripts/match-photos.py` exists for post-event batch face matching using the `buffalo_l` model. Requires Python + insightface installed separately

### Uncommitted Utility Scripts

- `scripts/clear-attendees.js` and `scripts/list-attendees.js` are useful for testing but destructive (clear) — decide whether to commit

---

## Key File Paths (Quick Reference)

| Area | Path |
|------|------|
| Firebase client init | `lib/firebase/client.ts` |
| Firebase admin init | `lib/firebase/admin.ts` |
| Auth helpers | `lib/auth-helpers.ts` |
| Type definitions | `lib/types.ts` |
| Apple Wallet generation | `lib/passes/apple.ts` |
| Google Wallet generation | `lib/passes/google.ts` |
| Face detection | `lib/face/detect.ts` |
| Offline DB schema | `lib/offline/db.ts` |
| Offline sync logic | `lib/offline/sync.ts` |
| Audit logging | `lib/audit.ts` |
| PIN generation | `lib/pin.ts` |
| QR generation | `lib/qr.ts` |
| Email templates | `lib/email/resend.ts` |
| Rate limiting middleware | `middleware.ts` |
| Service Worker | `public/sw.js` |
| PWA manifest | `public/manifest.json` |
| Apple pass template | `public/passModels/desrangila.pass/` |
| Face-api.js models | `public/models/` |
| Firestore security rules | `firestore.rules` |
| Design document | `des_rangila_digital_passport_design_document.md` |
| Implementation summary | `pre-plug-n-play-summary.md` |

---

## Setup for New Session

```bash
nvm use 20
npm install
npm run dev    # localhost:3000
```

Ensure `.env.local` has all required variables (see section above). The app will build without them (lazy init) but features won't work at runtime.

**Build check:**
```bash
npm run build  # Should produce 36 routes, 0 errors, 1 harmless face-api.js warning
```

---

## What Remains (Event Prep)

- [ ] Import final attendee list (CSV)
- [ ] Seed production station + inventory data
- [ ] Send wallet passes to all attendees (bulk email)
- [ ] Recruit + register volunteers, assign stations
- [ ] Field-test QR scanning outdoors on real devices
- [ ] Verify Apple + Google Wallet passes on real phones
- [ ] Test offline redemption → online sync flow
- [ ] Prepare for walk-in registration at the event
- [ ] Plan post-event: batch face matching, send memories email
