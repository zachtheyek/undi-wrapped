# 🗳️ Undi Wrapped

**Your Malaysian seat, every election since 1955 — wrapped.**
A Spotify-Wrapped-style card stack for any of Malaysia's 222 parliamentary and
600 state constituencies: the founding party, the dynasties, the biggest swings,
the closest calls, and how marginal your seat is right now.

🔗 **Live:** https://zachtheyek.github.io/undi-wrapped/

![Undi Wrapped — Klang](https://zachtheyek.github.io/undi-wrapped/og/p-selangor-klang.png)

## Credit

All underlying data is the **Malaysian Election Corpus (MECo)** by
**[Thevesh Thevananthan](https://x.com/Thevesh)** — released under CC0.
This project only visualises that corpus. It is **not affiliated** with the author.

- Data & API: **[electiondata.my](https://electiondata.my)**
- Corpus: [github.com/Thevesh/paper-meco-results](https://github.com/Thevesh/paper-meco-results)
- Paper: _The Malaysian Election Corpus (MECo)_, **Scientific Data 13, 190 (2026)**

## What's inside

- **Instagram-stories navigation.** Auto-advancing cards with a countdown progress bar;
  tap the screen edges or use ◀ ▶ arrow keys; hold the screen or hit the pause button to stop the timer.
- **An animated constituency boundary** on the cover, morphing through every delimitation
  the seat lived through (1954–2019), built from MECo's electoral maps.
- **Official party & coalition logos** on the roll-call, dynasty and head-to-head cards.
- **Head-to-head infographics** for the biggest swing (the previous election stacked above
  the one it swung to) and the closest-ever race — logos on each side, a party-coloured
  vote-share bar in the middle.
- **One search box, no login, mobile-first.** Works one-handed in five seconds.
- **A permalink per seat** (`/seat/<slug>/`) with a **pre-rendered Open Graph card**.
- **Compare mode** — put your seat head-to-head with a friend's on coloured metric bars,
  and swap the compared seat in place at any time.
- Fully static — 822 seat pages + OG images generated at build time.

## Methodology & honest caveats

- **Seat threading.** Malaysian seat identity is _not_ stable across delimitations: numbers
  are reassigned, names change, and a seat can even **keep its name while its boundaries are
  wholly replaced** — pre-2003 _P.190 Tawau_ has **zero** overlap with today's Tawau (its real
  ancestor is the old _Semporna_). So we thread each seat's history by **electiondata.my's
  boundary-based dominant-ancestor lineage**, not by name, so every "Wrapped" follows the true
  line of descent. A split ancestor is legitimately shared by its descendants (1959 _Damansara_
  feeds 11 modern KL/Selangor seats). Lineage from
  [electiondata.my](https://electiondata.my/seats/) (CC0).
- **"Current" seats** = those contested in the most recent election (GE-15 for federal;
  the latest state election per state).
- **Biggest swing** = the largest absolute change in the winning party's vote share between
  consecutive contests at that seat.
- **Marginality rank** = rank by latest winning margin among current seats of the same type.
- **Boundary animation.** The animated outline now follows the **same lineage** as the data:
  at each delimitation it draws the seat's lineage ancestor active in that period — the name is
  read straight from the seat's timeline, not guessed from the current name — so e.g. _Tawau_
  correctly shows the old _Semporna_ shape for its 1984/1994 frames. The map frames remain a
  separate, manually-refreshed feed (see "data freshness"), so they can still lag the _latest_
  delimitation, but they no longer contradict the lineage-threaded history above. 821 / 822
  seats have at least one frame.
- **Candidate photos.** There is **no public dataset of official candidate portraits**
  keyed to the time each person was elected — across 14k candidates and seven decades it
  simply doesn't exist, and auto-matching faces risks showing the _wrong_ person. We
  therefore identify each rep by **name only**, never a photo.
- **Logos** are the official party/coalition marks served by electiondata.my (`<uid>.png`),
  self-hosted here. Historical logo variants "at the time" aren't available as data, so the
  current/canonical mark is used.
- **electiondata.my link.** electiondata.my's seats page selects seats purely client-side
  with **no URL parameter**, so a link cannot pre-populate a specific seat — the "Explore on
  electiondata.my" button opens the seats explorer, where you search the seat yourself.

## Build

```bash
npm install
npm run data        # regenerate public/data/ from ../meco-data/out (needs the foundation + Python)
npm run boundaries  # fetch the latest electoral maps from the lake + rebuild public/boundaries/
npm run dev         # local dev
npm run build       # vite build + 822 OG cards (satori) + per-seat prerender → dist/
```

`public/boundaries/` and `public/logos/` are **committed** (external assets, rarely change);
`public/data/` is **git-ignored and generated** — locally by `npm run data`, in CI by the
deploy workflow (which installs Python + clones the foundation). Boundaries are built from
MECo's electoral-map GeoJSONs; logos are sourced from electiondata.my (CC0 data; logos are
party trademarks used informationally).

## Deployment & data freshness

Per-seat data is **generated in CI, not committed**: the deploy workflow
(`.github/workflows/deploy.yml`) clones the
[meco-data](https://github.com/zachtheyek/meco-data) foundation, runs `build_data.py`, and
builds. Every push deploys; a **weekly** run rebuilds only when the MECo data actually
changed since the last deploy (stamped in `dist/data-version.txt`), so the site tracks
upstream corrections and new results on its own — and does nothing on a quiet week. The
corpus itself auto-refreshes upstream in meco-data, so the whole chain is hands-off.
(Local one-liner to regenerate seat data from `../meco-data/out`: `npm run data`.)

**Boundaries are deliberately _not_ on a schedule.** Unlike results — which change at every
by-election — constituency boundaries only move at a _redelineation_: a roughly once-a-decade,
publicly-gazetted event (the last federal one completed in 2018, and the Constitution bars
another within 8 years of the last). Nor is it a passive feed — the delimitation years are
hard-coded in `boundary_build.py`'s `REGION_YEARS`, and a redelineation splits, merges and
renames seats, which is exactly when the `(state, normalised name)` frame-matching needs a
human to sanity-check it. A blind weekly cron would re-download tens of MB to find nothing
~every time, and could half-update the site at the one moment care is actually needed. So a
refresh is a single manual command:

```bash
npm run boundaries             # fetches the latest maps from the lake + rebuilds public/boundaries/
git status public/boundaries   # any diff = the maps drifted upstream; commit it to publish
```

(If a brand-new delimitation has been gazetted, add its year to `REGION_YEARS` first.)
**Think a seat's boundaries look out of date?
[Open an issue](https://github.com/zachtheyek/undi-wrapped/issues) and we'll rerun the refresh.**

## Sibling projects

Part of a family of civic data-viz tools built on the Malaysian Election Corpus:

- [**Lompat**](https://zachtheyek.github.io/lompat/) — every party-hop since 1955, and the leaderboard of "frogs"
- [**Salasilah**](https://zachtheyek.github.io/salasilah/) — the family tree of Malaysia's parties & coalitions
- [**Nadi Demokrasi**](https://zachtheyek.github.io/nadi-demokrasi/) — the health of the democracy in six indicators
- [**Undi Lain**](https://zachtheyek.github.io/undi-lain/) — re-run past elections under different voting systems
- [**Undi Generasi**](https://zachtheyek.github.io/undi-generasi/) — how Malaysia votes across generations

## Licence

Code: MIT. Data: CC0 (MECo / Thevesh Thevananthan).
