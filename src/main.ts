import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "./style.css";
import { partyColor, coalitionColor, GRADIENTS } from "./colors";

const BASE = import.meta.env.BASE_URL;
const app = document.getElementById("app")!;

// ---------- types ----------
interface IndexItem { slug: string; name: string; state: string; type: string; seat_no: string; holder: string; coalition: string | null; margin: number | null; }
interface TL { year: number; election: string; win_party: string; win_coalition: string | null; win_name: string; margin_perc: number | null; turnout: number | null; n_candidates: number | null; uncontested: boolean; electorate: number | null; }
interface Seat {
  slug: string; seat_type: string; state: string; current_name: string; current_seat: string;
  all_names: string[]; n_names: number; first_year: number; last_year: number; n_contests: number;
  founding: { year: number; party: string; coalition: string | null; name: string; seat_name: string };
  current_holder: { party: string; coalition: string | null; name: string; year: number; margin_perc: number | null; turnout: number | null; uncontested: boolean };
  parties_won: { party: string; coalition: string | null; wins: number }[];
  n_distinct_winning_parties: number;
  dominant_party: { party: string; coalition: string | null; wins: number } | null;
  closest: { year: number; election: string; win_party: string; run_party: string; margin_perc: number } | null;
  biggest_swing: { year: number; election: string; swing_pp: number; from_coalition: string | null; to_coalition: string | null; flipped: boolean; win_party: string } | null;
  marginality_rank: { rank: number; total: number; scope: string } | null;
  turnout_ref: { national_avg: number; latest_year: number };
  timeline: TL[];
}

// ---------- utils ----------
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const num = (n: number, d = 1) => n.toLocaleString("en-MY", { minimumFractionDigits: d, maximumFractionDigits: d });
const ord = (n: number) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const seatLabel = (s: Seat) => `${s.current_seat.split(" ")[0]} ${s.current_name}`;
const dot = (color: string) => `<i class="dot" style="background:${color}"></i>`;
function go(slug: string, compare?: string | null) {
  const url = `${BASE}seat/${slug}/` + (compare ? `?compare=${compare}` : "");
  history.pushState({}, "", url);
  route();
}

async function loadIndex(): Promise<IndexItem[]> {
  if ((window as any).__IDX__) return (window as any).__IDX__;
  const idx = await fetch(`${BASE}data/index.json`).then((r) => r.json());
  (window as any).__IDX__ = idx;
  return idx;
}
async function loadSeat(slug: string): Promise<Seat> {
  const pre = (window as any).__SEAT__;
  if (pre && pre.slug === slug) return pre;
  return fetch(`${BASE}data/seats/${slug}.json`).then((r) => { if (!r.ok) throw new Error("404"); return r.json(); });
}

// ---------- router ----------
function getRoute() {
  const m = location.pathname.match(/\/seat\/([^/]+)/);
  const slug = m ? decodeURIComponent(m[1]) : new URLSearchParams(location.search).get("seat");
  const compare = new URLSearchParams(location.search).get("compare");
  return { slug, compare };
}
async function route() {
  const { slug, compare } = getRoute();
  if (!slug) return renderLanding();
  app.innerHTML = `<div class="loading">Loading…</div>`;
  try {
    const seat = await loadSeat(slug);
    if (compare) {
      const other = await loadSeat(compare).catch(() => null);
      if (other) return renderCompare(seat, other);
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
        by <a href="https://electiondata.my" target="_blank" rel="noopener">Thevesh Thevananthan</a> (CC0).
        Not affiliated with the author. <a href="https://github.com/zachtheyek" target="_blank" rel="noopener">Source</a>.
      </p>
    </div></div>`;
  const idx = await loadIndex();
  const input = document.getElementById("q") as HTMLInputElement;
  const results = document.getElementById("results")!;
  const examples = document.getElementById("examples")!;
  ["Bagan", "Pekan", "Lembah Pantai", "Kota Bharu", "Iskandar Puteri"].forEach((nm) => {
    const it = idx.find((x) => x.name === nm && x.type === "federal");
    if (!it) return;
    const b = document.createElement("button");
    b.textContent = nm; b.onclick = () => go(it.slug);
    examples.appendChild(b);
  });
  let active = -1;
  const render = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.innerHTML = ""; active = -1; return; }
    const hits = idx.filter((x) =>
      x.name.toLowerCase().includes(q) || x.state.toLowerCase().includes(q) || x.seat_no.toLowerCase().includes(q)
    ).sort((a, b) => (a.type === b.type ? 0 : a.type === "federal" ? -1 : 1)).slice(0, 30);
    results.innerHTML = hits.map((h, i) => `
      <li data-slug="${h.slug}" class="${i === active ? "active" : ""}">
        ${dot(coalitionColor(h.coalition) )}
        <span class="seatno">${esc(h.seat_no)}</span>
        <span><span class="nm">${esc(h.name)}</span> <span class="st">· ${esc(h.state)} · ${h.type === "federal" ? "Parlimen" : "DUN"}</span></span>
      </li>`).join("");
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

// ---------- mini line chart ----------
function lineChart(points: { x: number; y: number; color: string }[], opts: { yMax?: number; w?: number; h?: number; fmt?: (v: number) => string } = {}) {
  const w = opts.w ?? 480, h = opts.h ?? 130, pad = 16;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMax = opts.yMax ?? Math.max(...ys, 1) * 1.1, yMin = 0;
  const sx = (x: number) => pad + ((x - xMin) / Math.max(1, xMax - xMin)) * (w - 2 * pad);
  const sy = (y: number) => h - pad - ((y - yMin) / Math.max(1, yMax - yMin)) * (h - 2 * pad);
  const path = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join("");
  const area = `${path}L${sx(xMax).toFixed(1)},${h - pad}L${sx(xMin).toFixed(1)},${h - pad}Z`;
  const dots = points.map((p) => `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="4.5" fill="${p.color}" stroke="#fff" stroke-width="1.4"/>`).join("");
  return `<div class="spark"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" role="img">
    <path d="${area}" fill="rgba(255,255,255,.13)"/>
    <path d="${path}" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text x="${pad}" y="${h - 2}" font-size="11" fill="rgba(255,255,255,.6)">${xMin}</text>
    <text x="${w - pad}" y="${h - 2}" font-size="11" fill="rgba(255,255,255,.6)" text-anchor="end">${xMax}</text>
  </svg></div>`;
}

// ---------- deck ----------
function renderDeck(s: Seat) {
  document.title = `${seatLabel(s)} — Undi Wrapped`;
  const cards: string[] = [];
  const dom = s.dominant_party;
  const ch = s.current_holder;
  const contested = s.timeline.filter((t) => t.margin_perc != null);

  // 0 cover
  cards.push(`
    <div class="kicker">${s.seat_type === "federal" ? "Parlimen" : "Dewan Undangan Negeri"} · ${esc(s.state)}</div>
    <div class="headline" style="margin-top:10px;font-size:clamp(38px,11vw,64px)">${esc(s.current_name)}</div>
    <div class="sub" style="opacity:.95">${esc(s.current_seat.split(" ")[0])} · <strong>Undi Wrapped</strong></div>
    <div class="sub"><strong>${s.n_contests}</strong> elections since <strong>${s.first_year}</strong>${s.n_names > 1 ? ` · known by ${s.n_names} names` : ""}.</div>`);

  // 1 origin
  cards.push(`
    <div class="kicker">In the beginning</div>
    <div class="sub" style="margin-top:8px">It all started in</div>
    <div class="big">${s.founding.year}</div>
    <div class="sub">First won by <strong>${esc(s.founding.name)}</strong> ${dot(partyColor(s.founding.party))} <strong>${esc(s.founding.party)}</strong>${s.founding.seat_name !== s.current_name ? `<br><span style="opacity:.8">back when it was called <strong>${esc(s.founding.seat_name)}</strong>.</span>` : "."}</div>`);

  // 2 the record / parties roll-call
  cards.push(`
    <div class="kicker">The roll call</div>
    <div class="big">${s.n_distinct_winning_parties}</div>
    <div class="sub">${s.n_distinct_winning_parties === 1 ? "party has" : "different parties have"} ever won here, across <strong>${s.n_contests}</strong> contests.</div>
    <div class="chips">${s.parties_won.map((p) => `<span class="chip">${dot(partyColor(p.party))}${esc(p.party)} <b>×${p.wins}</b></span>`).join("")}</div>`);

  // 3 dominant / dynasty
  if (dom) {
    const share = Math.round((dom.wins / s.n_contests) * 100);
    cards.push(`
      <div class="kicker">The dynasty</div>
      <div class="headline" style="margin-top:8px">${esc(dom.party)} owns this place.</div>
      <div class="big">${share}%</div>
      <div class="sub"><strong>${esc(dom.party)}</strong> ${dot(partyColor(dom.party))} has won <strong>${dom.wins}</strong> of ${s.n_contests} contests here.</div>`);
  }

  // 4 margin trajectory chart
  if (contested.length >= 3) {
    const pts = contested.map((t) => ({ x: t.year, y: t.margin_perc!, color: coalitionColor(t.win_coalition) }));
    cards.push(`
      <div class="kicker">The trajectory</div>
      <div class="headline" style="margin-top:8px">How safe has it been?</div>
      ${lineChart(pts, { yMax: 100 })}
      <div class="tiny">Winning margin (percentage points) at each election. Higher = a safer seat; dips near the floor are the nail-biters.</div>`);
  }

  // 5 biggest swing
  if (s.biggest_swing) {
    const bs = s.biggest_swing;
    cards.push(`
      <div class="kicker">The earthquake</div>
      <div class="sub" style="margin-top:8px">The ground moved most in</div>
      <div class="big">${bs.year}</div>
      <div class="sub">The winner's vote share moved <strong>${bs.swing_pp > 0 ? "+" : ""}${num(bs.swing_pp)} pts</strong>${bs.flipped ? `, and the seat <strong>flipped</strong> ${dot(coalitionColor(bs.from_coalition))}${esc(bs.from_coalition || "—")} → ${dot(coalitionColor(bs.to_coalition))}${esc(bs.to_coalition || "—")}.` : ` — held, but shaken.`}</div>`);
  }

  // 6 closest race
  if (s.closest) {
    const cl = s.closest;
    cards.push(`
      <div class="kicker">The photo finish</div>
      <div class="sub" style="margin-top:8px">Closest call ever, in ${cl.year}:</div>
      <div class="big">${num(cl.margin_perc, 2)}<span style="font-size:.32em"> pts</span></div>
      <div class="sub">${dot(partyColor(cl.win_party))}<strong>${esc(cl.win_party)}</strong> edged out ${dot(partyColor(cl.run_party))}<strong>${esc(cl.run_party)}</strong>.</div>`);
  }

  // 7 right now + marginality
  const mr = s.marginality_rank;
  cards.push(`
    <div class="kicker">Right now</div>
    <div class="sub" style="margin-top:8px">Your current rep:</div>
    <div class="headline" style="margin-top:4px">${esc(ch.name)}</div>
    <div class="sub">${dot(partyColor(ch.party))}<strong>${esc(ch.party)}</strong>${ch.coalition && ch.coalition !== "ALONE" ? ` · ${esc(ch.coalition)}` : ""} — won ${ch.uncontested ? "<strong>unopposed</strong>" : `by <strong>${num(ch.margin_perc ?? 0)} pts</strong>`} in ${ch.year}.</div>
    ${mr ? `<div class="chips"><span class="chip">🔪 <b>${ord(mr.rank)}</b> most marginal of ${mr.total}</span><span class="chip">${esc(mr.scope)}</span></div>` : ""}`);

  // 8 turnout
  if (ch.turnout != null) {
    const diff = ch.turnout - s.turnout_ref.national_avg;
    cards.push(`
      <div class="kicker">Turnout</div>
      <div class="big">${num(ch.turnout)}<span style="font-size:.3em">%</span></div>
      <div class="sub">voted here in ${s.turnout_ref.latest_year} — <strong>${diff >= 0 ? num(diff) + " pts above" : num(-diff) + " pts below"}</strong> the national average of ${num(s.turnout_ref.national_avg)}%.</div>`);
  }

  // 9 outro / share
  const shareText = `${seatLabel(s)} since ${s.first_year}: ${s.n_distinct_winning_parties} parties, ${s.n_contests} elections, closest call ${s.closest ? num(s.closest.margin_perc, 2) + "pts" : "—"}. My seat, wrapped 🗳️`;
  const pageUrl = location.origin + `${BASE}seat/${s.slug}/`;
  cards.push(`
    <div class="kicker">That's a wrap</div>
    <div class="headline" style="margin-top:8px">${esc(seatLabel(s))}</div>
    <div class="sub">${s.first_year}–${s.last_year} · ${s.n_contests} elections · ${s.n_distinct_winning_parties} winning parties</div>
    <div class="share">
      <button class="primary" id="sh-copy">🔗 Copy link to this seat</button>
      <a class="x" id="sh-x" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(pageUrl)}" target="_blank" rel="noopener">𝕏 Share on X</a>
      <button id="sh-compare">⚖️ Compare with a friend's seat</button>
      <a id="sh-src" href="https://electiondata.my/seats/" target="_blank" rel="noopener" style="background:transparent;font-size:13px;font-weight:600;opacity:.85">See the full boundary history on electiondata.my →</a>
    </div>
    <p class="tiny">Data: <a href="https://electiondata.my" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline">Malaysian Election Corpus</a> by Thevesh Thevananthan (CC0). Seat history is threaded by name within state — see methodology.</p>`);

  app.innerHTML = `
    <div class="progress" id="progress">${cards.map((_, i) => `<span class="${i === 0 ? "on" : ""}"></span>`).join("")}</div>
    <div class="topbar"><button id="back">← Search</button><button id="restart">↻ Restart</button></div>
    <div class="deck" id="deck">
      ${cards.map((c, i) => `<section class="card" style="background:${GRADIENTS[i % GRADIENTS.length]}"><div class="card__body">${c}</div>${i < cards.length - 1 ? '<div class="scrollcue">scroll ↓</div>' : ""}</section>`).join("")}
    </div>`;

  const deck = document.getElementById("deck")!;
  const bars = [...document.querySelectorAll("#progress span")];
  deck.addEventListener("scroll", () => {
    const i = Math.round(deck.scrollTop / window.innerHeight);
    bars.forEach((b, j) => b.classList.toggle("on", j <= i));
  }, { passive: true });
  document.getElementById("back")!.onclick = () => { history.pushState({}, "", BASE); route(); };
  document.getElementById("restart")!.onclick = () => deck.scrollTo({ top: 0, behavior: "smooth" });
  document.getElementById("sh-copy")!.onclick = async (e) => {
    await navigator.clipboard.writeText(pageUrl);
    (e.target as HTMLElement).textContent = "✓ Link copied!";
  };
  document.getElementById("sh-compare")!.onclick = async () => {
    const idx = await loadIndex();
    const q = prompt("Compare with which seat? (type a name, e.g. Pekan)");
    if (!q) return;
    const hit = idx.find((x) => x.name.toLowerCase() === q.trim().toLowerCase()) ||
                idx.find((x) => x.name.toLowerCase().includes(q.trim().toLowerCase()));
    if (hit) go(s.slug, hit.slug); else alert("No seat matched that name.");
  };
}

// ---------- compare ----------
function renderCompare(a: Seat, b: Seat) {
  document.title = `${seatLabel(a)} vs ${seatLabel(b)} — Undi Wrapped`;
  const row = (label: string, va: string, vb: string) =>
    `<div class="cmp__metric">${label}</div><div class="cmp__row"><div class="cmp__cell"><div class="v">${va}</div></div><div class="cmp__cell"><div class="v">${vb}</div></div></div>`;
  app.innerHTML = `<div class="cmp"><div class="cmp__inner">
    <h1>Head to head</h1>
    <div class="cmp__grid">
      <div class="cmp__head" style="background:${GRADIENTS[0]}"><div class="nm">${esc(a.current_name)}</div><div class="st">${esc(a.state)} · ${a.current_seat.split(" ")[0]}</div></div>
      <div class="cmp__head" style="background:${GRADIENTS[3]}"><div class="nm">${esc(b.current_name)}</div><div class="st">${esc(b.state)} · ${b.current_seat.split(" ")[0]}</div></div>
      ${row("Elections since 1955", String(a.n_contests), String(b.n_contests))}
      ${row("Winning parties", String(a.n_distinct_winning_parties), String(b.n_distinct_winning_parties))}
      ${row("Current holder", `${a.current_holder.party}`, `${b.current_holder.party}`)}
      ${row("Current margin (pts)", a.current_holder.margin_perc != null ? num(a.current_holder.margin_perc) : "—", b.current_holder.margin_perc != null ? num(b.current_holder.margin_perc) : "—")}
      ${row("Closest ever (pts)", a.closest ? num(a.closest.margin_perc, 2) : "—", b.closest ? num(b.closest.margin_perc, 2) : "—")}
      ${row("Marginality rank", a.marginality_rank ? `${ord(a.marginality_rank.rank)}/${a.marginality_rank.total}` : "—", b.marginality_rank ? `${ord(b.marginality_rank.rank)}/${b.marginality_rank.total}` : "—")}
      ${row("Latest turnout", a.current_holder.turnout != null ? num(a.current_holder.turnout) + "%" : "—", b.current_holder.turnout != null ? num(b.current_holder.turnout) + "%" : "—")}
    </div>
    <div style="display:flex;gap:10px;margin-top:24px;justify-content:center">
      <button class="primary" onclick="navigator.clipboard.writeText(location.href)" style="background:#fff;color:#111;padding:13px 20px;border-radius:12px;font-weight:700">🔗 Copy compare link</button>
      <button onclick="history.pushState({},'','${BASE}seat/${a.slug}/');location.reload()" style="background:#222;padding:13px 20px;border-radius:12px;font-weight:700">← Back to ${esc(a.current_name)}</button>
    </div>
    <p class="attribution" style="margin-top:28px">Built on the <a href="https://electiondata.my" target="_blank" rel="noopener">Malaysian Election Corpus</a> by Thevesh Thevananthan (CC0).</p>
  </div></div>`;
}

route();
