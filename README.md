# 🗳️ Undi Wrapped

**Your Malaysian seat, every election since 1955 — wrapped.**
A Spotify-Wrapped-style card stack for any of Malaysia's 222 parliamentary and
600 state constituencies: the founding party, the dynasties, the biggest swings,
the closest calls, and how marginal your seat is right now.

🔗 **Live:** https://zachtheyek.github.io/undi-wrapped/

![Undi Wrapped — Bagan](https://zachtheyek.github.io/undi-wrapped/og/p-pulau-pinang-bagan.png)

## Credit

All underlying data is the **Malaysian Election Corpus (MECo)** by
**[Thevesh Thevananthan](https://electiondata.my)** — released under CC0.
This project only visualises that corpus. It is **not affiliated** with the author.

- Data & API: **[electiondata.my](https://electiondata.my)**
- Corpus: [github.com/Thevesh/paper-meco-results](https://github.com/Thevesh/paper-meco-results)
- Paper: *The Malaysian Election Corpus (MECo)*, **Scientific Data 13, 190 (2026)**

## What's inside

- **One search box, no login, mobile-first.** Works one-handed in five seconds.
- **A permalink per seat** (`/seat/<slug>/`) with a **pre-rendered Open Graph card**, so
  every share on X / WhatsApp renders a rich, screenshot-native image.
- **Compare mode** (`?compare=<slug>`) — send your seat against a friend's.
- Fully static — 822 seat pages + OG images generated at build time.

## Methodology & honest caveats

- **Seat threading.** Malaysian seat identity is *not* stable across delimitations:
  numbers are reassigned and names change (`P.001` was *Wellesley North → Perlis Utara →
  Kangar → Padang Besar*). We thread a seat's history by **normalised name within a
  state**, which is honest but name-based, not boundary-based. A seat's pre-rename history
  may therefore be incomplete. For true boundary lineage, see the geospatial seat view on
  [electiondata.my](https://electiondata.my/seats/).
- **"Current" seats** = those contested in the most recent election (GE-15 for federal;
  the latest state election per state).
- **Biggest swing** = the largest absolute change in the winning party's vote share between
  consecutive contests at that seat.
- **Marginality rank** = rank by latest winning margin among current seats of the same type.

## Build

```bash
npm install
npm run data      # regenerate public/data/ from ../meco-data/out (needs the foundation repo + Python)
npm run dev       # local dev
npm run build     # vite build + 822 OG cards (satori) + per-seat prerender → dist/
```

`public/data/` is committed, so CI builds need only Node (no Python).

## Licence

Code: MIT. Data: CC0 (MECo / Thevesh Thevananthan).
