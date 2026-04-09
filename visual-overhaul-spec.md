# Des Rangila — Visual Overhaul Spec

**Purpose:** Transform the app from its current generic indigo/SaaS aesthetic to a warm, cultural, bazaar-at-dusk feel that matches the event's watercolor promotional materials.

**Scope:** Color palette, typography, and targeted component styling. No layout restructuring, no new features, no animation.

**Priority:** Attendee-facing pages first (pass page, attendee portal, PIN entry, stamp passport). Admin/volunteer pages get palette changes for free via CSS variables but no structural work.

---

## 1. Color palette — `app/globals.css`

Replace the entire `:root` block. Every semantic color shifts from cool indigo/gray to warm mahogany/cream/saffron.

### Find and replace the `:root` contents inside `@layer base`

**Old primary (indigo):** `239 84% 67%` → **New primary (mahogany):** `16 23% 24%`
*(This is HSL for #483932)*

Here is the complete replacement for the CSS variables inside `:root`:

```css
/* === Des Rangila — warm bazaar palette === */
--background: 36 47% 97%;          /* #FDF8F0 warm cream */
--foreground: 20 36% 13%;          /* #2D1F15 dark brown */
--card: 40 100% 99%;               /* #FFFCF7 soft cream */
--card-foreground: 20 36% 13%;     /* #2D1F15 */
--popover: 40 100% 99%;            /* #FFFCF7 */
--popover-foreground: 20 36% 13%;  /* #2D1F15 */
--primary: 16 23% 24%;             /* #483932 mahogany */
--primary-foreground: 36 47% 88%;  /* #F5E6C8 warm light */
--secondary: 34 22% 91%;           /* #EDE6DB warm sand light */
--secondary-foreground: 20 36% 13%;/* #2D1F15 */
--muted: 34 22% 91%;               /* #EDE6DB */
--muted-foreground: 22 13% 48%;    /* #8C7B6B warm gray */
--accent: 32 64% 53%;              /* #D4913B saffron */
--accent-foreground: 0 0% 100%;    /* #ffffff */
--destructive: 0 84% 60%;          /* keep red */
--destructive-foreground: 0 0% 98%;
--border: 34 24% 86%;              /* #E8DFD0 warm sand */
--input: 34 24% 86%;               /* #E8DFD0 */
--ring: 32 64% 53%;                /* #D4913B saffron for focus rings */
--radius: 0.5rem;

/* === Chart colors === */
--chart-1: 16 23% 24%;             /* mahogany */
--chart-2: 32 64% 53%;             /* saffron */
--chart-3: 142 71% 45%;            /* green — keep */
--chart-4: 22 30% 38%;             /* #705f3d warm brown */
--chart-5: 0 84% 60%;              /* red — keep */

/* === Des Rangila semantic tokens === */
--color-primary: #483932;
--color-primary-light: #705f3d;
--color-primary-dark: #2D1F15;
--color-accent: #D4913B;

--color-success: #22c55e;
--color-warning: #D4913B;
--color-error: #ef4444;
--color-info: #705f3d;

--color-background: #FDF8F0;
--color-surface: #FFFCF7;
--color-surface-elevated: #FFFCF7;

--color-text-primary: #2D1F15;
--color-text-secondary: #8C7B6B;
--color-text-on-primary: #F5E6C8;

--color-border: #E8DFD0;
--shadow-sm: 0 1px 2px rgba(45, 31, 21, 0.05);
--shadow-md: 0 4px 6px rgba(45, 31, 21, 0.07);
--shadow-lg: 0 10px 15px rgba(45, 31, 21, 0.1);

--radius-sm: 0.375rem;
--radius-md: 0.5rem;
--radius-lg: 0.75rem;
--radius-xl: 1rem;
--radius-full: 9999px;

--font-sans: 'DM Sans', 'Inter', system-ui, sans-serif;
--font-display: 'Playfair Display', Georgia, serif;
```

---

## 2. Typography — `app/layout.tsx`

### Add Google Fonts

Replace the current Inter-only font setup. Import both DM Sans (body) and Playfair Display (display/headings).

```tsx
import { DM_Sans, Playfair_Display } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "700"],
});
```

Update the `<body>` tag:

```tsx
<body className={`${dmSans.variable} ${playfair.variable} font-sans antialiased`}>
```

### Update theme color

Change the viewport export:

```tsx
export const viewport: Viewport = {
  themeColor: "#483932",
};
```

---

## 3. PWA manifest — `public/manifest.json`

```json
"background_color": "#483932",
"theme_color": "#483932",
```

---

## 4. EventHeader component — `components/shared/EventHeader.tsx`

Change the title to use the display font (serif):

```tsx
export function EventHeader({ className }: EventHeaderProps) {
  return (
    <div className={cn("text-center", className)}>
      <h1 className="text-3xl font-medium tracking-tight font-display text-[var(--color-primary)]">
        Des Rangila
      </h1>
      <p className="text-sm text-muted-foreground mt-1">
        Tour of India &middot; April 11, 2026 &middot; 5&ndash;8 PM
      </p>
      <p className="text-xs text-muted-foreground">
        McKeldin Mall, University of Maryland
      </p>
    </div>
  );
}
```

Note: changed `font-bold` to `font-medium` — Playfair Display looks better at medium weight.

---

## 5. Pass distribution page — `app/pass/[qrPayload]/page.tsx`

This is the first thing attendees see (linked from their SMS). It needs to feel like receiving a passport, not viewing a tech dashboard.

### Structural changes

Replace the current page structure with a card-based layout with a warm dark header:

```tsx
return (
  <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[var(--color-background)]">
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border">
      {/* Dark header */}
      <div className="bg-[var(--color-primary)] px-6 py-7 text-center">
        <h1 className="font-display text-[28px] font-medium text-[var(--color-text-on-primary)] tracking-wide">
          Des Rangila
        </h1>
        <p className="text-xs tracking-[3px] mt-1" style={{ color: '#B4A689' }}>
          TOUR OF INDIA
        </p>
      </div>

      {/* Body */}
      <div className="bg-card p-6 space-y-5">
        {/* Event details card */}
        <div className="bg-[var(--color-background)] rounded-xl p-4 border border-border space-y-3">
          <div>
            <p className="text-[11px] tracking-widest text-muted-foreground">EVENT</p>
            <p className="text-sm font-medium mt-0.5">Des Rangila — Tour of India</p>
          </div>
          <div>
            <p className="text-[11px] tracking-widest text-muted-foreground">DATE & TIME</p>
            <p className="text-sm font-medium mt-0.5">Saturday, April 11 · 5:00–8:00 PM</p>
          </div>
          <div>
            <p className="text-[11px] tracking-widest text-muted-foreground">LOCATION</p>
            <p className="text-sm font-medium mt-0.5">McKeldin Mall East, UMD</p>
          </div>
        </div>

        {/* PIN */}
        <div className="text-center">
          <p className="text-[11px] tracking-widest text-muted-foreground mb-2">YOUR PIN</p>
          <p className="text-4xl font-medium tracking-[10px] text-[var(--color-primary)] font-mono">
            {attendee.pin}
          </p>
        </div>

        {/* QR Code */}
        <QRCodeDisplay payload={params.qrPayload} />

        {/* Wallet buttons */}
        {isIOS && (
          <a
            href={`/api/passes/apple/${params.qrPayload}`}
            className="flex items-center justify-center w-full bg-[var(--color-accent)] text-white rounded-xl py-3.5 font-medium hover:opacity-90 transition-opacity"
          >
            Add to Apple Wallet
          </a>
        )}
        {isAndroid && (
          <a
            href={`/api/passes/google/${params.qrPayload}`}
            className="flex items-center justify-center w-full bg-[var(--color-primary)] text-[var(--color-text-on-primary)] rounded-xl py-3.5 font-medium hover:opacity-90 transition-opacity"
          >
            Add to Google Wallet
          </a>
        )}
        {!isIOS && !isAndroid && (
          <>
            <a
              href={`/api/passes/apple/${params.qrPayload}`}
              className="flex items-center justify-center w-full bg-[var(--color-accent)] text-white rounded-xl py-3.5 font-medium hover:opacity-90 transition-opacity"
            >
              Add to Apple Wallet
            </a>
            <a
              href={`/api/passes/google/${params.qrPayload}`}
              className="flex items-center justify-center w-full bg-[var(--color-primary)] text-[var(--color-text-on-primary)] rounded-xl py-3.5 font-medium hover:opacity-90 transition-opacity"
            >
              Add to Google Wallet
            </a>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="bg-card border-t border-border px-6 py-4 text-center">
        <p className="text-[11px] text-muted-foreground">
          Indian Student Association · University of Maryland
        </p>
      </div>
    </div>
  </main>
);
```

Also update the "Pass Not Found" state to use the same dark header + card pattern.

---

## 6. Attendee portal — `app/me/page.tsx`

### PIN entry screen

Add a dark header above the PIN entry area, matching the pass page pattern:

```tsx
// PIN entry screen
if (!attendee) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border">
        <div className="bg-[var(--color-primary)] px-6 py-6 text-center">
          <h1 className="font-display text-2xl font-medium text-[var(--color-text-on-primary)]">
            Des Rangila
          </h1>
          <p className="text-[11px] tracking-[3px] mt-1" style={{ color: '#B4A689' }}>
            TOUR OF INDIA
          </p>
        </div>
        <div className="bg-card p-6 space-y-4">
          <div className="text-center">
            <h2 className="text-base font-medium mb-1">Your event passport</h2>
            <p className="text-sm text-muted-foreground">
              Enter your 4-digit PIN to view your stamps and photos.
            </p>
          </div>
          <PINEntry onSubmit={handlePinSubmit} loading={loading} error={error} />
        </div>
      </div>
    </main>
  );
}
```

### Attendee dashboard (after PIN)

Add a dark header with the attendee's name:

```tsx
return (
  <main className="min-h-screen pb-8 max-w-lg mx-auto">
    {/* Dark personalized header */}
    <div className="bg-[var(--color-primary)] px-6 py-5 text-center mb-6">
      <p className="font-display text-xl font-medium text-[var(--color-text-on-primary)]">
        {attendee.name}&apos;s Passport
      </p>
      <p className="text-[11px] tracking-[3px] mt-1" style={{ color: '#B4A689' }}>
        DES RANGILA · APRIL 11, 2026
      </p>
    </div>

    <div className="px-4 space-y-8">
      <StampPassport stampsCollected={attendee.stampsCollected || []} />

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-medium text-[var(--color-primary)]">
            {attendee.stampsCollected?.length || 0}
          </p>
          <p className="text-xs text-muted-foreground">Stations visited</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-medium text-[var(--color-primary)]">
            {attendee.totalFoodRedemptions}/{attendee.maxFoodRedemptions}
          </p>
          <p className="text-xs text-muted-foreground">Food redeemed</p>
        </div>
      </div>

      <PhotoGallery photos={photos} />

      <div className="text-center pt-4">
        <button
          className="text-sm text-muted-foreground underline"
          onClick={() => { setAttendee(null); setPhotos([]); }}
        >
          Use a different PIN
        </button>
      </div>
    </div>
  </main>
);
```

---

## 7. StampPassport component — `components/attendee/StampPassport.tsx`

The stamp grid is the visual centerpiece. Visited stamps should feel hand-stamped.

### Key changes

1. Visited tiles: solid mahogany background, warm cream text, slight random rotation (-3deg to +3deg) using inline styles, checkmark in cream
2. Unvisited tiles: transparent background, dashed border in warm sand color, muted text
3. Grid: 3 columns on mobile, 5 on `sm:` breakpoint (already implemented in our data fix)
4. Progress bar: saffron fill instead of primary (which is now dark mahogany — too dark for a thin bar)

Replace the component:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STATIONS = [
  { id: "jammu-kashmir", name: "J&K + Ladakh" },
  { id: "himachal-uttarakhand", name: "Himachal + Uttarakhand" },
  { id: "punjab", name: "Punjab" },
  { id: "haryana-rajasthan", name: "Haryana + Rajasthan" },
  { id: "gujarat", name: "Gujarat" },
  { id: "maharashtra", name: "Maharashtra" },
  { id: "central-india", name: "Central India" },
  { id: "odisha", name: "Odisha" },
  { id: "west-bengal", name: "West Bengal" },
  { id: "seven-sisters-sikkim", name: "Seven Sisters + Sikkim" },
  { id: "andhra-telangana", name: "AP + Telangana" },
  { id: "karnataka", name: "Karnataka" },
  { id: "tamil-nadu", name: "Tamil Nadu" },
  { id: "kerala", name: "Kerala" },
  { id: "motion-cafe", name: "Motion Cafe" },
];

const TOTAL = STATIONS.length;

// Deterministic rotation per station for the "hand-stamped" feel
const ROTATIONS = [-2, 1, -1, 2, -3, 1, -2, 3, -1, 2, -2, 1, 3, -1, 2];

interface StampPassportProps {
  stampsCollected: string[];
}

export function StampPassport({ stampsCollected }: StampPassportProps) {
  const visited = new Set(stampsCollected);
  const count = STATIONS.filter((s) => visited.has(s.id)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Stamp passport</h2>
        <span className="text-sm text-muted-foreground">
          {count}/{TOTAL} visited
        </span>
      </div>

      {/* Progress bar — saffron fill */}
      <div className="w-full bg-border rounded-full h-1.5">
        <div
          className="bg-accent h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(count / TOTAL) * 100}%` }}
        />
      </div>

      {/* Station grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
        {STATIONS.map((station, i) => {
          const isVisited = visited.has(station.id);
          return (
            <div
              key={station.id}
              className={cn(
                "aspect-square rounded-lg flex flex-col items-center justify-center p-1 text-center transition-all",
                isVisited
                  ? "bg-[var(--color-primary)] text-[var(--color-text-on-primary)] border-2 border-[var(--color-primary)]"
                  : "bg-transparent text-muted-foreground border-2 border-dashed border-border"
              )}
              style={isVisited ? { transform: `rotate(${ROTATIONS[i]}deg)` } : undefined}
            >
              {isVisited && (
                <Check className="h-3.5 w-3.5 mb-0.5" style={{ color: 'var(--color-text-on-primary)' }} />
              )}
              <span className="text-[9px] leading-tight font-medium">
                {station.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 8. Wallet pass colors

### Apple Wallet — `lib/passes/apple.ts`

Find and replace these three lines:

```
backgroundColor: "rgb(99, 102, 241)", // indigo-500
```
→
```
backgroundColor: "rgb(72, 57, 50)", // mahogany #483932
```

```
foregroundColor: "rgb(255, 255, 255)",
```
→
```
foregroundColor: "rgb(245, 230, 200)", // warm cream #F5E6C8
```

```
labelColor: "rgb(199, 210, 254)", // indigo-200
```
→
```
labelColor: "rgb(180, 166, 137)", // warm tan #B4A689
```

### Google Wallet — `lib/passes/google.ts`

Find and replace both occurrences of:

```
hexBackgroundColor: "#6366f1",
```
→
```
hexBackgroundColor: "#483932",
```

---

## 9. Pass page — Google Wallet button color

### `app/pass/[qrPayload]/page.tsx`

If you keep the old button structure instead of adopting the full rewrite in section 5, change:

```
bg-[#4285f4]
```
→
```
bg-[var(--color-primary)]
```

And:
```
hover:bg-[#4285f4]/90
```
→
```
hover:opacity-90
```

---

## 10. Landing page — `app/page.tsx`

Minimal change. Just ensure the header uses `font-display` and buttons use warm colors. The palette swap handles most of this automatically. One optional improvement: change the "Admin Dashboard" button to use the accent color:

```tsx
<a
  href="/admin/login"
  className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
>
  Admin Dashboard
</a>
<a
  href="/me"
  className="inline-flex items-center justify-center rounded-lg border border-border bg-card px-6 py-2.5 text-sm font-medium hover:bg-secondary transition-colors"
>
  Attendee Portal
</a>
```

---

## Color reference card

For quick lookup when implementing:

| Token | Hex | HSL (for CSS vars) | Usage |
|-------|-----|-----|-------|
| Mahogany | #483932 | 16 23% 24% | Primary, headers, visited stamps, wallet bg |
| Dark brown | #2D1F15 | 20 36% 13% | Text primary, foreground |
| Warm brown | #705f3d | 22 30% 38% | Secondary accent, chart, info |
| Warm gray | #8C7B6B | 22 13% 48% | Muted text, labels |
| Saffron | #D4913B | 32 64% 53% | Accent, CTAs, progress bars, focus rings |
| Warm cream bg | #FDF8F0 | 36 47% 97% | Page background |
| Soft cream card | #FFFCF7 | 40 100% 99% | Card surfaces |
| Warm sand | #E8DFD0 | 34 24% 86% | Borders, input borders, unvisited stamp borders |
| Sand light | #EDE6DB | 34 22% 91% | Muted backgrounds, secondary |
| Light gold text | #F5E6C8 | 36 47% 88% | Text on dark mahogany backgrounds |
| Warm tan | #B4A689 | 39 22% 62% | Subtitle text on dark backgrounds |

---

## Files to modify (ordered by priority)

1. `app/globals.css` — full palette swap (section 1)
2. `app/layout.tsx` — fonts + theme color (section 2)
3. `public/manifest.json` — PWA colors (section 3)
4. `components/shared/EventHeader.tsx` — font-display (section 4)
5. `app/pass/[qrPayload]/page.tsx` — full restructure (section 5)
6. `app/me/page.tsx` — dark header, card wrapping (section 6)
7. `components/attendee/StampPassport.tsx` — stamp aesthetic (section 7)
8. `lib/passes/apple.ts` — 3 color values (section 8)
9. `lib/passes/google.ts` — 2 color values (section 8)
10. `app/page.tsx` — minor button tweaks (section 10)

---

## Files NOT to modify

- `app/admin/*` — admin pages get palette changes for free, no structural work needed
- `app/scan/*` — volunteer scanner is functional-first, palette handles it
- `app/booth/*` — photo booth gets palette for free
- `components/ui/*` — shadcn components inherit from CSS variables, no changes needed
- `lib/email/resend.ts` — being replaced by SMS, skip entirely
- `middleware.ts` — no visual component
- `lib/offline/*` — no visual component
- Any `*.md` documentation files

---

## Validation checklist

After implementing, verify:

1. `npx tsc --noEmit` — zero TypeScript errors
2. `npm run build` — compiles (ignore face-api.js warning)
3. Visit `/` — warm cream background, mahogany buttons, serif "Des Rangila"
4. Visit `/me` — dark mahogany header, warm PIN keypad, cream background
5. Visit `/pass/DR-XXXXXXXX` (any test payload) — dark header card, saffron CTA button, warm event details
6. Visit `/admin` — palette is warm (not indigo), no broken layouts
7. Visit `/scan` — station picker has warm colors, scanner works
8. Check mobile viewport — theme color is mahogany in browser chrome
