// Merge data/parts/*.json into data/dishes.json, dropping duplicates and fixing enum values.
import fs from 'node:fs';
const KINDS = ['nuoc','kho','com','banh','lau','an-vat','che','do-uong','mon-nhau'];
const TAGS = ['chay','cay','hai-san','nhanh','re','dac-san','mua-lanh','mua-nong'];
const MEALS = ['sang','trua','toi','vat'];
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/gi,'d').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const out = [], ids = new Set(), names = new Set(), dropped = [];
for (const f of ['bac','trung','nam','intl']) {
  const extra = fs.existsSync(`data/parts/${f}.extra.json`) ? JSON.parse(fs.readFileSync(`data/parts/${f}.extra.json`,'utf8')) : {};
  for (const d of JSON.parse(fs.readFileSync(`data/parts/${f}.json`,'utf8'))) {
    const n = norm(d.name);
    if (ids.has(d.id) || names.has(n)) { dropped.push(`${f}:${d.name}`); continue; }
    ids.add(d.id); names.add(n);
    d.kind = KINDS.includes(d.kind) ? d.kind : 'an-vat';
    d.tags = (d.tags||[]).filter((t) => TAGS.includes(t));
    d.meals = (d.meals||[]).filter((m) => MEALS.includes(m)); if (!d.meals.length) d.meals = ['trua','toi'];
    d.price = [1,2,3].includes(+d.price) ? +d.price : 2;
    out.push({ id:d.id, name:d.name, nameEn:d.nameEn, region:d.region, cuisine:d.cuisine, meals:d.meals, kind:d.kind, tags:d.tags, price:d.price, wiki:d.wiki||null, img:d.img||d.nameEn, desc:d.desc, emoji:d.emoji, history: extra[d.id]?.history || null, joke: extra[d.id]?.joke || null });
  }
}
fs.writeFileSync('data/dishes.json', JSON.stringify(out));
const by = out.reduce((a,d)=>(a[d.region]=(a[d.region]||0)+1,a),{});
console.log(out.length, JSON.stringify(by), 'dropped', dropped.length, dropped.join(' | '));
