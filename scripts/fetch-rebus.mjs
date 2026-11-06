// Photo-rebus images: one Wikipedia lead photo per word unit (bùn -> "Mud", bò -> "Cattle"...).
// Input: data/rebus-src.json { units: [{unit, for, type, enwiki, say}], dishes: [{id, name, units}] }
// Output: img/rebus/*.webp and data/rebus.json (only dishes whose every unit has a photo).
// Usage: node scripts/fetch-rebus.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const SRC = path.join(ROOT, 'data', 'rebus-src.json');
const OUTJ = path.join(ROOT, 'data', 'rebus.json');
const OUT = path.join(ROOT, 'img', 'rebus');
const FORCE = process.argv.includes('--force');
const UA = process.env.WIKI_UA || 'HomNayAnGi-FoodPicker/1.1 (single-user hobby script)';
const API_GAP = +(process.env.API_GAP || 6500);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const strip = (s = '') => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const OK_LICENSE = /(cc|public domain|pd|gfdl)/i;
const slugOf = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const src = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const prev = fs.existsSync(OUTJ) ? JSON.parse(fs.readFileSync(OUTJ, 'utf8')).units : {};
fs.mkdirSync(OUT, { recursive: true });

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
    log('api', r.status, 'backoff');
    await sleep(Math.max((+r.headers.get('retry-after') || 0) * 1000, 10000 * 2 ** i));
  }
  return {};
}

// stable unique file slug per unit
const used = new Set();
const slug = {};
for (const u of src.units) {
  let s = slugOf(u.unit) || 'u', k = 2;
  while (used.has(s)) s = `${slugOf(u.unit)}-${k++}`;
  used.add(s); slug[u.unit] = s;
}
const units = {};
const todo = src.units.filter((u) => {
  const p = prev[u.unit];
  if (!FORCE && p && p.enwiki === u.enwiki && fs.existsSync(path.join(ROOT, p.img))) { units[u.unit] = p; return false; }
  return true;
});
log('units', src.units.length, 'to fetch', todo.length);

/* A. article title -> lead image file */
const fileOf = {};
for (const part of chunk([...new Set(todo.map((u) => u.enwiki))], 50)) {
  const j = await api('en.wikipedia.org', { action: 'query', titles: part.join('|'), prop: 'pageimages', piprop: 'name', redirects: 1 });
  const q = j.query || {};
  const final = Object.fromEntries(part.map((t) => [t, t]));
  for (const n of [...(q.normalized || []), ...(q.redirects || [])]) for (const t in final) if (final[t] === n.from) final[t] = n.to;
  const img = Object.fromEntries((q.pages || []).filter((p) => p.pageimage).map((p) => [p.title, p.pageimage]));
  for (const t of part) if (img[final[t]]) fileOf[t] = 'File:' + img[final[t]];
  log('titles', part.length, '->', Object.keys(img).length);
}

/* B. file -> Commons info (license, thumb) */
const info = {};
for (const part of chunk([...new Set(Object.values(fileOf))], 40)) {
  const j = await api('commons.wikimedia.org', { action: 'query', titles: part.join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: 500 });
  const norm = Object.fromEntries((j.query?.normalized || []).map((n) => [n.to, n.from]));
  for (const p of j.query?.pages || []) {
    const ii = p.imageinfo?.[0];
    if (!ii || (ii.mime && !/image\/(jpeg|png|webp)/.test(ii.mime))) continue;
    const m = ii.extmetadata || {};
    const license = strip(m.LicenseShortName?.value);
    if (!OK_LICENSE.test(license)) continue;
    info[norm[p.title] || p.title] = { thumb: ii.thumburl || ii.url, page: ii.descriptionurl, file: p.title, artist: strip(m.Artist?.value).slice(0, 80) || 'Wikimedia Commons', license };
  }
  log('commons info', part.length);
}

/* C. download */
for (const u of todo) {
  const c = info[fileOf[u.enwiki]];
  if (!c) { log('miss', u.unit, u.enwiki); continue; }
  let r;
  for (let k = 0; k < 4; k++) {
    await sleep(900);
    r = await fetch(c.thumb, { headers: { 'User-Agent': UA } });
    if (r.status !== 429) break;
    await sleep(10000 * (k + 1));
  }
  if (!r.ok) { log('thumb', r.status, u.unit); continue; }
  const img = `img/rebus/${slug[u.unit]}.webp`;
  await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize(320, 320, { fit: 'cover' }).webp({ quality: 70 }).toFile(path.join(ROOT, img));
  units[u.unit] = { say: u.say, type: u.type, enwiki: u.enwiki, img, credit: { file: c.file, page: c.page, artist: c.artist, license: c.license } };
}

const skip = new Set(src.skip || []);
for (const s of skip) delete units[s];
const dishes = src.dishes.filter((d) => d.units.every((x) => units[x]));
fs.writeFileSync(OUTJ, JSON.stringify({ units, dishes: dishes.map(({ id, units: us }) => ({ id, units: us })) }, null, 1));
log('units with photo', Object.keys(units).length, '/', src.units.length, '· dishes', dishes.length, '/', src.dishes.length);
