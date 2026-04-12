#!/usr/bin/env python3

"""
Des Rangila 2026 — Post-Event Analytics Report
Spotify Wrapped-style deep dive into all event data.

Usage:
    export GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json
    python scripts/analytics-report.py
"""

import os
import sys
import json
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict

os.environ["ORT_LOG_LEVEL"] = "3"

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
except ImportError:
    print("ERROR: firebase-admin not installed.")
    sys.exit(1)


# ── Firebase init ───────────────────────────────────────────────────
def init_firebase():
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred_path:
        print("ERROR: GOOGLE_APPLICATION_CREDENTIALS not set.")
        sys.exit(1)
    cred = credentials.Certificate(cred_path)
    with open(cred_path) as f:
        sa = json.load(f)
    firebase_admin.initialize_app(cred, {"storageBucket": f"{sa['project_id']}.firebasestorage.app"})
    return firestore.client()


# ── Helpers ─────────────────────────────────────────────────────────
def to_dt(ts):
    """Convert Firestore timestamp to datetime, or return None."""
    if ts is None:
        return None
    if hasattr(ts, "to_pydatetime"):
        return ts.to_pydatetime()
    if hasattr(ts, "_seconds"):
        return datetime.fromtimestamp(ts._seconds, tz=timezone.utc)
    if hasattr(ts, "seconds"):
        return datetime.fromtimestamp(ts.seconds, tz=timezone.utc)
    return None


def fetch_collection(db, name):
    docs = list(db.collection(name).stream())
    return [{"_id": doc.id, **doc.to_dict()} for doc in docs]


def safe_div(a, b, default=0):
    return a / b if b > 0 else default


def bar(count, max_count, width=30):
    filled = round(count / max_count * width) if max_count > 0 else 0
    return "█" * filled + "░" * (width - filled)


def fmt_time(dt_obj):
    if dt_obj is None:
        return "N/A"
    # Convert to ET (UTC-4 for EDT)
    et = dt_obj - timedelta(hours=4)
    return et.strftime("%-I:%M %p")


def fmt_duration(td):
    hours = int(td.total_seconds() // 3600)
    minutes = int((td.total_seconds() % 3600) // 60)
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"


# ── Report class ────────────────────────────────────────────────────
class Report:
    def __init__(self):
        self.lines = []
        self.md_lines = []

    def banner(self, title, subtitle=""):
        w = 52
        self.lines.append("")
        self.lines.append("╔" + "═" * w + "╗")
        self.lines.append("║" + title.center(w) + "║")
        if subtitle:
            self.lines.append("║" + subtitle.center(w) + "║")
        self.lines.append("╚" + "═" * w + "╝")
        self.lines.append("")
        self.md_lines.append(f"# {title}")
        if subtitle:
            self.md_lines.append(f"*{subtitle}*")
        self.md_lines.append("")

    def section(self, emoji, title):
        self.lines.append("")
        self.lines.append(f"{emoji} {title}")
        self.lines.append("━" * 52)
        self.md_lines.append(f"\n## {emoji} {title}\n")

    def stat(self, label, value, indent=2):
        self.lines.append(" " * indent + f"{label:<32} {value}")
        self.md_lines.append(f"| {label} | {value} |")

    def table_header(self):
        self.md_lines.append("| Metric | Value |")
        self.md_lines.append("|--------|-------|")

    def text(self, line=""):
        self.lines.append(line)
        self.md_lines.append(line)

    def ranking(self, items, max_show=10):
        """items: list of (label, count)"""
        if not items:
            self.text("  (no data)")
            return
        medals = ["🥇", "🥈", "🥉"]
        max_count = items[0][1] if items else 1
        for i, (label, count) in enumerate(items[:max_show]):
            medal = medals[i] if i < len(medals) else f"  {i+1}."
            b = bar(count, max_count, 20)
            self.lines.append(f"  {medal} {label:<28} {b} {count}")
            self.md_lines.append(f"{i+1}. **{label}** — {count}")

    def histogram(self, buckets):
        """buckets: list of (label, count)"""
        max_count = max(c for _, c in buckets) if buckets else 1
        for label, count in buckets:
            b = bar(count, max_count, 25)
            self.lines.append(f"  {label:<14} {b} {count}")
            self.md_lines.append(f"| {label} | {count} |")

    def timeline_chart(self, bins):
        """bins: sorted list of (time_label, count)"""
        if not bins:
            self.text("  (no data)")
            return
        max_count = max(c for _, c in bins)
        for label, count in bins:
            b = bar(count, max_count, 30)
            marker = " ◀ PEAK" if count == max_count else ""
            self.lines.append(f"  {label:<10} {b} {count}{marker}")
            peak = " **PEAK**" if count == max_count else ""
            self.md_lines.append(f"| {label} | {'█' * round(count/max_count*20)} | {count} |{peak}")

    def output(self):
        return "\n".join(self.lines)

    def markdown(self):
        return "\n".join(self.md_lines)


# ── Analytics ───────────────────────────────────────────────────────
def generate_report(db):
    r = Report()

    # Fetch all data
    print("Fetching data from Firestore...")
    attendees = fetch_collection(db, "attendees")
    redemptions = fetch_collection(db, "redemptions")
    photos = fetch_collection(db, "photos")
    face_matches = fetch_collection(db, "face_match_queue")
    audit_log = fetch_collection(db, "audit_log")
    volunteers = fetch_collection(db, "volunteers")
    stations = fetch_collection(db, "stations")
    inventory = fetch_collection(db, "inventory")
    print(f"  Loaded: {len(attendees)} attendees, {len(redemptions)} redemptions, {len(photos)} photos")
    print(f"  {len(volunteers)} volunteers, {len(stations)} stations, {len(inventory)} inventory items")
    print(f"  {len(face_matches)} face matches, {len(audit_log)} audit log entries")
    print()

    # Lookup maps
    station_map = {s["_id"]: s for s in stations}
    attendee_map = {a["_id"]: a for a in attendees}
    stampable_ids = {s["_id"] for s in stations if s.get("type") in ("food", "activity", "both")}
    food_station_ids = {s["_id"] for s in stations if s.get("type") in ("food", "both")}
    activity_station_ids = {s["_id"] for s in stations if s.get("type") in ("activity", "both")}

    # Classify attendees
    checked_in = [a for a in attendees if a.get("checkedIn")]
    pre_orders = [a for a in attendees if a.get("preOrder")]
    walkin_ids = {e.get("targetId") for e in audit_log if e.get("action") == "walkin.created"}
    walk_ins = [a for a in attendees if a["_id"] in walkin_ids]
    if not walk_ins:
        # Fallback: attendees not in pre_orders who are checked in
        pre_order_ids = {a["_id"] for a in pre_orders}
        walk_ins = [a for a in checked_in if a["_id"] not in pre_order_ids and not a.get("preOrder")]

    # Timestamps
    checkin_times = [to_dt(a.get("checkedInAt")) for a in checked_in]
    checkin_times = [t for t in checkin_times if t is not None]
    redemption_times = [to_dt(r.get("timestamp")) for r in redemptions]
    redemption_times = [t for t in redemption_times if t is not None]
    all_times = checkin_times + redemption_times

    # ════════════════════════════════════════════════════════════════
    r.banner("DES RANGILA 2026", "Post-Event Analytics Report  ·  April 11, 2026")

    # ── Section 1: THE BIG NUMBERS ──────────────────────────────────
    r.section("🎯", "THE BIG NUMBERS")
    r.table_header()
    r.stat("Total Attendees", len(attendees))
    r.stat("  Pre-orders", len(pre_orders))
    r.stat("  Walk-ins", len(walk_ins))
    r.stat("Checked In", f"{len(checked_in)} ({safe_div(len(checked_in), len(attendees)) * 100:.0f}%)")
    r.stat("Total Redemptions", len(redemptions))
    food_redemptions = [r_ for r_ in redemptions if r_.get("itemType") != "activity"]
    activity_redemptions = [r_ for r_ in redemptions if r_.get("itemType") == "activity"]
    r.stat("  Food Redemptions", len(food_redemptions))
    r.stat("  Activity Redemptions", len(activity_redemptions))
    booth_photos = [p for p in photos if p.get("photoType") == "booth"]
    r.stat("Photo Booth Sessions", len(booth_photos))
    total_individual = sum(len(p.get("individualPhotos", [])) for p in booth_photos)
    r.stat("Individual Photos", total_individual)
    if all_times:
        event_start = min(all_times)
        event_end = max(all_times)
        r.stat("Event Duration", fmt_duration(event_end - event_start))
        r.stat("First Check-in", fmt_time(min(checkin_times)) if checkin_times else "N/A")
        r.stat("Last Activity", fmt_time(event_end))

    # ── Section 2: ATTENDANCE TIMELINE ──────────────────────────────
    r.section("📊", "ATTENDANCE TIMELINE")
    if checkin_times:
        bins = Counter()
        for t in checkin_times:
            et = t - timedelta(hours=4)  # UTC to ET
            bin_key = et.replace(minute=(et.minute // 15) * 15, second=0, microsecond=0)
            bins[bin_key] += 1
        sorted_bins = sorted(bins.items())
        timeline = [(k.strftime("%-I:%M %p"), v) for k, v in sorted_bins]
        r.text("  Check-ins by 15-minute window:")
        r.text("")
        r.md_lines.append("| Time | Bar | Count |")
        r.md_lines.append("|------|-----|-------|")
        r.timeline_chart(timeline)
        peak_time, peak_count = max(sorted_bins, key=lambda x: x[1])
        r.text("")
        r.text(f"  ⚡ Peak: {peak_count} check-ins at {peak_time.strftime('%-I:%M %p')} ET")
    else:
        r.text("  (no check-in timestamps available)")

    # ── Section 3: STATION RANKINGS ─────────────────────────────────
    r.section("🏆", "STATION RANKINGS")
    station_counts = Counter()
    for red in redemptions:
        sid = red.get("stationId")
        if sid:
            station_counts[sid] += 1

    r.text("  Overall (by total redemptions):")
    r.text("")
    ranked = [(station_map.get(sid, {}).get("name", sid), count)
              for sid, count in station_counts.most_common()]
    r.ranking(ranked)

    # Food vs Activity
    r.text("")
    r.text("  🍽  Food Stations:")
    r.text("")
    food_counts = [(station_map.get(sid, {}).get("name", sid), c)
                   for sid, c in station_counts.most_common() if sid in food_station_ids]
    r.ranking(food_counts)

    r.text("")
    r.text("  🎨 Activity Stations:")
    r.text("")
    activity_counts = [(station_map.get(sid, {}).get("name", sid), c)
                       for sid, c in station_counts.most_common() if sid in activity_station_ids]
    r.ranking(activity_counts)

    # Average time between visits
    if redemption_times:
        attendee_times = defaultdict(list)
        for red in redemptions:
            t = to_dt(red.get("timestamp"))
            if t:
                attendee_times[red.get("attendeeId")].append(t)
        gaps = []
        for aid, times in attendee_times.items():
            times.sort()
            for i in range(1, len(times)):
                gap = (times[i] - times[i-1]).total_seconds() / 60
                if gap > 0:
                    gaps.append(gap)
        if gaps:
            r.text("")
            r.stat("Avg time between stations", f"{sum(gaps)/len(gaps):.1f} minutes")

    # ── Section 4: FOOD DEEP DIVE ──────────────────────────────────
    r.section("🍽", "FOOD DEEP DIVE")
    r.table_header()
    r.stat("Total Food Servings", len(food_redemptions))
    r.stat("Avg per Attendee", f"{safe_div(len(food_redemptions), len(checked_in)):.1f}")

    # Top food items
    food_by_station = Counter()
    for red in food_redemptions:
        sname = red.get("stationName", red.get("stationId", "Unknown"))
        food_by_station[sname] += 1

    r.text("")
    r.text("  Food item ranking:")
    r.text("")
    r.ranking(food_by_station.most_common())

    # Inventory analysis
    r.text("")
    r.text("  📦 Inventory Status:")
    r.text("")
    for inv in sorted(inventory, key=lambda i: safe_div(i.get("remainingCount", 0), i.get("initialCount", 1))):
        initial = inv.get("initialCount", 0)
        remaining = inv.get("remainingCount", 0)
        consumed = initial - remaining
        pct = safe_div(consumed, initial) * 100
        status = "🔴 SOLD OUT" if remaining == 0 else f"{'🟡' if pct > 80 else '🟢'} {remaining} left"
        item = inv.get("itemName", "Unknown")
        r.lines.append(f"    {item:<24} {consumed:>3}/{initial}  ({pct:>5.1f}%)  {status}")
        r.md_lines.append(f"| {item} | {consumed}/{initial} ({pct:.0f}%) | {status} |")

    # Top food consumers
    food_by_attendee = Counter()
    for red in food_redemptions:
        food_by_attendee[red.get("attendeeName", "Unknown")] += 1
    r.text("")
    r.text("  🏅 Top Food Consumers:")
    r.text("")
    r.ranking(food_by_attendee.most_common(5), max_show=5)

    # ── Section 5: ACTIVITY DEEP DIVE ──────────────────────────────
    r.section("🎨", "ACTIVITY DEEP DIVE")
    activity_by_station = Counter()
    for red in activity_redemptions:
        sname = red.get("stationName", red.get("stationId", "Unknown"))
        activity_by_station[sname] += 1

    r.table_header()
    r.stat("Total Activity Redemptions", len(activity_redemptions))

    r.text("")
    r.text("  Activity ranking:")
    r.text("")
    r.ranking(activity_by_station.most_common())

    # Who did the most activities
    activity_by_attendee = Counter()
    for red in activity_redemptions:
        activity_by_attendee[red.get("attendeeName", "Unknown")] += 1
    r.text("")
    r.text("  🏅 Top Activity Enthusiasts:")
    r.text("")
    r.ranking(activity_by_attendee.most_common(5), max_show=5)

    # ── Section 6: STAMP PASSPORT COMPLETION ───────────────────────
    r.section("📘", "STAMP PASSPORT COMPLETION")
    stamp_counts = []
    for a in checked_in:
        stamps = len(a.get("stampsCollected", []))
        stamp_counts.append(stamps)

    total_stampable = len(stampable_ids)
    r.table_header()
    r.stat("Stampable Stations", total_stampable)
    r.stat("Avg Stamps per Attendee", f"{safe_div(sum(stamp_counts), len(stamp_counts)):.1f}" if stamp_counts else "0")

    # Distribution
    buckets = [
        ("0 stamps", sum(1 for s in stamp_counts if s == 0)),
        ("1-3 stamps", sum(1 for s in stamp_counts if 1 <= s <= 3)),
        ("4-7 stamps", sum(1 for s in stamp_counts if 4 <= s <= 7)),
        ("8-11 stamps", sum(1 for s in stamp_counts if 8 <= s <= 11)),
        ("12-14 stamps", sum(1 for s in stamp_counts if s >= 12)),
    ]
    r.text("")
    r.text("  Distribution:")
    r.text("")
    r.md_lines.append("| Bucket | Count |")
    r.md_lines.append("|--------|-------|")
    r.histogram(buckets)

    # Completionists
    completionists = [a for a in checked_in if len(a.get("stampsCollected", [])) >= total_stampable]
    r.text("")
    r.stat("All-14 Completionists", len(completionists))
    if completionists:
        r.text("")
        r.text("  🎖  Hall of Fame:")
        for a in completionists:
            r.text(f"     ⭐ {a.get('name')}")
            r.md_lines.append(f"- ⭐ **{a.get('name')}**")

    # ── Section 7: PHOTO BOOTH ─────────────────────────────────────
    r.section("📸", "PHOTO BOOTH")
    r.table_header()
    r.stat("Booth Sessions", len(booth_photos))
    r.stat("Individual Photos Taken", total_individual)

    # Face matching
    total_matches = len(face_matches)
    auto_approved = sum(1 for m in face_matches if m.get("status") == "auto-approved")
    approved = sum(1 for m in face_matches if m.get("status") in ("auto-approved", "approved"))
    r.stat("Face Matches Found", total_matches)
    r.stat("Auto-Approved", auto_approved)
    r.stat("Match Success Rate", f"{safe_div(approved, total_matches) * 100:.0f}%" if total_matches else "N/A")

    # Attendees matched
    matched_attendee_ids = set()
    for p in booth_photos:
        for aid in p.get("attendeeIds", []):
            matched_attendee_ids.add(aid)
    r.stat("Attendees Matched to Photos", len(matched_attendee_ids))

    # Average confidence
    confidences = [m.get("confidence", 0) for m in face_matches if m.get("confidence")]
    if confidences:
        r.stat("Avg Match Confidence", f"{sum(confidences)/len(confidences):.3f}")

    # ── Section 8: VOLUNTEER MVP ───────────────────────────────────
    r.section("🦸", "VOLUNTEER MVP")
    vol_redemptions = Counter()
    for red in redemptions:
        vname = red.get("volunteerName", "Unknown")
        vol_redemptions[vname] += 1

    r.text("  Top volunteers by redemptions processed:")
    r.text("")
    r.ranking(vol_redemptions.most_common(10))

    # Check-ins processed
    checkin_logs = [e for e in audit_log if e.get("action") == "attendee.checked_in"]
    vol_checkins = Counter()
    for e in checkin_logs:
        vol_checkins[e.get("actorName", "Unknown")] += 1
    if vol_checkins:
        r.text("")
        r.text("  Top check-in processors:")
        r.text("")
        r.ranking(vol_checkins.most_common(5), max_show=5)

    # ── Section 9: DIGITAL PASSPORT ADOPTION ───────────────────────
    r.section("📱", "DIGITAL PASSPORT ADOPTION")
    r.table_header()
    selfie_count = sum(1 for a in checked_in if a.get("selfieStorageUrl"))
    r.stat("Selfies Uploaded", f"{selfie_count} ({safe_div(selfie_count, len(checked_in)) * 100:.0f}%)")

    wallet_count = sum(1 for a in checked_in if a.get("walletPassGenerated"))
    r.stat("Wallet Passes Generated", wallet_count)

    wallet_types = Counter()
    for a in checked_in:
        wt = a.get("walletPassType")
        if wt:
            wallet_types[wt] += 1
    for wtype, count in wallet_types.most_common():
        r.stat(f"  {wtype.title()} Wallet", str(count))

    sms_count = sum(1 for a in checked_in if a.get("smsSentAt"))
    r.stat("Pass SMS Sent", str(sms_count))

    # ── Section 10: FUN FACTS & SUPERLATIVES ───────────────────────
    r.section("✨", "FUN FACTS & SUPERLATIVES")

    if checkin_times:
        first_idx = checkin_times.index(min(checkin_times))
        first_person = checked_in[first_idx] if first_idx < len(checked_in) else None
        # Actually need to find the right person
        earliest = min(checkin_times)
        latest_checkin = max(checkin_times)
        first_name = "Unknown"
        last_name = "Unknown"
        for a in checked_in:
            t = to_dt(a.get("checkedInAt"))
            if t == earliest:
                first_name = a.get("name", "Unknown")
            if t == latest_checkin:
                last_name = a.get("name", "Unknown")

        r.text(f"  🏃 First to arrive: {first_name} at {fmt_time(earliest)} ET")
        r.text(f"  🦉 Last to check in: {last_name} at {fmt_time(latest_checkin)} ET")
        r.md_lines.append(f"- 🏃 **First to arrive:** {first_name} at {fmt_time(earliest)} ET")
        r.md_lines.append(f"- 🦉 **Last to check in:** {last_name} at {fmt_time(latest_checkin)} ET")

    # Most stations visited
    if checked_in:
        most_stamps = max(checked_in, key=lambda a: len(a.get("stampsCollected", [])))
        r.text(f"  🗺️  Most stations visited: {most_stamps.get('name')} ({len(most_stamps.get('stampsCollected', []))} stations)")
        r.md_lines.append(f"- 🗺️ **Most stations visited:** {most_stamps.get('name')} ({len(most_stamps.get('stampsCollected', []))} stations)")

    # Busiest minute
    if checkin_times:
        minute_bins = Counter()
        for t in checkin_times:
            et = t - timedelta(hours=4)
            minute_bins[et.strftime("%-I:%M %p")] += 1
        busiest_min, busiest_count = minute_bins.most_common(1)[0]
        r.text(f"  ⏰ Busiest minute: {busiest_min} ET ({busiest_count} check-ins)")
        r.md_lines.append(f"- ⏰ **Busiest minute:** {busiest_min} ET ({busiest_count} check-ins)")

    # Total unique food items tried
    unique_foods = set()
    for red in food_redemptions:
        unique_foods.add(red.get("stationName", ""))
    r.text(f"  🍴 Unique food items served: {len(unique_foods)}")
    r.md_lines.append(f"- 🍴 **Unique food items served:** {len(unique_foods)}")

    # Volunteers count
    active_vols = [v for v in volunteers if v.get("isActive") and v.get("name") != "Dev Test"]
    r.text(f"  🤝 Volunteers who showed up: {len(active_vols)}")
    r.md_lines.append(f"- 🤝 **Volunteers who showed up:** {len(active_vols)}")

    r.text("")
    r.text("━" * 52)
    r.text("  Thank you for an incredible event! 🎉")
    r.text("  Des Rangila 2026 — Tour of India")
    r.text("  University of Maryland · Indian Student Association")
    r.text("━" * 52)
    r.md_lines.append("\n---\n*Generated by Des Rangila Analytics Engine*")

    return r


# ── Main ────────────────────────────────────────────────────────────
def main():
    db = init_firebase()
    report = generate_report(db)

    # Print to stdout
    print(report.output())

    # Save markdown
    md_path = os.path.join(os.path.dirname(__file__), "..", "ANALYTICS_REPORT.md")
    with open(md_path, "w") as f:
        f.write(report.markdown())
    print(f"\n📄 Report saved to ANALYTICS_REPORT.md")


if __name__ == "__main__":
    main()
