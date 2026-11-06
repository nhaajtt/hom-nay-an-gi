// Fetch one CC-licensed photo per dish from Wikipedia / Wikimedia Commons.
// Batches title lookups (50 per request) to stay inside the anonymous API rate limit.
// Usage: node scripts/fetch-images.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const DATA = path.join(ROOT, 'data', 'dishes.json');
const OUT = path.join(ROOT, 'img', 'dishes');
const CREDITS = path.join(ROOT, 'data', 'credits.json');
const FORCE = process.argv.includes('--force');
const PASS2 = process.argv.includes('--by-name'); // search Commons by the Vietnamese name only
const UA = process.env.WIKI_UA || 'HomNayAnGi-FoodPicker/1.1 (single-user hobby script)';
const API_GAP = +(process.env.API_GAP || 6500); // ~9 requests / minute
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const dishes = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const credits = fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, 'utf8')) : {};
fs.mkdirSync(OUT, { recursive: true });
const saveCredits = () => fs.writeFileSync(CREDITS, JSON.stringify(credits, null, 1));

let lastApi = 0;
async function api(host, params) {
  const u = new URL(`https://${host}/w/api.php`);
  Object.entries({ format: 'json', formatversion: 2, ...params }).forEach(([k, v]) => u.searchParams.set(k, v));
  for (let i = 0; i < 6; i++) {
    const wait = lastApi + API_GAP - Date.now();
    if (wait > 0) await sleep(wait);
    lastApi = Date.now();
    const r = await fetch(u, { headers: { 'User-Agent': UA } });
    if (r.ok) return r.json();
    const ra = +r.headers.get('retry-after') || 0;
    log('api', r.status, 'backoff');
    await sleep(Math.max(ra * 1000, 10000 * 2 ** i));
  }
  return {};
}
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const OK_LICENSE = /(cc|public domain|pd|gfdl)/i;
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const todo = dishes.filter((d) => FORCE || !(credits[d.id] && fs.existsSync(path.join(OUT, `${d.id}.webp`))));
log('dishes to fetch:', todo.length);

/* A. article titles -> page image file names (batched per wiki) */
const cands = new Map(); // id -> [[lang,title],...]
for (const d of todo) {
  const c = [];
  if (d.wiki) { const [l, ...t] = d.wiki.split(':'); c.push([l, t.join(':')]); }
  if (d.region !== 'intl') c.push(['vi', d.name]);
  c.push(['en', d.nameEn]);
  if (d.region === 'intl') c.push(['en', d.name]);
  cands.set(d.id, c);
}
const pageImage = {}; // `${lang}:${title}` -> file
for (const lang of PASS2 ? [] : ['vi', 'en']) {
  const titles = [...new Set([...cands.values()].flat().filter(([l]) => l === lang).map(([, t]) => t))];
  for (const part of chunk(titles, 50)) {
    const j = await api(`${lang}.wikipedia.org`, { action: 'query', titles: part.join('|'), prop: 'pageimages', piprop: 'name', redirects: 1 });
    const q = j.query || {};
    const final = {};
    for (const t of part) final[t] = t;
    (q.normalized || []).forEach((n) => { for (const t in final) if (final[t] === n.from) final[t] = n.to; });
    (q.redirects || []).forEach((n) => { for (const t in final) if (final[t] === n.from) final[t] = n.to; });
    const img = Object.fromEntries((q.pages || []).filter((p) => p.pageimage).map((p) => [p.title, p.pageimage]));
    for (const t of part) if (img[final[t]]) pageImage[`${lang}:${t}`] = img[final[t]];
    log(lang, 'titles batch', part.length, '->', Object.keys(img).length);
  }
}
const fileOf = {};
for (const d of todo) {
  const hit = cands.get(d.id).find(([l, t]) => pageImage[`${l}:${t}`]);
  if (hit) fileOf[d.id] = 'File:' + pageImage[`${hit[0]}:${hit[1]}`];
}

/* B. file names -> Commons image info (batched) */
function info(p) {
  const ii = p?.imageinfo?.[0];
  if (!ii || (ii.mime && !/image\/(jpeg|png|webp)/.test(ii.mime))) return null;
  const m = ii.extmetadata || {};
  const license = strip(m.LicenseShortName?.value);
  if (!OK_LICENSE.test(license)) return null;
  return { thumb: ii.thumburl || ii.url, page: ii.descriptionurl, file: p.title, artist: strip(m.Artist?.value).slice(0, 80) || 'Wikimedia Commons', license };
}
const fileInfo = {};
for (const part of chunk([...new Set(Object.values(fileOf))], 40)) {
  const j = await api('commons.wikimedia.org', { action: 'query', titles: part.join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: 500 });
  const norm = Object.fromEntries((j.query?.normalized || []).map((n) => [n.to, n.from]));
  for (const p of j.query?.pages || []) { const c = info(p); if (c) fileInfo[norm[p.title] || p.title] = c; }
  log('commons info batch', part.length);
}
const found = {};
for (const d of todo) if (fileInfo[fileOf[d.id]]) found[d.id] = fileInfo[fileOf[d.id]];
log('found via articles:', Object.keys(found).length, '/', todo.length);

/* C. remaining dishes -> Commons file search (one request each) */
for (const d of todo.filter((x) => !found[x.id])) {
  const j = await api('commons.wikimedia.org', {
    action: 'query', generator: 'search', gsrsearch: `${PASS2 ? d.name : d.img || d.nameEn} filetype:bitmap`, gsrnamespace: 6, gsrlimit: 6,
    prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: 500,
  });
  const pages = (j.query?.pages || []).sort((a, b) => a.index - b.index);
  for (const p of pages) {
    if (/logo|map|flag|menu|sign|store|shop|restaurant/i.test(p.title)) continue;
    const c = info(p);
    if (c) { found[d.id] = c; break; }
  }
  log('search', d.id, found[d.id] ? 'ok' : 'miss');
}

/* D. download thumbnails */
const stats = { ok: 0, miss: 0 };
for (const d of todo) {
  const c = found[d.id];
  if (!c) { stats.miss++; continue; }
  let r;
  for (let k = 0; k < 4; k++) {
    await sleep(900);
    r = await fetch(c.thumb, { headers: { 'User-Agent': UA } });
    if (r.status !== 429) break;
    await sleep(10000 * (k + 1));
  }
  if (!r.ok) { stats.miss++; log('thumb', r.status, d.id); continue; }
  const buf = Buffer.from(await r.arrayBuffer());
  await sharp(buf).rotate().resize(480, 480, { fit: 'cover' }).webp({ quality: 70 }).toFile(path.join(OUT, `${d.id}.webp`));
  credits[d.id] = { file: c.file, page: c.page, artist: c.artist, license: c.license };
  stats.ok++;
  if (stats.ok % 25 === 0) { saveCredits(); log('downloaded', stats.ok); }
}
saveCredits();
log('done', JSON.stringify(stats), 'misses:', todo.filter((d) => !found[d.id]).map((d) => d.id).join(','));
