import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./style.css";
import { partyColor, coalitionColor, GRADIENTS } from "./colors";

const BASE = import.meta.env.BASE_URL;
const METHODOLOGY_URL = "https://github.com/zachtheyek/undi-wrapped#methodology--honest-caveats";
const ELECTIONDATA_SEATS = "https://electiondata.my/seats/";
const app = document.getElementById("app")!;

// ---------- types ----------
interface IndexItem { slug: string; name: string; state: string; type: string; seat_no: string; holder: string; holder_uid?: string | null; coalition: string | null; margin: number | null; }
interface PartyRef { party: string; party_uid?: string | null; coalition?: string | null; coalition_uid?: string | null; wins?: number; }
interface TL { year: number; election: string; win_party: string; win_party_uid?: string | null; win_coalition: string | null; win_name: string; win_perc: number | null; run_party?: string | null; run_perc?: number | null; margin_perc: number | null; turnout: number | null; n_candidates: number | null; uncontested: boolean; electorate: number | null; }
interface Seat {
  slug: string; seat_type: string; state: string; current_name: string; current_seat: string;
  all_names: string[]; n_names: number; first_year: number; last_year: number; n_contests: number;
  founding: { year: number; party: string; party_uid?: string | null; coalition: string | null; name: string; seat_name: string };
  current_holder: { party: string; party_uid?: string | null; coalition: string | null; name: string; year: number; margin_perc: number | null; win_perc?: number | null; run_party?: string | null; run_perc?: number | null; turnout: number | null; uncontested: boolean };
  parties_won: PartyRef[]; n_distinct_winning_parties: number; dominant_party: PartyRef | null;
  closest: { year: number; win_party: string; win_party_uid?: string | null; run_party: string; run_party_uid?: string | null; win_perc: number | null; run_perc: number | null; margin_perc: number } | null;
  biggest_swing: { year: number; swing_pp: number; from_coalition: string | null; to_coalition: string | null; flipped: boolean; win_party: string; win_party_uid?: string | null; win_perc?: number | null; run_party?: string | null; run_party_uid?: string | null; run_perc?: number | null; prev_year?: number; prev_win_party?: string | null; prev_win_party_uid?: string | null; prev_win_perc?: number | null; prev_run_party?: string | null; prev_run_party_uid?: string | null; prev_run_perc?: number | null } | null;
  marginality_rank: { rank: number; total: number; scope: string } | null;
  turnout_ref: { national_avg: number; latest_year: number };
  timeline: TL[];
}
interface Boundary { vb: number; frames: { year: number; paths: string[] }[]; name: string; }

// ---------- utils ----------
const esc = (s: string) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const num = (n: number, d = 1) => n.toLocaleString("en-MY", { minimumFractionDigits: d, maximumFractionDigits: d });
const ord = (n: number) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const seatLabel = (s: Seat) => `${s.current_seat.split(" ")[0]} ${s.current_name}`;
const dot = (c: string) => `<i class="dot" style="background:${c}"></i>`;
const CONNECTORS = new Set(["bin", "binti", "bte", "al", "a/l", "a/p", "ap", "@", "dato", "datuk", "tan", "sri", "haji", "hajjah", "dr", "ir"]);
function initials(name: string): string {
  const parts = name.split(/[\s/]+/).filter((w) => w && !CONNECTORS.has(w.toLowerCase().replace(/[.,]/g, "")));
  const ls = parts.slice(0, 2).map((w) => w[0]?.toUpperCase()).filter(Boolean);
  return ls.join("") || name[0]?.toUpperCase() || "?";
}
function partyLogo(uid: string | null | undefined, label: string, color: string, size = 40): string {
  const badge = `<span class="logobadge" style="width:${size}px;height:${size}px;background:${color};${uid ? "display:none" : ""}">${esc(initials(label))}</span>`;
  const img = uid ? `<img class="logo" src="${BASE}logos/parties/${uid}.png" width="${size}" height="${size}" alt="${esc(label)} logo" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : "";
  return `<span class="logowrap" style="width:${size}px;height:${size}px">${img}${badge}</span>`;
}

function go(slug: string, compare?: string | null) {
  history.pushState({}, "", `${BASE}seat/${slug}/` + (compare ? `?compare=${compare}` : ""));
  route();
}
async function loadIndex(): Promise<IndexItem[]> {
  if ((window as any).__IDX__) return (window as any).__IDX__;
  const idx = await fetch(`${BASE}data/index.json`).then((r) => r.json());
  (window as any).__IDX__ = idx; return idx;
}
async function loadSeat(slug: string): Promise<Seat> {
  const pre = (window as any).__SEAT__;
  if (pre && pre.slug === slug) return pre;
  return fetch(`${BASE}data/seats/${slug}.json`).then((r) => { if (!r.ok) throw new Error("404"); return r.json(); });
}
async function loadBoundary(slug: string): Promise<Boundary | null> {
  return fetch(`${BASE}boundaries/${slug}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
}

// ---------- toast ----------
function toast(msg: string) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.innerHTML = `<span class="tick">✓</span> ${esc(msg)}`;
  t.classList.add("show");
  clearTimeout((t as any)._h);
  (t as any)._h = setTimeout(() => t!.classList.remove("show"), 2600);
}

// ---------- router ----------
function getRoute() {
  const m = location.pathname.match(/\/seat\/([^/]+)/);
  const slug = m ? decodeURIComponent(m[1]) : new URLSearchParams(location.search).get("seat");
  const compare = new URLSearchParams(location.search).get("compare");
  return { slug, compare };
}
let returnSlide = 0;
async function route() {
  const { slug, compare } = getRoute();
  if (!slug) return renderLanding();
  app.innerHTML = `<div class="loading">Loading…</div>`;
  try {
    const seat = await loadSeat(slug);
    if (compare) {
      const other = await loadSeat(compare).catch(() => null);
      return renderCompare(seat, other);
    }
    renderDeck(seat);
  } catch {
    app.innerHTML = `<div class="err"><div><h2>Seat not found.</h2><p style="margin-top:12px"><a href="${BASE}">← Search again</a></p></div></div>`;
  }
}
window.addEventListener("popstate", route);

// ---------- landing ----------
async function renderLanding() {
  app.innerHTML = `
    <div class="landing"><div class="landing__inner">
      <h1 class="brand">Undi<br>Wrapped<small>Your Malaysian seat — every election since 1955, wrapped.</small></h1>
      <div class="search">
        <input id="q" type="search" autocomplete="off" placeholder="Search your seat — e.g. Bagan, Pekan, Lembah Pantai…" />
        <ul class="results" id="results"></ul>
      </div>
      <div class="examples" id="examples"></div>
      <p class="hint">222 parliament seats · 600 state seats · 1955–2022</p>
      <p class="attribution">
        Built on the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a>
        by <a href="https://x.com/Thevesh" target="_blank" rel="noopener">Thevesh Thevananthan</a> (CC0).
        Not affiliated with the author. <a href="https://github.com/zachtheyek/undi-wrapped" target="_blank" rel="noopener">Source</a>.
      </p>
    </div></div>`;
  const idx = await loadIndex();
  const input = document.getElementById("q") as HTMLInputElement;
  const results = document.getElementById("results")!;
  const examples = document.getElementById("examples")!;
  ["Bagan", "Pekan", "Lembah Pantai", "Kota Bharu", "Iskandar Puteri"].forEach((nm) => {
    const it = idx.find((x) => x.name === nm && x.type === "federal");
    if (!it) return;
    const b = document.createElement("button"); b.textContent = nm; b.onclick = () => go(it.slug); examples.appendChild(b);
  });
  let active = -1;
  const render = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.innerHTML = ""; active = -1; return; }
    const hits = idx.filter((x) => x.name.toLowerCase().includes(q) || x.state.toLowerCase().includes(q) || x.seat_no.toLowerCase().includes(q))
      .sort((a, b) => (a.type === b.type ? 0 : a.type === "federal" ? -1 : 1)).slice(0, 30);
    results.innerHTML = hits.map((h, i) => `
      <li data-slug="${h.slug}" class="${i === active ? "active" : ""}">${dot(coalitionColor(h.coalition))}
        <span class="seatno">${esc(h.seat_no)}</span>
        <span><span class="nm">${esc(h.name)}</span> <span class="st">· ${esc(h.state)} · ${h.type === "federal" ? "Parlimen" : "DUN"}</span></span></li>`).join("");
    results.querySelectorAll("li").forEach((li) => li.addEventListener("click", () => go((li as HTMLElement).dataset.slug!)));
  };
  input.addEventListener("input", () => { active = -1; render(); });
  input.addEventListener("keydown", (e) => {
    const items = [...results.querySelectorAll("li")];
    if (e.key === "ArrowDown") { active = Math.min(active + 1, items.length - 1); render(); }
    else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); render(); }
    else if (e.key === "Enter" && items[active]) go((items[active] as HTMLElement).dataset.slug!);
  });
  input.focus();
}

// ---------- charts ----------
function lineChart(points: { x: number; y: number; color: string }[], opts: { yMax?: number } = {}) {
  const w = 480, h = 200, padL = 34, padR = 16, padT = 14, padB = 26;
  const xs = points.map((p) => p.x);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMax = opts.yMax ?? Math.max(...points.map((p) => p.y), 1) * 1.1;
  const sx = (x: number) => padL + ((x - xMin) / Math.max(1, xMax - xMin)) * (w - padL - padR);
  const sy = (y: number) => h - padB - ((y) / yMax) * (h - padT - padB);
  const path = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join("");
  const area = `${path}L${sx(xMax).toFixed(1)},${h - padB}L${sx(xMin).toFixed(1)},${h - padB}Z`;
  const dots = points.map((p) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="4.5" fill="${p.color}" stroke="#fff" stroke-width="1.4"/>`).join("");
  let axis = "";
  for (let t = 0; t <= 4; t++) {
    const v = (yMax / 4) * t, yy = sy(v).toFixed(1);
    axis += `<line x1="${padL}" y1="${yy}" x2="${w - padR}" y2="${yy}" stroke="rgba(255,255,255,.16)" stroke-width="1"/>` +
      `<text x="${padL - 6}" y="${(+yy + 4).toFixed(1)}" font-size="11" fill="rgba(255,255,255,.7)" text-anchor="end">${Math.round(v)}</text>`;
  }
  return `<div class="spark"><svg viewBox="0 0 ${w} ${h}" role="img">
    ${axis}
    <path d="${area}" fill="rgba(255,255,255,.13)"/>
    <path d="${path}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text x="${padL}" y="${h - 8}" font-size="11" fill="rgba(255,255,255,.65)">${xMin}</text>
    <text x="${w - padR}" y="${h - 8}" font-size="11" fill="rgba(255,255,255,.65)" text-anchor="end">${xMax}</text>
    <text x="${(padL - 26)}" y="${(h) / 2}" font-size="10" fill="rgba(255,255,255,.55)" transform="rotate(-90 ${padL - 26} ${h / 2})" text-anchor="middle">margin (pts)</text>
  </svg></div>`;
}

type HHSide = { party: string; uid?: string | null; color: string; perc: number | null };
function headToHead(L: HHSide, R: HHSide, caption: string, size = 64) {
  const lp = L.perc ?? 0, rp = R.perc ?? 0, tot = lp + rp || 1;
  const lpct = (lp / tot) * 100;
  return `<div class="h2h">
    <div class="h2h__side">${partyLogo(L.uid, L.party, L.color, size)}<div class="h2h__nm">${esc(L.party)}</div><div class="h2h__pc">${L.perc != null ? num(L.perc) + "%" : "—"}</div></div>
    <div class="h2h__mid">
      <div class="h2h__bar"><span style="width:${lpct}%;background:${L.color}"></span><span style="width:${100 - lpct}%;background:${R.color}"></span></div>
      ${caption ? `<div class="h2h__cap">${caption}</div>` : ""}
    </div>
    <div class="h2h__side">${partyLogo(R.uid, R.party, R.color, size)}<div class="h2h__nm">${esc(R.party)}</div><div class="h2h__pc">${R.perc != null ? num(R.perc) + "%" : "—"}</div></div>
  </div>`;
}

function turnoutBars(seatVal: number, natVal: number) {
  const max = Math.max(seatVal, natVal, 1), H = 150;
  const bar = (label: string, v: number, color: string) =>
    `<div class="tbar"><div class="tbar__val">${num(v)}%</div><div class="tbar__col" style="height:${(v / max * H).toFixed(0)}px;background:${color}"></div><div class="tbar__lab">${label}</div></div>`;
  return `<div class="turnout">${bar("National", natVal, "rgba(255,255,255,.45)")}${bar("This seat", seatVal, "#ffd23d")}</div>`;
}

// ---------- boundary animation ----------
let boundaryTimer: any = null;
function clearBoundary() { if (boundaryTimer) { clearInterval(boundaryTimer); boundaryTimer = null; } }
function mountBoundary(host: HTMLElement, b: Boundary) {
  const vb = b.vb;
  const groups = b.frames.map((f, i) =>
    `<g class="bframe" data-i="${i}" style="opacity:${i === 0 ? 1 : 0}">${f.paths.map((p) => `<path d="${p}" fill="rgba(255,255,255,.10)" stroke="rgba(255,255,255,.85)" stroke-width="3" stroke-linejoin="round"/>`).join("")}</g>`).join("");
  host.innerHTML = `<svg class="bsvg" viewBox="0 0 ${vb} ${vb}" preserveAspectRatio="xMidYMid meet">${groups}</svg><div class="byear">${b.frames[0].year}</div>`;
  if (b.frames.length < 2) return;
  const gEls = [...host.querySelectorAll(".bframe")] as HTMLElement[];
  const yEl = host.querySelector(".byear") as HTMLElement;
  let i = 0;
  clearBoundary();
  boundaryTimer = setInterval(() => {
    i = (i + 1) % b.frames.length;
    gEls.forEach((g, j) => (g.style.opacity = j === i ? "1" : "0"));
    yEl.textContent = String(b.frames[i].year);
  }, 1300);
}

// ---------- deck ----------
const DURATION = 7000; // auto-advance per slide (ms)
const ICON_PAUSE = `<svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><rect x="2" y="1" width="3" height="10" rx="1"/><rect x="7" y="1" width="3" height="10" rx="1"/></svg>`;
const ICON_PLAY = `<svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1.4 L10.4 6 L3 10.6 Z"/></svg>`;
function renderDeck(s: Seat, startAt = 0) {
  document.title = `${seatLabel(s)} — Undi Wrapped`;
  const dom = s.dominant_party, ch = s.current_holder;
  const contested = s.timeline.filter((t) => t.margin_perc != null);
  const cards: string[] = [];

  // 0 cover (with boundary animation)
  cards.push(`<div class="cover">
    <div class="cover__map" id="cover-map"></div>
    <div class="cover__fg">
      <div class="kicker">${s.seat_type === "federal" ? "Parlimen" : "Dewan Undangan Negeri"} · ${esc(s.state)}</div>
      <div class="headline" style="margin-top:10px;font-size:clamp(40px,12vw,68px)">${esc(s.current_name)}</div>
      <div class="sub" style="opacity:.95">${esc(s.current_seat.split(" ")[0])} · <strong>Undi Wrapped</strong></div>
      <div class="sub"><strong>${s.n_contests}</strong> elections since <strong>${s.first_year}</strong>${s.n_names > 1 ? ` · known by ${s.n_names} names` : ""}.</div>
    </div></div>`);

  // 1 origin
  cards.push(`
    <div class="kicker">In the beginning</div>
    <div class="sub" style="margin-top:14px">It all started in</div>
    <div class="big" style="margin:2px 0 6px">${s.founding.year}</div>
    <div class="sub">First won by <strong>${esc(s.founding.name)}</strong></div>
    <div class="partyline">${partyLogo(s.founding.party_uid, s.founding.party, partyColor(s.founding.party), 34)}<strong>${esc(s.founding.party)}</strong>${s.founding.seat_name !== s.current_name ? `<span style="opacity:.8"> · then called <strong>${esc(s.founding.seat_name)}</strong></span>` : ""}</div>`);

  // 2 roll call (party logos)
  cards.push(`
    <div class="kicker">The roll call</div>
    <div class="big">${s.n_distinct_winning_parties}</div>
    <div class="sub">${s.n_distinct_winning_parties === 1 ? "party has" : "different parties have"} ever won here, across <strong>${s.n_contests}</strong> contests.</div>
    <div class="rollcall">${s.parties_won.map((p) => `<div class="rollcall__item">${partyLogo(p.party_uid, p.party, partyColor(p.party), 46)}<div class="rollcall__nm">${esc(p.party)}</div><div class="rollcall__w">×${p.wins}</div></div>`).join("")}</div>`);

  // 3 dynasty (logo)
  if (dom) {
    const share = Math.round((dom.wins! / s.n_contests) * 100);
    cards.push(`
      <div class="kicker">The dynasty</div>
      <div class="avrow">${partyLogo(dom.party_uid, dom.party, partyColor(dom.party), 84)}</div>
      <div class="headline">${esc(dom.party)} owns this place.</div>
      <div class="big">${share}%</div>
      <div class="sub"><strong>${esc(dom.party)}</strong> has won <strong>${dom.wins}</strong> of ${s.n_contests} contests here.</div>`);
  }

  // 4 trajectory (with y-axis)
  if (contested.length >= 3) {
    const pts = contested.map((t) => ({ x: t.year, y: t.margin_perc!, color: coalitionColor(t.win_coalition) }));
    cards.push(`
      <div class="kicker">The trajectory</div>
      <div class="headline" style="margin-top:8px">How safe has it been?</div>
      ${lineChart(pts, { yMax: 100 })}
      <div class="tiny">Winning margin (percentage points) at each election. Higher = a safer seat; dips near the floor are the nail-biters.</div>`);
  }

  // 5 biggest swing (two stacked results: previous election on top, current below)
  if (s.biggest_swing && s.biggest_swing.win_perc != null && s.biggest_swing.run_party && s.biggest_swing.prev_win_party && s.biggest_swing.prev_run_party) {
    const bs = s.biggest_swing;
    const swing = `${bs.swing_pp > 0 ? "+" : ""}${num(bs.swing_pp)} pt swing`;
    const prevBar = headToHead({ party: bs.prev_win_party!, uid: bs.prev_win_party_uid, color: partyColor(bs.prev_win_party!), perc: bs.prev_win_perc ?? null },
                               { party: bs.prev_run_party!, uid: bs.prev_run_party_uid, color: partyColor(bs.prev_run_party!), perc: bs.prev_run_perc ?? null }, "", 52);
    const currBar = headToHead({ party: bs.win_party, uid: bs.win_party_uid, color: partyColor(bs.win_party), perc: bs.win_perc ?? null },
                               { party: bs.run_party!, uid: bs.run_party_uid, color: partyColor(bs.run_party!), perc: bs.run_perc ?? null }, "", 52);
    cards.push(`
      <div class="kicker">The earthquake</div>
      <div class="sub" style="margin-top:4px">The ground moved most in <strong>${bs.year}</strong></div>
      <div class="quake">
        <div class="quake__yr">${bs.prev_year}</div>
        ${prevBar}
        <div class="quake__swing">${swing}</div>
        <div class="quake__yr">${bs.year}</div>
        ${currBar}
      </div>`);
  } else if (s.biggest_swing && s.biggest_swing.win_perc != null && s.biggest_swing.run_party) {
    const bs = s.biggest_swing;
    const swing = `${bs.swing_pp > 0 ? "+" : ""}${num(bs.swing_pp)} pt swing`;
    cards.push(`
      <div class="kicker">The earthquake</div>
      <div class="sub" style="margin-top:4px">The ground moved most in <strong>${bs.year}</strong></div>
      ${headToHead({ party: bs.win_party, uid: bs.win_party_uid, color: partyColor(bs.win_party), perc: bs.win_perc ?? null },
                   { party: bs.run_party!, uid: bs.run_party_uid, color: partyColor(bs.run_party!), perc: bs.run_perc ?? null }, swing)}`);
  } else if (s.biggest_swing) {
    const bs = s.biggest_swing;
    cards.push(`<div class="kicker">The earthquake</div><div class="sub" style="margin-top:8px">The ground moved most in</div><div class="big">${bs.year}</div>
      <div class="sub">The winner's vote share moved <strong>${bs.swing_pp > 0 ? "+" : ""}${num(bs.swing_pp)} pts</strong>${bs.flipped ? `, and the seat <strong>flipped</strong>.` : " — held, but shaken."}</div>`);
  }

  // 6 closest race (head-to-head)
  if (s.closest && s.closest.win_perc != null) {
    const cl = s.closest;
    cards.push(`
      <div class="kicker">The photo finish</div>
      <div class="sub" style="margin-top:4px">Closest call ever, in <strong>${cl.year}</strong> — by just <strong>${num(cl.margin_perc, 2)} pts</strong></div>
      ${headToHead({ party: cl.win_party, uid: cl.win_party_uid, color: partyColor(cl.win_party), perc: cl.win_perc ?? null },
                   { party: cl.run_party, uid: cl.run_party_uid, color: partyColor(cl.run_party), perc: cl.run_perc ?? null }, "")}`);
  }

  // 7 right now (rep name + logo + marginality)
  const mr = s.marginality_rank;
  cards.push(`
    <div class="kicker">Right now</div>
    <div class="sub" style="margin-top:14px">Your current rep:</div>
    <div class="headline" style="font-size:clamp(28px,8vw,44px)">${esc(ch.name)}</div>
    <div class="partyline">${partyLogo(ch.party_uid, ch.party, partyColor(ch.party), 32)}<strong>${esc(ch.party)}</strong>${ch.coalition && ch.coalition !== "ALONE" ? ` · ${esc(ch.coalition)}` : ""}</div>
    <div class="sub">won ${ch.uncontested ? "<strong>unopposed</strong>" : `by <strong>${num(ch.margin_perc ?? 0)} pts</strong>`} in ${ch.year}.</div>
    ${mr ? `<div class="chips"><span class="chip">🔪 <b>${ord(mr.rank)}</b> most marginal of ${mr.total}</span></div><div class="tiny">${esc(mr.scope)}</div>` : ""}`);

  // 8 turnout (bar chart)
  if (ch.turnout != null) {
    const diff = ch.turnout - s.turnout_ref.national_avg;
    cards.push(`
      <div class="kicker">Turnout</div>
      <div class="headline" style="margin-top:6px">${num(ch.turnout)}% turned out</div>
      ${turnoutBars(ch.turnout, s.turnout_ref.national_avg)}
      <div class="sub" style="margin-top:8px"><strong>${diff >= 0 ? num(diff) + " pts above" : num(-diff) + " pts below"}</strong> the national average in ${s.turnout_ref.latest_year}.</div>`);
  }

  // 9 outro / share
  const shareText = `${seatLabel(s)} since ${s.first_year}: ${s.n_distinct_winning_parties} parties, ${s.n_contests} elections, closest call ${s.closest ? num(s.closest.margin_perc, 2) + "pts" : "—"}. My seat, wrapped 🗳️`;
  const pageUrl = location.origin + `${BASE}seat/${s.slug}/`;
  cards.push(`
    <div class="kicker">That's a wrap</div>
    <div class="headline" style="margin-top:8px">${esc(seatLabel(s))}</div>
    <div class="sub">${s.first_year}–${s.last_year} · ${s.n_contests} elections · ${s.n_distinct_winning_parties} winning parties</div>
    <div class="share">
      <button class="primary" data-act="share">🔗 Share this seat</button>
      <a class="x" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}" target="_blank" rel="noopener">𝕏 Share on X</a>
      <button data-act="compare">⚖️ Compare with a friend's seat</button>
      <a href="${ELECTIONDATA_SEATS}" target="_blank" rel="noopener" class="ghost">Explore this seat on electiondata.my →</a>
    </div>
    <p class="tiny">Data: <a href="https://electiondata.my" target="_blank" rel="noopener" class="ul">Malaysian Election Corpus</a> by <a href="https://x.com/Thevesh" target="_blank" rel="noopener" class="ul">Thevesh</a> (CC0). Seat history is threaded by name within state — <a href="${METHODOLOGY_URL}" target="_blank" rel="noopener" class="ul">see methodology</a>.</p>`);

  app.innerHTML = `
    <div class="progress" id="progress">${cards.map(() => `<span><i></i></span>`).join("")}</div>
    <div class="topbar"><button id="back">← Search</button><div class="topbar__right"><button id="playpause" class="iconbtn" aria-label="Pause" title="Pause">${ICON_PAUSE}</button><button id="restart" class="iconbtn" aria-label="Restart" title="Restart">↻</button></div></div>
    <div class="deck" id="deck">
      ${cards.map((c, i) => `<section class="card" data-i="${i}" style="background:${GRADIENTS[i % GRADIENTS.length]}"><div class="card__body">${c}</div></section>`).join("")}
    </div>
    <div class="navhint navhint--l">‹</div><div class="navhint navhint--r">›</div>`;

  const deck = document.getElementById("deck")!;
  const sections = [...deck.querySelectorAll(".card")] as HTMLElement[];
  const bars = [...document.querySelectorAll("#progress span i")] as HTMLElement[];
  let current = -1, anim: Animation | null = null, paused = false, manualPaused = false;

  function show(i: number) {
    if (i < 0 || i >= sections.length) return;
    clearBoundary();
    current = i;
    sections.forEach((sec, j) => sec.classList.toggle("active", j === i));
    bars.forEach((b, j) => { b.style.transition = "none"; b.style.width = j < i ? "100%" : "0%"; });
    if (i === 0) loadBoundary(s.slug).then((b) => { if (b && current === 0) mountBoundary(document.getElementById("cover-map")!, b); });
    // animate the active bar
    void bars[i].offsetWidth;
    if (anim) anim.cancel();
    anim = bars[i].animate([{ width: "0%" }, { width: "100%" }], { duration: DURATION, fill: "forwards" });
    anim.onfinish = () => { if (current < sections.length - 1) show(current + 1); };
    if (paused) anim.pause();
  }
  function next() { if (current < sections.length - 1) show(current + 1); }
  function prev() { if (current > 0) show(current - 1); }
  function pause() { paused = true; anim?.pause(); }
  function resume() { paused = false; anim?.play(); }

  // tap / hold navigation
  let downT = 0, downX = 0, held = false, holdTimer: any = null;
  function isCtl(t: EventTarget | null) { return t instanceof Element && t.closest("button,a,input,.topbar,.progress"); }
  deck.addEventListener("pointerdown", (e) => {
    if (isCtl(e.target)) return;
    downT = Date.now(); downX = e.clientX; held = false;
    holdTimer = setTimeout(() => { held = true; pause(); }, 220);
  });
  deck.addEventListener("pointerup", (e) => {
    if (isCtl(e.target)) return;
    clearTimeout(holdTimer);
    if (held) { if (!manualPaused) resume(); held = false; return; }
    const left = downX < window.innerWidth * 0.33;
    if (Date.now() - downT < 500) { left ? prev() : next(); }
  });
  deck.addEventListener("pointercancel", () => { clearTimeout(holdTimer); if (held) { if (!manualPaused) resume(); held = false; } });

  const keyHandler = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); prev(); }
    else if (e.key === "Escape") { history.pushState({}, "", BASE); route(); }
  };
  window.addEventListener("keydown", keyHandler);
  new MutationObserver((_, obs) => { if (!document.body.contains(deck)) { window.removeEventListener("keydown", keyHandler); clearBoundary(); obs.disconnect(); } })
    .observe(document.body, { childList: true, subtree: true });

  document.getElementById("back")!.onclick = () => { history.pushState({}, "", BASE); route(); };
  document.getElementById("restart")!.onclick = () => show(0);
  const ppBtn = document.getElementById("playpause")!;
  ppBtn.onclick = () => {
    manualPaused = !manualPaused;
    if (manualPaused) pause(); else resume();
    ppBtn.innerHTML = manualPaused ? ICON_PLAY : ICON_PAUSE;
    const lbl = manualPaused ? "Play" : "Pause";
    ppBtn.setAttribute("aria-label", lbl); ppBtn.setAttribute("title", lbl);
  };
  deck.addEventListener("click", (e) => {
    const act = (e.target as HTMLElement).closest("[data-act]")?.getAttribute("data-act");
    if (act === "share") { navigator.clipboard.writeText(pageUrl); toast("Link copied"); }
    else if (act === "compare") { returnSlide = current; go(s.slug, "__pick__"); }
  });

  show(startAt);
}

// ---------- compare (visual head-to-head) ----------
async function renderCompare(a: Seat, bIn: Seat | null) {
  const picking = !bIn;
  document.title = picking ? `Compare ${a.current_name} — Undi Wrapped` : `${a.current_name} vs ${bIn!.current_name} — Undi Wrapped`;
  const idx = await loadIndex();
  const gradA = GRADIENTS[0], gradB = GRADIENTS[3];

  // head-to-head split bar (same style as the swing / closest-race slides):
  // one diverging bar per metric, seat A (red) left, seat B (teal) right, split by value.
  function metricBar(label: string, va: number | null, vb: number | null, fmt: (v: number) => string, higherWins = false) {
    const a0 = va ?? 0, b0 = vb ?? 0, tot = a0 + b0 || 1;
    const aPct = (a0 / tot) * 100;
    const aWin = va != null && vb != null && (higherWins ? va > vb : va < vb);
    const bWin = va != null && vb != null && (higherWins ? vb > va : vb < va);
    return `<div class="cmp__metric">${label}</div>
      <div class="h2hrow">
        <span class="h2hrow__v ${aWin ? "win" : ""}">${va != null ? fmt(va) : "—"}</span>
        <div class="h2hrow__bar"><span style="width:${aPct.toFixed(1)}%;background:#ff5e7a"></span><span style="width:${(100 - aPct).toFixed(1)}%;background:#37c7d4"></span></div>
        <span class="h2hrow__v ${bWin ? "win" : ""}">${vb != null ? fmt(vb) : "—"}</span>
      </div>`;
  }

  const head = (seat: Seat | null, grad: string, pickable = false) => {
    if (!seat)
      return `<div class="cmp__head cmp__head--pick" style="background:${grad}"><div class="nm">Pick a seat</div><div class="searchmini"><input id="friendq" type="search" autocomplete="off" placeholder="Search a friend's seat…"><ul class="ac" id="friendac"></ul></div></div>`;
    const body = `<div class="nm">${esc(seat.current_name)}</div><div class="st">${esc(seat.state)} · ${seat.current_seat.split(" ")[0]}</div><div class="hold">${partyLogo(seat.current_holder.party_uid, seat.current_holder.party, partyColor(seat.current_holder.party), 30)} ${esc(seat.current_holder.party)}</div>`;
    return pickable
      ? `<div id="cmp-headB" class="cmp__head cmp__head--b" role="button" tabindex="0" style="background:${grad}" title="Click to compare a different seat">${body}</div>`
      : `<div class="cmp__head" style="background:${grad}">${body}</div>`;
  };

  // wire a seat-search box (used by both the initial picker and the in-place re-pick)
  function wireSearch(input: HTMLInputElement, ac: HTMLElement, onPick: (slug: string) => void) {
    let hits: IndexItem[] = [];
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) { ac.innerHTML = ""; hits = []; return; }
      hits = idx.filter((x) => x.slug !== a.slug && (x.name.toLowerCase().includes(q) || x.state.toLowerCase().includes(q) || x.seat_no.toLowerCase().includes(q)))
        .sort((x, y) => (x.type === y.type ? 0 : x.type === "federal" ? -1 : 1)).slice(0, 16);
      ac.innerHTML = hits.map((h) => `<li data-slug="${h.slug}">${dot(coalitionColor(h.coalition))}<span class="seatno">${esc(h.seat_no)}</span> <span>${esc(h.name)} <span class="st">· ${esc(h.state)}</span></span></li>`).join("");
      ac.querySelectorAll("li").forEach((li) => li.addEventListener("mousedown", (e) => { e.preventDefault(); onPick((li as HTMLElement).dataset.slug!); }));
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Enter" && hits.length) { e.preventDefault(); onPick(hits[0].slug); } });
  }

  app.innerHTML = `<div class="cmp"><div class="cmp__inner">
    <div class="cmp__top"><button id="cmp-back" class="ghostbtn">← Back</button><h1>Head-to-head</h1><span style="width:60px"></span></div>
    <div class="cmp__grid">
      <div class="cmp__heads">${head(a, gradA)}${head(bIn, gradB, true)}</div>
      ${bIn ? `
        ${metricBar("Elections since 1955", a.n_contests, bIn.n_contests, (v) => String(Math.round(v)), true)}
        ${metricBar("Winning parties", a.n_distinct_winning_parties, bIn.n_distinct_winning_parties, (v) => String(Math.round(v)), true)}
        ${metricBar("Current margin (pts)", a.current_holder.margin_perc, bIn.current_holder.margin_perc, (v) => num(v), true)}
        ${metricBar("Closest ever (pts)", a.closest?.margin_perc ?? null, bIn.closest?.margin_perc ?? null, (v) => num(v, 2), false)}
        ${metricBar("Marginality rank (1 = tightest)", a.marginality_rank?.rank ?? null, bIn.marginality_rank?.rank ?? null, (v) => "#" + Math.round(v), false)}
        ${metricBar("Latest turnout (%)", a.current_holder.turnout, bIn.current_holder.turnout, (v) => num(v), true)}
        <div class="cmp__legend"><span><i style="background:#ff5e7a"></i>${esc(a.current_name)}</span><span><i style="background:#37c7d4"></i>${esc(bIn.current_name)}</span></div>
        <div class="cmp__actions">
          <button class="primary" id="cmp-copy">🔗 Share this head-to-head</button>
          <button id="cmp-toA">← Back to ${esc(a.current_name)}</button>
        </div>` : `<p class="cmp__hint">Search a friend's seat on the right to see the two go head to head.</p>`}
    </div>
    <p class="attribution" style="margin-top:26px">Built on the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a> by <a href="https://x.com/Thevesh" target="_blank" rel="noopener">Thevesh</a> (CC0).</p>
  </div></div>`;

  document.getElementById("cmp-back")!.onclick = () => { history.pushState({}, "", `${BASE}seat/${a.slug}/`); renderDeck(a, returnSlide); };
  if (bIn) {
    document.getElementById("cmp-copy")!.onclick = () => { navigator.clipboard.writeText(location.href); toast("Link copied"); };
    document.getElementById("cmp-toA")!.onclick = () => { history.pushState({}, "", `${BASE}seat/${a.slug}/`); renderDeck(a, returnSlide); };
    // in-place re-pick: click seat B's header to search a new comparison without
    // disturbing the rest of the page — commit on select/Enter, cancel on Esc/blur.
    const headB = document.getElementById("cmp-headB")!;
    let editing = false;
    const enterEdit = () => {
      if (editing) return;
      editing = true;
      const restore = headB.innerHTML;
      let committing = false;
      headB.classList.add("cmp__head--editing");
      headB.innerHTML = `<div class="searchmini"><input type="search" autocomplete="off"><ul class="ac"></ul></div>`;
      const input = headB.querySelector("input") as HTMLInputElement;
      const ac = headB.querySelector(".ac") as HTMLElement;
      input.value = bIn!.current_name;
      wireSearch(input, ac, (slug) => { committing = true; go(a.slug, slug); });
      const cancel = () => {
        if (committing || !editing) return;
        editing = false;
        headB.classList.remove("cmp__head--editing");
        headB.innerHTML = restore; // resets the typed string back to B's name
      };
      input.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); cancel(); } });
      input.addEventListener("blur", () => setTimeout(cancel, 150));
      input.focus(); input.select();
    };
    headB.addEventListener("click", enterEdit);
    headB.addEventListener("keydown", (e) => { if (!editing && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); enterEdit(); } });
  } else {
    const fi = document.getElementById("friendq") as HTMLInputElement;
    wireSearch(fi, document.getElementById("friendac")!, (slug) => go(a.slug, slug));
    fi.focus();
  }
}

route();
