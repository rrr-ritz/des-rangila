# Des Rangila Digital Passport System — Technical Design Document

**Project:** Des Rangila Event Tech Platform
**Author:** Ritvik (ISA Historian / Photographer / Software Engineer)
**Event Date:** Saturday, April 11, 2026, 5:00 PM – 8:00 PM
**Location:** McKeldin Mall East, University of Maryland, College Park
**Expected Attendees:** ~200
**Version:** 1.0

---

## 1. Project Overview

### 1.1 What Is Des Rangila?

Des Rangila is a mela/bazaar-style "Tour of India" festival hosted by UMD's Indian Student Association on McKeldin Mall. Sixteen tables encircle the central fountain, each representing a region of India with culturally-relevant activities (hair clip making, block printing, dandiya making, polaroid photo booth, henna, pookalam/flower rangoli) and/or regional food (mango lassi, vada pav, chai, momos, biryani, idli, uthappam). A stage hosts dance and music performances throughout the evening by campus organizations (Manzar, Dhoom, Bhangra, Moksha, Anokha, etc.).

Attendees purchase $7–$10 tickets via DoorList, which entitle them to table experiences, set servings of food items, photo booth access, and more.

### 1.2 What Is the Digital Passport System?

A custom-built event tech platform that replaces paper stamp cards, manual head-counts, and disconnected photo workflows with a unified digital experience. The system has three user classes:

1. **Attendees** — Receive a digital wallet pass (Apple Wallet or Google Wallet) containing a unique QR code and PIN. They scan in at tables to redeem activities/food, take photo booth photos linked to their profile, and access all their event memories via a lightweight web portal.
2. **Volunteers** — ISA board members and trusted helpers who staff the 16 tables. They use a browser-based scanning PWA on their personal phones to scan attendee QR codes and process redemptions. They self-select their station and can switch freely.
3. **Admins** — ISA executive board members (Ritvik, Dhruv, Shreya, and others) who monitor the entire event in real-time: attendance, food inventory, table activity, scan logs, photos, and anomalies. All significant volunteer/system actions trigger admin notifications.

### 1.3 Core Design Principle

**Technology is invisible.** Attendees should remember the food, the performances, the culture, and the joy — not the app. Every UX decision optimizes for minimal friction, zero confusion, and delight. If an interaction takes more than 3 seconds or requires explanation, it's too complex.

### 1.4 Design Aesthetic

Modern, sleek, clean but not sterile or corporate. Inviting but minimalistic and highly functional. The visual design system (colors, typography, branding, cultural motifs) will be provided separately by the ISA design/PR team. The codebase should use a theming system (CSS custom properties or Tailwind config) that makes it trivial to apply the event's brand identity later.

---

## 2. System Architecture

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL (Hosting)                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                   Next.js Application                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ │  │
│  │  │ Attendee │ │ Volunteer│ │  Admin   │ │  Photo Booth│ │  │
│  │  │  Portal  │ │ Scanner  │ │Dashboard │ │   Web App   │ │  │
│  │  │  (PWA)   │ │  (PWA)   │ │  (SSR)   │ │   (PWA)     │ │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘ │  │
│  │       │             │            │               │        │  │
│  │  ┌────┴─────────────┴────────────┴───────────────┴─────┐  │  │
│  │  │              Next.js API Routes                      │  │  │
│  │  │  /api/attendees, /api/redemptions, /api/photos,     │  │  │
│  │  │  /api/passes, /api/admin, /api/import, /api/scan    │  │  │
│  │  └────┬─────────────┬────────────┬───────────────┬─────┘  │  │
│  └───────┼─────────────┼────────────┼───────────────┼────────┘  │
└──────────┼─────────────┼────────────┼───────────────┼───────────┘
           │             │            │               │
    ┌──────┴──────┐ ┌────┴────┐ ┌────┴────┐  ┌───────┴───────┐
    │  Firebase   │ │Firebase │ │Firebase │  │   External    │
    │  Firestore  │ │  Auth   │ │ Storage │  │   Services    │
    │  (Database) │ │ (SMS +  │ │ (Photos)│  │               │
    │             │ │ Email)  │ │         │  │ • Apple Wallet│
    │ • attendees │ │         │ │ • booth │  │   (PassKit)   │
    │ • stations  │ │ • phone │ │ • event │  │ • Google      │
    │ • redemptn  │ │   auth  │ │ • faces │  │   Wallet API  │
    │ • photos    │ │ • email │ │         │  │ • face-api.js │
    │ • inventory │ │   auth  │ │         │  │   (post-event)│
    │ • audit_log │ │         │ │         │  │               │
    └─────────────┘ └─────────┘ └─────────┘  └───────────────┘
```

### 2.2 Tech Stack

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| **Framework** | Next.js (App Router) | 14+ | Unified frontend + API routes in one codebase, SSR for admin, excellent TypeScript support |
| **Language** | TypeScript | 5.x | Type safety across the entire codebase, better IDE support, fewer runtime bugs |
| **Hosting** | Vercel | — | Free tier: 100GB bandwidth, auto-HTTPS, zero-config deploys, edge functions |
| **Database** | Firebase Firestore | v9+ | Free tier: 50K reads/day, 20K writes/day; real-time listeners; no connection limit on Spark plan |
| **Auth** | Firebase Authentication | v9+ | Built-in phone (SMS) auth for volunteers; email/password for admins; free tier: 10K SMS verifications/month |
| **Storage** | Firebase Cloud Storage | v9+ | Free tier: 5GB; stores compressed event photos; integrated with Firebase Auth for security rules |
| **QR Scanning** | qr-scanner (nimiq) | 1.4+ | 16KB gzipped, Web Worker decoding, highest detection rate, auto-uses native BarcodeDetector API |
| **QR Generation** | qrcode (npm) | 1.5+ | Generates QR code images for passes and fallback display |
| **Apple Wallet** | passkit-generator (npm) | — | MIT-licensed Node.js library for creating signed .pkpass files |
| **Google Wallet** | Google Wallet REST API | v1 | Free, real-time updates via PATCH, JWT-based pass creation |
| **Offline** | Workbox + idb | 7.x / 8.x | Google's production Service Worker toolkit + lightweight IndexedDB wrapper |
| **Photo Booth** | getUserMedia + Canvas API | — | Browser-native camera access and image compositing |
| **Face Recognition** | @vladmandic/face-api | — | MIT-licensed, runs server-side, 99.38% accuracy on LFW benchmark |
| **Image Processing** | Sharp (npm) | 0.33+ | High-performance Node.js image resizing/compression |
| **UI Components** | Tailwind CSS + shadcn/ui | 3.x / latest | Utility-first CSS + accessible pre-built components; easy theming via CSS custom properties |
| **Charts** | Recharts | 2.x | Lightweight React charting for admin dashboard |
| **Notifications** | Firebase Cloud Messaging | v9+ | Push notifications to admin devices for real-time alerts |

### 2.3 Environment & Configuration

Use environment variables (`.env.local` for development, Vercel environment variables for production):

```
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_SERVICE_ACCOUNT_KEY=     # JSON, server-side only

# Apple Wallet
APPLE_PASS_TYPE_IDENTIFIER=       # e.g., pass.edu.umd.isa.desrangila
APPLE_TEAM_IDENTIFIER=            # Apple Developer Team ID
APPLE_WWDR_CERT_PATH=             # Path to Apple WWDR certificate
APPLE_PASS_CERT_PATH=             # Path to Pass Type ID certificate
APPLE_PASS_CERT_PASSWORD=         # Certificate password

# Google Wallet
GOOGLE_WALLET_ISSUER_ID=          # From Google Pay & Wallet Console
GOOGLE_WALLET_SERVICE_ACCOUNT=    # JSON service account key
GOOGLE_WALLET_CLASS_ID=           # e.g., desrangila_2026

# App
NEXT_PUBLIC_APP_URL=              # e.g., https://desrangila.app
ADMIN_EMAILS=                     # Comma-separated admin emails
```

---

## 3. Data Models (Firestore)

### 3.1 Collection: `attendees`

Document ID: Auto-generated Firestore ID

```typescript
interface Attendee {
  id: string;                    // Firestore doc ID
  pin: string;                   // 6-digit numeric PIN, unique
  qrPayload: string;             // Opaque string encoded in QR: "DR-{8-char-alphanumeric}"
  name: string;                  // Full name
  email: string;                 // Email address
  ticketTier: 'general' | 'vip'; // Maps to different redemption allowances
  checkedIn: boolean;            // Whether they've been scanned at the registration table
  checkedInAt: Timestamp | null; // When they checked in
  faceDescriptor: number[] | null; // 128-dimensional face vector, null until selfie taken at check-in
  faceConsentGiven: boolean;     // Whether they opted in to face recognition
  stampsCollected: string[];     // Array of station IDs they've visited
  totalFoodRedemptions: number;  // Running count of food items redeemed
  maxFoodRedemptions: number;    // Limit based on ticket tier (e.g., general=5, vip=10)
  walletPassGenerated: boolean;  // Whether a pass has been generated
  walletPassType: 'apple' | 'google' | 'web' | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Indexes required:**
- `pin` (unique — enforce in application logic since Firestore doesn't support unique constraints natively; use a transaction to check-then-write)
- `qrPayload` (unique, same approach)
- `email` (for deduplication during import)

### 3.2 Collection: `stations`

Document ID: Slug string (e.g., `jammu-kashmir`, `punjab`, `west-bengal`)

```typescript
interface Station {
  id: string;                    // Slug: "jammu-kashmir", "punjab", etc.
  name: string;                  // Display name: "Jammu & Kashmir + Ladakh"
  region: string;                // Geographic region of India
  type: 'activity' | 'food' | 'both' | 'registration' | 'photo-booth';
  activityName: string | null;   // e.g., "Hair Clip Making", "Block Printing"
  foodItem: string | null;       // e.g., "Mango Lassi Shots", "Vada Pav"
  tableNumber: number;           // Physical table number (1-16)
  order: number;                 // Display order in UI
  isActive: boolean;             // Can be toggled off if a station closes
}
```

### 3.3 Collection: `inventory`

Document ID: `{stationId}_{itemSlug}` (e.g., `punjab_mango-lassi`)

```typescript
interface InventoryItem {
  id: string;
  stationId: string;             // Reference to station
  itemName: string;              // "Mango Lassi Shots"
  itemType: 'food' | 'activity-supply'; // Food items are consumable
  initialCount: number;          // Starting quantity
  remainingCount: number;        // Current quantity (decremented on redemption)
  unit: string;                  // "servings", "pieces", "sets"
  lowStockThreshold: number;     // Trigger admin alert when remaining <= this
  depletedAt: Timestamp | null;  // When it hit zero
}
```

### 3.4 Collection: `redemptions`

Document ID: Auto-generated. **Critical: enforce uniqueness of (attendeeId, stationId, itemType) in application logic using a Firestore transaction.**

```typescript
interface Redemption {
  id: string;
  attendeeId: string;            // Reference to attendee
  attendeeName: string;          // Denormalized for quick display in logs
  stationId: string;             // Reference to station
  stationName: string;           // Denormalized
  itemType: string;              // "activity" or specific food item slug
  volunteerId: string;           // Who processed this redemption
  volunteerName: string;         // Denormalized
  timestamp: Timestamp;
  syncedFromOffline: boolean;    // Whether this was queued offline and synced later
  idempotencyKey: string;        // Client-generated UUID to prevent duplicate submissions
}
```

### 3.5 Collection: `volunteers`

Document ID: Auto-generated

```typescript
interface Volunteer {
  id: string;
  uid: string;                   // Firebase Auth UID (from phone auth)
  name: string;
  phone: string;                 // Phone number used for SMS auth
  role: 'volunteer' | 'admin';
  currentStationId: string | null; // Which station they're currently assigned to
  isActive: boolean;             // Whether they're currently "on duty"
  createdAt: Timestamp;
}
```

### 3.6 Collection: `photos`

Document ID: Auto-generated

```typescript
interface Photo {
  id: string;
  attendeeIds: string[];         // Array — a photo can contain multiple attendees
  stationId: string | null;      // Which photo booth station, or null for photographer photos
  photoType: 'booth' | 'photographer' | 'event';
  storageUrl: string;            // Firebase Storage download URL
  thumbnailUrl: string;          // Smaller version for gallery views
  stripUrl: string | null;       // Photo strip composite (for booth photos)
  width: number;
  height: number;
  takenAt: Timestamp;
  uploadedAt: Timestamp;
  faceMatchConfidence: number | null;  // For photographer photos matched via face recognition
  approved: boolean;             // Whether attendee approved (booth photos)
}
```

### 3.7 Collection: `audit_log`

Document ID: Auto-generated. **This is append-only — never update or delete entries.**

```typescript
interface AuditLogEntry {
  id: string;
  action: string;                // e.g., "redemption.created", "volunteer.station_changed",
                                 //       "attendee.checked_in", "inventory.low_stock",
                                 //       "inventory.depleted", "photo.uploaded",
                                 //       "admin.import_attendees", "system.error"
  actorId: string;               // Who performed the action (volunteer/admin ID, or "system")
  actorName: string;
  actorRole: 'volunteer' | 'admin' | 'system';
  targetId: string | null;       // What was affected (attendee ID, station ID, etc.)
  targetType: string | null;     // "attendee", "station", "inventory", etc.
  details: Record<string, any>;  // Flexible metadata (e.g., { stationId: "punjab", itemType: "food" })
  severity: 'info' | 'warning' | 'error';
  timestamp: Timestamp;
  notifyAdmins: boolean;         // Whether this should trigger a push notification
}
```

---

## 4. User Flows

### 4.1 Attendee Journey (End-to-End)

```
BEFORE EVENT (days/weeks prior):
1. Attendee purchases ticket on DoorList ($7-$10)
2. Admin exports attendee CSV from DoorList
3. Admin uploads CSV to admin dashboard → system generates:
   - Unique 6-digit PIN
   - Unique QR payload string (DR-xxxxxxxx)
   - QR code image
4. System sends email to each attendee with:
   - Personalized pass link: https://desrangila.app/pass/{qrPayload}
   - Their PIN for quick access
5. Attendee visits link → detects platform:
   - iPhone → "Add to Apple Wallet" button → .pkpass downloads → opens in Wallet
   - Android → "Add to Google Wallet" button → redirects to Google save URL
   - Other → QR code + PIN displayed on page, with "Add to Home Screen" prompt

EVENT DAY:
6. Attendee arrives at McKeldin Mall → goes to Registration Table (Table 16 or dedicated)
7. Registration volunteer scans their QR code → system marks as checked in
8. (Optional, opt-in) Attendee takes a quick selfie on the check-in tablet → face descriptor stored
9. Attendee walks around the mall, visiting tables:
   a. Approaches a table → shows wallet pass QR code
   b. Volunteer scans QR → sees attendee info + available items
   c. Volunteer taps to redeem → attendee gets the food/activity
   d. Wallet pass updates with new stamp (Google Wallet: instant; Apple Wallet: near-real-time)
10. Attendee visits Photo Booth station(s):
    a. Scans QR code at the booth tablet to identify themselves
    b. Takes photos → reviews → approves favorites
    c. Photos immediately appear in their personal gallery
11. Event photographers take candid photos throughout (linking happens post-event via face recognition)

AFTER EVENT:
12. Attendee visits https://desrangila.app/me → enters PIN
13. Sees: stamp passport (which tables visited), photo gallery (booth + photographer photos), event memories
14. Can download individual photos or entire gallery
15. Data retained for 30 days, then purged
```

### 4.2 Volunteer Flow

```
SETUP (before event):
1. Admin shares volunteer signup link
2. Volunteer visits link → enters phone number → receives SMS code → verifies
3. Volunteer enters their name → selects their station from dropdown
4. Account created → they bookmark/install the scanner PWA

EVENT DAY:
5. Volunteer opens scanner PWA → authenticates (session persists)
6. Scanner interface shows:
   - Their current station name and info at the top
   - Live camera viewfinder (QR scanning active)
   - "Change Station" button (settings/gear icon)
7. Attendee shows QR code → volunteer points phone camera at it
8. QR decoded → screen shows:
   ┌─────────────────────────────┐
   │  ✓ Sarah Johnson            │
   │  General Admission          │
   │                             │
   │  [Food: Mango Lassi]  🟢   │
   │  [Activity: Completed] 🔴   │
   │                             │
   │  Food: 3 of 5 redeemed     │
   │                             │
   │  [ Redeem Mango Lassi ]    │
   └─────────────────────────────┘
9. Volunteer taps "Redeem Mango Lassi":
   - Success: green checkmark + haptic vibration + "Redeemed!" message
   - Already redeemed: red X + "Already redeemed at this station"
   - Food limit reached: yellow warning + "Food limit reached (5/5)"
   - Out of stock: red + "Mango Lassi is sold out"
10. Camera reactivates for next attendee (auto-return after 3 seconds)

STATION CHANGE:
11. Volunteer taps gear icon → "Change Station" → selects new station → confirms
12. Action logged to audit_log → admin notification sent
```

### 4.3 Admin Flow

```
BEFORE EVENT:
1. Admin signs in with email/password (pre-registered in Firebase Auth)
2. Admin dashboard shows:
   - "Import Attendees" button → CSV upload interface
   - Attendee list with search/filter
   - Station configuration
   - Inventory setup (initial counts for each food item)
   - Volunteer management (list, roles, station assignments)

EVENT DAY:
3. Dashboard shows real-time event view:
   - KPI bar: Total checked in / Total registered, Active now, Tables open
   - Station grid: 16 cards, each showing:
     - Station name + region
     - Current volunteer(s) assigned
     - Visit count (how many attendees have visited)
     - Food inventory bar (green/yellow/red)
   - Live activity feed: scrolling log of recent scans, redemptions, alerts
   - Notification bell: real-time alerts for:
     - Low stock warnings (item < 25% remaining)
     - Depleted items (item = 0)
     - Volunteer station changes
     - System errors
     - Suspicious activity (e.g., same attendee scanned 10 times in 1 minute)

4. Attendee lookup: search by PIN or name → see full activity history
5. Food inventory management: adjust counts, mark items as depleted manually
6. Photo management: view all event photos, filter by station/attendee

POST-EVENT:
7. Export event data (CSV): attendees, redemptions, photo metadata
8. Trigger face recognition batch job for photographer photos
9. Review/approve face-matched photos before they appear in attendee galleries
```

### 4.4 Photo Booth Flow

```
1. Photo booth station: tablet/laptop on a table with camera facing the user(s)
2. Screen shows inviting start screen: "Take a Photo!" with event branding
3. Attendee taps to start → "Scan your QR code first" screen appears
4. Attendee holds up their wallet pass QR code to the FRONT-facing camera
   (or enters their PIN manually as fallback)
5. System identifies attendee → shows "Hi, {name}! Ready for your photo?"
6. Camera switches to selfie mode (front-facing):
   a. Live preview with branded frame overlay (transparent PNG)
   b. "How many photos?" → options: 1, 2, 3, or 4 (for photo strip)
   c. Countdown: 3... 2... 1... *shutter animation + sound*
   d. If multiple: repeat countdown for each photo
7. Preview screen: shows captured photo(s) arranged in strip/grid layout
   - "Love it!" → saves and uploads
   - "Retake" → goes back to step 6
8. Processing: photos composited into strip with branded frame → uploaded to Firebase Storage
9. Confirmation: "Your photos are ready! View them anytime at desrangila.app/me"
10. Screen returns to start screen for next person

MULTI-PERSON PHOTOS:
- First person scans their QR → identified
- "Add more people?" → next person scans their QR (or skips)
- Photo linked to all identified attendees
- Each person sees the photo in their individual gallery
```

---

## 5. Component Specifications

### 5.1 Wallet Pass System

#### 5.1.1 Apple Wallet Pass (.pkpass)

**Prerequisites:**
- Apple Developer Account ($99/year) — already secured
- Pass Type ID Certificate (created in Apple Developer portal)
- Apple WWDR Intermediate Certificate

**Pass Design (pass.json structure):**
```json
{
  "formatVersion": 1,
  "passTypeIdentifier": "pass.edu.umd.isa.desrangila",
  "serialNumber": "{attendee.qrPayload}",
  "teamIdentifier": "{APPLE_TEAM_IDENTIFIER}",
  "organizationName": "UMD Indian Student Association",
  "description": "Des Rangila Digital Passport",
  "foregroundColor": "rgb(255, 255, 255)",
  "backgroundColor": "rgb(dynamic — from theme)",
  "labelColor": "rgb(dynamic — from theme)",
  "barcode": {
    "format": "PKBarcodeFormatQR",
    "message": "{attendee.qrPayload}",
    "messageEncoding": "iso-8859-1"
  },
  "generic": {
    "primaryFields": [
      { "key": "name", "label": "ATTENDEE", "value": "{attendee.name}" }
    ],
    "secondaryFields": [
      { "key": "pin", "label": "PIN", "value": "{attendee.pin}" },
      { "key": "tier", "label": "TICKET", "value": "{attendee.ticketTier}" }
    ],
    "auxiliaryFields": [
      { "key": "stamps", "label": "TABLES VISITED", "value": "0 / 16" }
    ],
    "backFields": [
      { "key": "event", "label": "Event", "value": "Des Rangila — Tour of India" },
      { "key": "date", "label": "Date", "value": "April 11, 2026 | 5–8 PM" },
      { "key": "location", "label": "Location", "value": "McKeldin Mall, UMD" },
      { "key": "portal", "label": "Your Photos & Info", "value": "https://desrangila.app/me" }
    ]
  }
}
```

**Pass images required (provide as @1x, @2x, @3x):**
- `icon.png` — 29×29 (notification icon)
- `logo.png` — 160×50 (shown at top of pass)
- `strip.png` — 375×123 (banner image behind primary fields) — use event branding artwork
- `thumbnail.png` — 90×90 (optional)

**Pass updates (stamps visited):**
Updating Apple Wallet passes requires implementing a web service. The flow:
1. Pass includes `webServiceURL` and `authenticationToken` fields
2. Apple's servers call your endpoints when the pass needs to refresh
3. Required endpoints (5 total):
   - `POST /api/apple-wallet/v1/devices/{deviceId}/registrations/{passTypeId}/{serialNumber}` — Register device
   - `DELETE /api/apple-wallet/v1/devices/{deviceId}/registrations/{passTypeId}/{serialNumber}` — Unregister
   - `GET /api/apple-wallet/v1/devices/{deviceId}/registrations/{passTypeId}` — List updated passes
   - `GET /api/apple-wallet/v1/passes/{passTypeId}/{serialNumber}` — Get latest pass
   - `POST /api/apple-wallet/v1/log` — Log errors
4. When stamps change, send a push notification via APNs to trigger a refresh

**Implementation library:** Use `passkit-generator` npm package:
```typescript
import { PKPass } from "passkit-generator";

const pass = await PKPass.from({
  model: "./passModels/desrangila.pass", // Directory with pass.json + images
  certificates: {
    wwdr: fs.readFileSync(APPLE_WWDR_CERT_PATH),
    signerCert: fs.readFileSync(APPLE_PASS_CERT_PATH),
    signerKey: fs.readFileSync(APPLE_PASS_KEY_PATH),
    signerKeyPassphrase: APPLE_PASS_CERT_PASSWORD,
  },
});

pass.setBarcodes({ format: "PKBarcodeFormatQR", message: attendee.qrPayload });
pass.primaryFields[0].value = attendee.name;
// ... set other fields

const buffer = pass.getAsBuffer();
// Serve as response with Content-Type: application/vnd.apple.pkpass
```

#### 5.1.2 Google Wallet Pass

**Prerequisites:**
- Google Cloud project with Wallet API enabled
- Service account with `roles/walletobjects.issuer` role
- Wallet Issuer account (created in Google Pay & Wallet Console)

**Class definition (created once via API):**
```json
{
  "id": "{ISSUER_ID}.desrangila_2026",
  "classTemplateInfo": {
    "cardTemplateOverride": {
      "cardRowTemplateInfos": [
        {
          "twoItems": {
            "startItem": { "firstValue": { "fields": [{ "fieldPath": "object.textModulesData['pin']" }] } },
            "endItem": { "firstValue": { "fields": [{ "fieldPath": "object.textModulesData['tier']" }] } }
          }
        }
      ]
    }
  },
  "linksModuleData": {
    "uris": [{ "uri": "https://desrangila.app/me", "description": "Your Photos & Info" }]
  }
}
```

**Object creation (per attendee):**
```json
{
  "id": "{ISSUER_ID}.{attendee.qrPayload}",
  "classId": "{ISSUER_ID}.desrangila_2026",
  "state": "ACTIVE",
  "header": { "defaultValue": { "language": "en", "value": "Des Rangila" } },
  "subheader": { "defaultValue": { "language": "en", "value": "Tour of India" } },
  "textModulesData": [
    { "id": "name", "header": "ATTENDEE", "body": "{attendee.name}" },
    { "id": "pin", "header": "PIN", "body": "{attendee.pin}" },
    { "id": "tier", "header": "TICKET", "body": "{attendee.ticketTier}" },
    { "id": "stamps", "header": "TABLES VISITED", "body": "0 / 16" }
  ],
  "barcode": { "type": "QR_CODE", "value": "{attendee.qrPayload}" }
}
```

**Real-time updates:** Simply PATCH the object to update the stamps field:
```typescript
await walletClient.genericobject.patch({
  resourceId: `${ISSUER_ID}.${attendee.qrPayload}`,
  requestBody: {
    textModulesData: [
      // ... same as above but with updated stamps count
      { id: "stamps", header: "TABLES VISITED", body: `${count} / 16` }
    ]
  }
});
```
Google handles pushing the update to the user's device automatically.

#### 5.1.3 Platform Detection & Pass Distribution Page

Route: `/pass/[qrPayload]`

```typescript
// Pseudo-code for the pass distribution page
export default function PassPage({ params }) {
  const attendee = await getAttendeeByQrPayload(params.qrPayload);
  const userAgent = headers().get('user-agent');
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);

  return (
    <PassPageLayout>
      <EventHeader />  {/* Event branding, date, location */}
      <AttendeeInfo name={attendee.name} pin={attendee.pin} tier={attendee.ticketTier} />
      <QRCodeDisplay payload={attendee.qrPayload} />  {/* Always visible as fallback */}

      {isIOS && <AddToAppleWalletButton passUrl={`/api/passes/apple/${attendee.qrPayload}`} />}
      {isAndroid && <AddToGoogleWalletButton saveUrl={googleWalletSaveUrl} />}

      <AddToHomeScreenPrompt />  {/* PWA install prompt for all platforms */}
      <PINDisplay pin={attendee.pin} />
    </PassPageLayout>
  );
}
```

### 5.2 QR Scanning PWA (Volunteer Interface)

Route: `/scan`

**Technical requirements:**
- Must work on personal phones (iPhone and Android) in mobile browser
- Must serve over HTTPS (handled by Vercel)
- Camera access via `getUserMedia()` — requires user permission grant
- iOS Safari: video element must have `playsinline`, `autoplay`, `muted` attributes
- Set camera to rear-facing by default: `facingMode: "environment"`

**Performance optimizations (goal: sub-500ms scan-to-result):**
- Request camera at 720p resolution (`width: { ideal: 1280 }, height: { ideal: 720 }`), not 1080p/4K — fewer pixels = faster per-frame processing, and QR codes don't need high resolution to decode
- Set scan frame rate to 15 FPS via qr-scanner's `calculateScanRegion` — fast enough for near-instant detection, conservative enough to preserve battery over a 3+ hour event
- Always-on scanning: the camera never turns off between scans. After a redemption is confirmed and the success screen auto-dismisses (3 seconds), the scanner immediately resumes with no tap-to-restart. The moment the next QR code enters the frame, it's detected
- Lock autofocus to mid-range if the browser supports it (`focusMode: "manual"`, `focusDistance` via MediaTrackConstraints) to prevent the camera from hunting between scans. Fall back gracefully if unsupported
- Our QR codes encode a short 14-character string (`DR-a7b3c9d2`), producing a low-density QR pattern that is faster to decode, more forgiving of angle/distance/lighting, and scannable even at arm's length
- Instant haptic feedback: call `navigator.vibrate(100)` the moment a QR code is successfully decoded, before any network or database lookup. This gives the volunteer physical confirmation in under 500ms
- Attendee info loads from IndexedDB (local cache), not the network — lookup completes in under 50ms
- Visual feedback: screen border flashes green on successful decode, red on error. Success/error states use large, high-contrast icons visible in direct sunlight
- On successful redemption: green checkmark animation + haptic vibration + optional success sound (configurable, off by default)

**Offline capability:**
- Service Worker caches the entire scan interface (HTML, JS, CSS)
- On first load (or periodic refresh), download the full attendee list to IndexedDB
  - 200 attendees × ~500 bytes each = ~100KB — trivially small
  - Store: `{ qrPayload, name, ticketTier, stampsCollected, totalFoodRedemptions, maxFoodRedemptions }`
- QR decoding is 100% client-side (camera + JS = no network needed)
- Attendee lookup: check IndexedDB first, fall back to Firestore if online
- Redemptions when offline:
  1. Write to IndexedDB redemption queue with a client-generated UUID (idempotency key)
  2. Update local attendee record optimistically
  3. Show "Redeemed ✓ (syncing...)" indicator
  4. When connectivity returns, Background Sync API (Chrome/Android) or setInterval retry (iOS) flushes the queue
  5. Server uses idempotency key to deduplicate

**UI states:**
1. **Scanning** — camera viewfinder active, station name shown at top
2. **Attendee Found** — name, tier, available/redeemed items, action buttons
3. **Processing** — brief loading spinner during redemption write
4. **Success** — green checkmark, auto-returns to scanning after 3 seconds
5. **Error** — red X with specific error message, manual dismiss
6. **Offline Banner** — persistent yellow banner at top: "Offline — scans will sync when connected"

### 5.3 Photo Booth Web App

Route: `/booth`

**Hardware setup:** Tablet (iPad preferred) or laptop mounted on a table/stand, front-facing camera, good lighting. The app runs entirely in the browser.

**Camera access:**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    facingMode: "user",           // Front-facing for selfies
    width: { ideal: 1280 },
    height: { ideal: 960 },
    frameRate: { ideal: 30 }
  },
  audio: false
});
```

**Photo strip compositing (Canvas API):**
```
For a 4-photo strip (classic photo booth style):
┌─────────────────────┐
│   Des Rangila 2026   │  ← Header with event branding
├─────────────────────┤
│                     │
│     Photo 1         │  ← Each photo: 600×450px
│                     │
├─────────────────────┤
│                     │
│     Photo 2         │
│                     │
├─────────────────────┤
│                     │
│     Photo 3         │
│                     │
├─────────────────────┤
│                     │
│     Photo 4         │
│                     │
├─────────────────────┤
│  ISA • UMD • 2026   │  ← Footer with branding
└─────────────────────┘

Total canvas size: ~660×2200px (with padding and branding)
```

**Compositing implementation:**
1. Capture each photo as a frame from the video element drawn to a hidden canvas
2. After all photos captured, create the final composite canvas
3. Draw: background color → branded header → each photo with padding → branded footer → optional overlay frame (transparent PNG)
4. Export as JPEG at 90% quality via `canvas.toBlob('image/jpeg', 0.9)`
5. Also generate a thumbnail at 400px wide for gallery views

**Upload flow:**
1. Generate unique filename: `booth_{stationId}_{timestamp}_{random}.jpg`
2. Upload full-size strip to Firebase Storage: `photos/booth/{filename}`
3. Upload thumbnail: `photos/booth/thumbs/{filename}`
4. Create Firestore `photos` document linking to the attendee(s)
5. Individual photos (pre-strip) are also saved separately for flexibility

**Attendee identification at booth:**
- Primary: QR code scan using rear camera (switch cameras briefly)
- Fallback: PIN entry via on-screen number pad
- Multi-person: after first person identified, prompt "Add more people?" with another scan/PIN entry
- Skip option: "Take photos without linking" for attendees who just want to take a quick photo

### 5.4 Attendee Portal

Route: `/me`

Lightweight page where attendees enter their PIN and see their event profile.

**Authentication:** PIN-only. No complex signup. Rate-limit to 5 attempts per minute per IP to prevent brute-forcing (with 1M possible PINs and 200 actual attendees, collision/guessing probability is negligible).

**Portal sections:**
1. **Event Header** — event branding, date, basic info
2. **Stamp Passport** — visual grid of all 16 stations; visited ones are colorful/stamped, unvisited are grayed out. Shows progress: "12/16 stations visited"
3. **Photo Gallery** — all photos linked to this attendee (booth photos + photographer photos after post-event processing). Each photo expandable to full-size, downloadable individually
4. **Download All** — zip download of all photos (generated on-demand server-side)
5. **Event Info** — quick reference: schedule, map, station list

**Technical notes:**
- This should be a PWA with Add to Home Screen support
- Manifest: `display: "standalone"`, theme color from event branding
- Photos load as thumbnails first, full-size on tap (lazy loading)
- No sensitive data exposed — name, stamps, and photos are all the attendee would already know about themselves

### 5.5 Admin Dashboard

Route: `/admin` (protected by email/password auth)

**Layout:** Responsive sidebar layout. Desktop-optimized but functional on mobile.

**Pages:**

1. **Overview / Live Event**
   - Real-time KPI cards: Total Registered, Checked In, Currently Active (scanned in last 30 min), Completion Rate (avg stamps/16)
   - Station grid: 16 cards showing name, volunteer count, visit count, food inventory gauge
   - Activity feed: live-scrolling log of recent actions (newest on top)
   - Notification panel: alerts requiring attention

2. **Attendees**
   - Searchable/filterable table: name, PIN, email, tier, checked in (Y/N), stamps count
   - Click to expand: full redemption history, photos, timeline
   - "Import Attendees" button: CSV upload interface
     - CSV format: `name,email,ticket_tier` (minimum required fields)
     - On upload: parse CSV, deduplicate by email, generate PINs + QR payloads, create Firestore docs, send pass emails
     - Show progress: "Processing... 142/200 attendees created"
     - Show results: "200 imported, 3 duplicates skipped, 0 errors"

3. **Stations**
   - Configure station details, activity/food info
   - Toggle stations active/inactive
   - View current volunteer assignments

4. **Inventory**
   - Per-station food item tracking
   - Set initial counts, view remaining, manually adjust
   - Color-coded: green (>50%), yellow (25–50%), orange (10–25%), red (<10%), black (0%)

5. **Volunteers**
   - List of all volunteers, their current station, last active time
   - Ability to reassign or deactivate

6. **Photos**
   - Gallery view of all event photos
   - Filter by: station, attendee, type (booth/photographer), date range
   - Bulk actions: approve, delete, re-assign to different attendee

7. **Audit Log**
   - Full searchable log of all system actions
   - Filter by: action type, actor, severity, time range

8. **Face Recognition** (post-event)
   - Upload photographer photos (batch)
   - Run matching job
   - Review suggested matches: shows photo + suggested attendee(s) + confidence score
   - Admin approves/rejects each match before it appears in attendee galleries

### 5.6 Face Recognition Pipeline

**This runs post-event, not in real-time.** It is a batch processing job, not a live feature.

**Selfie collection (at check-in):**
1. During check-in at the registration table, after scanning the attendee's QR code:
2. If `faceConsentGiven` is false, show consent prompt:
   - "Would you like your event photos automatically linked to your profile? We'll take a quick selfie to match you in photos taken by our photographers. Your face data is deleted 30 days after the event."
   - "Yes, link my photos" / "No thanks"
3. If consented: front-facing camera activates → capture face photo → process immediately:
   - Use face-api.js `detectSingleFace().withFaceLandmarks().withFaceDescriptor()`
   - Store the 128-dimensional float array in `attendee.faceDescriptor`
   - Store the selfie image temporarily (can discard after descriptor extraction)
4. If declined: `faceConsentGiven = false`, they can still get booth photos (QR-linked) but won't be auto-tagged in photographer photos

**Post-event batch matching:**
1. Admin uploads photographer photos (RAW/JPEG from DSLR) to a designated upload area
2. Server processes each photo using Sharp (resize to max 2000px wide for face detection performance)
3. For each photo, detect all faces: `detectAllFaces().withFaceLandmarks().withFaceDescriptors()`
4. For each detected face, compare its descriptor against all stored attendee descriptors:
   - Use Euclidean distance; threshold of 0.6 (standard for face-api.js)
   - If distance < 0.6: potential match
5. Store results as suggested matches in a `face_match_queue` subcollection
6. Admin reviews each suggestion in the dashboard:
   - Shows: the photo, the detected face region (highlighted), the suggested attendee name + profile photo, confidence score
   - Actions: "Approve" (creates photo document linked to attendee) or "Reject" (discards match)
7. Approved matches appear in the attendee's gallery on their portal

**Privacy safeguards:**
- Face descriptors are numeric vectors, not reconstructable images
- All face data (descriptors + selfies) deleted 30 days post-event
- Consent is explicit and opt-in
- Only admin can trigger and review matching
- Attendees can request deletion at any time

---

## 6. Offline-First Architecture

### 6.1 Why It's Non-Negotiable

McKeldin Mall is an outdoor space. While UMD's eduroam WiFi and attendees' cellular data provide reasonable connectivity, 200+ devices competing for bandwidth during a peak-activity event will cause intermittent drops. The scanning system — the most critical real-time component — must work with zero network dependency.

### 6.2 Service Worker Strategy (Workbox)

```typescript
// next.config.js — integrate with next-pwa or manual Workbox config
// Precache: entire app shell (HTML, JS, CSS, icons, fonts)
// Runtime cache: Firestore requests (stale-while-revalidate)
// Background sync: redemption queue

// workbox-config.js
module.exports = {
  globDirectory: '.next/',
  globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
  swDest: 'public/sw.js',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/firestore\.googleapis\.com/,
      handler: 'NetworkFirst',
      options: { cacheName: 'firestore-cache', networkTimeoutSeconds: 3 }
    }
  ]
};
```

### 6.3 IndexedDB Data Sync

On scanner PWA load (and every 5 minutes while open):
1. Fetch all attendees from Firestore → store in IndexedDB `attendees` object store
2. Fetch all stations from Firestore → store in IndexedDB `stations` object store
3. Fetch inventory levels → store in IndexedDB `inventory` object store

QR scan lookup: IndexedDB first (instant), then Firestore if online (to get freshest data).

### 6.4 Redemption Queue

```typescript
interface QueuedRedemption {
  idempotencyKey: string;   // crypto.randomUUID()
  attendeeQrPayload: string;
  stationId: string;
  itemType: string;
  volunteerId: string;
  timestamp: number;        // Date.now()
  synced: boolean;
}
```

When a redemption is created:
1. Write to IndexedDB `redemption_queue` store
2. Update local IndexedDB `attendees` record optimistically
3. If online: immediately POST to `/api/redemptions` with the idempotency key
4. If offline: queue for later sync

Sync mechanism:
- **Chrome/Android:** Use `workbox-background-sync` — automatically retries when connectivity returns
- **iOS Safari:** `setInterval` every 10 seconds checks `navigator.onLine`; if true, flush queue
  - iOS does not support Background Sync API, so this polling approach is the fallback
- **Server-side:** The `/api/redemptions` endpoint checks idempotency key before creating the document. If the key already exists, return 200 OK (idempotent success) without creating a duplicate.

### 6.5 Offline UI Indicators

- Persistent banner at top of scanner when offline: "📡 Offline — scans will sync when reconnected"
- Each queued redemption shows a small sync icon: ⏳ (pending) → ✓ (synced)
- Connection status dot in header: 🟢 (online) / 🔴 (offline)

---

## 7. API Routes

All routes are Next.js API routes under `/app/api/`.

### 7.1 Attendee Management

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/attendees/import` | Bulk import from CSV | Admin |
| GET | `/api/attendees` | List all attendees (paginated) | Admin |
| GET | `/api/attendees/[id]` | Get single attendee | Admin |
| GET | `/api/attendees/by-qr/[qrPayload]` | Lookup by QR payload | Volunteer |
| GET | `/api/attendees/by-pin/[pin]` | Lookup by PIN | Public (rate-limited) |
| PATCH | `/api/attendees/[id]/check-in` | Mark as checked in | Volunteer |
| POST | `/api/attendees/[id]/face` | Store face descriptor from selfie | Volunteer (check-in station) |
| GET | `/api/attendees/sync` | Bulk download for offline cache | Volunteer |

### 7.2 Redemptions

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/redemptions` | Create a redemption (with idempotency key) | Volunteer |
| GET | `/api/redemptions/by-attendee/[id]` | Get redemptions for an attendee | Volunteer, Admin |
| GET | `/api/redemptions/by-station/[id]` | Get redemptions at a station | Admin |
| GET | `/api/redemptions/recent` | Last 50 redemptions (for admin feed) | Admin |

### 7.3 Inventory

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/inventory` | Get all inventory items | Volunteer, Admin |
| PATCH | `/api/inventory/[id]` | Update remaining count | Admin |
| GET | `/api/inventory/sync` | Bulk download for offline cache | Volunteer |

### 7.4 Wallet Passes

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/passes/apple/[qrPayload]` | Generate and serve .pkpass file | Public (by link) |
| GET | `/api/passes/google/[qrPayload]` | Generate Google Wallet save URL | Public (by link) |
| POST | `/api/passes/send/[id]` | Email pass link to attendee | Admin |
| POST | `/api/passes/send-all` | Bulk email pass links | Admin |

Apple Wallet Web Service endpoints (called by Apple's servers):
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/apple-wallet/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]` | Register |
| DELETE | `/api/apple-wallet/v1/devices/[deviceId]/registrations/[passTypeId]/[serialNumber]` | Unregister |
| GET | `/api/apple-wallet/v1/devices/[deviceId]/registrations/[passTypeId]` | List updates |
| GET | `/api/apple-wallet/v1/passes/[passTypeId]/[serialNumber]` | Get latest pass |
| POST | `/api/apple-wallet/v1/log` | Error logging |

### 7.5 Photos

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/photos/upload` | Upload photo(s) from booth or photographer | Volunteer, Admin |
| GET | `/api/photos/by-attendee/[id]` | Get photos for an attendee | Public (PIN-authenticated) |
| GET | `/api/photos/by-station/[id]` | Get photos from a station | Admin |
| POST | `/api/photos/face-match` | Trigger face recognition batch job | Admin |
| GET | `/api/photos/face-match/queue` | Get pending face match suggestions | Admin |
| PATCH | `/api/photos/face-match/[id]` | Approve or reject a face match | Admin |

### 7.6 Volunteers

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| POST | `/api/volunteers/register` | Create volunteer account (after SMS auth) | Authenticated |
| PATCH | `/api/volunteers/[id]/station` | Change station assignment | Volunteer (self) |
| GET | `/api/volunteers` | List all volunteers | Admin |

### 7.7 Admin

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| GET | `/api/admin/stats` | Real-time event statistics | Admin |
| GET | `/api/admin/audit-log` | Query audit log | Admin |
| POST | `/api/admin/notify` | Send manual notification to all admins | Admin |

---

## 8. Security & Privacy

### 8.1 Authentication Layers

| User Type | Auth Method | Implementation |
|-----------|------------|----------------|
| Attendees | PIN (6-digit) | Rate-limited: 5 attempts/min/IP |
| Volunteers | Phone number + SMS OTP | Firebase Phone Auth |
| Admins | Email + password | Firebase Email Auth, restricted to pre-registered emails |

### 8.2 Authorization

Implement as middleware in Next.js API routes:

```typescript
type Role = 'public' | 'attendee' | 'volunteer' | 'admin';

function withAuth(handler: NextApiHandler, requiredRole: Role): NextApiHandler {
  return async (req, res) => {
    if (requiredRole === 'public') return handler(req, res);

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const decoded = await admin.auth().verifyIdToken(token);
    const volunteer = await getVolunteerByUid(decoded.uid);

    if (requiredRole === 'admin' && volunteer?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (requiredRole === 'volunteer' && !volunteer) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.volunteer = volunteer;
    return handler(req, res);
  };
}
```

### 8.3 Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Attendees: read by authenticated volunteers/admins, write by admins only
    match /attendees/{attendeeId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
      // Exception: check-in and face descriptor updates by volunteers
      allow update: if isVolunteer() &&
        request.resource.data.diff(resource.data).affectedKeys()
          .hasOnly(['checkedIn', 'checkedInAt', 'faceDescriptor', 'faceConsentGiven', 'stampsCollected', 'totalFoodRedemptions', 'updatedAt']);
    }

    // Redemptions: create by volunteers, read by volunteers/admins
    match /redemptions/{redemptionId} {
      allow read: if request.auth != null;
      allow create: if isVolunteer();
    }

    // Inventory: read by all authenticated, write by admins
    match /inventory/{itemId} {
      allow read: if request.auth != null;
      allow write: if isAdmin();
      // Exception: decrement by volunteers (via API route, not direct)
    }

    // Photos: read by all (attendee portal uses PIN auth at API level, not Firestore level)
    match /photos/{photoId} {
      allow read: if true; // Public read — photos are not sensitive
      allow write: if request.auth != null;
    }

    // Audit log: append-only by system, read by admins
    match /audit_log/{logId} {
      allow read: if isAdmin();
      allow create: if request.auth != null;
    }

    // Volunteers: self-read, admin-read/write
    match /volunteers/{volunteerId} {
      allow read: if request.auth != null && (request.auth.uid == resource.data.uid || isAdmin());
      allow create: if request.auth != null;
      allow update: if request.auth != null && (request.auth.uid == resource.data.uid || isAdmin());
    }

    // Helper functions
    function isAdmin() {
      return request.auth != null &&
        get(/databases/$(database)/documents/volunteers/$(request.auth.uid)).data.role == 'admin';
    }
    function isVolunteer() {
      return request.auth != null &&
        exists(/databases/$(database)/documents/volunteers/$(request.auth.uid));
    }
  }
}
```

### 8.4 Data Privacy & Retention

- Collect only: name, email, phone (volunteers only), PIN, QR payload, face descriptor (opt-in)
- Face descriptors are 128-dimensional float arrays — not reconstructable as images
- All attendee PII and face data deleted 30 days post-event
- Photos available for download for 30 days, then purged from storage
- Privacy policy page at `/privacy` — plain-language explanation of data collection, use, and retention
- Attendees can request immediate deletion by emailing the ISA contact

### 8.5 Rate Limiting

- PIN lookup (`/api/attendees/by-pin`): 5 requests/minute per IP
- SMS auth: Firebase's built-in rate limiting (10K/month free tier)
- Photo upload: 10 uploads/minute per authenticated session
- CSV import: 1 request/minute (admin only, prevents accidental double-imports)

Implement rate limiting via Vercel Edge Middleware or a simple in-memory counter (at 200 users, no need for Redis).

---

## 9. Notification System

### 9.1 Admin Notifications

Every audit log entry with `notifyAdmins: true` triggers a notification. Delivery methods:

1. **In-app:** Real-time notification bell in admin dashboard (Firestore onSnapshot listener on audit_log where notifyAdmins == true)
2. **Push notification:** Firebase Cloud Messaging to admin devices (if they've granted notification permission on the admin PWA)
3. **Sound:** Audible ping for high-severity alerts (inventory depleted, system errors)

### 9.2 Events That Trigger Admin Notifications

| Event | Severity | Message |
|-------|----------|---------|
| Inventory item < 25% remaining | Warning | "⚠️ Punjab Mango Lassi: 23 servings remaining (25%)" |
| Inventory item depleted | Error | "🔴 Punjab Mango Lassi: SOLD OUT" |
| Volunteer changed station | Info | "ℹ️ Priya switched from Punjab to Gujarat" |
| Attendee import completed | Info | "✓ 200 attendees imported, 3 duplicates skipped" |
| System error | Error | "❌ Redemption failed: {error details}" |
| Suspicious activity | Warning | "⚠️ Attendee Sarah Johnson scanned 8 times in 2 minutes at Punjab" |

---

## 10. Email System

### 10.1 Pass Distribution Email

Triggered after CSV import or manual "Send Pass" action. Use a transactional email service (Resend, SendGrid, or Firebase Extensions — all have generous free tiers).

**Email content:**
- Subject: "Your Des Rangila Digital Passport 🎪"
- Body:
  - Greeting with attendee name
  - Event details (date, time, location)
  - Their unique PIN (prominently displayed)
  - "Add to Wallet" button/link: `https://desrangila.app/pass/{qrPayload}`
  - Brief instructions: "Show this QR code at each table to participate"
  - Link to attendee portal: `https://desrangila.app/me`
  - QR code image embedded in the email (as a fallback)

### 10.2 Post-Event Email

Sent 1-2 days after the event:
- Subject: "Your Des Rangila Memories Are Ready! 📸"
- Body:
  - Thank you message
  - Stats: "You visited 12/16 stations!"
  - Link to photo gallery: `https://desrangila.app/me`
  - Reminder: photos available for 30 days

---

## 11. Project Structure

```
des-rangila/
├── app/
│   ├── layout.tsx                    # Root layout with theme provider
│   ├── page.tsx                      # Landing page (redirects or event info)
│   ├── pass/
│   │   └── [qrPayload]/
│   │       └── page.tsx              # Platform-detected pass distribution
│   ├── scan/
│   │   └── page.tsx                  # Volunteer QR scanner PWA
│   ├── booth/
│   │   └── page.tsx                  # Photo booth web app
│   ├── me/
│   │   └── page.tsx                  # Attendee portal (PIN entry → dashboard)
│   ├── admin/
│   │   ├── layout.tsx                # Admin sidebar layout + auth guard
│   │   ├── page.tsx                  # Overview / live event dashboard
│   │   ├── attendees/
│   │   │   └── page.tsx              # Attendee management + import
│   │   ├── stations/
│   │   │   └── page.tsx              # Station configuration
│   │   ├── inventory/
│   │   │   └── page.tsx              # Food inventory tracking
│   │   ├── volunteers/
│   │   │   └── page.tsx              # Volunteer management
│   │   ├── photos/
│   │   │   └── page.tsx              # Photo management + face matching
│   │   └── audit-log/
│   │       └── page.tsx              # System audit log
│   ├── volunteer/
│   │   ├── register/
│   │   │   └── page.tsx              # Volunteer signup (SMS auth + station select)
│   │   └── settings/
│   │       └── page.tsx              # Change station, profile
│   ├── privacy/
│   │   └── page.tsx                  # Privacy policy
│   └── api/
│       ├── attendees/
│       │   ├── import/route.ts       # CSV import
│       │   ├── by-qr/[qr]/route.ts  # QR payload lookup
│       │   ├── by-pin/[pin]/route.ts # PIN lookup
│       │   ├── sync/route.ts         # Bulk download for offline
│       │   └── [id]/
│       │       ├── route.ts          # Get/update attendee
│       │       ├── check-in/route.ts # Mark checked in
│       │       └── face/route.ts     # Store face descriptor
│       ├── redemptions/
│       │   ├── route.ts              # Create redemption
│       │   ├── by-attendee/[id]/route.ts
│       │   ├── by-station/[id]/route.ts
│       │   └── recent/route.ts
│       ├── inventory/
│       │   ├── route.ts              # Get all
│       │   ├── sync/route.ts         # Bulk download for offline
│       │   └── [id]/route.ts         # Update
│       ├── passes/
│       │   ├── apple/[qr]/route.ts   # Generate .pkpass
│       │   ├── google/[qr]/route.ts  # Generate Google save URL
│       │   └── send/route.ts         # Email pass links
│       ├── apple-wallet/             # Apple Wallet web service endpoints
│       │   └── v1/...
│       ├── photos/
│       │   ├── upload/route.ts
│       │   ├── by-attendee/[id]/route.ts
│       │   ├── face-match/
│       │   │   ├── route.ts          # Trigger batch job
│       │   │   └── queue/route.ts    # Get/update suggestions
│       │   └── by-station/[id]/route.ts
│       ├── volunteers/
│       │   ├── register/route.ts
│       │   └── [id]/station/route.ts
│       └── admin/
│           ├── stats/route.ts
│           └── audit-log/route.ts
├── components/
│   ├── ui/                           # shadcn/ui components
│   ├── scanner/
│   │   ├── QRScanner.tsx             # Camera + qr-scanner integration
│   │   ├── ScanResult.tsx            # Attendee info + redeem buttons
│   │   └── OfflineBanner.tsx         # Connectivity status
│   ├── booth/
│   │   ├── CameraView.tsx            # Live camera preview
│   │   ├── Countdown.tsx             # 3-2-1 countdown animation
│   │   ├── PhotoStrip.tsx            # Canvas-based strip compositing
│   │   ├── PhotoPreview.tsx          # Review + approve/retake
│   │   └── QRIdentify.tsx            # Scan QR to identify attendee at booth
│   ├── admin/
│   │   ├── KPICards.tsx              # Real-time stat cards
│   │   ├── StationGrid.tsx           # 16-station overview
│   │   ├── ActivityFeed.tsx          # Live action log
│   │   ├── CSVImporter.tsx           # Drag-and-drop CSV upload
│   │   ├── InventoryGauge.tsx        # Color-coded inventory bars
│   │   ├── FaceMatchReview.tsx       # Approve/reject face matches
│   │   └── NotificationBell.tsx      # Real-time alert system
│   ├── attendee/
│   │   ├── StampPassport.tsx         # Visual stamp grid
│   │   ├── PhotoGallery.tsx          # Photo grid with lightbox
│   │   └── PINEntry.tsx              # Number pad for PIN input
│   └── shared/
│       ├── EventHeader.tsx           # Branded event header
│       ├── LoadingSpinner.tsx
│       └── ErrorBoundary.tsx
├── lib/
│   ├── firebase/
│   │   ├── client.ts                 # Client-side Firebase init
│   │   ├── admin.ts                  # Server-side Firebase Admin init
│   │   └── auth.ts                   # Auth helpers
│   ├── wallet/
│   │   ├── apple.ts                  # Apple Wallet pass generation
│   │   └── google.ts                 # Google Wallet pass generation
│   ├── offline/
│   │   ├── db.ts                     # IndexedDB schema + helpers (using idb)
│   │   ├── sync.ts                   # Redemption queue + sync logic
│   │   └── cache.ts                  # Attendee/station data caching
│   ├── photos/
│   │   ├── compress.ts               # Sharp-based image compression
│   │   ├── composite.ts              # Photo strip compositing
│   │   └── face.ts                   # Face detection + matching
│   ├── email/
│   │   └── send.ts                   # Transactional email helpers
│   ├── qr.ts                         # QR code generation
│   ├── pin.ts                        # PIN generation + validation
│   ├── audit.ts                      # Audit log helper: logAction()
│   └── utils.ts                      # Shared utilities
├── public/
│   ├── sw.js                         # Service Worker (generated by Workbox)
│   ├── manifest.json                 # PWA manifest
│   ├── passModels/                   # Apple Wallet pass template
│   │   └── desrangila.pass/
│   │       ├── pass.json
│   │       ├── icon.png / icon@2x.png / icon@3x.png
│   │       ├── logo.png / logo@2x.png / logo@3x.png
│   │       └── strip.png / strip@2x.png / strip@3x.png
│   └── overlays/                     # Photo booth frame overlays
│       └── frame-default.png         # Transparent PNG overlay
├── styles/
│   └── globals.css                   # Tailwind base + CSS custom properties for theming
├── middleware.ts                      # Rate limiting, auth checks
├── next.config.js                    # PWA config, headers
├── tailwind.config.ts                # Theme tokens
├── tsconfig.json
├── package.json
└── .env.local
```

---

## 12. Theming System

Use CSS custom properties for easy brand application later:

```css
/* styles/globals.css */
:root {
  /* Primary palette — replace with event branding */
  --color-primary: #6366f1;       /* Indigo as placeholder */
  --color-primary-light: #818cf8;
  --color-primary-dark: #4f46e5;
  --color-accent: #f59e0b;        /* Amber accent */

  /* Semantic colors */
  --color-success: #22c55e;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;

  /* Surfaces */
  --color-background: #fafafa;
  --color-surface: #ffffff;
  --color-surface-elevated: #ffffff;

  /* Text */
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-text-on-primary: #ffffff;

  /* Borders & shadows */
  --color-border: #e5e7eb;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);

  /* Border radius */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-full: 9999px;

  /* Typography */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-display: 'Inter', system-ui, sans-serif; /* Replace with event display font */
}
```

---

## 13. Prioritized Build Order

Build in this order. Each phase produces a working, testable increment. Dependencies flow downward — nothing in a later phase depends on something not yet built.

### Phase 1: Foundation (CRITICAL — build first)
1. Next.js project setup with TypeScript, Tailwind, shadcn/ui
2. Firebase project creation and configuration (Firestore, Auth, Storage)
3. Environment variables and Firebase Admin SDK setup
4. Firestore data models and security rules
5. Admin email/password authentication
6. Basic admin layout (sidebar + page structure)

### Phase 2: Attendee Pipeline (CRITICAL)
7. CSV import endpoint: parse CSV → generate PINs + QR payloads → create Firestore docs
8. Admin attendee management page (list, search, view details)
9. QR code generation (using `qrcode` npm package)
10. PIN generation with uniqueness enforcement
11. Attendee lookup endpoints (by QR, by PIN)
12. Pass distribution page (`/pass/[qrPayload]`) with platform detection

### Phase 3: Scanning & Redemption (CRITICAL)
13. Volunteer phone auth (SMS OTP via Firebase)
14. Volunteer registration flow (name, phone, station selection)
15. QR scanner component using qr-scanner (nimiq)
16. Scan result display (attendee info, available items)
17. Redemption creation endpoint with idempotency
18. Inventory tracking (decrement on redemption, low-stock alerts)
19. Audit logging for all significant actions

### Phase 4: Offline-First (CRITICAL)
20. Service Worker setup with Workbox (precache app shell)
21. IndexedDB schema and data sync (attendees, stations, inventory)
22. Offline redemption queue with idempotency keys
23. Background sync (Workbox for Chrome, setInterval for iOS)
24. Offline UI indicators (banner, sync status icons)
25. Connectivity detection and queue flush logic

### Phase 5: Wallet Passes (HIGH PRIORITY)
26. Apple Wallet pass template (pass.json + images)
27. Apple Wallet pass generation endpoint using passkit-generator
28. Apple Wallet web service (5 endpoints for pass updates)
29. Google Wallet class creation and object generation
30. Google Wallet save URL generation
31. Platform-aware "Add to Wallet" buttons on pass page
32. Pass update logic (stamps count) triggered on redemption

### Phase 6: Admin Dashboard (HIGH PRIORITY)
33. Real-time event overview page (KPI cards, station grid)
34. Firestore onSnapshot listeners for live data
35. Activity feed component (recent redemptions/actions)
36. Inventory management page (gauges, manual adjustments)
37. Notification system (in-app bell + FCM push)
38. Volunteer management page
39. Audit log viewer with filtering

### Phase 7: Photo Booth (HIGH PRIORITY)
40. Camera access component (getUserMedia, front-facing)
41. Countdown + capture flow
42. Photo strip compositing (Canvas API)
43. Frame overlay system (transparent PNG compositing)
44. QR-based attendee identification at booth
45. Photo upload to Firebase Storage with compression (Sharp)
46. Thumbnail generation
47. Attendee portal photo gallery

### Phase 8: Attendee Portal (MEDIUM)
48. PIN entry page with number pad UI
49. Stamp passport visualization (16-station grid)
50. Photo gallery with lightbox
51. PWA manifest and Add to Home Screen support
52. Download individual photos and batch download

### Phase 9: Email System (MEDIUM)
53. Email service integration (Resend or SendGrid)
54. Pass distribution email template
55. Bulk email sending (after CSV import)
56. Post-event memories email

### Phase 10: Face Recognition (LOWER PRIORITY — post-event feature)
57. Selfie capture at check-in with consent flow
58. Face descriptor extraction (face-api.js)
59. Photographer photo batch upload interface
60. Face matching batch job
61. Match review interface for admin
62. Approved match → photo linked to attendee gallery

### Phase 11: Polish & Hardening
63. Comprehensive error handling across all endpoints
64. Loading states and skeleton screens throughout UI
65. Accessibility audit (touch targets, contrast, screen reader)
66. Performance optimization (lazy loading, image optimization)
67. Rate limiting middleware
68. Privacy policy page
69. Final testing with simulated 200 users

### If time runs short, cut in this order (last = cut first):
- Phase 10 (face recognition) — use manual tagging instead
- Phase 9 (emails) — distribute pass links via DoorList messaging or group chat
- Phase 8 items 51-52 (PWA + batch download) — they can just screenshot
- Phase 7 (photo booth) — use a shared Google Photos album
- Phase 5 items 28-32 (wallet updates + Google Wallet) — static Apple passes + web fallback
- **NEVER cut:** Phases 1-4 (these are the core system), Phase 6 (admin needs visibility)

---

## 14. Testing Strategy

### 14.1 Pre-Event Testing

1. **Simulated load test:** Create 200 test attendees via CSV import, use a script to simulate concurrent scans
2. **Offline testing:** Open scanner PWA, enable airplane mode, scan multiple QR codes, re-enable connectivity, verify all redemptions sync correctly and no duplicates created
3. **Cross-device testing:** Test scanner on at least:
   - iPhone (Safari) — most critical
   - Android (Chrome)
   - Budget Android phone (verify performance at 10 FPS scanning)
4. **Photo booth testing:** Test on the actual tablet(s) that will be used, in similar lighting conditions
5. **Wallet pass testing:** Install Apple Wallet pass on a real iPhone, verify it appears in Wallet and QR code scans correctly
6. **Edge cases:**
   - Scan a QR code that doesn't exist in the system
   - Try to redeem when food is out of stock
   - Try to redeem the same item twice
   - Scan with camera at extreme angles and in low light
   - Import a CSV with duplicate emails
   - Enter wrong PIN 6 times in a row

### 14.2 Day-Of Rehearsal (April 10)

1. Set up all stations with actual devices
2. Have 5-10 board members walk through the full attendee flow
3. Test WiFi connectivity at each table location
4. Verify photo booth cameras work in outdoor lighting
5. Confirm admin dashboard shows real-time data
6. Practice the check-in flow including selfie capture

---

*This document is the single source of truth for the Des Rangila Digital Passport System. All implementation decisions should reference this document. If a question arises that isn't covered here, the answer should be added to this document before proceeding with implementation.*
