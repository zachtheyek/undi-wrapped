"""
Undi Wrapped — per-seat data build
==================================
Reads the shared MECo foundation (../meco-data/out) and emits, for every
currently-existing constituency, a compact "Wrapped" JSON used by the site.

Output:
  public/data/index.json          # search index (all current seats)
  public/data/seats/<slug>.json   # full wrapped payload per seat
  public/data/meta.json           # national reference numbers
"""
from __future__ import annotations
import json, re, unicodedata
from pathlib import Path
import pandas as pd

FOUND = Path("../meco-data/out")
OUT = Path("public/data")
(OUT / "seats").mkdir(parents=True, exist_ok=True)

contests = pd.read_parquet(FOUND / "contests.parquet")
contests = contests.sort_values("date")

def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def seat_slug(row) -> str:
    pre = "p" if row["seat_type"] == "federal" else "n"
    return f"{pre}-{slugify(row['state'])}-{slugify(row['seat_name'])}"

# ---- define "current" seats = contested in the most recent election ----------
# Federal: every seat in GE-15 (2022). State: the latest SE *round* per state.
# This excludes renamed predecessors (e.g. P.188 Silam, renamed Lahad Datu),
# so each currently-existing constituency appears exactly once.
fed_keys = set(contests[(contests.election == "GE-15") & (contests.seat_type == "federal")]["seat_key"])
state_keys = set()
for state, g in contests[contests.seat_type == "state"].groupby("state"):
    se = g[g.election.str.startswith("SE-")]
    if not len(se):
        continue
    latest_round = se.sort_values("date").iloc[-1]["election"]
    state_keys |= set(g[g.election == latest_round]["seat_key"])
current_keys = fed_keys | state_keys
cur = contests[contests["seat_key"].isin(current_keys)].copy()

# national reference numbers (latest federal = GE-15, latest state = each SE round)
fed15 = contests[(contests.election == "GE-15") & (contests.seat_type == "federal")]
nat = {
    "fed_turnout_avg": round(float(fed15.voter_turnout.mean()), 1),
    "fed_n_seats": int(len(fed15)),
    "fed_margin_rank": (fed15.dropna(subset=["margin_perc"])
                        .sort_values("margin_perc")["seat_key"].tolist()),
}

# precompute state-round marginality rankings (group by election round)
state_rank = {}
for elec, g in contests[contests.seat_type == "state"].groupby("election"):
    g = g.dropna(subset=["margin_perc"]).sort_values("margin_perc")
    for i, k in enumerate(g["seat_key"].tolist()):
        state_rank[(elec, k)] = (i + 1, len(g))

index = []
N = 0
for key, g in cur.groupby("seat_key"):
    g = g.sort_values("date").reset_index(drop=True)
    latest = g.iloc[-1]
    first = g.iloc[0]
    stype = latest["seat_type"]
    slug = seat_slug(latest)

    # parties that have WON it
    winners = g.groupby("win_party").size().sort_values(ascending=False)
    coalition_of = g.dropna(subset=["win_party"]).drop_duplicates("win_party").set_index("win_party")["win_coalition"]
    parties_won = [{"party": p, "coalition": (coalition_of.get(p) or None), "wins": int(n)}
                   for p, n in winners.items()]
    dominant = parties_won[0] if parties_won else None

    # closest race ever (smallest nonzero margin)
    contested = g[(~g.uncontested) & g.margin_perc.notna()]
    closest = None
    if len(contested):
        cr = contested.loc[contested.margin_perc.idxmin()]
        closest = {"year": int(cr.year), "election": cr.election,
                   "win_party": cr.win_party, "run_party": cr.run_party,
                   "margin_perc": round(float(cr.margin_perc), 2)}

    # biggest swing = largest absolute change in winning party's vote-share between
    # consecutive contests; flag if the seat changed coalition.
    biggest_swing = None
    gc = g[g.win_votes_perc.notna()].reset_index(drop=True)
    best = 0.0
    for i in range(1, len(gc)):
        prev, curr = gc.iloc[i - 1], gc.iloc[i]
        d = abs(float(curr.win_votes_perc) - float(prev.win_votes_perc))
        if d > best:
            best = d
            biggest_swing = {
                "year": int(curr.year), "election": curr.election,
                "swing_pp": round(float(curr.win_votes_perc) - float(prev.win_votes_perc), 1),
                "from_coalition": prev.win_coalition, "to_coalition": curr.win_coalition,
                "flipped": bool(prev.win_coalition != curr.win_coalition),
                "win_party": curr.win_party,
            }

    # national marginality rank (current)
    rank = None
    if stype == "federal" and key in nat["fed_margin_rank"]:
        rank = {"rank": nat["fed_margin_rank"].index(key) + 1, "total": len(nat["fed_margin_rank"]),
                "scope": "federal seats, GE-15 (2022)"}
    elif (latest.election, key) in state_rank:
        r, t = state_rank[(latest.election, key)]
        rank = {"rank": r, "total": t, "scope": f"state seats, {latest.election}"}

    # turnout reference for latest contest
    if stype == "federal":
        nat_turnout = nat["fed_turnout_avg"]
    else:
        ref = contests[(contests.election == latest.election) & (contests.seat_type == "state")]
        nat_turnout = round(float(ref.voter_turnout.mean()), 1)

    timeline = [{
        "year": int(r.year), "election": r.election, "date": r.date,
        "seat_name": r.seat_name,
        "win_party": r.win_party, "win_coalition": r.win_coalition, "win_name": r.win_name,
        "margin_perc": (round(float(r.margin_perc), 2) if pd.notna(r.margin_perc) else None),
        "turnout": (round(float(r.voter_turnout), 1) if pd.notna(r.voter_turnout) else None),
        "n_candidates": (int(r.n_candidates) if pd.notna(r.n_candidates) else None),
        "uncontested": bool(r.uncontested),
        "electorate": (int(r.voters_total) if pd.notna(r.voters_total) else None),
    } for _, r in g.iterrows()]

    payload = {
        "slug": slug, "seat_type": stype, "state": latest["state"],
        "current_name": latest["seat_name"], "current_seat": latest["seat"],
        "all_names": sorted(g.seat_name.unique().tolist()),
        "n_names": int(g.seat_name.nunique()),
        "first_year": int(first.year), "last_year": int(latest.year),
        "n_contests": int(len(g)),
        "founding": {"year": int(first.year), "party": first.win_party,
                     "coalition": first.win_coalition, "name": first.win_name,
                     "seat_name": first.seat_name},
        "current_holder": {"party": latest.win_party, "coalition": latest.win_coalition,
                           "name": latest.win_name, "year": int(latest.year),
                           "margin_perc": (round(float(latest.margin_perc), 2)
                                           if pd.notna(latest.margin_perc) else None),
                           "turnout": (round(float(latest.voter_turnout), 1)
                                       if pd.notna(latest.voter_turnout) else None),
                           "uncontested": bool(latest.uncontested)},
        "parties_won": parties_won, "n_distinct_winning_parties": len(parties_won),
        "dominant_party": dominant,
        "closest": closest, "biggest_swing": biggest_swing,
        "marginality_rank": rank,
        "turnout_ref": {"national_avg": nat_turnout, "latest_year": int(latest.year)},
        "timeline": timeline,
    }
    (OUT / "seats" / f"{slug}.json").write_text(json.dumps(payload, separators=(",", ":")))
    index.append({"slug": slug, "name": latest["seat_name"], "state": latest["state"],
                  "type": stype, "seat_no": latest["seat"].split()[0],
                  "holder": latest.win_party, "coalition": latest.win_coalition,
                  "margin": (round(float(latest.margin_perc), 1) if pd.notna(latest.margin_perc) else None)})
    N += 1

index.sort(key=lambda x: (x["type"] != "federal", x["seat_no"]))
(OUT / "index.json").write_text(json.dumps(index, separators=(",", ":")))
(OUT / "meta.json").write_text(json.dumps({
    "fed_turnout_avg": nat["fed_turnout_avg"], "fed_n_seats": nat["fed_n_seats"],
    "n_seats_total": N,
}, indent=2))

print(f"wrote {N} seats ({sum(1 for x in index if x['type']=='federal')} federal, "
      f"{sum(1 for x in index if x['type']=='state')} state)")
