# 🗳️ Undi Wrapped

**Your Malaysian seat, every election since 1955 — wrapped.**
A Spotify-Wrapped-style card stack for any of Malaysia's 222 parliamentary and
600 state constituencies: the founding party, the dynasties, the biggest swings,
the closest calls, and how marginal your seat is right now.

🔗 **Live:** https://zachtheyek.github.io/undi-wrapped/

![Undi Wrapped — Bagan](https://zachtheyek.github.io/undi-wrapped/og/p-pulau-pinang-bagan.png)

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

- **Seat threading.** Malaysian seat identity is _not_ stable across delimitations:
  numbers are reassigned and names change (`P.001` was _Wellesley North → Perlis Utara →
  Kangar → Padang Besar_). We thread a seat's history by **normalised name within a
  state**, which is honest but name-based, not boundary-based. A seat's pre-rename history
  may therefore be incomplete. For true boundary lineage, see the geospatial seat view on
  [electiondata.my](https://electiondata.my/seats/).
- **"Current" seats** = those contested in the most recent election (GE-15 for federal;
  the latest state election per state).
- **Biggest swing** = the largest absolute change in the winning party's vote share between
  consecutive contests at that seat.
- **Marginality rank** = rank by latest winning margin among current seats of the same type.
- **Boundary animation.** Frames are matched to the seat by `(state, normalised name)` across
  each delimitation, then simplified. Seats that were genuinely _renamed_ (not just
  renumbered) only show the delimitations under their current name — the same name-threading
  caveat as above. 821 / 822 seats have at least one frame.
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
npm run data      # regenerate public/data/ from ../meco-data/out (needs the foundation + Python)
python scripts/boundary_build.py   # regenerate public/boundaries/ from MECo electoral maps
npm run dev       # local dev
npm run build     # vite build + 822 OG cards (satori) + per-seat prerender → dist/
```

`public/data/`, `public/boundaries/` and `public/logos/` are committed, so CI builds need
only Node (no Python, no map downloads). Boundaries are built from MECo's electoral-map
GeoJSONs; logos are sourced from electiondata.my (CC0 data; logos are party trademarks used
informationally).

## Deployment & data freshness

Every push to `main` builds and deploys to GitHub Pages
(`.github/workflows/deploy.yml`). A **weekly** scheduled workflow
(`.github/workflows/refresh-data.yml`) re-pulls the latest MECo CSVs from the corpus, reruns
the pipeline + `build_data.py`, and commits + redeploys **only when the seat data actually
changes** — so the site tracks upstream corrections and new results on its own. (Boundaries
are not auto-refreshed; rerun `boundary_build.py` by hand after a redelineation.)

## Licence

Code: MIT. Data: CC0 (MECo / Thevesh Thevananthan).
