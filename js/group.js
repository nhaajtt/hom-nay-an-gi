// Group play (rooms over WebSocket): voting cup, swipe-to-match, one veto each, TV screen.
// Also the weekly leaderboard for the daily quiz and the 11am lunch reminder (Web Push).
import { store } from './store.js';
import { sfx, reduced, pick, confetti } from './sketch.js';
import { esc, photo, polaroidHTML } from './modes.js';
import { dayKey } from './extras.js';

const S = store.get();
let A; // app api: { BY_ID, DISHES, pool, openDish, toast, say, closeMenu }
const $ = (s, r = document) => r.querySelector(s);
const EMO = ['😋', '🤤', '😎', '🐷', '🐼', '🦊', '🐸', '🐙', '🦄', '👻', '🤖', '🍜'];
const api = (p, o) => fetch(p, o).then((r) => r.json());

/* ================= rooms ================= */
let ws = null, room = null, me = null, state = null, tv = false, swipeIdx = 0, retry = 0;
const ov = () => $('#group');
const body = () => $('#groupBody');
const tokenKey = (c) => 'room:' + c;

export function openGroup(code) {
  A.closeMenu?.();
  ov().hidden = false;
  sfx.open();
  if (code) return join(code);
  if (room && ws) return render();
  const name = S.nick || '';
  body().innerHTML = `
    <div class="g-start">
      <p class="g-lead">Cả nhóm không chốt được món? Tạo phòng, gửi link, mọi người cùng vote trên điện thoại của mình.</p>
      <label class="g-field">Tên bạn <input id="gName" maxlength="16" value="${esc(name)}" placeholder="vd: Tèo đói bụng"></label>
      <div class="g-emo" role="radiogroup" aria-label="Biểu tượng">${EMO.map((e) => `<button role="radio" aria-checked="${e === (S.nickEmo || EMO[0])}" data-e="${e}">${e}</button>`).join('')}</div>
      <div class="g-row"><button class="pill" id="gCreate">➕ Tạo phòng mới</button></div>
      <div class="g-row"><input id="gCode" maxlength="4" placeholder="MÃ" autocapitalize="characters" aria-label="Mã phòng"><button class="pill ghost" id="gJoin">Vào phòng</button></div>
    </div>`;
  body().querySelectorAll('.g-emo button').forEach((b) => (b.onclick = () => { store.set({ nickEmo: b.dataset.e }); body().querySelectorAll('.g-emo button').forEach((x) => x.setAttribute('aria-checked', x === b)); }));
  const saveName = () => store.set({ nick: $('#gName').value.trim().slice(0, 16) || 'Thực khách' });
  $('#gCreate').onclick = async () => {
    saveName();
    try { const { code } = await api('/api/room', { method: 'POST' }); join(code); } catch { A.toast('Không tạo được phòng, mạng có vấn đề rồi.'); }
  };
  $('#gJoin').onclick = () => { saveName(); const c = $('#gCode').value.trim().toUpperCase(); if (/^[A-Z]{4}$/.test(c)) join(c); else A.toast('Mã phòng gồm 4 chữ cái nha.'); };
}
export function closeGroup() { ov().hidden = true; }

function join(code, asTv = false) {
  room = code; tv = asTv; swipeIdx = 0;
  ws?.close();
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}/api/room/${code}/ws`);
  body().innerHTML = '<p class="g-lead">Đang vào phòng…</p>';
  ws.onopen = () => {
    retry = 0;
    ws.send(JSON.stringify(tv ? { t: 'hello', tv: true } : { t: 'hello', token: sessionStorage.getItem(tokenKey(code)), name: S.nick || 'Thực khách', emoji: S.nickEmo || EMO[0] }));
  };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'you') { me = m.pid; sessionStorage.setItem(tokenKey(code), m.token); }
    if (m.t === 'error') A.toast(m.msg);
    if (m.t === 'state') {
      const prev = state?.phase;
      state = m.state;
      if (m.match || (state.phase === 'done' && prev && prev !== 'done')) celebrate();
      render();
    }
  };
  ws.onclose = () => { if (room === code && retry < 5 && !ov().hidden) setTimeout(() => join(code, tv), 800 * ++retry); };
  history.replaceState(null, '', `?${tv ? 'tv' : 'room'}=${code}`);
}
const send = (m) => ws?.readyState === 1 && ws.send(JSON.stringify(m));
const D = (id) => A.BY_ID[id];
const isHost = () => state && state.host === me;
const joinUrl = () => `${location.origin}${location.pathname}?room=${room}`;

function celebrate() {
  sfx.win();
  if (!reduced) confetti(innerWidth / 2, innerHeight / 2, 80);
}
function playersHTML() {
  return `<ul class="g-players">${state.players.map((p) => `<li class="${p.online ? '' : 'off'}">${esc(p.emoji)} ${esc(p.name)}${p.pid === state.host ? ' 👑' : ''}${p.pid === me ? ' <small>(bạn)</small>' : ''}${state.phase === 'cup' && p.voted ? ' ✅' : ''}${state.phase === 'veto' && p.veto ? ' 🚫' : ''}</li>`).join('')}</ul>`;
}
function headHTML() {
  const qr = tv && window.qrcode ? (() => { const q = window.qrcode(0, 'M'); q.addData(joinUrl()); q.make(); return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }); })() : '';
  return `<div class="g-head ${tv ? 'tv' : ''}"><div><small>Mã phòng</small><b class="g-code">${room}</b></div>
    ${qr ? `<div class="g-qr" aria-label="Mã QR vào phòng">${qr}</div>` : `<button class="link" id="gShare">↗ gửi link mời</button>${isHost() ? '<button class="link" id="gTv">📺 mở màn hình TV</button>' : ''}`}</div>`;
}

function render() {
  if (!state) return;
  const ph = state.phase, B = body();
  let main = '';
  if (ph === 'lobby') {
    main = isHost()
      ? `<p class="g-lead">Chờ mọi người vào phòng rồi chọn kiểu chơi:</p>
        <div class="g-games">
          <button class="g-game" data-g="cup"><b>🏆 Đấu cúp vote</b><small>Mỗi trận cả nhóm cùng vote, số đông thắng</small></button>
          <button class="g-game" data-g="swipe"><b>💘 Quẹt match</b><small>Ai cũng quẹt trên máy mình, món nào cả nhóm cùng thích là MATCH</small></button>
        </div>
        <label class="g-field">Số món <select id="gN"><option>8</option><option selected>16</option><option>24</option></select></label>`
      : '<p class="g-lead">Chờ chủ phòng 👑 chọn kiểu chơi…</p>';
  } else if (ph === 'veto') {
    const mine = state.vetoes[me];
    main = `<p class="g-lead">Mỗi người được <b>cấm 1 món</b>. Không cấm thì thôi. ${isHost() ? 'Xong thì bấm bắt đầu.' : ''}</p>
      <div class="g-cands">${state.cands.map((id) => { const d = D(id); const by = state.players.filter((p) => state.vetoes[p.pid] === id).map((p) => p.emoji).join(''); return d ? `<button class="g-cand ${by ? 'banned' : ''} ${mine === id ? 'mine' : ''}" data-id="${id}"><span class="ava">${photo(d, 'ball')}</span>${esc(d.name)}${by ? `<i>🚫${by}</i>` : ''}</button>` : ''; }).join('')}</div>
      ${isHost() ? '<button class="pill" id="gStart">▶ Bắt đầu</button>' : ''}`;
  } else if (ph === 'cup') {
    const a = D(state.round[state.idx]), b = D(state.round[state.idx + 1]);
    const n = state.round.length, names = { 32: 'Vòng 1/16', 16: 'Vòng 1/8', 8: 'Tứ kết', 4: 'Bán kết', 2: 'Chung kết' };
    const voted = me in state.votes;
    const cnt = Object.keys(state.votes).length, on = state.players.filter((p) => p.online).length;
    main = `<p class="g-round">${names[n] || 'Vòng loại'} · trận ${state.idx / 2 + 1}/${n / 2} · đã vote ${cnt}/${on}</p>
      <div class="cup-pair g-pair">
        <button class="polaroid ${voted && state.votes[me] === 0 ? 'won' : ''}" data-k="0" ${tv ? 'disabled' : ''}>${a ? polaroidHTML(a) : ''}</button>
        <span class="vs">vs</span>
        <button class="polaroid ${voted && state.votes[me] === 1 ? 'won' : ''}" data-k="1" ${tv ? 'disabled' : ''}>${b ? polaroidHTML(b) : ''}</button>
      </div>
      ${isHost() ? '<button class="link" id="gSettle">⏩ chốt trận (có người ngủ quên)</button>' : ''}`;
  } else if (ph === 'swipe') {
    const deck = state.round, d = D(deck[swipeIdx]);
    main = tv
      ? `<p class="g-lead">Mọi người đang quẹt trên điện thoại… món nào ai cũng thích là MATCH 💘</p>`
      : d
        ? `<div class="g-swipe"><div class="g-card" id="gCard">${polaroidHTML(d)}<p>${esc(d.joke || d.desc || '')}</p></div>
            <div class="g-row"><button class="pill ghost" data-like="0">✕ Thôi</button><button class="pill" data-like="1">💚 Thèm</button></div>
            <small class="g-left">${swipeIdx + 1}/${deck.length} · quẹt trái phải cũng được</small></div>`
        : `<p class="g-lead">Bạn quẹt hết rồi! Chờ mọi người… ${isHost() ? '<button class="link" id="gEnd">⏹ chốt món được thích nhiều nhất</button>' : ''}</p>`;
  } else if (ph === 'done') {
    const d = D(state.result);
    main = `<div class="g-done"><p class="g-round">${state.game === 'swipe' ? '💘 MATCH!' : '🏆 VÔ ĐỊCH'}</p>
      ${d ? `<div class="cup-champ polaroid">${polaroidHTML(d)}</div>` : ''}
      <p class="g-lead">Cả nhóm đi ăn <b>${esc(d?.name || '')}</b> nha! Cấm đổi ý.</p>
      <div class="g-row">${d && !tv ? '<button class="pill" id="gSee">Xem món</button>' : ''}${isHost() ? '<button class="pill ghost" id="gAgain">🔁 Chơi lại</button>' : ''}</div></div>`;
  }
  B.innerHTML = headHTML() + `<div class="g-main ${tv ? 'tv' : ''}">${main}</div>` + playersHTML();

  $('#gShare')?.addEventListener('click', async () => {
    const text = `Vào phòng ${room} chọn món ăn với tui nè! 🍜`;
    try { if (navigator.share) await navigator.share({ text, url: joinUrl() }); else { await navigator.clipboard.writeText(`${text} ${joinUrl()}`); A.toast('Đã copy link mời!'); } } catch {}
  });
  $('#gTv')?.addEventListener('click', () => open(`${location.pathname}?tv=${room}`, '_blank', 'noopener'));
  B.querySelectorAll('.g-game').forEach((b) => (b.onclick = () => {
    const n = +$('#gN').value, p = A.pool();
    const ids = sample(p.length >= n ? p : A.DISHES, n).map((d) => d.id);
    send({ t: 'prepare', game: b.dataset.g, ids }); sfx.pop();
  }));
  B.querySelectorAll('.g-cand').forEach((b) => (b.onclick = () => { if (!tv) { send({ t: 'veto', id: b.dataset.id }); sfx.tick(); } }));
  $('#gStart')?.addEventListener('click', () => { send({ t: 'start' }); sfx.pop(); });
  B.querySelectorAll('.g-pair .polaroid').forEach((b) => (b.onclick = () => { send({ t: 'vote', k: +b.dataset.k }); sfx.pop(); }));
  $('#gSettle')?.addEventListener('click', () => send({ t: 'settle' }));
  $('#gEnd')?.addEventListener('click', () => send({ t: 'endswipe' }));
  $('#gAgain')?.addEventListener('click', () => send({ t: 'reset' }));
  $('#gSee')?.addEventListener('click', () => { closeGroup(); A.openDish(D(state.result)); });
  B.querySelectorAll('[data-like]').forEach((b) => (b.onclick = () => like(+b.dataset.like)));
  const card = $('#gCard');
  if (card) dragSwipe(card);
}
function like(v) {
  const id = state.round[swipeIdx];
  send({ t: 'like', id, v: !!v });
  v ? sfx.pop() : sfx.tick();
  const card = $('#gCard');
  swipeIdx++;
  if (card && !reduced) gsap.to(card, { x: v ? 400 : -400, rotation: v ? 25 : -25, opacity: 0, duration: 0.3, onComplete: render });
  else render();
}
function dragSwipe(card) {
  let x0 = null;
  card.onpointerdown = (e) => { x0 = e.clientX; card.setPointerCapture(e.pointerId); };
  card.onpointermove = (e) => { if (x0 == null) return; const dx = e.clientX - x0; card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; card.dataset.hint = dx > 40 ? 'yes' : dx < -40 ? 'no' : ''; };
  card.onpointerup = (e) => { const dx = e.clientX - (x0 ?? e.clientX); x0 = null; if (Math.abs(dx) > 90) like(dx > 0 ? 1 : 0); else { card.style.transform = ''; card.dataset.hint = ''; } };
}
function sample(arr, n) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

/* ================= weekly leaderboard ================= */
const TITLES = ['Thánh Bún 👑', 'Phó Thánh Phở 🥈', 'Thần Bánh Mì 🥉'];
const FUNNY = ['Kẻ phản bội phở', 'Chiến thần cơm tấm', 'Hiệp sĩ trà đá', 'Lãng tử bún đậu', 'Nữ hoàng chè', 'Bá chủ hủ tiếu', 'Đại sứ mắm tôm', 'Thực tập sinh nước chấm', 'Người giữ nồi lẩu', 'Thám tử ốc'];
const hashN = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const uid = () => S.uid || (store.set({ uid: [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, '0')).join('') }), S.uid);

async function submitDaily(e) {
  if (!e.detail.daily) return;
  if (!S.nick) return A.toast('Đặt tên trong 🏆 Bảng xếp hạng để điểm hôm nay được tính nha!');
  try {
    const r = await api('/api/lb', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid: uid(), name: S.nick, day: dayKey(), score: e.detail.score }) });
    if (r.ok) A.toast(`🏆 Tuần này bạn hạng ${r.rank}/${r.players} với ${r.score} điểm!`);
  } catch {}
}
export async function openBoard() {
  A.closeMenu?.();
  const o = $('#lb');
  o.hidden = false; sfx.open();
  const box = $('#lbBody');
  box.innerHTML = '<p class="g-lead">Đang tải bảng xếp hạng…</p>';
  let data = { top: [], players: 0, week: '' };
  try { data = await api('/api/lb'); } catch { box.innerHTML = '<p class="g-lead">Không tải được bảng xếp hạng.</p>'; return; }
  box.innerHTML = `<p class="g-lead">Tuần từ ${esc(data.week)} · ${data.players} người chơi · cộng điểm “📅 Đố hôm nay” mỗi ngày.</p>
    <ol class="lb-list">${data.top.map((r, i) => `<li><b>${esc(r.name)}</b> <span class="lb-title">${i < 3 ? TITLES[i] : FUNNY[hashN(r.name) % FUNNY.length]}</span><span class="lb-score">${r.score}đ · ${r.days} ngày</span></li>`).join('') || '<li>Chưa ai chơi tuần này. Giành hạng 1 liền đi!</li>'}</ol>
    <label class="g-field">Tên trên bảng <input id="lbName" maxlength="16" value="${esc(S.nick || '')}" placeholder="vd: Tèo đói bụng"></label>
    <button class="pill ghost" id="lbSave">Lưu tên</button>`;
  $('#lbSave').onclick = () => { const n = $('#lbName').value.trim().slice(0, 16); if (n) { store.set({ nick: n }); A.toast(`Đã lưu tên: ${n}`); } };
}

/* ================= 11am lunch reminder ================= */
async function togglePush(on) {
  const box = $('#pushOn');
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Trình duyệt này chưa hỗ trợ thông báo. Trên iPhone: thêm web vào màn hình chính trước.');
    const reg = await navigator.serviceWorker.ready;
    if (!on) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await api('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }); await sub.unsubscribe(); }
      store.set({ push: false });
      return A.toast('Đã tắt nhắc ăn trưa. Nhớ tự đói đúng giờ nha.');
    }
    if ((await Notification.requestPermission()) !== 'granted') throw new Error('Bạn chưa cho phép thông báo.');
    const { key } = await api('/api/push');
    if (!key) throw new Error('Máy chủ chưa bật thông báo.');
    const appKey = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((key.length + 3) % 4)), (c) => c.charCodeAt(0));
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey }));
    await api('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint, tz: new Date().getTimezoneOffset(), hour: 11 }) });
    store.set({ push: true });
    A.toast('🔔 11 giờ trưa mỗi ngày tui sẽ hỏi “đói chưa?”');
  } catch (e) {
    box.checked = false; store.set({ push: false });
    A.toast(e.message || 'Không bật được thông báo.');
  }
}

export function initGroup(app) {
  A = app;
  $('#groupBtn').onclick = () => openGroup();
  $('#groupClose').onclick = closeGroup;
  $('#lbBtn').onclick = openBoard;
  $('#lbClose').onclick = () => ($('#lb').hidden = true);
  $('#pushOn').checked = !!S.push;
  $('#pushOn').onchange = (e) => togglePush(e.target.checked);
  addEventListener('quizdone', submitDaily);
  const q = new URLSearchParams(location.search);
  const rc = (q.get('room') || '').toUpperCase(), tc = (q.get('tv') || '').toUpperCase();
  if (/^[A-Z]{4}$/.test(tc)) { document.documentElement.dataset.tv = '1'; ov().hidden = false; join(tc, true); }
  else if (/^[A-Z]{4}$/.test(rc)) {
    if (S.nick) openGroup(rc);
    else { openGroup(); setTimeout(() => { $('#gCode').value = rc; A.toast('Nhập tên rồi bấm “Vào phòng” nha!'); }, 50); }
  }
}
export const groupOpen = () => !ov().hidden;
