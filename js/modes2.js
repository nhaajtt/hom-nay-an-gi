// Dish quiz: photo rebus (one real photo per word) or a history paragraph with the name hidden.
import { sfx, rand, pick, reduced } from './sketch.js';
import { photo, esc } from './modes.js';
import { store } from './store.js';
import { dayKey } from './extras.js';

export const quizData = { photo: [], units: {}, byId: {}, labels: { region: {}, kind: {} } };
export const quizDaily = { on: false };
// same questions for everyone on the same day
function seeded(key) {
  let h = 1779033703 ^ key.length;
  for (const ch of key) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
const seededSample = (arr, n, rnd) => {
  const a = arr.slice().sort((x, y) => (x.id < y.id ? -1 : 1));
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};
export function dailyStreak(S) {
  const done = S.daily || {};
  let n = 0;
  for (let t = new Date(); done[dayKey(t)]; t.setDate(t.getDate() - 1)) n++;
  return n;
}
export const QUIZ_KINDS = {
  anh: { name: "Ảnh ghép chữ", note: "mỗi ảnh là một chữ" },
  su: { name: "Đọc sử đoán món", note: "tên món bị che đi" },
  tron: { name: "Trộn cả hai", note: "xen kẽ hai kiểu" },
};
const ROUND = 5, LIVES = 3;
export const QUIZ_LEVELS = {
  de: { name: 'Dễ', note: 'chọn 1 trong 4 · 40 giây', time: 40, mult: 1, hints: 1 },
  kho: { name: 'Khó', note: 'tự gõ tên · 60 giây', time: 60, mult: 2, hints: 3 },
  sieu: { name: 'Siêu khó', note: 'tự gõ · 30 giây · cấm gợi ý', time: 30, mult: 3, hints: 0 },
};
const RANKS = ['Người ngoài hành tinh 👽', 'Thực khách tập sự 🥢', 'Thực khách tập sự 🥢', 'Dân sành ăn 😋', 'Dân sành ăn 😋', 'Thần ăn uống 👑'];
const WRONG = ['Sai rồi! Gần đúng… với một món khác 😅', 'Không phải! Bao tử bạn đoán hay não bạn đoán vậy?', 'Trật lất! Nhìn kỹ lại mấy cái icon đi.', 'Sai nhưng mà tự tin, tui thích.', 'Hông phải nha. Đọc to lên thử xem?'];
const RIGHT = ['Chuẩn không cần chỉnh!', 'Ăn nhiều nên đoán hay ghê!', 'Đầu bếp nghe xong muốn khóc.', 'Bộ não này đáng giá một tô phở.', 'Ghê chưa, ghê chưa!'];

const sample = (arr, n) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
};
const qnorm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
function correct(guess, d) {
  const g = qnorm(guess);
  if (g.length < 2) return false;
  for (const t of [d.name, d.nameEn]) {
    const n = qnorm(t);
    if (!n) continue;
    if (g === n || (n.length > 6 && lev(g, n) <= 1)) return true;
    if (g.split(' ').length >= 2 && n.startsWith(g + ' ') && g.length >= n.length * 0.55) return true;
  }
  return false;
}
// three wrong answers that look plausible: same first word ("Bún …", "Bánh …") when possible
function distractors(d) {
  const all = Object.values(quizData.byId).filter((x) => x.id !== d.id && x.region !== 'intl');
  const head = qnorm(d.name).split(' ')[0];
  const close = all.filter((x) => qnorm(x.name).split(' ')[0] === head);
  const out = sample(close, 3);
  return out.concat(sample(all.filter((x) => !out.includes(x)), 3 - out.length));
}

// hide every word of the dish name inside its history paragraph
function maskStory(text, d) {
  const hide = new Set([...d.name.split(/\s+/), ...(d.nameEn || '').split(/\s+/).filter((w) => w.length > 3)].map((w) => w.toLowerCase()).filter((w) => w.length >= 2));
  return text.split(/(\s+|[,.;:()“”"!?…]+)/).map((t) => (hide.has(t.toLowerCase()) ? '<i class="q-mask">▒▒▒</i>' : esc(t))).join('');
}
const photoById = () => Object.fromEntries(quizData.photo.map((p) => [p.id, p]));
function makeQ(kind, d) {
  const L = quizData.labels;
  const words = d.name.split(' ');
  const pattern = (reveal) => words.map((w) => [...w].map((c, i) => (reveal && i === 0 ? c : '_')).join(' ')).join('   /   ');
  if (kind === 'anh') {
    const tiles = photoById()[d.id].units.map((u) => ({ u, ...quizData.units[u] }));
    const TYPE = { pun: 'đọc gần giống', literal: 'nghĩa thật', place: 'địa danh' };
    return {
      kind, d, tiles,
      hints: [tiles.map((t, i) => `ảnh ${i + 1}: ${TYPE[t.type] || 'nghĩa thật'}`).join(' · '), `${words.length} chữ: ${pattern(false)}`, `Trong ảnh là: ${tiles.map((t) => t.u).join(' · ')}`],
      explain: tiles.map((t) => t.say || t.u).join(' + ') + ' = ' + d.name + '.',
    };
  }
  return {
    kind: 'su', d,
    hints: [`${L.region[d.region] || ''} · ${L.kind[d.kind] || ''}`, `${words.length} chữ: ${pattern(false)}`, `Chữ đầu: ${pattern(true)}`],
    explain: d.history || d.desc || '',
  };
}

function quiz(host, ctx) {
  let running = false;
  const S = store.get();
  const intro = () => {
    if (running) return;
    const lv = S.quizLevel in QUIZ_LEVELS ? S.quizLevel : 'kho';
    const kd = S.quizKind in QUIZ_KINDS ? S.quizKind : 'tron';
    const exampleHTML = () => {
      const p = quizData.photo.find((x) => x.id === 'bun-bo-hue') || quizData.photo[0];
      if (!p) return '<div class="q-emoji q-idle"><span>📜</span> = ❓</div>';
      return `<div class="q-photos q-idle">${p.units.map((u) => `<figure><img src="${quizData.units[u].img}" alt=""></figure>`).join('<em>+</em>')}<em>= ?</em></div>`;
    };
    const ex = quizData.photo.find((x) => x.id === 'bun-bo-hue') || quizData.photo[0];
    const exText = ex ? `Ví dụ: ${ex.units.map((u) => '<b>' + esc(u) + '</b>').join(' + ')} = <b>${esc(quizData.byId[ex.id].name)}</b>.` : '';
    const seen = (S.quizSeen || []).length;
    host.innerHTML = `<span class="mode-title">[ đố vui ] nhìn ảnh, đọc to, ghép lại thành tên món</span>
      <div class="quiz">
        ${exampleHTML()}
        <p class="q-msg q-intro">${exText} Hoặc đọc đoạn lịch sử bị che tên rồi đoán món.<br>Mỗi ván ${ROUND} câu, ${LIVES} mạng. Trả lời nhanh, đúng liên tiếp thì điểm càng cao.</p>
        <div class="q-levels" role="radiogroup" aria-label="Độ khó">${Object.entries(QUIZ_LEVELS).map(([k, v]) =>
          `<button role="radio" data-lv="${k}" aria-checked="${k === lv}"><b>${v.name}</b><small>${v.note}</small></button>`).join('')}</div>
        <div class="q-levels q-kinds" role="radiogroup" aria-label="Kiểu đề">${Object.entries(QUIZ_KINDS).map(([k, v]) =>
          `<button role="radio" data-kind="${k}" aria-checked="${k === kd}"><b>${v.name}</b><small>${v.note}</small></button>`).join('')}</div>
        <p class="q-stat">🏆 Kỷ lục: <b>${S.quizBest || 0}</b> điểm · đã giải ${seen} câu · ${quizData.photo.length} câu ảnh, ${Object.keys(quizData.byId).length} câu sử</p>
      </div>`;
    host.querySelectorAll('.q-levels button').forEach((b) => (b.onclick = () => {
      sfx.click();
      const key = b.dataset.lv ? 'lv' : 'kind';
      store.set(key === 'lv' ? { quizLevel: b.dataset.lv } : { quizKind: b.dataset.kind });
      b.parentNode.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', x === b));
    }));
    if (!reduced) gsap.from(host.querySelectorAll('.q-idle figure, .q-idle span'), { scale: 0, rotation: () => rand(-40, 40), duration: .45, stagger: .12, ease: 'back.out(2.5)' });
  };
  intro();

  return {
    refresh: intro,
    run(chosen, pool) {
      running = true;
      let daily = quizDaily.on; quizDaily.on = false;
      const lv = daily ? 'kho' : QUIZ_LEVELS[S.quizLevel] ? S.quizLevel : 'kho';
      const L = QUIZ_LEVELS[lv];
      const ids = new Set(pool.map((d) => d.id));
      return new Promise((resolve) => {
        let lives, score, streak, idx, qs, results, cleanup = () => {};
        const done = (d) => { cleanup(); running = false; resolve(d); };
        const $ = (s) => host.querySelector(s);

        const start = () => {
          const seen = new Set(S.quizSeen || []);
          const kd = S.quizKind in QUIZ_KINDS ? S.quizKind : 'tron';
          const all = Object.values(quizData.byId).filter((d) => d.history);
          const photoIds = new Set(quizData.photo.map((p) => p.id));
          const pickFrom = (list, n, kind) => {
            let cand = list.filter((d) => ids.has(d.id));
            if (cand.length < n) cand = list;
            const fresh = cand.filter((d) => !seen.has(kind + ':' + d.id));
            return sample(fresh.length >= n ? fresh : cand, n).map((d) => makeQ(kind, d));
          };
          const photoList = all.filter((d) => photoIds.has(d.id));
          const nPhoto = !photoList.length ? 0 : kd === 'anh' ? ROUND : kd === 'su' ? 0 : Math.ceil(ROUND / 2);
          if (daily) {
            const rnd = seeded('angi-' + dayKey());
            const np = Math.min(2, photoList.length);
            qs = seededSample([...seededSample(photoList, np, rnd).map((d) => makeQ('anh', d)), ...seededSample(all, ROUND - np, rnd).map((d) => makeQ('su', d))].map((q) => ({ ...q, id: q.d.id })), ROUND, rnd);
          } else qs = sample([...pickFrom(photoList, nPhoto, 'anh'), ...pickFrom(all, ROUND - nPhoto, 'su')], ROUND);
          lives = LIVES; score = 0; streak = 0; idx = 0; results = [];
          ctx.say(daily ? `Đố hôm nay ${dayKey()}: cả nước cùng một đề, mức Khó. Chiến! 🔥` : `Ván mới, mức ${L.name}. Nhìn kỹ, đoán lẹ! 🧠`, 'wow');
          ask();
        };

        const ask = () => {
          cleanup();
          const q = qs[idx], d = q.d;
          const words = d.name.split(' ');
          let tries = lv === 'de' ? 1 : 2, hintLv = 0, over = false;
          let left = L.time;
          host.innerHTML = `<span class="mode-title">[ ${daily ? 'đố hôm nay' : 'đố vui · ' + L.name} ] câu ${idx + 1}/${ROUND}</span>
            <div class="quiz">
              <div class="q-top"><span class="q-lives" aria-label="Mạng">${'♥'.repeat(lives)}${'♡'.repeat(LIVES - lives)}</span><span class="q-streak">${streak > 1 ? `🔥 chuỗi ${streak}` : ''}</span><span class="q-score">${score} điểm</span></div>
              <div class="q-timer" aria-hidden="true"><i></i></div>
              ${q.kind === 'anh'
                ? `<div class="q-photos" aria-label="Câu đố bằng ảnh">${q.tiles.map((t) => `<figure><img src="${t.img}" alt="ảnh đố"></figure>`).join('<em>+</em>')}</div>`
                : `<blockquote class="q-story">📜 ${maskStory(q.explain, d)}</blockquote>`}
              <p class="q-hint" hidden></p>
              ${lv === 'de'
                ? `<div class="q-opts">${sample([d, ...distractors(d)], 4).map((o, i) => `<button type="button" data-id="${o.id}"><kbd>${i + 1}</kbd>${esc(o.name)}</button>`).join('')}</div>`
                : `<form class="q-form" autocomplete="off"><input class="q-in" placeholder="gõ tên món… (không dấu cũng được)" aria-label="Tên món"><button class="pill" type="submit">đoán!</button></form>`}
              <div class="q-tools">${L.hints ? `<button type="button" class="link q-help">💡 gợi ý (−4 điểm)</button>` : ''}<button type="button" class="link q-give">🏳️ chịu thua</button></div>
              <p class="q-msg" aria-live="polite"></p>
            </div>`;
          const msg = $('.q-msg'), hint = $('.q-hint'), bar = $('.q-timer i');
          if (!reduced) gsap.from(host.querySelectorAll('.q-photos figure, .q-photos em, .q-story'), { scale: 0, rotation: () => rand(-40, 40), duration: .45, stagger: .12, ease: 'back.out(2.5)' });

          const t0 = Date.now();
          const timer = setInterval(() => {
            left = Math.max(0, L.time - (Date.now() - t0) / 1000);
            bar.style.width = (left / L.time) * 100 + '%';
            bar.parentNode.classList.toggle('hot', left < 10);
            if (left <= 0) end(false, '⏰ Hết giờ!');
          }, 200);
          const onKey = (e) => {
            if (lv === 'de' && /^[1-4]$/.test(e.key)) host.querySelectorAll('.q-opts button')[e.key - 1]?.click();
          };
          addEventListener('keydown', onKey);
          cleanup = () => { clearInterval(timer); removeEventListener('keydown', onKey); };

          const end = (won, why) => {
            if (over) return;
            over = true; cleanup();
            host.querySelectorAll('.q-opts button, .q-form button, .q-tools button').forEach((b) => (b.disabled = true));
            const inp = $('.q-in'); if (inp) inp.disabled = true;
            host.querySelectorAll('.q-opts button').forEach((b) => b.classList.toggle('right', b.dataset.id === d.id));
            let pts = 0;
            if (won) {
              streak++;
              pts = Math.max(2, 10 + Math.ceil(left / 3) + 5 * (streak - 1) - 4 * hintLv) * L.mult;
              score += pts;
              store.set({ quizSeen: [...new Set([...(S.quizSeen || []), q.kind + ':' + d.id])] });
              sfx.win(); ctx.say(pick(RIGHT), 'happy');
            } else {
              streak = 0; lives--;
              sfx.boo(); ctx.say(why || 'Hông sao, ăn vô là nhớ liền.', 'sad');
            }
            results.push({ d, ok: won, pts });
            const last = lives <= 0 || idx >= ROUND - 1;
            $('.q-tools').remove();
            hint.hidden = true;
            msg.innerHTML = `${won ? `<b>ĐÚNG! +${pts}</b>` : `<b>${esc(why || 'Thua rồi!')}</b>`}
              <span class="q-reveal"><span class="ava">${photo(d, 'ball')}</span><span><b>${esc(d.name)}</b><small>${esc(q.kind === 'anh' ? q.explain : '')}</small></span></span>
              <span class="q-next"><button type="button" class="pill q-go">${last ? 'xem tổng kết ➜' : 'câu tiếp ➜'}</button><button type="button" class="pill ghost q-eat">🍽️ ăn món này</button></span>`;
            $('.q-top').innerHTML = `<span class="q-lives">${'♥'.repeat(lives)}${'♡'.repeat(LIVES - lives)}</span><span class="q-streak">${streak > 1 ? `🔥 chuỗi ${streak}` : ''}</span><span class="q-score">${score} điểm</span>`;
            if (!reduced) gsap.from('.q-reveal', { y: 14, opacity: 0, duration: .35 });
            $('.q-eat').onclick = () => done(d);
            $('.q-go').onclick = () => { sfx.click(); if (last) summary(); else { idx++; ask(); } };
            $('.q-go').focus({ preventScroll: true });
          };

          if (lv === 'de') {
            host.querySelectorAll('.q-opts button').forEach((b) => (b.onclick = () => {
              if (b.dataset.id === d.id) end(true);
              else { b.classList.add('wrong'); end(false, 'Sai rồi!'); }
            }));
          } else {
            const input = $('.q-in');
            setTimeout(() => input.focus({ preventScroll: true }), 300);
            $('.q-form').addEventListener('submit', (e) => {
              e.preventDefault();
              const v = input.value.trim();
              if (!v || over) return;
              if (correct(v, d)) return end(true);
              tries--;
              sfx.boo();
              if (!reduced) gsap.fromTo($('.q-form'), { x: -10 }, { x: 0, duration: .4, ease: 'elastic.out(1, .3)' });
              if (tries <= 0) return end(false, 'Sai 2 lần rồi!');
              msg.textContent = `${pick(WRONG)} Còn 1 lần đoán.`;
              input.select();
            });
          }
          $('.q-help')?.addEventListener('click', () => {
            hintLv++; sfx.tick();
            hint.hidden = false;
            hint.textContent = (hintLv === 1 ? 'Gợi ý: ' : '') + q.hints[hintLv - 1];
            if (hintLv >= L.hints) $('.q-help').disabled = true;
            $('.q-in')?.focus({ preventScroll: true });
          });
          $('.q-give').addEventListener('click', () => end(false, 'Chịu thua rồi!'));
        };

        const summary = () => {
          cleanup();
          const right = results.filter((r) => r.ok).length;
          const best = score > (S.quizBest || 0);
          if (best) store.set({ quizBest: score });
          const grid = results.map((r) => (r.ok ? '🟩' : '🟥')).join('') + '⬜'.repeat(ROUND - results.length);
          if (daily && !(S.daily || {})[dayKey()]) store.set({ daily: { ...(S.daily || {}), [dayKey()]: { score, grid } } });
          const streakN = dailyStreak(S);
          dispatchEvent(new CustomEvent('quizdone', { detail: { daily, score, right, grid } }));
          host.innerHTML = `<span class="mode-title">[ đố vui · ${L.name} ] tổng kết</span>
            <div class="quiz q-end">
              <div class="q-big">${score} <small>điểm</small></div>
              ${best && score ? '<p class="q-new">🎉 KỶ LỤC MỚI!</p>' : `<p class="q-stat">Kỷ lục: ${S.quizBest || 0} điểm</p>`}
              <p class="q-rank">${RANKS[right]} · đúng ${right}/${results.length}</p>
              ${daily ? `<p class="q-grid">${grid} <small>chuỗi 🔥 ${streakN} ngày</small></p><button type="button" class="pill q-share">↗ khoe kết quả</button>` : ''}
              <p class="q-msg">Ván này gặp mấy món dưới đây. Hôm nay ăn món nào?</p>
              <div class="q-picks">${results.map((r, i) => `<button type="button" data-i="${i}" class="${r.ok ? 'ok' : ''}"><span class="ava">${photo(r.d, 'ball')}</span>${esc(r.d.name)}</button>`).join('')}</div>
              <button type="button" class="link q-again">🔁 ${daily ? 'chơi ván thường' : 'chơi ván nữa'}</button>
            </div>`;
          right >= 4 ? sfx.win() : sfx.pop();
          ctx.say(right >= 4 ? 'Trời ơi thiên tài ẩm thực!' : right >= 2 ? 'Cũng được đó, ăn thêm cho giỏi nha.' : 'Chắc tại đói quá nên đoán sai 😅', right >= 2 ? 'happy' : 'sad');
          if (!reduced) gsap.from(host.querySelectorAll('.q-picks button'), { y: 30, opacity: 0, stagger: .06, duration: .35, ease: 'back.out(1.6)' });
          host.querySelectorAll('.q-picks button').forEach((b) => (b.onclick = () => done(results[b.dataset.i].d)));
          $('.q-again').onclick = () => { sfx.click(); daily = false; start(); };
          $('.q-share')?.addEventListener('click', async () => {
            const text = `Đố ăn gì hôm nay ${dayKey()} 🧩
${grid} ${score} điểm · chuỗi 🔥${streakN}
${location.origin}${location.pathname}`;
            try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); ctx.say('Đã copy kết quả, dán vô nhóm khoe đi!', 'happy'); } } catch {}
          });
        };

        if (!Object.keys(quizData.byId).length) { ctx.say('Chưa có câu đố nào, để tui chọn thường nha.', 'sad'); return done(chosen); }
        start();
      });
    },
  };
}

export const MODES2 = { quiz };
