// Picking modes: fortune sticks (xin xăm) and the food cup.
import { svgEl, sfx, rand, pick, reduced, css } from './sketch.js';
import { store } from './store.js';

export const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// photos: real image when we have one, otherwise a meme so the slot is never empty
export const media = { has: new Set(), memes: [] };
const MEME_TOP = ['ảnh món này', 'tìm ảnh cả buổi', 'đầu bếp gửi ảnh', 'món này ngon tới mức', 'wikipedia bảo', 'ảnh thật bị', 'đang tải ảnh'];
const MEME_BOT = ['bị ăn mất rồi', 'chỉ thấy con này', 'nhưng con mèo nhận', 'không ai kịp chụp', 'tự tưởng tượng đi', 'chủ quán giấu mất', 'loading… 99%'];
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export function memeHTML(d, small = false) {
  const h = hash(d.id), m = media.memes[h % (media.memes.length || 1)];
  const top = MEME_TOP[h % MEME_TOP.length], bot = MEME_BOT[(h >> 3) % MEME_BOT.length];
  const pic = m ? `<img src="img/memes/${m}" alt="" loading="lazy">` : `<div class="emo">${d.emoji || '🍽️'}</div>`;
  return `<div class="meme ${small ? 'small-meme' : ''}" title="Chưa có ảnh thật cho món này">${pic}<span class="top">${esc(top)}</span><span class="bot">${esc(bot)}</span></div>`;
}
export function photo(d, small = false) {
  if (!media.has.has(d.id)) return small === 'ball' ? `<div class="emo">${d.emoji || '🍽️'}</div>` : memeHTML(d, small);
  return `<img src="img/dishes/${d.id}.webp" alt="${esc(d.name)}" loading="lazy" decoding="async" data-id="${d.id}" onerror="window.__memeFix&&window.__memeFix(this)">`;
}
export function polaroidHTML(d) {
  return `<div class="ph">${photo(d, true)}</div><div class="cap">${esc(d.name)}</div>`;
}
const sample = (arr, n) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};
const wait = (ms) => new Promise((r) => setTimeout(r, reduced ? Math.min(ms, 60) : ms));
const T = (t) => (reduced ? 0.05 : t);
const rcOf = (svg) => rough.svg(svg);

const VERSES = [
  'Thượng thượng xăm: bụng no thì lòng vui.', 'Ăn món này, mọi deadline đều tan.',
  'Quẻ nói: hôm nay hợp ăn, kỵ nhịn.', 'Trung bình xăm: ăn xong nhớ uống nước.',
  'Đại cát: món này làm bạn cười cả chiều.', 'Quẻ bảo ăn thêm topping, đừng cãi.',
  'Người xưa có câu: thèm gì ăn nấy.', 'Xăm vàng: no bụng thì việc gì cũng xong.',
];
const loadScript = (src) => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = Object.assign(document.createElement('script'), { src, onload: res, onerror: rej }); document.head.appendChild(s); });
// let the phone's accelerometer drive the tube for up to 3 s
function phoneShake(tube, ctx) {
  if (!matchMedia('(pointer: coarse)').matches || !('DeviceMotionEvent' in window)) return Promise.resolve(false);
  return new Promise((resolve) => {
    let energy = 0, got = false, last = 0;
    ctx.say('Lắc điện thoại đi! Lắc mạnh vô 📱💥', 'wow');
    const on = (e) => {
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a) return;
      got = true;
      gsap.to(tube, { rotation: Math.max(-25, Math.min(25, (a.x || 0) * 2.4)), x: (a.x || 0) * 1.5, duration: 0.08 });
      const g = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
      if (g > 16) { energy += g - 16; if (Date.now() - last > 120) { sfx.clack(); last = Date.now(); } }
      if (energy > 140) done(true);
    };
    const done = (ok) => { removeEventListener('devicemotion', on); clearTimeout(t); resolve(ok && got); };
    const t = setTimeout(() => done(got && energy > 40), 3000);
    addEventListener('devicemotion', on);
  });
}
// the stick flies out of the tube and tumbles with real physics (Matter.js)
async function stickPhysics(host, tube, stick) {
  try { await loadScript('vendor/matter.min.js'); } catch { return false; }
  const { Engine, Bodies, Body, Composite } = window.Matter;
  const hr = host.getBoundingClientRect(), tr = tube.getBoundingClientRect();
  const W = hr.width, H = hr.height, sw = 24, sh = Math.min(210, H * 0.42);
  const engine = Engine.create({ gravity: { y: 1.1 } });
  const x0 = tr.left - hr.left + tr.width * 0.42, y0 = tr.top - hr.top + sh * 0.25;
  const body = Bodies.rectangle(x0, y0, sw, sh, { restitution: 0.45, friction: 0.4, frictionAir: 0.01, chamfer: { radius: 6 } });
  Body.setAngle(body, -0.5);
  Body.setVelocity(body, { x: -(4 + Math.random() * 3), y: -(9 + Math.random() * 3) });
  Body.setAngularVelocity(body, -0.18 - Math.random() * 0.1);
  const floor = Bodies.rectangle(W / 2, H - 6 + 30, W * 2, 60, { isStatic: true });
  const wl = Bodies.rectangle(-30, H / 2, 60, H * 3, { isStatic: true }), wr = Bodies.rectangle(W + 30, H / 2, 60, H * 3, { isStatic: true });
  Composite.add(engine.world, [body, floor, wl, wr]);
  Object.assign(stick.style, { left: '0px', top: '0px', bottom: 'auto', marginLeft: '0', height: sh + 'px', opacity: 1, zIndex: 3 });
  gsap.set(stick, { opacity: 1, x: 0, y: 0, rotation: 0 });
  let lastHit = 0;
  await new Promise((resolve) => {
    const t0 = performance.now();
    const step = (t) => {
      Engine.update(engine, 1000 / 60);
      const { x, y } = body.position;
      stick.style.transform = `translate(${x - sw / 2}px, ${y - sh / 2}px) rotate(${body.angle}rad)`;
      if (y > H - 60 && Math.abs(body.velocity.y) > 2 && t - lastHit > 160) { sfx.clack(); lastHit = t; }
      const still = body.speed < 0.15 && Math.abs(body.angularVelocity) < 0.01;
      if ((still && t - t0 > 900) || t - t0 > 3200) resolve(); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  Composite.clear(engine.world, false); Engine.clear(engine);
  return true;
}

function xam(host, ctx) {
  host.innerHTML = `<span class="mode-title">xin xăm — lắc ống, que nào rơi ra ăn món đó</span>
    <div class="xam-box"><div class="xam-stick"><span></span></div>
    <svg class="xam-tube" viewBox="-10 -90 170 330"></svg>
    <div class="xam-paper"><div class="num"></div><div class="nm"></div><div class="verse"></div></div></div>`;
  const tube = host.querySelector('.xam-tube'), stick = host.querySelector('.xam-stick'), paper = host.querySelector('.xam-paper');
  const rc = rcOf(tube);
  for (let i = 0; i < 9; i++) tube.appendChild(rc.rectangle(30 + i * 10 + rand(-3, 3), -70 + rand(0, 30), 9, 160, { fill: '#fbfaf7', fillStyle: 'solid', stroke: '#1a1714', strokeWidth: 1.4, seed: i + 1 }));
  tube.appendChild(rc.rectangle(10, 30, 130, 200, { fill: '#cc2018', fillStyle: 'solid', stroke: '#1a1714', strokeWidth: 2.5, roughness: 1.4, seed: 21 }));
  tube.appendChild(rc.rectangle(10, 30, 130, 200, { fill: '#1a1714', fillStyle: 'hachure', hachureGap: 14, fillWeight: .8, stroke: 'none', seed: 22 }));
  tube.appendChild(rc.ellipse(75, 30, 130, 26, { fill: '#1a1714', fillStyle: 'solid', stroke: '#1a1714', seed: 23 }));
  const lbl = svgEl('text', { x: 75, y: 145, 'text-anchor': 'middle', 'font-family': 'Cabin Sketch', 'font-size': 44, fill: '#fbfaf7', 'font-weight': 700 }, tube);
  lbl.textContent = 'XĂM';
  const lbl2 = svgEl('text', { x: 75, y: 190, 'text-anchor': 'middle', 'font-family': 'Kalam', 'font-size': 18, fill: '#fbfaf7' }, tube);
  lbl2.textContent = 'ăn gì đây?';

  return {
    refresh() { gsap.set([stick, paper], { opacity: 0 }); },
    async run(chosen) {
      gsap.set(paper, { opacity: 0 });
      gsap.set(stick, { opacity: 0, x: 0, y: 0, rotation: 0 });
      stick.removeAttribute('style');
      ctx.say('Thành tâm khấn: "con đói quá"… 🙏', 'wow');
      // phones: shake for real (tube follows the accelerometer); otherwise auto-shake
      const shook = await phoneShake(tube, ctx);
      const shakes = reduced ? 1 : shook ? 3 : 12;
      for (let i = 0; i < shakes; i++) {
        sfx.clack();
        await gsap.to(tube, { rotation: i % 2 ? -11 : 11, x: i % 2 ? -6 : 6, duration: 0.09, ease: 'power1.inOut' });
      }
      gsap.to(tube, { rotation: -24, x: 0, duration: T(.25) });
      stick.querySelector('span').textContent = chosen.name;
      sfx.pop();
      if (reduced || !(await stickPhysics(host, tube, stick))) {
        const W = host.clientWidth;
        await gsap.timeline()
          .set(stick, { opacity: 1, y: 40 })
          .to(stick, { y: -150, x: -40, rotation: -40, duration: T(.45), ease: 'power2.out' })
          .to(stick, { y: 40, x: -Math.min(W * 0.28, 220), rotation: -98, duration: T(.55), ease: 'bounce.out' });
      }
      gsap.to(tube, { rotation: 0, duration: T(.4) });
      paper.querySelector('.num').textContent = `quẻ số ${Math.floor(rand(1, 100))}`;
      paper.querySelector('.nm').textContent = chosen.name;
      paper.querySelector('.verse').textContent = pick(VERSES);
      await gsap.fromTo(paper, { opacity: 0, scale: .3, rotation: -30 }, { opacity: 1, scale: 1, rotation: 4, duration: T(.5), ease: 'back.out(2)' });
      await wait(500);
      return chosen;
    },
  };
}

/* ================= ĐẤU CÚP ================= */
const CUP_SIZES = [8, 16, 32];
const CUP_TALK = ['Kèo này căng à nha!', 'Trận cầu đinh!', 'Bụng bạn quyết định tất cả.', 'Hai món này gặp nhau là có biến.', 'Trọng tài đừng thiên vị nha!', 'Khán giả hò reo dữ dội!', 'Ai thua thì về nhà rửa chén.'];
function cup(host, ctx) {
  let running = false;
  const S = store.get();
  const intro = () => {
    if (running) return;
    const n = CUP_SIZES.includes(S.cupSize) ? S.cupSize : 16;
    host.innerHTML = `<span class="mode-title">[ đấu cúp ] bạn làm trọng tài, món vô địch được ăn</span>
      <div class="cup"><div class="cup-ico">🥊🍜 vs 🌮🥊</div>
      <div class="cup-round">Cúp Ăn Gì <small>chọn số món vào sân</small></div>
      <div class="cup-size" role="radiogroup" aria-label="Số món">${CUP_SIZES.map((k) => `<button role="radio" data-n="${k}" aria-checked="${k === n}"><b>${k}</b>món</button>`).join('')}</div>
      <p>Mỗi trận bấm món bạn thèm hơn (hoặc phím ← →). Phân vân quá thì bấm 🎲 để trời chọn.</p></div>`;
    host.querySelectorAll('.cup-size button').forEach((b) => (b.onclick = () => {
      sfx.click(); store.set({ cupSize: +b.dataset.n });
      host.querySelectorAll('.cup-size button').forEach((x) => x.setAttribute('aria-checked', x === b));
    }));
  };
  intro();
  return {
    refresh: intro,
    run(chosen, pool) {
      running = true;
      let n = CUP_SIZES.includes(S.cupSize) ? S.cupSize : 16;
      while (n > 2 && n > pool.length) n /= 2;
      let round = sample([chosen, ...sample(pool.filter((d) => d.id !== chosen.id), n - 1)], n);
      const total = round.length - 1;
      const names = { 32: 'Vòng 1/16', 16: 'Vòng 1/8', 8: 'Tứ kết', 4: 'Bán kết', 2: 'Chung kết' };
      let played = 0, onKey = () => {};
      return new Promise((resolve) => {
        let next = [], idx = 0;
        const finish = async (d) => {
          removeEventListener('keydown', onKey);
          host.innerHTML = `<div class="cup"><div class="cup-round">🏆 VÔ ĐỊCH <small>sau ${total} trận nảy lửa</small></div>
            <div class="cup-champ polaroid">${polaroidHTML(d)}</div></div>`;
          sfx.win();
          if (!reduced) gsap.from('.cup-champ', { scale: .3, rotation: -20, duration: .7, ease: 'back.out(1.8)' });
          ctx.say(`${d.name} lên ngôi! Cả bàn ăn vỗ tay 👏`, 'happy');
          await wait(1500);
          running = false;
          resolve(d);
        };
        const show = () => {
          if (idx >= round.length) { round = next; next = []; idx = 0; }
          if (round.length === 1) return finish(round[0]);
          const a = round[idx], b = round[idx + 1];
          const title = names[round.length] || 'Vòng loại';
          host.innerHTML = `<div class="cup"><div class="cup-round">${title} <small>trận ${idx / 2 + 1}/${round.length / 2} · ${round.length === 2 ? 'cả hội trường nín thở!' : pick(CUP_TALK)}</small></div>
            <div class="cup-pair">
              <button class="polaroid" data-k="0" aria-label="Chọn ${esc(a.name)}">${polaroidHTML(a)}</button>
              <span class="vs">vs</span>
              <button class="polaroid" data-k="1" aria-label="Chọn ${esc(b.name)}">${polaroidHTML(b)}</button>
            </div>
            <div class="cup-bar" aria-label="Tiến độ"><i style="width:${(played / total) * 100}%"></i></div>
            <button type="button" class="link cup-rand">🎲 phân vân quá, trời chọn dùm</button></div>`;
          const cards = host.querySelectorAll('.cup-pair .polaroid');
          if (!reduced) gsap.from(cards, { y: 60, opacity: 0, rotation: (i) => (i ? 20 : -20), duration: .45, stagger: .08, ease: 'back.out(1.6)' });
          let picked = false;
          const choose = async (k) => {
            if (picked) return;
            picked = true;
            const win = k ? b : a, loser = cards[k ? 0 : 1];
            cards.forEach((c) => (c.disabled = true));
            sfx.pop();
            cards[k].classList.add('won');
            const s = svgEl('svg', { class: 'scratch', viewBox: '0 0 100 100', preserveAspectRatio: 'none' });
            loser.appendChild(s);
            const rc = rcOf(s);
            s.appendChild(rc.line(8, 10, 92, 90, { stroke: '#cc2018', strokeWidth: 5, roughness: 2 }));
            s.appendChild(rc.line(92, 12, 10, 88, { stroke: '#cc2018', strokeWidth: 5, roughness: 2 }));
            await gsap.to(loser, { y: 200, rotation: 40, opacity: 0, duration: T(.5), delay: T(.2), ease: 'power2.in' });
            next.push(win); idx += 2; played++;
            show();
          };
          cards.forEach((el) => el.addEventListener('click', () => choose(+el.dataset.k)));
          host.querySelector('.cup-rand').onclick = () => { ctx.say('Trời đã chọn, cấm cãi!', 'wow'); choose(Math.random() < .5 ? 0 : 1); };
          removeEventListener('keydown', onKey);
          onKey = (e) => { if (e.key === 'ArrowLeft' || e.key === '1') choose(0); else if (e.key === 'ArrowRight' || e.key === '2') choose(1); };
          addEventListener('keydown', onKey);
        };
        ctx.say(`${round.length} món vào sân, bạn làm trọng tài nha! 🏆`, 'wow');
        show();
      });
    },
  };
}

export const MODES = { xam, cup };
