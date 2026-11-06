// Write CREDITS.md from data/credits.json and data/memes.json
import fs from 'node:fs';
const read = (f, fb) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fb);
const dishes = read('data/dishes.json', []);
const credits = read('data/credits.json', {});
const memes = read('data/memes.json', []);
const cell = (s = '') => String(s).replace(/[|[\]]/g, '/');
const rows = dishes.filter((d) => credits[d.id]).map((d) => {
  const c = credits[d.id];
  return `| ${cell(d.name)} | [${cell(c.file.replace(/^File:/, ''))}](${c.page}) | ${cell(c.artist)} | ${cell(c.license)} |`;
});
const rebus = read('data/rebus.json', { units: {} }).units;
const rebusRows = Object.entries(rebus).map(([u, v]) => `| ${cell(u)} | [${cell(v.credit.file.replace(/^File:/, ''))}](${v.credit.page}) | ${cell(v.credit.artist)} | ${cell(v.credit.license)} |`);
const memeRows = memes.map((m) => `| ${m.file} | [${cell(m.title || m.file)}](${m.page}) | ${cell(m.artist)} | ${cell(m.license)} |`);
fs.writeFileSync('CREDITS.md', `# Nguồn ảnh và âm thanh

Ảnh món ăn lấy từ Wikimedia Commons và Openverse (Flickr…), đã thu nhỏ và chuyển sang WebP. Bản quyền thuộc tác giả theo giấy phép ghi bên cạnh.

| Món | Tệp gốc | Tác giả | Giấy phép |
|---|---|---|---|
${rows.join('\n')}

## Ảnh câu đố (ảnh ghép chữ)

| Chữ | Tệp gốc | Tác giả | Giấy phép |
|---|---|---|---|
${rebusRows.join('\n')}

## Ảnh meme (dùng khi món chưa có ảnh thật)

| Tệp | Nguồn | Tác giả | Giấy phép |
|---|---|---|---|
${memeRows.join('\n')}

## Âm thanh

- Casino Audio và Interface Sounds — Kenney (kenney.nl), CC0: https://opengameart.org/content/54-casino-sound-effects-cards-dice-chips , https://opengameart.org/content/interface-sounds
- Win sound — CC0: https://opengameart.org/content/win-sound-effect
- Boiling Water Loops (tiếng bếp) — TinyWorlds, CC0: https://opengameart.org/content/boiling-water-loops
- Crowd shouting/speaking ambience (tiếng chợ) — StarNinjas, CC0: https://opengameart.org/content/crowd-shoutingspeaking-ambience

## Dữ liệu khác

- Danh sách quán gần bạn: © OpenStreetMap contributors (ODbL), tra qua Overpass API.
- Thời tiết: Open-Meteo (CC BY 4.0).
- Thư viện: three.js (MIT), Matter.js (MIT), GSAP, Rough.js (MIT), qrcode-generator (MIT).
`);
console.log(rows.length, 'photo credits,', rebusRows.length, 'rebus,', memeRows.length, 'memes');
