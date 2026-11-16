// Hakee rahastojen päivittäiset arvot ISIN-koodeilla (Yahoo Finance, epävirallinen) ja kirjoittaa prices.json.
import fs from "node:fs";
const isins = JSON.parse(fs.readFileSync("isins.json", "utf8"));
let old = { funds: {} };
try { old = JSON.parse(fs.readFileSync("prices.json", "utf8")); } catch {}
const j = async u => {
  const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
};
async function one(i) {
  const s = await j("https://query2.finance.yahoo.com/v1/finance/search?q=" + i + "&quotesCount=10&newsCount=0");
  const q = (s.quotes || []).filter(x => x.quoteType === "MUTUALFUND" || x.quoteType === "ETF");
  if (!q.length) throw new Error("Rahastoa ei löytynyt ISIN-koodilla");
  for (const c of q) {
    const d = await j("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(c.symbol) + "?range=10y&interval=1d");
    const r = d.chart?.result?.[0];
    if (!r?.timestamp || r.meta.currency !== "EUR") continue;
    const cl = r.indicators.quote[0].close, m = new Map();
    r.timestamp.forEach((t, k) => { if (cl[k] != null) m.set(new Date(t * 1000).toISOString().slice(0, 10), +cl[k].toFixed(4)); });
    if (m.size > 5) return { ok: true, symbol: c.symbol, name: c.longname || c.shortname, s: [...m] };
  }
  throw new Error("Hintadataa ei saatu");
}
const funds = {};
for (const i of isins) {
  try { funds[i] = await one(i); }
  catch (e) { const o = old.funds?.[i]; funds[i] = o?.ok ? { ...o, stale: true, err: e.message } : { ok: false, err: e.message }; }
  await new Promise(r => setTimeout(r, 1500));
}
fs.writeFileSync("prices.json", JSON.stringify({ updated: new Date().toISOString(), funds }));
for (const [k, v] of Object.entries(funds)) console.log(k, v.ok ? (v.stale ? "VANHA " : "OK ") + v.name : "EPÄONNISTUI " + v.err);
if (!Object.values(funds).some(v => v.ok)) process.exit(1);
