import { confetti, sfx, sound, mascot, pick, reduced } from './sketch.js';
import { MODES as M1, photo, polaroidHTML, esc, media } from './modes.js';
import { MODES2, quizData, quizDaily, dailyStreak } from './modes2.js';
import { bowlDrop } from './bowl3d.js';
import { initGroup, closeGroup } from './group.js';
import { dayKey, initExtras, contextWeight, cardMore, stamp, shareCard, closePassport } from './extras.js';
const MODES = { ...MODES2, ...M1 };
import { store } from './store.js';
import { SKINS, applySkin, randomSkin, calendarHTML, DEFAULT_SKIN } from './skins.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const LABELS = {
  region: { bac: 'Miền Bắc', trung: 'Miền Trung', nam: 'Miền Nam', intl: 'Quốc tế 🌎' },
  meal: { sang: 'Sáng', trua: 'Trưa', toi: 'Tối', vat: 'Ăn vặt' },
  kind: { nuoc: 'Món nước', kho: 'Món khô', com: 'Cơm', banh: 'Bánh', lau: 'Lẩu', 'an-vat': 'Đồ vặt', che: 'Chè / ngọt', 'do-uong': 'Đồ uống', 'mon-nhau': 'Món nhậu' },
  tag: { chay: 'Chay 🌱', cay: 'Cay 🌶️', 'hai-san': 'Hải sản 🦐', nhanh: 'Nhanh gọn', re: 'Rẻ', 'dac-san': 'Đặc sản', 'mua-lanh': 'Trời lạnh', 'mua-nong': 'Trời nóng' },
  price: { 1: '$', 2: '$$', 3: '$$$' },
  cuisine: { mexican: 'Mexico', chinese: 'Trung Hoa', korean: 'Hàn Quốc', japanese: 'Nhật Bản', thai: 'Thái Lan', filipino: 'Philippines', indian: 'Ấn Độ', 'middle-eastern': 'Trung Đông', ethiopian: 'Ethiopia', latin: 'Mỹ Latin', italian: 'Ý–Mỹ', american: 'Mỹ', hawaiian: 'Hawaii', 'se-asian': 'Đông Nam Á' },
  mode: { quiz: '🧩 Đố vui', xam: '🎋 Xin xăm', cup: '🏆 Đấu cúp' },
};
const SHOWN_TAGS = ['chay', 'cay', 'hai-san', 're', 'nhanh', 'dac-san'];

const LINES = {
  idle: ['Đói chưa? Bấm cái nút to to kia đi.', 'Nghĩ chi cho mệt, để cái bát lo.', 'Hôm nay ăn sang hay ăn sinh viên đây?', 'Tui biết hơn 700 món đó nha 😎', 'Bấm phím cách cũng được, khỏi với chuột.', 'Ăn gì cũng được = câu khó nhất thế kỷ.'],
  picking: ['Đang lắc hộp… lạch cạch lạch cạch', 'Để tui ngửi thử từng món…', 'Đang hỏi ý kiến bao tử của bạn…', 'Hồi hộp chưa? Tui thì có.', 'Đang tính calo… đùa thôi, ai tính.'],
  win: ['Chốt đơn! 🎉', 'Trời ơi hợp ghê!', 'Món này mà chê là tui giận.', 'Đi ăn liền, đừng suy nghĩ!', 'Bao tử vừa vỗ tay.'],
  reroll: ['Kén ăn ghê… để tui chọn lại.', 'Lại không ưng hả? Được, chiều luôn.', 'Món đó buồn lắm đó nha.'],
  picky: ['Kén vừa thôi bạn ơi 😤', 'Lần thứ mấy rồi? Tui mỏi tay rồi á.', 'Cứ đà này chắc nhịn tới tối luôn.'],
  give: ['Thôi, ăn mì gói đi. Tui hết cách rồi 🍜'],
  idleLong: ['Còn đó không? Đói xỉu chưa?', 'Ủa đi đâu rồi, món ăn đang chờ kìa.', 'Tui đếm tới 3 mà chưa bấm là tui tự chọn đó. 1… 2…'],
};

let DISHES = [], BY_ID = {}, CREDITS = {};
let mode, busy = false, bot, rerolls = 0;
const S = store.get();

/* ---------------- boot ---------------- */
async function boot() {
  if (S.skinV !== 2) store.set({ skin: DEFAULT_SKIN, skinV: 2 }); // one-time switch to the new main skin
  buildSkins();
  const qSkin = new URLSearchParams(location.search).get('skin');
  if (qSkin && SKINS.some((s) => s.id === qSkin)) setSkin(qSkin, false);
  else setSkin(S.skinRandom ? randomSkin(S.skin) : S.skin || DEFAULT_SKIN, !S.skinRandom);
  setSound(S.sound, false);
  bot = mascot($('#mascot'));

  const get = (u, fb) => fetch(u).then((r) => (r.ok ? r.json() : fb)).catch(() => fb);
  const [d, c, memes, quiz, more] = await Promise.all([get('data/dishes.json', []), get('data/credits.json', {}), get('data/memes.json', []), get('data/rebus.json', { units: {}, dishes: [] }), get('data/more.json', {})]);
  DISHES = d; CREDITS = c;
  DISHES.forEach((x) => { BY_ID[x.id] = x; x.more = more[x.id]; });
  quizData.units = quiz.units || {}; quizData.photo = (quiz.dishes || []).filter((q) => BY_ID[q.id]); quizData.byId = BY_ID; quizData.labels = { region: LABELS.region, kind: LABELS.kind };
  media.has = new Set(Object.keys(CREDITS));
  media.memes = memes.map((m) => m.file);
  window.__memeFix = (img) => { media.has.delete(img.dataset.id); img.outerHTML = photo(BY_ID[img.dataset.id], true); };

  $('#total').textContent = DISHES.length;
  $('#bookTotal').textContent = DISHES.length;
  buildFilters();
  buildModes();
  renderHistory();
  daily();
  setMode(S.mode);
  intro();
  initExtras({ BY_ID, DISHES, say, toast, openDish, go: () => { rerolls = 0; go(); }, setMode, closeMenu });
  initGroup({ BY_ID, DISHES, pool, openDish, toast, say, closeMenu });

  const qs = new URLSearchParams(location.search);
  if (qs.has('go')) setTimeout(() => go(), 900);
  if (qs.has('daily')) setTimeout(() => $('#dailyQuizBtn').click(), 900);
  const q = qs.get('mon');
  if (q && BY_ID[q]) openDish(BY_ID[q]);
}

function intro() {
  if (reduced) return;
  gsap.from('.eyebrow, .hero-title, .aka', { y: 30, opacity: 0, rotation: () => gsap.utils.random(-4, 4), duration: .7, stagger: .1, ease: 'back.out(1.6)' });
  gsap.from('.hero-sub, .summary', { y: 16, opacity: 0, duration: .6, delay: .4 });
  gsap.from('.hero-play', { y: 30, opacity: 0, duration: .8, delay: .2, ease: 'power3.out' });
}

/* ---------------- theme / sound ---------------- */
function setSkin(id, save = true) {
  const s = applySkin(id);
  if (save) store.set({ skin: s });
  $$('#skins button').forEach((b) => b.setAttribute('aria-checked', b.dataset.skin === s));
  $('#skinName').textContent = '· ' + (SKINS.find((x) => x.id === s)?.name || '');
  $('#calSheet').innerHTML = calendarHTML();
  setTimeout(() => mode?.refresh(pool()), 350);
}
function buildSkins() {
  $('#skins').innerHTML = SKINS.map((s) => `<button role="radio" data-skin="${s.id}"><b>${s.icon}</b>${s.name}</button>`).join('');
  $$('#skins button').forEach((b) => (b.onclick = () => { sfx.click(); setSkin(b.dataset.skin); }));
  $('#skinRandom').checked = !!S.skinRandom;
  $('#skinRandom').onchange = (e) => { store.set({ skinRandom: e.target.checked }); toast(e.target.checked ? 'Lần sau vào sẽ là một giao diện bất ngờ 🎲' : 'Giữ nguyên giao diện đã chọn.'); };
}
function setSound(on, save = true) {
  sound.on = on;
  $('#soundBtn').setAttribute('aria-pressed', on);
  $('#soundBtn').textContent = on ? '🔊 Âm thanh' : '🔈 Tắt tiếng';
  if (save) { store.set({ sound: on }); sfx.pop(); }
}
$('#soundBtn').onclick = () => setSound(!sound.on);
$('#fx3d').checked = S.fx3d !== false;
$('#fx3d').onchange = (e) => store.set({ fx3d: e.target.checked });

/* ---------------- mascot ---------------- */
let sayTimer, idleTimer;
function say(text, mood = 'smile') {
  const b = $('#bubble');
  b.textContent = text;
  bot?.mood(mood);
  if (!reduced) gsap.fromTo(b, { y: 6, opacity: 0 }, { y: 0, opacity: 1, duration: .3 });
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => bot?.mood('smile'), 2500);
  armIdle();
}
function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!busy && $('#overlay').hidden) say(pick(LINES.idleLong), 'wow'); }, 25000);
}
const baseTitle = document.title;
document.addEventListener('visibilitychange', () => { document.title = document.hidden ? 'Ê quay lại chọn món đi 😭' : baseTitle; });

/* ---------------- menu ---------------- */
function openMenu(focusSel) {
  const m = $('#menu');
  $('#scrim').hidden = false; m.hidden = false;
  $('#menuBtn').setAttribute('aria-expanded', 'true');
  if (!reduced) {
    gsap.fromTo(m, { rotationX: -40, y: -20, opacity: 0, transformPerspective: 1200 }, { rotationX: 0, y: 0, opacity: 1, duration: .45, ease: 'back.out(1.4)' });
    gsap.from('#menu .m-sec', { y: 14, opacity: 0, duration: .35, stagger: .05, delay: .12 });
  }
  (focusSel ? $(focusSel) : $('#menuClose')).focus({ preventScroll: true });
  sfx.open();
}
function closeMenu() {
  const m = $('#menu');
  if (m.hidden) return;
  $('#menuBtn').setAttribute('aria-expanded', 'false');
  const done = () => { m.hidden = true; $('#scrim').hidden = true; };
  reduced ? done() : gsap.to(m, { rotationX: -30, y: -16, opacity: 0, duration: .22, ease: 'power2.in', onComplete: done });
}
$('#menuBtn').onclick = () => ($('#menu').hidden ? openMenu() : closeMenu());
$('#menuClose').onclick = closeMenu;
$('#scrim').onclick = closeMenu;
$('#summary').onclick = () => openMenu('#menu details summary');

/* ---------------- filters ---------------- */
function chip(group, value, label) {
  const b = document.createElement('button');
  b.className = 'chip'; b.type = 'button'; b.textContent = label;
  b.setAttribute('aria-pressed', S.filters[group].includes(value));
  b.onclick = () => {
    const arr = S.filters[group], i = arr.indexOf(value);
    i < 0 ? arr.push(value) : arr.splice(i, 1);
    b.setAttribute('aria-pressed', i < 0);
    store.set({ filters: S.filters });
    sfx.click();
    onFilter();
  };
  return b;
}
function currentMeal() {
  const h = new Date().getHours();
  return h < 10 ? 'sang' : h < 14 ? 'trua' : h < 17 ? 'vat' : h < 22 ? 'toi' : 'vat';
}
function buildFilters() {
  const groups = { region: LABELS.region, meal: LABELS.meal, kind: LABELS.kind, tag: Object.fromEntries(SHOWN_TAGS.map((t) => [t, LABELS.tag[t]])), price: LABELS.price };
  for (const [g, map] of Object.entries(groups)) {
    const box = $(`.chips[data-filter="${g}"]`);
    box.innerHTML = '';
    for (const [v, l] of Object.entries(map)) box.appendChild(chip(g, g === 'price' ? +v : v, l));
  }
  $('#mealHint').textContent = `· giờ này hợp ${LABELS.meal[currentMeal()].toLowerCase()}`;
  $('#noRepeat').checked = S.noRepeat;
  $('#noRepeat').onchange = (e) => { store.set({ noRepeat: e.target.checked }); onFilter(); };
  $('#resetFilters').onclick = () => {
    Object.keys(S.filters).forEach((k) => (S.filters[k] = []));
    store.set({ filters: S.filters });
    $$('#menu .chip[aria-pressed="true"]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    onFilter();
  };
  onFilter(true);
}
function matches(d, f = S.filters) {
  if (f.region.length && !f.region.includes(d.region)) return false;
  if (f.meal.length && !d.meals.some((m) => f.meal.includes(m))) return false;
  if (f.kind.length && !f.kind.includes(d.kind)) return false;
  if (f.tag.length && !f.tag.every((t) => d.tags.includes(t))) return false;
  if (f.price.length && !f.price.includes(d.price)) return false;
  return true;
}
function pool({ strict = true } = {}) {
  const ban = new Set(S.ban);
  let p = DISHES.filter((d) => !ban.has(d.id) && matches(d));
  if (strict && S.noRepeat) {
    const recent = store.recentIds(7);
    const fresh = p.filter((d) => !recent.has(d.id));
    if (fresh.length) p = fresh;
  }
  return p;
}
let filterT;
function onFilter(first) {
  const n = pool().length;
  $('#poolTxt').textContent = `· còn ${n} món`;
  renderSummary(n);
  clearTimeout(filterT);
  if (!first) filterT = setTimeout(() => { if (!busy) showPool(); }, 250);
}
function renderSummary(n = pool().length) {
  const f = S.filters, bits = [];
  f.region.forEach((v) => bits.push(LABELS.region[v]));
  f.meal.forEach((v) => bits.push(LABELS.meal[v]));
  f.kind.forEach((v) => bits.push(LABELS.kind[v]));
  f.tag.forEach((v) => bits.push(LABELS.tag[v]));
  f.price.forEach((v) => bits.push(LABELS.price[v]));
  bits.push(`${n} món trong bát`);
  $('#summary').innerHTML = bits.map((b) => `<span>${esc(b)}</span>`).join('') + '<span class="more">bộ lọc ✎</span>';
}
function showPool() {
  const p = pool();
  if (!p.length) {
    $('#stageInner').innerHTML = `<div class="empty-pot">Bát trống trơn 🥣<br>Lọc kỹ quá hết món rồi. Bỏ bớt đi bạn ơi!</div>`;
    mode = null; say('Bạn lọc gắt hơn mẹ tui lựa rau 😅', 'sad');
    return;
  }
  if (!mode) return setMode(S.mode);
  mode.refresh(p);
}

/* ---------------- modes & picking ---------------- */
function buildModes() {
  $$('#modeTabs button').forEach((b) => (b.onclick = () => { if (busy) return; sfx.pop(); setMode(b.dataset.mode); }));
}
function setMode(m) {
  if (busy) return;
  if (!MODES[m]) m = 'quiz';
  store.set({ mode: m });
  $$('#modeTabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.mode === m));
  const host = $('#stageInner');
  host.innerHTML = '';
  renderSummary();
  const p = pool();
  if (!p.length) return showPool();
  mode = MODES[m](host, { say });
  mode.refresh(p);
  $('#pickLabel').textContent = { cup: 'bắt đầu đấu', quiz: 'ra đề!', xam: 'xin quẻ' }[m] || 'chọn dùm';
  say(m === 'cup' ? 'Món nào thèm hơn thì cho thắng nha 🏆' : m === 'quiz' ? 'Nhìn ảnh đoán chữ, hoặc đọc sử đoán món nha 🧩' : pick(LINES.idle));
}
function weightedPick(p) {
  const fav = new Set(S.fav);
  const w = p.map((d) => (fav.has(d.id) ? 3 : 1) * contextWeight(d));
  let r = Math.random() * w.reduce((s, x) => s + x, 0);
  for (let i = 0; i < p.length; i++) { r -= w[i]; if (r <= 0) return p[i]; }
  return p[p.length - 1];
}
async function go(forced) {
  if (busy) return;
  const p = pool();
  if (!p.length) return showPool();
  if (!mode) setMode(S.mode);
  busy = true;
  const btn = $('#pickBtn'); btn.disabled = true; btn.classList.add('down');
  if (S.mode !== 'cup') say(pick(LINES.picking), 'wow');
  tearSheet();
  try {
    const chosen = await mode.run(forced || weightedPick(p), p);
    if (S.fx3d !== false && !reduced) await bowlDrop(chosen).catch(() => {});
    sfx.win();
    say(pick(LINES.win), 'happy');
    const r = $('#stage').getBoundingClientRect();
    confetti(r.left + r.width / 2, r.top + r.height / 2);
    openDish(chosen, true);
  } finally {
    busy = false; btn.disabled = false; btn.classList.remove('down');
    if (S.mode === 'cup') setTimeout(() => mode?.refresh(pool()), 400);
  }
}
$('#pickBtn').onclick = () => { rerolls = 0; askMotion(); go(); };

/* shake the phone to pick */
let motionAsked = false, lastShake = 0;
function onMotion(e) {
  const a = e.accelerationIncludingGravity || e.acceleration;
  if (!a) return;
  const g = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
  if (g > 28 && Date.now() - lastShake > 2000 && !busy && $('#overlay').hidden && $('#menu').hidden && $('#book').hidden) {
    lastShake = Date.now(); rerolls = 0; say('Ối chóng mặt! Để tui chọn liền 😵‍💫', 'wow'); go();
  }
}
function askMotion() {
  if (motionAsked || !('DeviceMotionEvent' in window)) return;
  motionAsked = true;
  const RP = DeviceMotionEvent.requestPermission;
  if (typeof RP === 'function') RP().then((s) => s === 'granted' && addEventListener('devicemotion', onMotion)).catch(() => {});
}
if ('DeviceMotionEvent' in window && typeof DeviceMotionEvent.requestPermission !== 'function') addEventListener('devicemotion', onMotion);
if (matchMedia('(pointer: coarse)').matches) setTimeout(() => toast('Mẹo: lắc điện thoại cũng bốc được món nha 📱'), 2500);
addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || /input|textarea|button|summary/i.test(e.target.tagName) || !$('#overlay').hidden || !$('#menu').hidden || !$('#book').hidden) return;
  e.preventDefault(); rerolls = 0; go();
});

function tearSheet() {
  const sheet = $('#calSheet');
  if (reduced || document.documentElement.dataset.skin !== 'lich' || !sheet.offsetParent) return;
  const r = sheet.getBoundingClientRect();
  const c = sheet.cloneNode(true);
  c.removeAttribute('id');
  Object.assign(c.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', margin: 0, zIndex: 40, pointerEvents: 'none' });
  document.body.appendChild(c);
  sfx.flip();
  gsap.timeline({ onComplete: () => c.remove() })
    .to(c, { rotation: -6, transformOrigin: '10% 0%', duration: .15 })
    .to(c, { rotation: 28, y: innerHeight * .9, x: 80, opacity: 0, duration: 1.1, ease: 'power2.in' });
}

/* ---------------- dish card ---------------- */
function regionLabel(d) {
  return d.region === 'intl' ? `Món ${LABELS.cuisine[d.cuisine] || d.cuisine}` : `${LABELS.region[d.region]} · ${d.cuisine}`;
}
let current, lastFocus;
function openDish(d, fromPick = false) {
  current = d; lastFocus = document.activeElement;
  $('#mPhoto').innerHTML = `<div class="ph">${photo(d)}</div>`;
  $('#mKicker').textContent = fromPick ? `Hôm nay ăn… · ${regionLabel(d)}` : regionLabel(d);
  const nm = $('#mName');
  nm.innerHTML = d.name.split(' ').map((w) => `<span class="w">${[...w].map((c) => `<span class="ch">${esc(c)}</span>`).join('')}</span>`).join(' ');
  $('#mEn').textContent = d.nameEn && d.nameEn !== d.name ? d.nameEn : '';
  $('#mJoke').textContent = d.joke || '';
  $('#mJoke').hidden = !d.joke;
  $('#mDesc').textContent = d.desc;
  $('#mHistory').hidden = !d.history;
  $('#mHistory p').textContent = d.history || '';
  $('#mTags').innerHTML = [LABELS.kind[d.kind], ...d.tags.map((t) => LABELS.tag[t]), LABELS.price[d.price], ...d.meals.map((m) => LABELS.meal[m])]
    .filter(Boolean).map((t) => `<span class="tag">${esc(t)}</span>`).join('');
  renderActions(fromPick);
  cardMore(d);
  const c = CREDITS[d.id];
  $('#mCredit').innerHTML = c
    ? `Ảnh: ${esc(c.artist)} · ${esc(c.license)} · <a href="${esc(c.page)}" target="_blank" rel="noopener">nguồn</a>`
    : 'Chưa tìm được ảnh thật cho món này nên tạm để meme. Có ảnh đẹp thì gửi tui nha.';
  $('#overlay').hidden = false;
  if (!reduced) {
    gsap.fromTo('.card', { rotationX: -75, y: 60, opacity: 0 }, { rotationX: 0, y: 0, opacity: 1, duration: .7, ease: 'back.out(1.3)' });
    gsap.fromTo('#mPhoto .ph', { scale: 1.25, opacity: 0 }, { scale: 1, opacity: 1, duration: .6, delay: .25, ease: 'power3.out' });
    gsap.fromTo(nm.querySelectorAll('.ch'), { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: .35, stagger: .025, ease: 'back.out(3)', delay: .3 });
    gsap.from('.card-body > *:not(.card-name)', { y: 10, opacity: 0, duration: .35, stagger: .04, delay: .4 });
  }
  $('#closeModal').focus({ preventScroll: true });
}
function renderActions(fromPick) {
  const d = current, box = $('#mActions');
  const isFav = S.fav.includes(d.id), isBan = S.ban.includes(d.id);
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.name + ' near me')}`;
  box.innerHTML = `
    ${fromPick ? '<button class="pill" data-a="eat">✓ CHỐT, ĂN MÓN NÀY</button><button class="pill ghost" data-a="again">↻ Hông, món khác</button>' : '<button class="pill" data-a="eat">✓ HÔM NAY ĂN MÓN NÀY</button>'}
    <a class="pill ghost" href="${maps}" target="_blank" rel="noopener">📍 Quán gần đây</a>
    <button class="pill ghost ${isFav ? 'on' : ''}" data-a="fav">${isFav ? '♥ Đang mê' : '♡ Mê món này'}</button>
    <button class="pill ghost ${isBan ? 'on' : ''}" data-a="ban">${isBan ? '🚫 Đã cấm cửa' : '🚫 Cấm cửa'}</button>
    <button class="pill ghost" data-a="share">↗ Rủ bạn</button>
    <button class="pill ghost" data-a="card">📸 Ảnh khoe</button>`;
  box.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => action(b.dataset.a, fromPick)));
}
async function action(a, fromPick) {
  const d = current;
  if (a === 'eat') {
    store.eat(d.id); stamp(d); renderHistory(); onFilter(); rerolls = 0;
    toast(`Đã ghi sổ: hôm nay ăn ${d.name}. Ăn ngon nha! 📝`);
    closeModal();
  } else if (a === 'again') {
    rerolls++;
    closeModal();
    if (rerolls >= 6) {
      const mi = DISHES.find((x) => /mì gói|mì tôm/i.test(x.name));
      say(LINES.give[0], 'sad');
      return setTimeout(() => go(mi && matches(mi) ? mi : undefined), 600);
    }
    say(pick(rerolls >= 3 ? LINES.picky : LINES.reroll), 'sad');
    setTimeout(() => go(), 450);
  } else if (a === 'fav' || a === 'ban') {
    const on = store.toggleIn(a, d.id);
    toast(a === 'fav' ? (on ? 'Đã thêm vào món mê, sẽ hay được chọn hơn ♥' : 'Hết mê rồi. Tình cảm mong manh ghê.') : (on ? 'Món này bị cấm cửa vĩnh viễn 🚫' : 'Đã ân xá món này.'));
    renderActions(fromPick); onFilter(); markBook();
  } else if (a === 'card') {
    shareCard(d);
  } else if (a === 'share') {
    const url = `${location.origin}${location.pathname}?mon=${d.id}`;
    const text = `Hôm nay ăn ${d.name} ${d.emoji || ''} nha! (cái bát chọn đó, đừng cãi)`;
    try {
      if (navigator.share) await navigator.share({ title: d.name, text, url });
      else { await navigator.clipboard.writeText(`${text} ${url}`); toast('Đã copy link, dán vô nhóm chat đi!'); }
    } catch {}
  }
}
function closeModal() {
  $('#overlay').hidden = true;
  lastFocus?.focus?.({ preventScroll: true });
}
$('#closeModal').onclick = closeModal;
$('#overlay').onclick = (e) => { if (e.target.id === 'overlay') closeModal(); };
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#overlay').hidden) closeModal();
  else if (!$('#book').hidden) closeBook();
  else if (!$('#passport').hidden) closePassport();
  else if (!$('#lb').hidden) $('#lb').hidden = true;
  else if (!$('#group').hidden) closeGroup();
  else closeMenu();
});

let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------------- history & daily ---------------- */
function renderHistory() {
  const ol = $('#history');
  const ago = (ts) => { const n = Math.floor((Date.now() - ts) / 864e5); return n === 0 ? 'hôm nay' : n === 1 ? 'hôm qua' : `${n} ngày trước`; };
  ol.innerHTML = S.history.slice(0, 7).filter((h) => BY_ID[h.id])
    .map((h) => `<li data-id="${h.id}">${esc(BY_ID[h.id].name)} <span>· ${ago(h.ts)}</span></li>`).join('');
  ol.querySelectorAll('li').forEach((li) => (li.onclick = () => { closeMenu(); openDish(BY_ID[li.dataset.id]); }));
}
function daily() {
  const key = new Date().toISOString().slice(0, 10);
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const vn = DISHES.filter((d) => d.region !== 'intl' && media.has.has(d.id));
  const list = vn.length ? vn : DISHES;
  const d = list[Math.abs(h) % list.length];
  $('#dailyName').textContent = `${d.emoji || ''} ${d.name}`;
  $('#dailyBtn').onclick = () => { sfx.pop(); closeMenu(); openDish(d); };
}

/* ---------------- notebook ---------------- */
let bookFilter = 'all', bookQuery = '', bookLimit = 48, bookBuilt = false;
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
function openBook() {
  closeMenu();
  if (!bookBuilt) buildBook();
  $('#book').hidden = false;
  if (!reduced) gsap.fromTo('.book', { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: 'power3.out' });
  $('#search').focus({ preventScroll: true });
}
function closeBook() { $('#book').hidden = true; }
$('#bookBtn').onclick = openBook;
function dailyTile() {
  const done = (S.daily || {})[dayKey()];
  $('#dailyQuizTxt').textContent = done ? `${done.grid} ${done.score}đ · 🔥${dailyStreak(S)}` : `📅 5 câu chung cả nước${dailyStreak(S) ? ' · 🔥' + dailyStreak(S) : ''}`;
}
$('#dailyQuizBtn').onclick = () => {
  if (busy) return;
  closeMenu();
  if ((S.daily || {})[dayKey()]) return toast('Hôm nay bạn giải rồi! Mai quay lại giữ chuỗi 🔥 nha.');
  setMode('quiz'); quizDaily.on = true; rerolls = 0; go();
};
addEventListener('quizdone', dailyTile);
dailyTile();
$('#bookClose').onclick = closeBook;
$('#book').onclick = (e) => { if (e.target.id === 'book') closeBook(); };
function buildBook() {
  bookBuilt = true;
  const tabs = $('#bookTabs');
  const opts = { all: 'Tất cả', ...LABELS.region, fav: '♥ Món mê' };
  for (const [v, l] of Object.entries(opts)) {
    const b = document.createElement('button');
    b.className = 'chip'; b.textContent = l; b.setAttribute('aria-pressed', v === bookFilter);
    b.onclick = () => {
      bookFilter = v; bookLimit = 48;
      $$('.chip', tabs).forEach((x) => x.setAttribute('aria-pressed', x === b));
      renderBook();
    };
    tabs.appendChild(b);
  }
  let t;
  $('#search').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { bookQuery = norm(e.target.value.trim()); bookLimit = 48; renderBook(); }, 150); };
  $('#moreBtn').onclick = () => { bookLimit += 48; renderBook(true); };
  renderBook();
}
function bookList() {
  return DISHES.filter((d) => {
    if (bookFilter === 'fav') { if (!S.fav.includes(d.id)) return false; }
    else if (bookFilter !== 'all' && d.region !== bookFilter) return false;
    return !bookQuery || norm(`${d.name} ${d.nameEn} ${d.cuisine}`).includes(bookQuery);
  });
}
function renderBook(append) {
  const list = bookList(), grid = $('#grid');
  $('#bookCount').textContent = `${list.length} món`;
  const start = append ? grid.children.length : 0;
  if (!append) grid.innerHTML = '';
  const frag = document.createDocumentFragment();
  list.slice(start, bookLimit).forEach((d) => {
    const el = document.createElement('button');
    el.className = 'polaroid'; el.dataset.id = d.id;
    el.innerHTML = polaroidHTML(d) + badge(d);
    el.onclick = () => openDish(d);
    frag.appendChild(el);
  });
  grid.appendChild(frag);
  if (!list.length) grid.innerHTML = '<p>Không thấy món nào. Gõ sai chính tả hay món này chưa ai nghĩ ra? 🔍</p>';
  $('#moreBtn').hidden = list.length <= bookLimit;
}
const badge = (d) => (S.fav.includes(d.id) ? '<span class="badge">♥</span>' : S.ban.includes(d.id) ? '<span class="badge">🚫</span>' : '');
function markBook() {
  $$('#grid .polaroid').forEach((el) => {
    el.querySelector('.badge')?.remove();
    el.insertAdjacentHTML('beforeend', badge(BY_ID[el.dataset.id]));
  });
}

let rT;
addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { if (!busy && mode) mode.refresh(pool()); }, 300); });

boot();
