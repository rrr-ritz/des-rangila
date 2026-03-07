# Des Rangila Digital Passport — Complete Build Summary

## Project Overview
Event tech platform for UMD ISA's "Tour of India" festival (April 11, 2026, McKeldin Mall, ~200 attendees). Replaces paper stamp cards with QR-based digital passes. Built as a full-stack Next.js web app deployable on Vercel.

## Tech Stack
- **Framework:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui (new-york style)
- **Backend:** Firebase (Firestore, Auth, Cloud Storage) with lazy initialization (Proxy pattern for admin SDK, getter functions for client SDK) so the app builds without credentials
- **Runtime:** Node v20.20.0 via nvm (`nvm use 20` required before npm commands)
- **Packages:** `qr-scanner`, `qrcode`, `idb`, `passkit-generator`, `google-auth-library`, `resend`, `@vladmandic/face-api`

## Build Status
- **36 pages** (12 static + 24 dynamic routes), **0 build errors**
- Only warning: harmless face-api.js dynamic `require` (upstream issue)
- All 11 phases from the design doc are **code-complete**

---

## Phase-by-Phase Breakdown

### Phase 1 — Project Init & Auth
- Next.js 14 project with Tailwind, shadcn/ui, indigo/amber theming
- Firebase client config (`lib/firebase/client.ts`) and admin config (`lib/firebase/admin.ts`)
- 7 Firestore types defined in `lib/types.ts` (Attendee, Station, Volunteer, Redemption, InventoryItem, AuditEntry, Photo)
- Firestore security rules
- `AuthProvider` context wrapping the entire app
- Admin layout (`app/admin/layout.tsx`) with auth guard + sidebar with 8 nav items (Overview, Attendees, Stations, Inventory, Volunteers, Photos, Face Match, Audit Log)
- Admin login page (`app/admin/login/page.tsx`)

### Phase 2 — Attendee Data & Pass Distribution
- **PIN/QR generation:** `lib/pin.ts` (cryptographic 6-digit PIN, `DR-` prefixed 8-char QR payload), `lib/qr.ts` (PNG generation via `qrcode`)
- **CSV import endpoint:** `POST /api/attendees/import` — parses CSV, generates PINs/QR payloads, batch-writes to Firestore
- **Attendee API routes:** `GET /api/attendees` (list), `GET /api/attendees/[id]` (by ID), `GET /api/attendees/by-qr/[qr]`, `GET /api/attendees/by-pin/[pin]`, `POST /api/attendees/sync`, `POST /api/attendees/[id]/check-in`
- **Admin attendees page** (`app/admin/attendees/page.tsx`) with CSV importer UI
- **Pass distribution page** (`app/pass/[qrPayload]/page.tsx`) — server-rendered, shows attendee name, QR code image, PIN, platform-detected wallet buttons (Apple on iOS, Google on Android)
- **QR image API:** `GET /api/qr/[payload]` — generates PNG on-demand with 24h cache

### Phase 3 — Volunteer & Scanning System
- **Volunteer registration:** SMS auth flow (`app/volunteer/register/page.tsx`), `POST /api/volunteers/register`, `GET /api/volunteers`, `PATCH /api/volunteers/[id]/station`
- **QR scanner component** (`components/scanner/QRScanner.tsx`) — uses `qr-scanner` npm library, rear camera, QR validation
- **Scan page** (`app/scan/page.tsx`) — station picker (16 stations), scanner, result overlay, redemption flow
- **Scan result component** (`components/scanner/ScanResult.tsx`) — attendee info display, activity/food status, redeem buttons
- **Offline banner** (`components/scanner/OfflineBanner.tsx`) — online/offline status indicator
- **Redemption endpoint:** `POST /api/redemptions` — idempotency keys, Firestore transactions, prevents double-redemption, enforces food limits, decrements inventory, triggers low-stock/depletion alerts
- **Redemption query routes:** `GET /api/redemptions/by-attendee/[id]`, `GET /api/redemptions/by-station/[id]`, `GET /api/redemptions/recent`
- **Inventory routes:** `GET /api/inventory`, `PATCH /api/inventory/[id]`, `POST /api/inventory/sync`
- **Audit logging:** `lib/audit.ts` — `logAction()` appends to `audit_log` collection (append-only)
- **Auth middleware:** `lib/auth-helpers.ts` — `verifyAuth(request, role)` with `public`, `volunteer`, `admin` roles

### Phase 4 — Offline Infrastructure (PWA)
- **IndexedDB schema** (`lib/offline/db.ts`) — 4 stores: `attendees` (indexed by qrPayload, pin), `stations`, `inventory` (indexed by stationId), `redemption_queue` (with synced flag). CRUD functions for each store.
- **Data sync** (`lib/offline/sync.ts`) — `syncAttendees()`, `syncStations()` (hardcoded fallback), `syncInventory()`, `flushRedemptionQueue()` (idempotent — 200 or 409 both count as synced), `fullSync()`
- **useSync hook** (`lib/offline/use-sync.ts`) — online/offline listeners, 5-minute full sync interval, 10-second flush interval (iOS fallback), queue length polling
- **Service worker** (`public/sw.js`) — precaches static routes, network-first for API (3s timeout then cache fallback), cache-first for static assets
- **PWA manifest** (`public/manifest.json`) — standalone display mode, indigo theme
- **ServiceWorkerProvider** (`components/providers/ServiceWorkerProvider.tsx`) — auto-registers SW on mount
- **PWA icon** (`public/icons/icon.svg`) — placeholder

### Phase 5 — Wallet Passes (Apple + Google)
- **Apple Wallet library** (`lib/passes/apple.ts`) — `passkit-generator` PKPass generation with QR barcode, primary/secondary/auxiliary/back fields, web service URL for live updates. `generateApplePass(data)` returns Buffer. `isAppleWalletConfigured()` guard.
- **Google Wallet library** (`lib/passes/google.ts`) — `google-auth-library` + `jsonwebtoken` for JWT signing. `ensureWalletClass()`, `createWalletObject()`, `updateWalletStamps()`, `generateSaveUrl()`. Save URL uses JWT with genericObjects payload.
- **Apple pass template** (`public/passModels/desrangila.pass/pass.json`) — format version 1, indigo background, white foreground
- **API routes:**
  - `GET /api/passes/apple/[qr]` — generates and serves `.pkpass` file (Buffer to Uint8Array for NextResponse compatibility)
  - `GET /api/passes/google/[qr]` — generates save URL and redirects
  - `POST /api/passes/send/[id]` — emails pass link to single attendee (admin auth)
  - `POST /api/passes/send-all` — bulk email to all unsent attendees (admin auth, supports `?force=true`, `?dryRun=true`, batches of 5 with 500ms delays)
- **Apple Wallet Web Service (5 endpoints for live pass updates):**
  - `POST /api/apple-wallet/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]` — register device
  - `DELETE` same path — unregister device
  - `GET /api/apple-wallet/v1/devices/[deviceId]/registrations/[passTypeId]` — list passes needing update (supports `?passesUpdatedSince=` tag)
  - `GET /api/apple-wallet/v1/passes/[passTypeId]/[serialNumber]` — serve latest pass version
  - `POST /api/apple-wallet/v1/log` — device error logging

### Phase 6 — Admin Dashboard
- **Dashboard components:** KPICards, StationGrid, ActivityFeed, InventoryGauge, NotificationBell
- **Admin pages (full UI):**
  - `app/admin/page.tsx` — Overview: KPI cards, station grid, activity feed, notifications. Auto-refreshes every 30s.
  - `app/admin/stations/page.tsx` — Station table: 16 hardcoded stations with type icons, active/inactive toggle
  - `app/admin/inventory/page.tsx` — Inventory gauges, summary cards (total/low stock/depleted), manual adjustment dialog (plus/minus 10)
  - `app/admin/volunteers/page.tsx` — Volunteer table with role badges, station assignments
  - `app/admin/audit-log/page.tsx` — Searchable/filterable audit log: text search + action type + severity dropdowns
  - `app/admin/photos/page.tsx` — Photo gallery grid with stats cards, lightbox
- **Admin API routes:** `GET /api/admin/stats`, `GET /api/admin/audit-log`

### Phase 7 — Photo Booth
- **BoothCamera** (`components/booth/BoothCamera.tsx`) — `getUserMedia` front-facing camera, 3-2-1 countdown, flash effect, mirrored preview, captures at 600x450
- **PhotoStrip** (`components/booth/PhotoStrip.tsx`) — Canvas API compositing: dark header, white-bordered photos, ISA branding footer. Generates thumbnail at 400px wide.
- **AttendeeScanner** (`components/booth/AttendeeScanner.tsx`) — PIN-based attendee identification, multi-person support
- **Booth page** (`app/booth/page.tsx`) — full flow: start, identify, count (1-4 photos), capture, preview, save, done
- **Photo upload API** (`POST /api/photos/upload`) — FormData handler, uploads strip + thumbnail + individual photos to Firebase Storage, creates Firestore document. Auto-approves booth photos.

### Phase 8 — Attendee Portal
- **Attendee portal** (`app/me/page.tsx`) — PIN entry with numpad, stamp passport (16-station grid showing visited/unvisited), photo gallery with lightbox
- **Photo query API:** `GET /api/photos/by-attendee/[id]`

### Phase 9 — Email System
- **Email library** (`lib/email/resend.ts`) — Resend SDK with lazy client init. Two HTML email templates:
  - `sendPassEmail()` — Pass distribution: greeting, event details, large monospace PIN, QR code image, "Add to Wallet" button, portal link. Indigo-themed HTML.
  - `sendPostEventEmail()` — Post-event memories: thank you, stamp stats with emoji tiers, photo gallery CTA, PIN reminder, 30-day expiry note.
  - `isEmailConfigured()` guard.
- **API routes:**
  - `POST /api/passes/send/[id]` — send pass email to one attendee (admin auth, marks `passEmailSentAt`)
  - `POST /api/passes/send-all` — bulk send (admin auth, batches of 5, supports `?force=true`, `?dryRun=true`)
  - `POST /api/email/post-event` — send post-event memories (admin auth, supports `attendeeIds[]` filter, `dryRun`, sends to all checked-in attendees by default)

### Phase 10 — Face Recognition
- **Face detection library** (`lib/face/detect.ts`) — lazy-loads `@vladmandic/face-api`. Functions: `loadModels()`, `extractDescriptor(input)` (128-dim Float32Array), `extractAllDescriptors(input)`, `compareDescriptors(a, b)` (Euclidean distance), `findBestMatch(descriptor, attendeeDescriptors)` (threshold 0.6)
- **Model files** downloaded to `public/models/`: `ssd_mobilenetv1_model` (5.4MB), `face_recognition_model` (6.1MB), `face_landmark_68_model` (348KB)
- **Components:**
  - `SelfieCapture` — 5-step flow: consent, camera, processing, done/error. Oval face guide overlay.
  - `BatchUploader` — multi-file upload + process pipeline with per-file progress
  - `MatchReview` — pending matches list with photo preview, confidence badge, approve/reject/bulk-approve
- **API routes:**
  - `POST /api/attendees/[id]/face` — store 128-element face descriptor on attendee doc (volunteer auth)
  - `POST /api/photos/face-match` — receives detected faces, compares against all attendee descriptors server-side, creates `face_match_queue` docs (admin auth)
  - `GET /api/photos/face-match/queue` — list pending/approved/rejected matches (admin auth)
  - `PATCH /api/photos/face-match/[id]` — approve (links photo to attendee via arrayUnion) or reject (admin auth)
- **Admin page** (`app/admin/face-recognition/page.tsx`) — tabs for "Upload & Process" and "Review Matches"

### Phase 11 — Polish & Hardening
- **Rate limiting** (`middleware.ts`) — in-memory per-IP buckets with per-route configs: PIN 5/min, photo upload 10/min, import 1/min, general API 60/min. Returns 429 with Retry-After header. Uses `rateLimitStore.forEach()` for cleanup (not `for...of`, which caused a downlevelIteration error).
- **Loading states:** `app/admin/loading.tsx` (skeleton), `app/scan/loading.tsx`, `app/me/loading.tsx`, `app/booth/loading.tsx` (spinners)
- **Error boundaries:** `app/error.tsx`, `app/admin/error.tsx` — AlertTriangle icon + retry button
- **404 page:** `app/not-found.tsx` — links to Home and My Passport
- **Accessibility:** Skip-nav link, ARIA labels on sidebar/nav/buttons, 44px+ touch targets, `role="form"` on PIN entry
- **Redemption error handling:** try/catch around `request.json()`, validation-aware status codes (409 for known errors, 500 for unknown)
- **Privacy policy:** `app/privacy/page.tsx`

---

## QR Scanning Performance Optimizations

All 8 optimizations from Section 5.2 of the updated design doc were applied:

1. **720p camera resolution** — `track.applyConstraints({ width: { ideal: 1280 }, height: { ideal: 720 } })` after camera starts. Less pixels = faster QR decode.
2. **15 FPS scan rate** — `maxScansPerSecond: 15` (was 10). Fast enough for near-instant detection, conserves battery over 3+ hours.
3. **Always-on scanning with auto-resume** — Scanner never stops while mounted. Uses refs for `paused`/`onScan` so the scanner instance is never recreated. ScanResult renders as an overlay (`absolute inset-0 bg-black/70 backdrop-blur-sm`) on top of the running camera. Success auto-dismisses after 3s, scanner immediately resumes. No tap required.
4. **Autofocus locking** — Checks `track.getCapabilities().focusMode` for `"manual"`, locks `focusDistance` to 0.3m (typical QR scanning distance). Falls back gracefully if unsupported (only Chrome on Android supports this).
5. **Instant haptic feedback** — `navigator.vibrate(100)` fires inside the qr-scanner callback, before `onScan` is even called. Volunteer feels vibration within ~100ms of QR entering frame.
6. **Sunlight-visible border flash** — Full-screen `border-[6px]` flash: green on decode, red on not-found. Uses `shadow-[inset_0_0_40px_...]` glow. "Not found" state shows a red overlay with 80px XCircle icon, auto-dismisses after 2s.
7. **Success/error states** — Success: solid green background, 96px white CheckCircle with `pop-in` CSS animation, `navigator.vibrate(200)`. Error: solid red background, 96px XCircle, `navigator.vibrate([50, 50, 50])` (double-tap pattern). Optional success sound (Web Audio API 880Hz beep, off by default, toggled via Volume icon in header, persisted in localStorage).
8. **IndexedDB-first lookup** — `getAttendeeByQr(payload)` from local IndexedDB cache before any network call (sub-50ms). Falls back to API only if not found locally. After successful redemption, `updateCachedAttendee()` updates stamps/food count in IndexedDB for subsequent scans.

Additional scanning changes:
- **5-second dedup window** — prevents re-scanning same QR payload within 5 seconds (avoids re-triggering when same code is still in frame after overlay dismisses)
- **Sound toggle** — Volume2/VolumeX icon in scan page header, state persisted in localStorage
- **48px touch targets** — all buttons in ScanResult use `min-h-[48px]` for outdoor usability

---

## Key Patterns & Architecture

- **Auth:** `AuthProvider` context wraps entire app; admin layout has auth guard; API routes use `verifyAuth(request, role)`
- **Audit:** `logAction()` in `lib/audit.ts` — append-only `audit_log` collection with action, actor, target, severity, timestamp
- **Rate limiting:** `middleware.ts` with in-memory Map, per-route configs, per-IP buckets, 429 response with Retry-After
- **Offline:** IndexedDB (`idb`) + service worker + `useSync` hook (5min full sync, 10s flush for iOS)
- **Face detection:** Client-side via `@vladmandic/face-api`, 128-dim descriptors sent to server for Euclidean distance matching
- **Email:** Resend SDK with lazy client init, HTML email templates with indigo theming
- **Wallet passes:** Apple via `passkit-generator` (Buffer to Uint8Array for NextResponse), Google via JWT save URLs
- **Firebase lazy init:** Proxy pattern for admin SDK, getter functions for client SDK — prevents build crashes when env vars are empty

## Build Errors Encountered & Resolved

1. **IndexedDB `getAllFromIndex` with boolean** — `false` not assignable to IDBKeyRange. Fixed: `getAll()` + `.filter()`.
2. **Map iteration (`for...of`)** — downlevelIteration error. Fixed: `rateLimitStore.forEach()`.
3. **Unused variable** — ESLint doesn't allow `_prefix` convention. Fixed: removed parameter entirely.
4. **face-api.js model files** — GitHub URLs used shard filenames (404). Fixed: correct `.bin` filenames.
5. **Buffer type in NextResponse** — Buffer not assignable to BodyInit. Fixed: `new Uint8Array(passBuffer)`.
6. **themeColor metadata** — moved from `metadata` export to separate `viewport` export.

---

## What's Needed to Go Live (Plug & Play)

### 1. Firebase (~15 min)
Create project, enable Auth (email/password + phone), Firestore, Cloud Storage. Copy credentials to `.env.local`.

### 2. Resend (~5 min)
Sign up at resend.com, get API key, verify sending domain. Set `RESEND_API_KEY` and `EMAIL_FROM`.

### 3. Google Wallet (~20 min)
Enable Google Wallet API, create issuer account, generate service account key. Set `GOOGLE_WALLET_*` env vars. Free.

### 4. Apple Wallet (~30-45 min)
Apple Developer account ($99/yr), Pass Type ID cert, WWDR cert. Set `APPLE_*` env vars + cert paths.

### 5. Deploy
`vercel --prod` or connect Git repo to Vercel.

The core system (scanning, stamps, photo booth, attendee portal) only needs Firebase. Everything else is additive.

---

## File Tree (Key Files)

```
app/
  admin/
    layout.tsx              # Auth guard + sidebar (8 nav items)
    page.tsx                # Overview dashboard
    login/page.tsx          # Admin login
    attendees/page.tsx      # CSV import + attendee table
    stations/page.tsx       # 16-station table
    inventory/page.tsx      # Inventory gauges + adjustment
    volunteers/page.tsx     # Volunteer table
    photos/page.tsx         # Photo gallery
    face-recognition/page.tsx  # Face match admin
    audit-log/page.tsx      # Searchable audit log
    loading.tsx             # Skeleton loader
    error.tsx               # Error boundary
  scan/
    page.tsx                # Volunteer scanning interface
    loading.tsx
  me/
    page.tsx                # Attendee portal (PIN entry + stamps + photos)
    loading.tsx
  booth/
    page.tsx                # Photo booth flow
    loading.tsx
  pass/[qrPayload]/page.tsx  # Pass distribution page
  volunteer/register/page.tsx # Volunteer registration
  privacy/page.tsx          # Privacy policy
  error.tsx                 # Global error boundary
  not-found.tsx             # 404 page
  layout.tsx                # Root layout (AuthProvider, SW, manifest)

  api/
    attendees/              # CRUD + CSV import + sync + check-in + face
    redemptions/            # Create + query by attendee/station/recent
    inventory/              # List + update + sync
    volunteers/             # List + register + assign station
    passes/
      apple/[qr]/           # Generate .pkpass
      google/[qr]/          # Generate save URL + redirect
      send/[id]/            # Email pass to one attendee
      send-all/             # Bulk email passes
    apple-wallet/v1/        # 5 Apple Wallet web service endpoints
    email/post-event/       # Post-event memories email
    photos/
      upload/               # Photo booth upload
      by-attendee/[id]/     # Query photos
      face-match/           # Trigger + queue + approve/reject
    qr/[payload]/           # QR code PNG generation
    admin/
      stats/                # Dashboard KPIs
      audit-log/            # Audit log query

components/
  scanner/
    QRScanner.tsx           # Always-on QR scanner (720p, 15fps, haptic, autofocus)
    ScanResult.tsx          # High-contrast result overlay (outdoor-optimized)
    OfflineBanner.tsx       # Online/offline indicator
  booth/
    BoothCamera.tsx         # Camera with countdown + flash
    PhotoStrip.tsx          # Canvas compositing
    AttendeeScanner.tsx     # PIN-based ID
  face/
    SelfieCapture.tsx       # Consent + capture + descriptor extraction
    BatchUploader.tsx       # Multi-file upload + face processing
    MatchReview.tsx         # Approve/reject face matches
  dashboard/
    KPICards.tsx
    StationGrid.tsx
    ActivityFeed.tsx
    InventoryGauge.tsx
    NotificationBell.tsx
  attendee/
    PINEntry.tsx            # Accessible numpad
  providers/
    AuthProvider.tsx        # Firebase auth context
    ServiceWorkerProvider.tsx
  shared/
    EventHeader.tsx
    LoadingSpinner.tsx
  ui/                       # shadcn/ui components

lib/
  firebase/
    admin.ts                # Lazy-init admin SDK (Proxy pattern)
    client.ts               # Lazy-init client SDK
  offline/
    db.ts                   # IndexedDB schema + CRUD
    sync.ts                 # Full sync + flush queue
    use-sync.ts             # React hook
  passes/
    apple.ts                # Apple Wallet .pkpass generation
    google.ts               # Google Wallet JWT save URLs
  email/
    resend.ts               # Resend SDK + HTML templates
  face/
    detect.ts               # face-api.js detection + matching
  types.ts                  # 7 Firestore types
  pin.ts                    # PIN/QR payload generation
  qr.ts                     # QR code PNG generation
  audit.ts                  # Audit logging
  auth-helpers.ts           # API auth middleware
  utils.ts                  # shadcn cn() utility

middleware.ts               # Rate limiting (per-route, per-IP)

public/
  sw.js                     # Service worker
  manifest.json             # PWA manifest
  icons/icon.svg            # Placeholder icon
  models/                   # face-api.js model files (3 models)
  passModels/               # Apple Wallet pass template
```
