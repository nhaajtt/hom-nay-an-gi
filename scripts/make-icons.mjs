// Build PWA icons from the bowl mascot.
import sharp from 'sharp';
import fs from 'node:fs';
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" fill="#cc2018"/>
  <g transform="translate(${pad} ${pad + 6}) scale(${(120 - 2 * pad) / 120})">
    <g stroke="#fbfaf7" stroke-width="3" fill="none" stroke-linecap="round"><path d="M45 30 q-6 -8 0 -14 q6 -6 0 -14"/><path d="M62 28 q-6 -8 0 -14 q6 -6 0 -14"/><path d="M79 30 q-6 -8 0 -14 q6 -6 0 -14"/></g>
    <path d="M10 46 Q 12 100 60 102 Q 108 100 110 46 Z" fill="#fbfaf7" stroke="#1a1714" stroke-width="3"/>
    <path d="M8 46 Q 60 38 112 46" fill="none" stroke="#1a1714" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="44" cy="76" rx="4" ry="5.5" fill="#1a1714"/><ellipse cx="76" cy="76" rx="4" ry="5.5" fill="#1a1714"/>
    <ellipse cx="34" cy="86" rx="6" ry="3.5" fill="#ff9fb0"/><ellipse cx="86" cy="86" rx="6" ry="3.5" fill="#ff9fb0"/>
    <path d="M50 84 Q 60 100 70 84 Z" fill="#cc2018" stroke="#1a1714" stroke-width="2.6"/>
  </g></svg>`;
fs.mkdirSync('icons', { recursive: true });
for (const [n, pad] of [[192, 8], [512, 8], ['maskable-512', 20]]) {
  const size = typeof n === 'number' ? n : 512;
  await sharp(Buffer.from(svg(pad))).resize(size, size).png().toFile(`icons/icon-${n}.png`);
}
console.log('icons ok');
