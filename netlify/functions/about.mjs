import { finnhub, cached, fail, cleanSymbol, ApiError } from '../lib/finnhub.mjs';
import { yChart } from '../lib/yahoo.mjs';

// GET /api/about?s=AAPL  →  affärsidé, historia och fakta om bolaget
// Källor: Wikipedia (text, CC BY-SA 4.0) och Wikidata (fakta, CC0). Svenska i första hand, annars engelska.
const UA = 'Marknadskollen/1.0 (https://marknadskollen.netlify.app)';

export default async (req) => {
  try {
    const sym = cleanSymbol(new URL(req.url).searchParams.get('s'));
    if (!sym) throw new ApiError(400, 'ogiltig ticker');
    // Bolagsnamnet behövs för att hitta rätt artikel. Finnhub har amerikanska bolag, Yahoo även svenska.
    const profile = /[.^]/.test(sym) ? null : await finnhub('/stock/profile2', { symbol: sym }).catch(() => null);
    let name = profile?.name || '';
    if (!name) name = await yChart(sym, '5d', '1d').then((c) => c.meta?.longName || c.meta?.shortName || '').catch(() => '');

    const item = await findItem(sym, name);
    if (!item) return cached({ saknas: true }, 7 * 86400);

    const lang = item.sv ? 'sv' : item.en ? 'en' : null;
    const title = item.sv || item.en;
    const [text, facts] = await Promise.all([
      title ? articleText(lang, title) : null,
      wikidataFacts(item.id)
    ]);
    if (!text && !facts.length) return cached({ saknas: true }, 7 * 86400);

    return cached({
      titel: title,
      sprak: lang,
      url: title ? `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` : null,
      wikidata: `https://www.wikidata.org/wiki/${item.id}`,
      affarside: text?.affarside || null,
      historia: text?.historia || [],
      fakta: facts,
      webb: profile?.weburl || null
    }, 7 * 86400);
  } catch (e) { return fail(e); }
};

/* ---------- Hitta rätt bolag i Wikidata ---------- */
async function findItem(sym, name) {
  // 1. Via ticker i Wikidata (exakt), kontrollerat mot bolagsnamnet
  const base = sym.split('.')[0];
  const variants = [...new Set([base, base.replace(/-/g, ' '), base.replace(/-/g, '.'), base.replace(/-/g, '')])];
  const q = `SELECT ?item ?label ?sv ?en WHERE {
    VALUES ?t { ${variants.map((v) => JSON.stringify(v)).join(' ')} }
    ?item p:P414 ?st . ?st pq:P249 ?t .
    OPTIONAL { ?item rdfs:label ?label FILTER(lang(?label) = "en") }
    OPTIONAL { ?svl schema:about ?item ; schema:isPartOf <https://sv.wikipedia.org/> ; schema:name ?sv }
    OPTIONAL { ?enl schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> ; schema:name ?en }
  } LIMIT 10`;
  const r = await get(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`).catch(() => null);
  const rows = r?.results?.bindings || [];
  const cands = rows.map((b) => ({ id: b.item.value.split('/').pop(), label: b.label?.value || '', sv: b.sv?.value || null, en: b.en?.value || null }));
  const match = cands.find((c) => sameCompany(c.label, name) || sameCompany(c.en, name) || sameCompany(c.sv, name)) || (cands.length === 1 && !name ? cands[0] : null);
  if (match) return match;

  // 2. Via namnsökning på Wikipedia
  if (!name) return null;
  const clean = cleanName(name);
  for (const lang of ['sv', 'en']) {
    const s = await get(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(clean)}&srlimit=3&format=json`).catch(() => null);
    const hit = (s?.query?.search || []).find((h) => sameCompany(h.title, name));
    if (!hit) continue;
    const pp = await get(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&redirects=1&titles=${encodeURIComponent(hit.title)}&format=json`).catch(() => null);
    const page = Object.values(pp?.query?.pages || {})[0];
    const id = page?.pageprops?.wikibase_item;
    if (!id) continue;
    const links = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${id}&props=sitelinks&sitefilter=svwiki|enwiki&format=json`).catch(() => null);
    const sl = links?.entities?.[id]?.sitelinks || {};
    return { id, sv: sl.svwiki?.title || null, en: sl.enwiki?.title || null };
  }
  return null;
}

function cleanName(n) {
  return String(n || '')
    .replace(/\(publ\)/gi, '')
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|ab|asa|oyj|a\/s|sa|nv|ag|se|holdings?|group|class [a-c]|ser\.? [a-c])\b\.?/gi, '')
    .replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim();
}
// Samma bolag om första ordet i det ena namnet finns i det andra,
// t.ex. "Ericsson" och "Telefonaktiebolaget LM Ericsson"
function sameCompany(a, b) {
  const wa = cleanName(a).toLowerCase().split(' ').filter(Boolean);
  const wb = cleanName(b).toLowerCase().split(' ').filter(Boolean);
  const x = wa[0]; const y = wb[0];
  if (!x || !y || x.length < 2) return false;
  return x === y || (x.length > 3 && wb.includes(x)) || (y.length > 3 && wa.includes(y));
}

/* ---------- Text från Wikipedia ---------- */
async function articleText(lang, title) {
  const r = await get(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=wiki&redirects=1&titles=${encodeURIComponent(title)}&format=json`).catch(() => null);
  const page = Object.values(r?.query?.pages || {})[0];
  const full = String(page?.extract || '');
  if (!full) return null;
  const firstHeading = full.search(/\n==[^=]/);
  const intro = paragraphs(firstHeading > 0 ? full.slice(0, firstHeading) : full);
  // Avsnittet om historia, om det finns
  const hm = full.match(/\n==\s*(Historia|Historik|History|Bakgrund)\s*==\n([\s\S]*?)(?=\n==[^=]|$)/i);
  let hist = hm ? paragraphs(hm[2].replace(/\n===[^=]+===\n/g, '\n')) : [];
  const affarside = clip(sentences(intro[0] || '').slice(0, 3).join(' '), 520);
  if (!hist.length) hist = intro.slice(1);
  if (!hist.length) hist = [sentences(intro[0] || '').slice(3).join(' ')].filter(Boolean);
  const historia = [];
  let total = 0;
  for (const p of hist) { if (total > 1100) break; const c = clip(p, 650); historia.push(c); total += c.length; }
  return { affarside: affarside || null, historia: historia.slice(0, 3) };
}
const paragraphs = (t) => t.split(/\n+/).map((s) => s.trim()).filter((s) => s.length > 40 && !/^==/.test(s));
// Dela i meningar: punkt, utrops- eller frågetecken följt av stor bokstav eller siffra
const sentences = (p) => String(p).split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ0-9"«])/).map((s) => s.trim()).filter(Boolean);
function clip(s, n) { return s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + ' …' : s; }

/* ---------- Fakta från Wikidata ---------- */
async function wikidataFacts(id) {
  const r = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${id}&props=claims&format=json`).catch(() => null);
  const c = r?.entities?.[id]?.claims || {};
  const current = (arr) => (arr || []).filter((s) => s.rank !== 'deprecated' && !(s.qualifiers?.P582)); // utan slutdatum
  const ids = (arr) => current(arr).map((s) => s.mainsnak?.datavalue?.value?.id).filter(Boolean);
  const founded = (c.P571 || [])[0]?.mainsnak?.datavalue?.value?.time;
  const year = founded ? String(founded).replace(/^\+/, '').slice(0, 4) : null;
  const founders = ids(c.P112).slice(0, 4);
  const hq = ids(c.P159).slice(0, 1);
  const ceo = ids(c.P169).slice(0, 1);
  const emp = (c.P1128 || [])
    .map((s) => ({ n: Number(s.mainsnak?.datavalue?.value?.amount), t: s.qualifiers?.P585?.[0]?.datavalue?.value?.time || '' }))
    .filter((x) => Number.isFinite(x.n)).sort((a, z) => z.t.localeCompare(a.t))[0];
  const all = [...founders, ...hq, ...ceo];
  let labels = {};
  if (all.length) {
    const l = await get(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${all.join('|')}&props=labels&languages=sv|en&format=json`).catch(() => null);
    for (const [k, v] of Object.entries(l?.entities || {})) labels[k] = v.labels?.sv?.value || v.labels?.en?.value || null;
  }
  const names = (arr) => arr.map((x) => labels[x]).filter(Boolean).join(', ');
  return [
    ['Grundat', year],
    ['Grundare', names(founders) || null],
    ['Huvudkontor', names(hq) || null],
    ['Vd', names(ceo) || null],
    ['Anställda', emp ? Math.abs(emp.n).toLocaleString('sv-SE') + (emp.t ? ` (${String(emp.t).replace(/^\+/, '').slice(0, 4)})` : '') : null]
  ].filter((x) => x[1]);
}

async function get(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA, 'api-user-agent': UA, accept: 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

export const config = { path: '/api/about' };
