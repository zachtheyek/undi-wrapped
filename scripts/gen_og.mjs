// Pre-generate a 1200x630 Open Graph card per seat → dist/og/<slug>.png
// Uses satori (HTML/CSS → SVG) + resvg (SVG → PNG). Run after `vite build`.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { html } from "satori-html";
import { Resvg } from "@resvg/resvg-js";

const DATA = "public/data";
const OUT = "dist/og";
mkdirSync(OUT, { recursive: true });

const fontDir = "node_modules/@fontsource/space-grotesk/files";
const fonts = [
  { name: "Space Grotesk", weight: 400, style: "normal", data: readFileSync(join(fontDir, "space-grotesk-latin-400-normal.woff")) },
  { name: "Space Grotesk", weight: 700, style: "normal", data: readFileSync(join(fontDir, "space-grotesk-latin-700-normal.woff")) },
];

const GRADS = [
  ["#ff2d55", "#7a1335"], ["#3a1c71", "#d76d77"], ["#0f3d3e", "#16a085"],
  ["#1a2980", "#26d0ce"], ["#642b73", "#c6426e"], ["#cb2d3e", "#ef473a"],
  ["#0b486b", "#f56217"], ["#005c97", "#363795"], ["#23074d", "#cc5333"],
];
const PARTY = { UMNO: "#cc0001", MCA: "#16348f", DAP: "#d7282f", PKR: "#0096d6", PAS: "#1f8a4c", BERSATU: "#b01116", AMANAH: "#e2231a", PBB: "#1a6f7e", WARISAN: "#2aa7a0", GERAKAN: "#e4002b", BEBAS: "#888" };
const pc = (p) => PARTY[p] || "#cfcfe0";

function card(seat, grad) {
  const num = seat.current_seat.split(" ")[0];
  const holder = seat.current_holder;
  const stat = (v, l) => `
    <div style="display:flex;flex-direction:column;align-items:flex-start;margin-right:64px">
      <div style="font-size:64px;font-weight:700;line-height:1;color:#fff">${v}</div>
      <div style="font-size:22px;color:rgba(255,255,255,.85);margin-top:8px;text-transform:uppercase;letter-spacing:2px">${l}</div>
    </div>`;
  return html(`
  <div style="display:flex;flex-direction:column;width:1200px;height:630px;padding:64px 72px;background:linear-gradient(135deg,${grad[0]},${grad[1]});font-family:'Space Grotesk'">
    <div style="display:flex;align-items:center">
      <div style="display:flex;width:30px;height:30px;border-radius:7px;background:rgba(255,255,255,.95);margin-right:16px"></div>
      <div style="font-size:26px;font-weight:700;letter-spacing:6px;color:rgba(255,255,255,.92)">UNDI WRAPPED</div>
    </div>
    <div style="display:flex;flex-direction:column;margin-top:auto">
      <div style="font-size:30px;color:rgba(255,255,255,.85);font-weight:500">${num} · ${seat.state} · ${seat.seat_type === "federal" ? "Parlimen" : "DUN"}</div>
      <div style="font-size:128px;font-weight:700;color:#fff;line-height:.95;margin-top:6px">${seat.current_name}</div>
    </div>
    <div style="display:flex;margin-top:40px">
      ${stat(seat.n_contests, "elections since " + seat.first_year)}
      ${stat(seat.n_distinct_winning_parties, "winning parties")}
      ${stat((holder.margin_perc != null ? holder.margin_perc.toFixed(0) + " pts" : "—"), "current margin")}
    </div>
    <div style="display:flex;align-items:center;margin-top:44px;font-size:30px;color:#fff;font-weight:500">
      <div style="display:flex;width:22px;height:22px;border-radius:50%;background:${pc(holder.party)};margin-right:14px"></div>
      Now held by ${holder.name} · ${holder.party}
    </div>
    <div style="display:flex;margin-top:28px;font-size:22px;color:rgba(255,255,255,.7)">Data: Malaysian Election Corpus (Thevesh) · electiondata.my</div>
  </div>`);
}

const files = readdirSync(join(DATA, "seats")).filter((f) => f.endsWith(".json"));
let i = 0, t0 = Date.now();
for (const f of files) {
  const seat = JSON.parse(readFileSync(join(DATA, "seats", f), "utf8"));
  const grad = GRADS[i % GRADS.length];
  const svg = await satori(card(seat, grad), { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
  writeFileSync(join(OUT, seat.slug + ".png"), png);
  i++;
  if (i % 100 === 0) process.stdout.write(`  ${i}/${files.length}\n`);
}
// default card for the landing page (bespoke, robust layout)
const defVdom = html(`
  <div style="display:flex;flex-direction:column;justify-content:center;width:1200px;height:630px;padding:72px;background:linear-gradient(135deg,#2a1b4d,#ff2d55);font-family:'Space Grotesk'">
    <div style="display:flex;align-items:center;margin-bottom:28px">
      <div style="display:flex;width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,.95);margin-right:18px"></div>
      <div style="font-size:30px;font-weight:700;letter-spacing:7px;color:rgba(255,255,255,.92)">UNDI WRAPPED</div>
    </div>
    <div style="display:flex;flex-direction:column;font-size:96px;font-weight:700;color:#fff;line-height:1.02;letter-spacing:-2px">
      <div style="display:flex">Your seat,</div>
      <div style="display:flex">every election</div>
      <div style="display:flex">since 1955.</div>
    </div>
    <div style="display:flex;margin-top:36px;font-size:30px;color:rgba(255,255,255,.85)">222 parliament seats · 600 state seats · one search box</div>
    <div style="display:flex;margin-top:18px;font-size:22px;color:rgba(255,255,255,.7)">Data: Malaysian Election Corpus (Thevesh) · electiondata.my</div>
  </div>`);
const svg = await satori(defVdom, { width: 1200, height: 630, fonts });
writeFileSync("dist/og-default.png", new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng());
console.log(`generated ${i} OG cards + default in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
