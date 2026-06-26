"""
Undi Wrapped — per-seat data build
==================================
Reads the shared MECo foundation (../meco-data/out) and emits, for every
currently-existing constituency, a compact "Wrapped" JSON used by the site.
Includes party/coalition UIDs (for official logos) and runner-up vote shares
(for head-to-head infographics).

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

contests = pd.read_parquet(FOUND / "contests.parquet").sort_values("date")

def slugify(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def seat_slug(row) -> str:
    pre = "p" if row["seat_type"] == "federal" else "n"
    return f"{pre}-{slugify(row['state'])}-{slugify(row['seat_name'])}"

def U(v):  # uid / string or None
    return v if isinstance(v, str) and v else None

def F(v, d=2):  # float or None
    return round(float(v), d) if pd.notna(v) else None

# ---- define "current" seats = contested in the most recent election ----------
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

fed15 = contests[(contests.election == "GE-15") & (contests.seat_type == "federal")]
nat = {
    "fed_turnout_avg": round(float(fed15.voter_turnout.mean()), 1),
    "fed_n_seats": int(len(fed15)),
    "fed_margin_rank": (fed15.dropna(subset=["margin_perc"]).sort_values("margin_perc")["seat_key"].tolist()),
}
state_rank = {}
for elec, g in contests[contests.seat_type == "state"].groupby("election"):
    g = g.dropna(subset=["margin_perc"]).sort_values("margin_perc")
    for i, k in enumerate(g["seat_key"].tolist()):
        state_rank[(elec, k)] = (i + 1, len(g))

index = []
N = 0
for key, g in cur.groupby("seat_key"):
    g = g.sort_values("date").reset_index(drop=True)
    latest, first = g.iloc[-1], g.iloc[0]
    stype = latest["seat_type"]
    slug = seat_slug(latest)

    # uid lookups for parties seen here
    puid = g.dropna(subset=["win_party"]).drop_duplicates("win_party").set_index("win_party")["win_party_uid"].to_dict()
    cuid = g.dropna(subset=["win_coalition"]).drop_duplicates("win_coalition").set_index("win_coalition")["win_coalition_uid"].to_dict()
    coalition_of = g.dropna(subset=["win_party"]).drop_duplicates("win_party").set_index("win_party")["win_coalition"].to_dict()

    winners = g.groupby("win_party").size().sort_values(ascending=False)
    parties_won = [{"party": p, "party_uid": U(puid.get(p)), "coalition": (coalition_of.get(p) or None),
                    "coalition_uid": U(cuid.get(coalition_of.get(p))), "wins": int(n)}
                   for p, n in winners.items()]
    dominant = parties_won[0] if parties_won else None

    contested = g[(~g.uncontested) & g.margin_perc.notna()]
    closest = None
    if len(contested):
        cr = contested.loc[contested.margin_perc.idxmin()]
        closest = {"year": int(cr.year), "election": cr.election,
                   "win_party": cr.win_party, "win_party_uid": U(cr.win_party_uid), "win_coalition": U(cr.win_coalition),
                   "run_party": cr.run_party, "run_party_uid": U(cr.run_party_uid), "run_coalition": U(cr.run_coalition),
                   "win_perc": F(cr.win_votes_perc, 1), "run_perc": F(cr.run_votes_perc, 1),
                   "margin_perc": F(cr.margin_perc)}

    # biggest swing = largest absolute change in winner's vote-share between consecutive contests
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
                "win_party": curr.win_party, "win_party_uid": U(curr.win_party_uid), "win_coalition": U(curr.win_coalition),
                "win_perc": F(curr.win_votes_perc, 1),
                "run_party": curr.run_party, "run_party_uid": U(curr.run_party_uid), "run_coalition": U(curr.run_coalition),
                "run_perc": F(curr.run_votes_perc, 1),
                "prev_win_perc": F(prev.win_votes_perc, 1),
            }

    rank = None
    if stype == "federal" and key in nat["fed_margin_rank"]:
        rank = {"rank": nat["fed_margin_rank"].index(key) + 1, "total": len(nat["fed_margin_rank"]), "scope": "federal seats, GE-15 (2022)"}
    elif (latest.election, key) in state_rank:
        r, t = state_rank[(latest.election, key)]
        rank = {"rank": r, "total": t, "scope": f"state seats, {latest.election}"}

    if stype == "federal":
        nat_turnout = nat["fed_turnout_avg"]
    else:
        ref = contests[(contests.election == latest.election) & (contests.seat_type == "state")]
        nat_turnout = round(float(ref.voter_turnout.mean()), 1)

    timeline = [{
        "year": int(r.year), "election": r.election, "date": r.date, "seat_name": r.seat_name,
        "win_party": r.win_party, "win_party_uid": U(r.win_party_uid),
        "win_coalition": r.win_coalition, "win_coalition_uid": U(r.win_coalition_uid), "win_name": r.win_name,
        "win_perc": F(r.win_votes_perc, 1),
        "run_party": U(r.run_party), "run_party_uid": U(r.run_party_uid), "run_coalition": U(r.run_coalition),
        "run_perc": F(r.run_votes_perc, 1),
        "margin_perc": F(r.margin_perc), "turnout": F(r.voter_turnout, 1),
        "n_candidates": (int(r.n_candidates) if pd.notna(r.n_candidates) else None),
        "uncontested": bool(r.uncontested),
        "electorate": (int(r.voters_total) if pd.notna(r.voters_total) else None),
    } for _, r in g.iterrows()]

    payload = {
        "slug": slug, "seat_type": stype, "state": latest["state"],
        "current_name": latest["seat_name"], "current_seat": latest["seat"],
        "all_names": sorted(g.seat_name.unique().tolist()), "n_names": int(g.seat_name.nunique()),
        "first_year": int(first.year), "last_year": int(latest.year), "n_contests": int(len(g)),
        "founding": {"year": int(first.year), "party": first.win_party, "party_uid": U(first.win_party_uid),
                     "coalition": first.win_coalition, "coalition_uid": U(first.win_coalition_uid),
                     "name": first.win_name, "candidate_uid": U(first.win_candidate_uid), "seat_name": first.seat_name},
        "current_holder": {"party": latest.win_party, "party_uid": U(latest.win_party_uid),
                           "coalition": latest.win_coalition, "coalition_uid": U(latest.win_coalition_uid),
                           "name": latest.win_name, "candidate_uid": U(latest.win_candidate_uid), "year": int(latest.year),
                           "margin_perc": F(latest.margin_perc), "win_perc": F(latest.win_votes_perc, 1),
                           "run_party": U(latest.run_party), "run_party_uid": U(latest.run_party_uid),
                           "run_perc": F(latest.run_votes_perc, 1),
                           "turnout": F(latest.voter_turnout, 1), "uncontested": bool(latest.uncontested)},
        "parties_won": parties_won, "n_distinct_winning_parties": len(parties_won), "dominant_party": dominant,
        "closest": closest, "biggest_swing": biggest_swing, "marginality_rank": rank,
        "turnout_ref": {"national_avg": nat_turnout, "latest_year": int(latest.year)},
        "timeline": timeline,
    }
    (OUT / "seats" / f"{slug}.json").write_text(json.dumps(payload, separators=(",", ":")))
    index.append({"slug": slug, "name": latest["seat_name"], "state": latest["state"],
                  "type": stype, "seat_no": latest["seat"].split()[0],
                  "holder": latest.win_party, "holder_uid": U(latest.win_party_uid),
                  "coalition": latest.win_coalition, "margin": F(latest.margin_perc, 1)})
    N += 1

index.sort(key=lambda x: (x["type"] != "federal", x["seat_no"]))
(OUT / "index.json").write_text(json.dumps(index, separators=(",", ":")))
(OUT / "meta.json").write_text(json.dumps({"fed_turnout_avg": nat["fed_turnout_avg"],
                                           "fed_n_seats": nat["fed_n_seats"], "n_seats_total": N}, indent=2))
print(f"wrote {N} seats ({sum(1 for x in index if x['type']=='federal')} federal, "
      f"{sum(1 for x in index if x['type']=='state')} state)")
