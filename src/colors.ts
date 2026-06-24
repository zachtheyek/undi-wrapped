// Approximate brand colours for major Malaysian coalitions & parties.
// Used only to give cards a sense of identity — not an official palette.
export const COALITION_COLORS: Record<string, string> = {
  BN: "#1f4ea1",
  PH: "#d7282f",
  PN: "#0e2a6b",
  GPS: "#15788a",
  GRS: "#e08e0b",
  PR: "#c0392b",
  BA: "#117a4d",
  PERIKATAN: "#c79a3b",
  GS: "#1f8a4c",
  ALONE: "#6a6a78",
};

export const PARTY_COLORS: Record<string, string> = {
  UMNO: "#cc0001",
  MCA: "#16348f",
  MIC: "#f0a30a",
  DAP: "#d7282f",
  PKR: "#0096d6",
  PAS: "#1f8a4c",
  BERSATU: "#b01116",
  AMANAH: "#e2231a",
  GERAKAN: "#e4002b",
  PBB: "#1a6f7e",
  WARISAN: "#2aa7a0",
  PBS: "#2e7d32",
  STAR: "#283593",
  MUDA: "#000000",
  BEBAS: "#6a6a78",
  PSRM: "#9b2226",
  PERIKATAN: "#c79a3b",
};

export function partyColor(p?: string | null): string {
  if (!p) return "#6a6a78";
  return PARTY_COLORS[p] ?? COALITION_COLORS[p] ?? hashColor(p);
}
export function coalitionColor(c?: string | null): string {
  if (!c) return "#6a6a78";
  return COALITION_COLORS[c] ?? PARTY_COLORS[c] ?? hashColor(c);
}
function hashColor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360} 58% 52%)`;
}

// Gradient backdrops cycled across the card stack (Spotify-Wrapped vibe).
export const GRADIENTS = [
  "linear-gradient(155deg,#ff2d55,#7a1335)",
  "linear-gradient(155deg,#3a1c71,#d76d77 65%,#ffaf7b)",
  "linear-gradient(155deg,#0f3d3e,#16a085)",
  "linear-gradient(155deg,#1a2980,#26d0ce)",
  "linear-gradient(155deg,#642b73,#c6426e)",
  "linear-gradient(155deg,#cb2d3e,#ef473a)",
  "linear-gradient(155deg,#0b486b,#f56217)",
  "linear-gradient(155deg,#005c97,#363795)",
  "linear-gradient(155deg,#ff5f6d,#ffc371)",
  "linear-gradient(155deg,#23074d,#cc5333)",
];
