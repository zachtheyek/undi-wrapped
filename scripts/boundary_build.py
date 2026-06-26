"""
Undi Wrapped — per-seat boundary frames
=======================================
For every current federal seat, extracts its constituency boundary at each
delimitation (1954–2019), simplifies it, normalises all frames to a shared
viewBox, and writes public/boundaries/<slug>.json. The cover animates these
frames, looping from the seat's earliest to latest delimitation.

Matching: by (state, normalised name). Most seats keep their name across
delimitations and are only renumbered, so this threads them correctly; a small
number that were actually *renamed* will only show the delimitations under their
current name (documented honestly on the page).

Source: electiondata.my open data lake (MECo electoral maps, CC0).
No external geo deps — plain GeoJSON + an iterative Douglas–Peucker.
"""
from __future__ import annotations
import json, re, math, unicodedata
from pathlib import Path

MAPS = Path("/Users/zach/Documents/Projects/in_progress/_maps")
DATA = Path("public/data")
OUT = Path("public/boundaries"); OUT.mkdir(parents=True, exist_ok=True)

REGION_YEARS = {
    ("parlimen", "peninsular"): [1954, 1958, 1974, 1984, 1994, 2003, 2018],
    ("parlimen", "sabah"): [1966, 1974, 1984, 1994, 2003, 2019],
    ("parlimen", "sarawak"): [1968, 1977, 1987, 1996, 2005, 2015],
    ("dun", "peninsular"): [1958, 1974, 1984, 1994, 2003, 2018],
    ("dun", "sabah"): [1966, 1974, 1984, 1994, 2003, 2019],
    ("dun", "sarawak"): [1968, 1977, 1987, 1996, 2005, 2015],
}
PENINSULAR = {"Perlis", "Kedah", "Pulau Pinang", "Perak", "Kelantan", "Terengganu", "Pahang",
              "Selangor", "Negeri Sembilan", "Melaka", "Johor", "W.P. Kuala Lumpur", "W.P. Putrajaya"}

def region_of(state: str) -> str:
    if state in PENINSULAR: return "peninsular"
    if state in ("Sabah", "W.P. Labuan"): return "sabah"
    return "sarawak"

def norm(name: str) -> str:
    name = re.sub(r"^[PN]\.\d+\s+", "", name)
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower().strip()
    repl = {"datoh": "datuk", "datok": "datuk", "bahru": "baru", "baharu": "baru", "ulu": "hulu", "hilor": "hilir"}
    return " ".join(repl.get(t, t) for t in re.split(r"\s+", name) if t)

# ---- load all delimitation features: maps[region][year] = {(state,normname): [rings...]} ----
def rings_of(geom):
    """Exterior rings only (drop holes); handles Polygon + MultiPolygon."""
    t = geom["type"]; c = geom["coordinates"]
    if t == "Polygon": return [c[0]]
    if t == "MultiPolygon": return [poly[0] for poly in c]
    return []

maps: dict = {}
for (level, region), years in REGION_YEARS.items():
    for y in years:
        fp = MAPS / f"{region}_{y}_{level}.geojson"
        if not fp.exists(): continue
        g = json.loads(fp.read_text())
        d = {}
        for ft in g["features"]:
            p = ft["properties"]
            st = p.get("state"); nm = p.get(level) or p.get("name") or ""
            if not st: continue
            d[(st, norm(nm))] = rings_of(ft["geometry"])
        maps[(level, region, y)] = d

# ---- Douglas–Peucker (iterative) ----
def perp(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0: return math.hypot(px - ax, py - ay)
    return abs(dy * px - dx * py + bx * ay - by * ax) / math.hypot(dx, dy)

def rdp(pts, eps):
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        dmax, idx = 0.0, -1
        for k in range(i + 1, j):
            d = perp(pts[k], pts[i], pts[j])
            if d > dmax: dmax, idx = d, k
        if dmax > eps and idx != -1:
            keep[idx] = True; stack.append((i, idx)); stack.append((idx, j))
    return [p for p, k in zip(pts, keep) if k]

index = json.loads((DATA / "index.json").read_text())
written = 0
frame_counts = {}
for item in index:
    seat = json.loads((DATA / "seats" / f"{item['slug']}.json").read_text())
    state = seat["state"]; region = region_of(state)
    level = "parlimen" if seat["seat_type"] == "federal" else "dun"
    names = {norm(n) for n in seat["all_names"]} | {norm(seat["current_name"])}
    frames = []
    for y in REGION_YEARS[(level, region)]:
        d = maps.get((level, region, y), {})
        rings = None
        for nm in names:
            if (state, nm) in d: rings = d[(state, nm)]; break
        if rings: frames.append((y, rings))
    if not frames: continue
    # shared bbox over all frames + cos(lat) x-correction
    allc = [pt for _, rings in frames for ring in rings for pt in ring]
    minx = min(p[0] for p in allc); maxx = max(p[0] for p in allc)
    miny = min(p[1] for p in allc); maxy = max(p[1] for p in allc)
    midlat = (miny + maxy) / 2
    kx = math.cos(math.radians(midlat))
    dx = (maxx - minx) * kx or 1e-9; dy = (maxy - miny) or 1e-9
    VB = 1000; pad = 40
    scale = min((VB - 2 * pad) / dx, (VB - 2 * pad) / dy)
    ox = (VB - dx * scale) / 2; oy = (VB - dy * scale) / 2
    eps = max(dx, dy) * 0.0016  # simplify tolerance in (corrected) degrees
    out_frames = []
    for y, rings in frames:
        paths = []
        for ring in rings:
            ring = rdp(ring, eps)
            if len(ring) < 3: continue
            pts = []
            for lng, lat in ring:
                x = ox + (lng - minx) * kx * scale
                yv = oy + (maxy - lat) * scale
                pts.append(f"{x:.1f},{yv:.1f}")
            paths.append("M" + "L".join(pts) + "Z")
        if paths: out_frames.append({"year": y, "paths": paths})
    if not out_frames: continue
    (OUT / f"{item['slug']}.json").write_text(json.dumps(
        {"vb": VB, "frames": out_frames, "name": seat["current_name"]}, separators=(",", ":")))
    written += 1
    frame_counts[len(out_frames)] = frame_counts.get(len(out_frames), 0) + 1

report = [f"seats with boundaries: {written}/{len(index)}",
          "frame-count distribution: " + str(dict(sorted(frame_counts.items()))),
          f"total size: {sum(f.stat().st_size for f in OUT.glob('*.json'))/1e6:.2f} MB"]
Path("/tmp/boundary_report.txt").write_text("\n".join(report))
print("\n".join(report))
