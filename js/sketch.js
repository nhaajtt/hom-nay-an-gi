// Hand-drawn helpers: rough.js frames, doodles, confetti, sounds, mascot.
const NS = 'http://www.w3.org/2000/svg';
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function svgEl(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (parent) parent.appendChild(el);
  return el;
}

/* ---------- rough frames on [data-rough] ---------- */
const frames = new Map();
export function drawFrame(el) {
  let svg = el.querySelector(':scope > .rough-svg');
  if (!svg) { svg = svgEl('svg', { class: 'rough-svg', 'aria-hidden': 'true' }); el.prepend(svg); }
  svg.innerHTML = '';
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return;
  const rc = rough.svg(svg);
  const ink = css('--ink');
  svg.appendChild(rc.rectangle(6, 6, w, h, { stroke: ink, strokeWidth: 2.2, roughness: 1.6, bowing: 1.2, seed: 7 }));
  svg.appendChild(rc.line(10, h + 9, w + 2, h + 7, { stroke: ink, strokeWidth: 1, roughness: 2, seed: 9 }));
}
const ro = new ResizeObserver((entries) => entries.forEach((e) => drawFrame(e.target)));
export function roughify(root = document) {
  root.querySelectorAll('[data-rough]').forEach((el) => {
    if (!frames.has(el)) { frames.set(el, 1); ro.observe(el); }
    drawFrame(el);
  });
}
export const redrawAll = () => frames.forEach((_, el) => drawFrame(el));

/* hand-drawn circle path used around selected chips */
export function circlePath(w, h) {
  const cx = w / 2, cy = h / 2, rx = w / 2 - 2, ry = h / 2 - 2;
  let d = '';
  const start = rand(-0.4, 0.2), turns = 1.12, steps = 28;
  for (let i = 0; i <= steps; i++) {
    const t = start + (i / steps) * Math.PI * 2 * turns;
    const j = 1 + rand(-0.04, 0.04);
    const x = cx + Math.cos(t) * rx * j, y = cy + Math.sin(t) * ry * j * (1 + i / steps * 0.08);
    d += (i ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  return d;
}

/* underline under the title */
export function underline(target, color) {
  const svg = svgEl('svg', { viewBox: '0 0 200 22', preserveAspectRatio: 'none' }, target);
  const rc = rough.svg(svg);
  const n = rc.curve([[2, 14], [60, 8], [120, 15], [198, 7]], { stroke: color, strokeWidth: 3.2, roughness: 1.2, seed: 4 });
  svg.appendChild(n);
  if (!reduced) n.querySelectorAll('path').forEach((p) => {
    const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
    gsap.to(p, { strokeDashoffset: 0, duration: 1, delay: .4, ease: 'power2.out' });
  });
}

/* ---------- floating background doodles ---------- */
const DOODLES = {
  bowl: (rc, o) => [rc.arc(50, 40, 80, 70, 0, Math.PI, true, o), rc.line(14, 20, 32, 2, o), rc.line(22, 22, 44, 0, o), rc.curve([[40, 34], [44, 26], [40, 18], [44, 10]], o), rc.curve([[56, 34], [60, 26], [56, 18], [60, 10]], o)],
  chili: (rc, o) => [rc.curve([[20, 20], [40, 30], [60, 60], [80, 80]], { ...o, strokeWidth: 6 }), rc.line(16, 18, 10, 6, o)],
  leaf: (rc, o) => [rc.ellipse(50, 50, 60, 28, { ...o, fill: o.stroke, fillStyle: 'hachure', hachureGap: 6 }), rc.line(20, 50, 80, 50, o)],
  star: (rc, o) => [rc.polygon([[50, 5], [61, 38], [95, 38], [67, 58], [78, 92], [50, 71], [22, 92], [33, 58], [5, 38], [39, 38]], o)],
  noodle: (rc, o) => [rc.curve([[5, 50], [20, 20], [35, 80], [50, 20], [65, 80], [80, 20], [95, 50]], o)],
  egg: (rc, o) => [rc.ellipse(50, 50, 80, 64, o), rc.circle(50, 52, 28, { ...o, fill: '#f6c445', fillStyle: 'solid' })],
  chopsticks: (rc, o) => [rc.line(10, 90, 90, 6, { ...o, strokeWidth: 3 }), rc.line(22, 94, 96, 18, { ...o, strokeWidth: 3 })],
  heart: (rc, o) => [rc.path('M50 85 C 10 60, 10 20, 35 20 C 45 20, 50 30, 50 35 C 50 30, 55 20, 65 20 C 90 20, 90 60, 50 85 Z', o)],
};
export function doodle(name, size, color, seed = 1) {
  const svg = svgEl('svg', { viewBox: '0 0 100 100', width: size, height: size });
  const rc = rough.svg(svg);
  const o = { stroke: color, strokeWidth: 2, roughness: 1.5, seed };
  DOODLES[name](rc, o).forEach((n) => svg.appendChild(n));
  return svg;
}
export function backgroundDoodles(layer) {
  layer.innerHTML = '';
  const names = Object.keys(DOODLES);
  const colors = [css('--pen-red'), css('--pen-blue'), css('--leaf'), css('--orange')];
  const n = innerWidth < 700 ? 7 : 14;
  for (let i = 0; i < n; i++) {
    const s = doodle(names[i % names.length], rand(40, 80), colors[i % colors.length], i + 3);
    s.style.left = rand(0, 96) + 'vw';
    s.style.top = rand(0, 96) + 'vh';
    s.style.transform = `rotate(${rand(-30, 30)}deg)`;
    layer.appendChild(s);
    if (!reduced) gsap.to(s, { y: rand(-24, 24), rotation: `+=${rand(-14, 14)}`, duration: rand(4, 8), repeat: -1, yoyo: true, ease: 'sine.inOut' });
  }
}

/* ---------- confetti of herbs, chilies, noodles ---------- */
export function confetti(x = innerWidth / 2, y = innerHeight / 2, count = 46) {
  if (reduced) count = 10;
  const layer = document.getElementById('confetti');
  const shapes = ['leaf', 'chili', 'noodle', 'star', 'heart', 'egg'];
  const colors = ['#5f6b2e', '#cc2018', '#1a1714', '#1a1714', '#b9773a', '#fbfaf7'];
  for (let i = 0; i < count; i++) {
    const s = doodle(pick(shapes), rand(18, 34), pick(colors), i);
    layer.appendChild(s);
    gsap.set(s, { x, y, rotation: rand(0, 360), scale: rand(.7, 1.2) });
    const a = rand(-Math.PI, 0), v = rand(260, 620);
    gsap.timeline({ onComplete: () => s.remove() })
      .to(s, { x: x + Math.cos(a) * v, duration: rand(1.6, 2.4), ease: 'power1.out' }, 0)
      .to(s, { y: y + Math.sin(a) * v * .8, duration: .55, ease: 'power2.out' }, 0)
      .to(s, { y: innerHeight + 60, duration: rand(1.1, 1.8), ease: 'power1.in' }, .55)
      .to(s, { rotation: `+=${rand(-540, 540)}`, duration: 2.4, ease: 'none' }, 0);
  }
}

/* ---------- sound effects (Kenney CC0 packs + CC0 win jingle, see CREDITS.md) ---------- */
export const sound = { on: true };
const VOL = { tick: .35, click: .5, pop: .6, whoosh: .5, drop: .6, clack: .55, shake: .7, throw: .7, boo: .5, open: .5, flip: .4, win: .55 };
const bank = {};
let lastPlay = {};
function play(name, minGap = 0) {
  if (!sound.on) return;
  const now = performance.now();
  if (minGap && now - (lastPlay[name] || 0) < minGap) return;
  lastPlay[name] = now;
  bank[name] ||= Object.assign(new Audio(`sfx/${name}.mp3`), { preload: 'auto' });
  const a = bank[name].cloneNode();
  a.volume = VOL[name] ?? .5;
  a.play().catch(() => {});
}
export const sfx = {
  tick: () => play('tick', 45),
  click: () => play('click'),
  pop: () => play('pop'),
  whoosh: () => play('whoosh'),
  drop: () => play('drop'),
  clack: () => play('clack', 60),
  shake: () => play('shake', 300),
  throw: () => play('throw'),
  flip: () => play('flip', 50),
  open: () => play('open'),
  win: () => play('win'),
  boo: () => play('boo'),
};

/* ---------- mascot: Bé Bát (a little bowl) ---------- */
export function mascot(host) {
  host.innerHTML = `
  <svg viewBox="0 0 120 110" aria-hidden="true">
    <g class="steam" stroke="var(--ink-3)" stroke-width="2.4" fill="none" stroke-linecap="round">
      <path d="M45 30 q-6 -8 0 -14 q6 -6 0 -14"/><path d="M62 28 q-6 -8 0 -14 q6 -6 0 -14"/><path d="M79 30 q-6 -8 0 -14 q6 -6 0 -14"/>
    </g>
    <g class="body">
      <path d="M10 46 Q 12 100 60 102 Q 108 100 110 46 Z" fill="#fbfaf7" stroke="#1a1714" stroke-width="3" stroke-linejoin="round"/>
      <path d="M8 46 Q 60 38 112 46" fill="none" stroke="#1a1714" stroke-width="3" stroke-linecap="round"/>
      <path d="M16 58 Q 60 66 104 58" fill="none" stroke="#cc2018" stroke-width="2" stroke-dasharray="5 6"/>
      <g class="eyes" fill="#1a1714"><ellipse cx="44" cy="76" rx="4" ry="5.5"/><ellipse cx="76" cy="76" rx="4" ry="5.5"/></g>
      <ellipse cx="34" cy="86" rx="6" ry="3.5" fill="#ff9fb0" opacity=".8"/><ellipse cx="86" cy="86" rx="6" ry="3.5" fill="#ff9fb0" opacity=".8"/>
      <path class="mouth" d="M53 86 Q 60 93 67 86" fill="none" stroke="#1a1714" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M40 104 l-4 6 M80 104 l4 6" stroke="#1a1714" stroke-width="3" stroke-linecap="round"/>
    </g>
  </svg>`;
  const svg = host.firstElementChild;
  const eyes = svg.querySelector('.eyes'), mouth = svg.querySelector('.mouth'), body = svg.querySelector('.body');
  if (!reduced) {
    svg.querySelectorAll('.steam path').forEach((p, i) => gsap.to(p, { y: -5, opacity: .3, duration: 1.2 + i * .2, repeat: -1, yoyo: true, ease: 'sine.inOut' }));
    gsap.to(body, { y: -3, duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    const blink = () => { gsap.to(eyes, { scaleY: .1, transformOrigin: '50% 76px', duration: .08, yoyo: true, repeat: 1 }); setTimeout(blink, rand(2200, 5200)); };
    setTimeout(blink, 2000);
  }
  const mouths = { smile: 'M53 86 Q 60 93 67 86', wow: 'M56 86 Q 60 96 64 86 Q 60 82 56 86', happy: 'M50 84 Q 60 100 70 84 Z', sad: 'M53 90 Q 60 84 67 90' };
  return {
    mood(m) {
      mouth.setAttribute('d', mouths[m] || mouths.smile);
      mouth.setAttribute('fill', m === 'happy' ? '#cc2018' : 'none');
      if (m === 'wow' && !reduced) gsap.fromTo(body, { rotation: -6, transformOrigin: '50% 100%' }, { rotation: 6, duration: .12, repeat: 7, yoyo: true, onComplete: () => gsap.set(body, { rotation: 0 }) });
      if (m === 'happy' && !reduced) gsap.fromTo(svg, { y: 0 }, { y: -26, duration: .25, yoyo: true, repeat: 3, ease: 'power2.out' });
    },
  };
}
