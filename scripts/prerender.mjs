// Emit a static HTML page per seat at dist/seat/<slug>/index.html with proper
// Open Graph tags + inlined data, so shares render rich cards and crawlers see
// real content. Runs after `vite build`. Asset URLs in the template are absolute
// (base=/undi-wrapped/), so they resolve fine from the deeper path.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const SITE = (process.env.SITE_URL || "https://zachtheyek.github.io/undi-wrapped").replace(/\/$/, "");
const template = readFileSync("dist/index.html", "utf8");
const DATA = "public/data";

// strip the template's default <title>, description and og/twitter meta
function stripHead(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/[ \t]*<meta[^>]+(property="og:|name="twitter:|name="description")[^>]*>\n?/g, "");
}
const base = stripHead(template);

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// Cache-bust the OG image URL with a short content hash so X (and other scrapers) re-fetch
// it whenever the card actually changes — e.g. after the name→lineage data migration. A
// stable URL otherwise stays pinned to whatever a scraper cached on its first scrape.
function ogImage(slug) {
  const url = `${SITE}/og/${slug}.png`;
  try {
    const v = createHash("sha1").update(readFileSync(join("dist/og", `${slug}.png`))).digest("hex").slice(0, 8);
    return `${url}?v=${v}`;
  } catch {
    return url; // image not generated (shouldn't happen) — fall back to the bare URL
  }
}

function page(seat) {
  const num = seat.current_seat.split(" ")[0];
  const label = `${num} ${seat.current_name}`;
  const img = ogImage(seat.slug);
  const desc = `${seat.current_name} (${seat.state}): ${seat.n_contests} elections since ${seat.first_year}, ` +
    `${seat.n_distinct_winning_parties} winning parties` +
    (seat.closest ? `, closest call ${seat.closest.margin_perc.toFixed(2)} pts in ${seat.closest.year}` : "") +
    `. Now held by ${seat.current_holder.name} (${seat.current_holder.party}).`;
  const meta = `
    <title>${esc(label)} — Undi Wrapped</title>
    <meta name="description" content="${esc(desc)}" />
    <link rel="canonical" href="${SITE}/seat/${seat.slug}/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Undi Wrapped" />
    <meta property="og:title" content="${esc(label)} — Undi Wrapped" />
    <meta property="og:description" content="${esc(desc)}" />
    <meta property="og:url" content="${SITE}/seat/${seat.slug}/" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(label)} — Undi Wrapped" />
    <meta name="twitter:description" content="${esc(desc)}" />
    <meta name="twitter:image" content="${img}" />
    <script>window.__SEAT__=${JSON.stringify(seat)}</script>`;
  return base.replace("</head>", meta + "\n  </head>");
}

const files = readdirSync(join(DATA, "seats")).filter((f) => f.endsWith(".json"));
for (const f of files) {
  const seat = JSON.parse(readFileSync(join(DATA, "seats", f), "utf8"));
  const dir = join("dist", "seat", seat.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), page(seat));
}
// 404 fallback (GitHub Pages serves /404.html for unknown paths)
writeFileSync("dist/404.html", template);
console.log(`prerendered ${files.length} seat pages (SITE=${SITE})`);
