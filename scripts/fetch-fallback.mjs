// Second pass: find photos on Openverse (CC images from Flickr etc.) for dishes still missing one,
// and collect a few CC-licensed funny animal photos used as meme fallbacks.
// Anonymous Openverse limit: 20 requests/min, 200/day.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const dishes = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/dishes.json'), 'utf8'));
const CREDITS = path.join(ROOT, 'data/credits.json');
const MEMES = path.join(ROOT, 'data/memes.json');
const credits = fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, 'utf8')) : {};
const memes = fs.existsSync(MEMES) ? JSON.parse(fs.readFileSync(MEMES, 'utf8')) : [];
const UA = 'HomNayAnGi-FoodPicker/1.1 (single-user hobby script)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const plain = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
let budget = 190, last = 0;

async function search(q, extra = '') {
  if (budget <= 0) return [];
  const wait = last + 3300 - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now(); budget--;
  const r = await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=8&license_type=all-cc&mature=false${extra}`, { headers: { 'User-Agent': UA } });
  const left = r.headers.get('x-ratelimit-available-anon_sustained');
  if (left !== null) budget = Math.min(budget, +left - 5);
  if (!r.ok) { log('openverse', r.status); return []; }
  return (await r.json()).results || [];
}
async function download(url, out, size = 480) {
  for (let k = 0; k < 3; k++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA } }).catch(() => null);
    if (r?.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      await sharp(buf).rotate().resize(size, size, { fit: 'cover' }).webp({ quality: 70 }).toFile(out);
      return true;
    }
    await sleep(3000);
  }
  return false;
}
const credit = (x) => ({ file: x.title || 'untitled', page: x.foreign_landing_url, artist: (x.creator || x.source || 'unknown').slice(0, 80), license: `CC ${x.license.toUpperCase()} ${x.license_version || ''}`.trim() });
const save = () => { fs.writeFileSync(CREDITS, JSON.stringify(credits, null, 1)); fs.writeFileSync(MEMES, JSON.stringify(memes, null, 1)); };

/* memes first (small, fixed cost) */
if (!process.argv.includes('--no-memes') && memes.length < 8) {
  fs.mkdirSync(path.join(ROOT, 'img/memes'), { recursive: true });
  for (const q of ['funny cat face', 'surprised cat', 'dog wearing sunglasses', 'hungry dog staring', 'cat eating', 'shocked owl']) {
    const res = await search(q, '&category=photograph');
    for (const x of res.slice(0, 2)) {
      const file = `meme-${memes.length + 1}.webp`;
      if (await download(x.thumbnail || x.url, path.join(ROOT, 'img/memes', file), 480)) memes.push({ ...credit(x), title: x.title, file });
    }
    log('meme', q, memes.length);
  }
  save();
}

/* dishes still without a photo */
const missing = dishes.filter((d) => !credits[d.id]);
log('missing before:', missing.length, 'budget:', budget);
for (const d of missing) {
  if (budget <= 0) break;
  const key = plain(d.name).toLowerCase().split(' ').slice(0, 2).join(' ');
  let hit = null;
  for (const q of [plain(d.name), d.nameEn]) {
    const res = await search(q);
    hit = res.find((x) => plain(`${x.title} ${(x.tags || []).map((t) => t.name).join(' ')}`).toLowerCase().includes(key.split(' ')[0])) || (q === d.nameEn ? res[0] : null);
    if (hit || budget <= 0) break;
  }
  if (hit && (await download(hit.thumbnail || hit.url, path.join(ROOT, 'img/dishes', `${d.id}.webp`)))) {
    credits[d.id] = credit(hit);
    log('ok', d.id, '<-', hit.title);
  } else log('miss', d.id);
  if (Object.keys(credits).length % 10 === 0) save();
}
save();
log('done. missing now:', dishes.filter((d) => !credits[d.id]).length, 'budget left:', budget);
