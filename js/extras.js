// Extras: context-aware picking (weather, lunar days, night owl, mood, seasons), voice & pronunciation,
// share card, food passport, pet bowl, nearby places and the dish-card "more" tabs.
import { store } from './store.js';
import { lunar } from './skins.js';
import { sfx, reduced, pick, rand } from './sketch.js';
import { esc, photo, media } from './modes.js';

const S = store.get();
let A = null; // app api, set by initExtras
const $ = (s, r = document) => r.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (t = new Date()) => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;

/* ================= context ================= */
const now = new Date();
const L = lunar(now.getDate(), now.getMonth() + 1, now.getFullYear());
const isHot = (d) => d.kind === 'lau' || d.kind === 'nuoc' || d.tags.includes('mua-lanh') || /cháo|súp|soup|nướng/i.test(d.name);
const isCold = (d) => d.kind === 'che' || d.kind === 'do-uong' || d.tags.includes('mua-nong') || /kem|gỏi|nộm|bún|đá/i.test(d.name);

export const MOODS = {
  buon: { e: '😢', name: 'Buồn', line: 'Buồn thì ăn đồ ngọt. Khoa học chưa chứng minh nhưng bao tử thì tin.', w: (d) => (d.kind === 'che' || /kem|chè|flan|cháo|mì/i.test(d.name) ? 3 : 1) },
  chiatay: { e: '💔', name: 'Mới chia tay', line: 'Ăn cay cho nước mắt có lý do chính đáng 🌶️', w: (d) => (d.tags.includes('cay') ? 3.5 : d.kind === 'mon-nhau' ? 2 : 1) },
  luong: { e: '💰', name: 'Vừa lãnh lương', line: 'Lương về! Ăn sang một bữa rồi cuối tháng tính.', w: (d) => (d.price === 3 ? 3 : d.price === 2 ? 1.5 : 0.6) },
  ngheo: { e: '🪙', name: 'Cuối tháng', line: 'Cuối tháng, ví mỏng như bánh tráng. Tui chọn món rẻ nha.', w: (d) => (d.price === 1 ? 3 : 0.4) },
  lanh: { e: '🥶', name: 'Lạnh run', line: 'Lạnh vậy phải húp gì nóng nóng mới sống nổi.', w: (d) => (isHot(d) ? 3 : 1) },
  luoi: { e: '😴', name: 'Lười', line: 'Lười thì chọn món nhanh, khỏi chờ khỏi nghĩ.', w: (d) => (d.tags.includes('nhanh') ? 3 : 1) },
  om: { e: '🤒', name: 'Hơi ốm', line: 'Ốm thì ăn cháo, đừng cố ăn lẩu cay nha bạn hiền.', w: (d) => (/cháo|súp|soup|canh/i.test(d.name) ? 4 : d.tags.includes('cay') ? 0.3 : 1) },
  anmung: { e: '🥳', name: 'Ăn mừng', line: 'Ăn mừng thì phải lẩu, phải đặc sản, phải hoành tráng!', w: (d) => (d.kind === 'lau' || d.tags.includes('dac-san') || d.kind === 'mon-nhau' ? 2.5 : 1) },
};

const SEASONS = {
  tet: { name: 'Tết', fx: ['🌸', '🧧', '🏮', '🌼'], line: 'Tết tới rồi! Bánh chưng, dưa hành, thịt kho đâu hết rồi?', re: /bánh chưng|bánh tét|giò|thịt kho|dưa hành|mứt|xôi gấc|canh khổ qua/i },
  trungthu: { name: 'Trung thu', fx: ['🏮', '🥮', '🌕', '⭐'], line: 'Trung thu nè, bánh nướng hay bánh dẻo đây?', re: /trung thu|bánh dẻo|bánh nướng|bưởi/i },
  halloween: { name: 'Halloween', fx: ['🎃', '👻', '🦇', '🕸️'], line: 'Halloween! Hôm nay ăn gì cũng được, miễn đừng ăn kẹo của con nít.', re: /bí|pumpkin|tamale|pan de muerto/i },
  noel: { name: 'Giáng sinh', fx: ['❄️', '🎄', '⭐', '🎁'], line: 'Giáng sinh rồi, gà quay với bánh đâu?', re: /gà|turkey|bánh|lẩu|tamale/i },
  valentine: { name: 'Valentine', fx: ['💘', '🌹', '🍫', '💌'], line: 'Valentine! Có bồ thì đi ăn, không có bồ thì… cũng đi ăn.', re: /chè|kem|flan|lẩu|bánh/i },
};
function detectSeason() {
  const q = new URLSearchParams(location.search).get('season');
  if (q && SEASONS[q]) return q;
  const m = now.getMonth() + 1, d = now.getDate();
  if ((L.month === 12 && L.day >= 23) || (L.month === 1 && L.day <= 10)) return 'tet';
  if (L.month === 8 && L.day >= 8 && L.day <= 16) return 'trungthu';
  if (m === 10 && d >= 24) return 'halloween';
  if (m === 12 && d >= 15 && d <= 26) return 'noel';
  if (m === 2 && d >= 10 && d <= 14) return 'valentine';
  return null;
}

export const ctx = {
  weather: null, // {t, f, rain, label}
  lunarDay: L.day === 1 ? 'mung1' : L.day === 15 ? 'ram' : null,
  owl: (() => { const h = now.getHours(); return h >= 23 || h < 5; })() || new URLSearchParams(location.search).has('owl'),
  season: detectSeason(),
  get mood() { return S.mood && S.mood.day === dayKey() ? S.mood.v : null; },
};

export function contextWeight(d) {
  let w = 1;
  const wx = ctx.weather;
  if (wx) {
    if (wx.rain || wx.t < 16) w *= isHot(d) ? 2.5 : 1;
    else if (wx.t > 30) w *= isCold(d) ? 2.5 : isHot(d) ? 0.5 : 1;
  }
  if (ctx.lunarDay) w *= d.tags.includes('chay') ? 3 : 1;
  if (ctx.owl) w *= /mì gói|mì tôm|cháo|bánh mì|xôi|hủ tiếu|phở|bánh bao|trứng/i.test(d.name) ? 3 : 1;
  if (ctx.season) w *= SEASONS[ctx.season].re.test(d.name) ? 3 : 1;
  if (ctx.mood) w *= MOODS[ctx.mood].w(d);
  return w;
}

/* weather (Open-Meteo, only after the user opts in) */
const WX_CODES = { rain: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99], snow: [71, 73, 75, 77, 85, 86] };
async function loadWeather(ask) {
  if (!S.wx && !ask) return;
  try {
    const cached = JSON.parse(sessionStorage.getItem('wx') || 'null');
    if (cached && Date.now() - cached.ts < 30 * 60e3) { ctx.weather = cached.v; return renderCtx(); }
    let pos = S.wx;
    if (ask || !pos) {
      pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: +p.coords.latitude.toFixed(1), lon: +p.coords.longitude.toFixed(1) }), rej, { timeout: 10000, maximumAge: 36e5 }));
      store.set({ wx: pos });
    }
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${pos.lat}&longitude=${pos.lon}&current=temperature_2m,weather_code`;
    const j = await fetch(u).then((r) => r.json());
    const t = Math.round(j.current.temperature_2m), code = j.current.weather_code;
    const rain = WX_CODES.rain.includes(code), snow = WX_CODES.snow.includes(code);
    ctx.weather = { t, f: Math.round(t * 9 / 5 + 32), rain: rain || snow, icon: snow ? '🌨️' : rain ? '☔' : t > 30 ? '🥵' : t < 16 ? '🥶' : '⛅' };
    sessionStorage.setItem('wx', JSON.stringify({ ts: Date.now(), v: ctx.weather }));
    renderCtx();
    if (ask) A.say(ctx.weather.rain ? 'Trời mưa mà ăn gỏi là không tôn trọng ông trời ☔' : ctx.weather.t > 30 ? `Nóng ${ctx.weather.t} độ, ăn lẩu là liều đó nha 🥵` : 'Đã xem trời. Tui sẽ chọn món hợp thời tiết nha.', 'happy');
  } catch {
    if (ask) A.toast('Không lấy được vị trí, nên tui đoán thời tiết bằng… cảm giác vậy.');
  }
}

function ctxLine() {
  if (ctx.season) return SEASONS[ctx.season].line;
  if (ctx.owl) return 'Giờ này còn thức hả cú đêm? Tui gợi ý món khuya nha 🦉';
  if (ctx.lunarDay) return ctx.lunarDay === 'ram' ? 'Hôm nay rằm, ăn chay cho nhẹ bụng nha 🙏' : 'Mùng 1 đầu tháng, ăn chay lấy hên nha 🙏';
  if (ctx.mood) return MOODS[ctx.mood].line;
  return null;
}
export function renderCtx() {
  const box = $('#ctx');
  if (!box) return;
  const chips = [];
  const wx = ctx.weather;
  chips.push(wx
    ? `<span class="cx" title="Đang ưu tiên món hợp thời tiết">${wx.icon} ${wx.f}°F · ${wx.t}°C</span>`
    : `<button class="cx ask" data-cx="wx" title="Dùng vị trí gần đúng để xem thời tiết">🌦️ theo thời tiết?</button>`);
  if (ctx.lunarDay) chips.push(`<span class="cx">🌕 ${ctx.lunarDay === 'ram' ? 'Rằm' : 'Mùng 1'} · ưu tiên chay</span>`);
  if (ctx.owl) chips.push('<span class="cx">🦉 cú đêm</span>');
  if (ctx.season) chips.push(`<span class="cx">${SEASONS[ctx.season].fx[0]} ${SEASONS[ctx.season].name}</span>`);
  const m = ctx.mood;
  chips.push(`<button class="cx ask" data-cx="mood" aria-expanded="false">${m ? `${MOODS[m].e} ${MOODS[m].name}` : '😶 tâm trạng?'}</button>`);
  box.innerHTML = chips.join('') + `<div class="moods" hidden>${Object.entries(MOODS).map(([k, v]) => `<button data-mood="${k}" aria-pressed="${k === m}" title="${v.name}">${v.e}<small>${v.name}</small></button>`).join('')}<button data-mood="" title="Bỏ chọn">✕</button></div>`;
  box.querySelector('[data-cx="wx"]')?.addEventListener('click', () => loadWeather(true));
  const mb = box.querySelector('[data-cx="mood"]'), panel = box.querySelector('.moods');
  mb.onclick = () => { panel.hidden = !panel.hidden; mb.setAttribute('aria-expanded', !panel.hidden); sfx.click(); };
  panel.querySelectorAll('[data-mood]').forEach((b) => (b.onclick = () => {
    const v = b.dataset.mood;
    store.set({ mood: v ? { v, day: dayKey() } : null });
    renderCtx(); sfx.pop();
    if (v) A.say(MOODS[v].line, v === 'buon' || v === 'chiatay' || v === 'om' ? 'sad' : 'happy');
  }));
}

function seasonFx() {
  document.documentElement.dataset.owl = ctx.owl ? '1' : '';
  if (!ctx.season || reduced) return;
  const layer = document.createElement('div');
  layer.className = 'season-fx'; layer.setAttribute('aria-hidden', 'true');
  const fx = SEASONS[ctx.season].fx;
  layer.innerHTML = Array.from({ length: 14 }, () => `<i style="left:${rand(0, 100)}%;animation-duration:${rand(9, 18)}s;animation-delay:-${rand(0, 18)}s;font-size:${rand(14, 26)}px">${pick(fx)}</i>`).join('');
  document.body.appendChild(layer);
}

/* ================= pet bowl ================= */
function petState() {
  const week = Date.now() - 7 * 864e5;
  const ate = S.history.filter((h) => h.ts > week).map((h) => A.BY_ID[h.id]).filter(Boolean);
  const veg = ate.filter((d) => d.tags.includes('chay') || /rau|gỏi|nộm|salad/i.test(d.name)).length;
  const oily = ate.filter((d) => d.kind === 'mon-nhau' || /chiên|rán|quay|fried/i.test(d.name)).length;
  const away = S.lastVisit ? (Date.now() - S.lastVisit) / 864e5 : 0;
  if (away > 2) return { cls: 'hungry', line: `Bạn bỏ tui ${Math.floor(away)} ngày rồi đó. Đói muốn xỉu 😵`, mood: 'sad' };
  if (oily >= 3) return { cls: 'chubby', line: `Tuần này ăn ${oily} món chiên rán, tui tròn như cái bánh bao rồi nè 🍟`, mood: 'wow' };
  if (veg >= 3) return { cls: 'green', line: `Tuần này ăn ${veg} món rau, tui xanh mướt khỏe re 🥬`, mood: 'happy' };
  if (!ate.length) return { cls: '', line: 'Tuần này chưa cho tui ăn gì hết. Bấm chọn món đi chủ ơi!', mood: 'sad' };
  return { cls: '', line: `Tuần này ăn ${ate.length} món, tui no nê vừa đủ 😊`, mood: 'smile' };
}
function applyPet(talk) {
  const p = petState(), m = $('#mascot');
  m.classList.remove('hungry', 'chubby', 'green');
  if (p.cls) m.classList.add(p.cls);
  if (talk) A.say(p.line, p.mood);
  return p;
}

/* ================= pronunciation & voice ================= */
function viVoice() { return speechSynthesis.getVoices().find((v) => /^vi/i.test(v.lang)); }
export function speakDish(d) {
  if (!('speechSynthesis' in window)) return A.toast(`Đọc là: ${d.more?.say || d.name}`);
  speechSynthesis.cancel();
  const v = viVoice();
  const u = new SpeechSynthesisUtterance(v ? d.name : d.more?.say || d.name);
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
  u.rate = 0.85;
  speechSynthesis.speak(u);
  if (!v) A.toast(`Máy chưa có giọng tiếng Việt, đọc kiểu Mỹ: “${d.more?.say || d.name}”`);
}
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
function voiceCommand(text) {
  const t = norm(text);
  if (/do vui|do\b|cau do/.test(t)) { A.setMode('quiz'); return A.go(); }
  if (/cup|dau cup/.test(t)) { A.setMode('cup'); return A.go(); }
  if (/xam|que/.test(t)) { A.setMode('xam'); return A.go(); }
  const hit = A.DISHES.filter((d) => t.includes(norm(d.name))).sort((a, b) => b.name.length - a.name.length)[0];
  if (hit) return A.openDish(hit);
  for (const [k, m] of Object.entries(MOODS)) if (t.includes(norm(m.name))) { store.set({ mood: { v: k, day: dayKey() } }); renderCtx(); A.say(m.line, 'happy'); return A.go(); }
  if (/an gi|doi|chon|mon gi|bat oi|bat|gi gio/.test(t)) return A.go();
  A.say(`Tui nghe “${text}” mà không hiểu lắm. Nói “ăn gì giờ” thử xem?`, 'wow');
}
function listen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return A.toast('Trình duyệt này chưa nghe được giọng nói. Thử Chrome nha.');
  const r = new SR();
  r.lang = 'vi-VN'; r.interimResults = false; r.maxAlternatives = 1;
  const btn = $('#voiceBtn');
  btn.classList.add('on');
  A.say('Tui đang nghe nè… nói “Ê bát, ăn gì giờ?” 👂', 'wow');
  r.onresult = (e) => voiceCommand(e.results[0][0].transcript);
  r.onerror = () => A.say('Không nghe rõ, nói lại to hơn chút nha.', 'sad');
  r.onend = () => btn.classList.remove('on');
  r.start();
}

/* ================= share card ================= */
function wrap(c, text, x, y, maxW, lh, maxLines = 3) {
  const words = text.split(' ');
  let line = '', n = 0;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (c.measureText(t).width > maxW && line) { c.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines - 1) break; } else line = t;
  }
  c.fillText(line, x, y);
  return y + lh;
}
const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export async function shareCard(d) {
  const W = 1080, H = 1350, cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  const bg = cssVar('--bg') || '#eeefec', ink = cssVar('--ink') || '#1a1714', acc = cssVar('--accent') || '#cc2018', surf = cssVar('--surface') || '#fbfaf7';
  const disp = cssVar('--display') || 'sans-serif', txt = cssVar('--text') || 'sans-serif';
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.fillStyle = surf; c.strokeStyle = ink; c.lineWidth = 6;
  c.fillRect(70, 70, W - 140, H - 140); c.strokeRect(70, 70, W - 140, H - 140);
  c.fillStyle = acc; c.fillRect(70, 70, W - 140, 22);
  c.fillStyle = ink; c.font = `700 40px ${txt}`; c.textAlign = 'center';
  c.fillText('VŨ TRỤ BẮT TUI HÔM NAY ĂN', W / 2, 170);
  // photo
  const S2 = 640, px = (W - S2) / 2, py = 210;
  if (media.has.has(d.id)) {
    const img = new Image();
    img.src = `img/dishes/${d.id}.webp`;
    await img.decode().catch(() => {});
    c.save(); c.translate(W / 2, py + S2 / 2); c.rotate(-0.03);
    c.fillStyle = '#fff'; c.fillRect(-S2 / 2 - 18, -S2 / 2 - 18, S2 + 36, S2 + 36);
    if (img.naturalWidth) c.drawImage(img, -S2 / 2, -S2 / 2, S2, S2);
    c.restore();
  } else { c.font = `300px serif`; c.fillText(d.emoji || '🍽️', W / 2, py + 450); }
  c.fillStyle = acc; c.font = `900 92px ${disp}`;
  let y = wrap(c, d.name, W / 2, 990, W - 220, 96, 2);
  c.fillStyle = ink; c.font = `italic 500 36px ${txt}`;
  y = wrap(c, d.joke || d.desc || '', W / 2, y + 6, W - 240, 46, 3);
  c.font = `700 32px ${txt}`; c.fillStyle = ink;
  c.fillText('angi.nhaajt.com · cái bát chọn đó, đừng cãi', W / 2, H - 110);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  const file = new File([blob], `hom-nay-an-${d.id}.png`, { type: 'image/png' });
  const url = `${location.origin}${location.pathname}?mon=${d.id}`;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: d.name, text: `Hôm nay ăn ${d.name}! ${url}` }); } catch {}
  } else {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: file.name });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    A.toast('Đã lưu ảnh khoe món, đăng story liền đi! 📸');
  }
}

/* ================= food passport ================= */
// tile-grid map of Vietnam's 63 provinces [name, short, col, row]
const PROV = [
  ['Lai Châu', 'LC', 0, 0], ['Lào Cai', 'LCa', 1, 0], ['Hà Giang', 'HG', 2, 0], ['Cao Bằng', 'CB', 3, 0],
  ['Điện Biên', 'ĐB', 0, 1], ['Yên Bái', 'YB', 1, 1], ['Tuyên Quang', 'TQ', 2, 1], ['Bắc Kạn', 'BK', 3, 1], ['Lạng Sơn', 'LS', 4, 1],
  ['Sơn La', 'SL', 0, 2], ['Phú Thọ', 'PT', 1, 2], ['Thái Nguyên', 'TN', 2, 2], ['Bắc Giang', 'BG', 3, 2], ['Quảng Ninh', 'QN', 4, 2],
  ['Hòa Bình', 'HB', 0, 3], ['Vĩnh Phúc', 'VP', 1, 3], ['Hà Nội', 'HN', 2, 3], ['Bắc Ninh', 'BN', 3, 3], ['Hải Dương', 'HD', 4, 3], ['Hải Phòng', 'HP', 5, 3],
  ['Hà Nam', 'HNa', 2, 4], ['Hưng Yên', 'HY', 3, 4], ['Thái Bình', 'TB', 4, 4],
  ['Ninh Bình', 'NB', 1, 5], ['Nam Định', 'NĐ', 2, 5],
  ['Thanh Hóa', 'TH', 1, 6], ['Nghệ An', 'NA', 1, 7], ['Hà Tĩnh', 'HT', 2, 8], ['Quảng Bình', 'QB', 2, 9], ['Quảng Trị', 'QT', 3, 10], ['Thừa Thiên Huế', 'Huế', 3, 11],
  ['Quảng Nam', 'QNa', 3, 12], ['Đà Nẵng', 'ĐN', 4, 12],
  ['Kon Tum', 'KT', 3, 13], ['Quảng Ngãi', 'QNg', 4, 13], ['Gia Lai', 'GL', 3, 14], ['Bình Định', 'BĐ', 4, 14],
  ['Đắk Lắk', 'ĐL', 3, 15], ['Phú Yên', 'PY', 4, 15],
  ['Đắk Nông', 'ĐNo', 2, 16], ['Lâm Đồng', 'LĐ', 3, 16], ['Khánh Hòa', 'KH', 4, 16],
  ['Bình Phước', 'BP', 1, 17], ['Bình Dương', 'BD', 2, 17], ['Đồng Nai', 'ĐNa', 3, 17], ['Ninh Thuận', 'NT', 4, 17],
  ['Tây Ninh', 'TNi', 0, 18], ['Long An', 'LA', 1, 18], ['TP. Hồ Chí Minh', 'SG', 2, 18], ['Bà Rịa - Vũng Tàu', 'VT', 3, 18], ['Bình Thuận', 'BTh', 4, 18],
  ['An Giang', 'AG', 0, 19], ['Đồng Tháp', 'ĐT', 1, 19], ['Tiền Giang', 'TG', 2, 19], ['Bến Tre', 'BT', 3, 19],
  ['Kiên Giang', 'KG', 0, 20], ['Cần Thơ', 'CT', 1, 20], ['Vĩnh Long', 'VL', 2, 20], ['Trà Vinh', 'TV', 3, 20],
  ['Hậu Giang', 'HGi', 1, 21], ['Sóc Trăng', 'ST', 2, 21], ['Cà Mau', 'CM', 0, 22], ['Bạc Liêu', 'BL', 1, 22],
];
const COUNTRY = { MX: "Mexico", US: "Mỹ", CN: "Trung Quốc", TW: "Đài Loan", HK: "Hồng Kông", KR: "Hàn Quốc", JP: "Nhật", TH: "Thái Lan", PH: "Philippines", GB: "Anh", IN: "Ấn Độ", PK: "Pakistan", LB: "Li-băng", GR: "Hy Lạp", TR: "Thổ Nhĩ Kỳ", IL: "Israel", ET: "Ethiopia", SV: "El Salvador", VE: "Venezuela", JM: "Jamaica", PE: "Peru", AR: "Argentina", CU: "Cuba", PR: "Puerto Rico", BR: "Brazil", IT: "Ý", KH: "Campuchia", LA: "Lào", MM: "Myanmar", FR: "Pháp", DE: "Đức", ES: "Tây Ban Nha", MY: "Malaysia", ID: "Indonesia", SG: "Singapore", NG: "Nigeria", CO: "Colombia" };
const FLAG = (cc) => "🌐 " + (COUNTRY[cc] || cc);
export function stamp(d) {
  const pp = S.passport || {};
  const firstDish = !pp[d.id];
  const origin = d.more?.origin;
  const placeBefore = origin && Object.keys(pp).some((id) => A.BY_ID[id]?.more?.origin === origin);
  if (firstDish) { pp[d.id] = Date.now(); store.set({ passport: pp }); }
  if (ctx.owl) store.set({ owlEats: (S.owlEats || 0) + 1 });
  if (origin && !placeBefore) {
    sfx.clack();
    setTimeout(() => A.toast(`📮 Đóng dấu hộ chiếu: ${origin.length === 2 ? FLAG(origin) : origin}! Vùng đất mới 🎉`), 900);
  }
  applyPet(false);
}
function badges(ids) {
  const ds = ids.map((id) => A.BY_ID[id]).filter(Boolean);
  const prov = new Set(ds.filter((d) => d.region !== 'intl').map((d) => d.more?.origin).filter(Boolean));
  const ctry = new Set(ds.filter((d) => d.region === 'intl').map((d) => d.more?.origin).filter(Boolean));
  const count = (re) => ds.filter((d) => re.test(d.name)).length;
  const regions = new Set(ds.map((d) => d.region));
  return [
    ['🛫', 'Chuyến bay đầu tiên', 'Đóng con dấu đầu tiên', ds.length >= 1],
    ['🗺️', 'Phượt thủ bao tử', 'Ăn món của 5 tỉnh', prov.size >= 5],
    ['🏍️', 'Xuyên Việt', 'Ăn món của 20 tỉnh', prov.size >= 20],
    ['🍲', 'Ba miền một bụng', 'Ăn đủ Bắc, Trung, Nam', ['bac', 'trung', 'nam'].every((r) => regions.has(r))],
    ['🌎', 'Công dân thế giới', 'Ăn món của 5 nước', ctry.size >= 5],
    ['🍜', 'Phở Master', '5 loại phở', count(/^phở/i) >= 5],
    ['🥢', 'Bún thủ', '10 loại bún', count(/^bún/i) >= 10],
    ['🥖', 'Bánh tình', '10 loại bánh', count(/^bánh/i) >= 10],
    ['🌱', 'Chay tịnh', '5 món chay', ds.filter((d) => d.tags.includes('chay')).length >= 5],
    ['🌶️', 'Thánh cay', '10 món cay', ds.filter((d) => d.tags.includes('cay')).length >= 10],
    ['🦉', 'Cú đêm', 'Chốt món sau 11 giờ đêm 3 lần', (S.owlEats || 0) >= 3],
    ['👑', 'Vua ẩm thực', 'Ăn 100 món khác nhau', ds.length >= 100],
  ];
}
export function openPassport() {
  const ov = $('#passport');
  const ids = Object.keys(S.passport || {});
  const ds = ids.map((id) => A.BY_ID[id]).filter(Boolean);
  const byProv = {};
  A.DISHES.forEach((d) => { const o = d.more?.origin; if (o) (byProv[o] = byProv[o] || []).push(d); });
  const eatenProv = {};
  ds.forEach((d) => { const o = d.more?.origin; if (o) eatenProv[o] = (eatenProv[o] || 0) + 1; });
  const ctry = Object.keys(byProv).filter((k) => k.length === 2).sort((a, b) => (eatenProv[b] || 0) - (eatenProv[a] || 0));
  const bs = badges(ids);
  ov.querySelector('.pp-map').innerHTML = PROV.map(([n, s, c, r]) => {
    const k = eatenProv[n] || 0, total = (byProv[n] || []).length;
    return `<button class="pp-tile ${k ? 'on' : ''} ${total ? '' : 'none'}" style="grid-column:${c + 1};grid-row:${r + 1}" data-p="${esc(n)}" title="${esc(n)}: ${k}/${total} món">${esc(s)}</button>`;
  }).join('');
  const nProv = Object.keys(eatenProv).filter((k) => k.length > 2).length;
  ov.querySelector('.pp-side').innerHTML = `
    <p class="pp-stat"><b>${ds.length}</b> món · <b>${nProv}</b>/63 tỉnh · <b>${ctry.filter((k) => eatenProv[k]).length}</b> nước</p>
    <div class="pp-flags">${ctry.map((k) => `<button class="pp-flag ${eatenProv[k] ? 'on' : ''}" data-p="${k}" title="${k}">${esc(COUNTRY[k] || k)}<small>${eatenProv[k] || 0}</small></button>`).join('')}</div>
    <h4>Huy hiệu</h4>
    <div class="pp-badges">${bs.map(([e, n, h, ok]) => `<span class="pp-badge ${ok ? 'on' : ''}" title="${esc(h)}">${e}<b>${esc(n)}</b><small>${esc(h)}</small></span>`).join('')}</div>
    <div class="pp-list"><p class="pp-hint">Bấm một tỉnh hoặc lá cờ để xem món ở đó. Món nào bấm “✓ chốt” sẽ được đóng dấu.</p></div>`;
  ov.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => {
    const p = b.dataset.p, list = byProv[p] || [];
    ov.querySelector('.pp-list').innerHTML = `<h4>${esc(p.length === 2 ? FLAG(p) : p)} · ${eatenProv[p] || 0}/${list.length}</h4>` + (list.length
      ? `<div class="pp-dishes">${list.map((d) => `<button data-id="${d.id}" class="${S.passport?.[d.id] ? 'on' : ''}">${S.passport?.[d.id] ? '📮' : '·'} ${esc(d.name)}</button>`).join('')}</div>`
      : '<p class="pp-hint">Chưa có món nào của nơi này trong sổ.</p>');
    ov.querySelectorAll('.pp-dishes button').forEach((x) => (x.onclick = () => { closePassport(); A.openDish(A.BY_ID[x.dataset.id]); }));
  }));
  ov.hidden = false;
  sfx.open();
  if (!reduced) gsap.from(ov.querySelectorAll('.pp-tile.on, .pp-badge.on'), { scale: 0, rotation: () => rand(-30, 30), stagger: 0.02, duration: 0.35, ease: 'back.out(2)' });
  $('#ppClose').focus({ preventScroll: true });
}
export function closePassport() { $('#passport').hidden = true; }

/* ================= nearby places (OpenStreetMap, on request) ================= */
const OSM_CUISINE = { MX: 'mexican', CN: 'chinese', TH: 'thai', KR: 'korean', JP: 'japanese', PH: 'filipino', IN: 'indian', ET: 'ethiopian', IT: 'italian', US: 'american', VN: 'vietnamese' };
async function nearby(d, box) {
  box.innerHTML = '<p class="pp-hint">Đang dò quán quanh bạn…</p>';
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition((p) => res(p.coords), rej, { timeout: 10000, maximumAge: 6e5 }));
    const cui = d.region === 'intl' ? OSM_CUISINE[d.more?.origin] || '' : 'vietnamese';
    const q = `[out:json][timeout:15];nwr(around:5000,${pos.latitude.toFixed(3)},${pos.longitude.toFixed(3)})["amenity"~"restaurant|fast_food|cafe"]${cui ? `["cuisine"~"${cui}",i]` : ''};out center 40;`;
    const j = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(q) }).then((r) => r.json());
    const R = 6371, rad = (x) => (x * Math.PI) / 180;
    const dist = (la, lo) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(la - pos.latitude) / 2) ** 2 + Math.cos(rad(pos.latitude)) * Math.cos(rad(la)) * Math.sin(rad(lo - pos.longitude) / 2) ** 2));
    const list = j.elements.filter((e) => e.tags?.name).map((e) => {
      const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
      return { name: e.tags.name, la, lo, km: dist(la, lo) };
    }).sort((a, b) => a.km - b.km).slice(0, 6);
    box.innerHTML = list.length
      ? `<ol class="near">${list.map((p) => `<li><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}%20${p.la},${p.lo}" target="_blank" rel="noopener">${esc(p.name)}</a> <small>${(p.km * 0.621).toFixed(1)} mi</small></li>`).join('')}</ol><p class="pp-hint">Dữ liệu quán: © OpenStreetMap. Gọi trước hỏi có món ${esc(d.name)} không nha.</p>`
      : `<p class="pp-hint">Quanh 5 km chưa thấy quán ${cui ? 'hợp' : ''} trên OpenStreetMap. Thử nút “📍 Google Maps” nha.</p>`;
  } catch {
    box.innerHTML = '<p class="pp-hint">Không lấy được vị trí hoặc dữ liệu quán. Thử lại sau nha.</p>';
  }
}

/* ================= dish card extras ================= */
export function cardMore(d) {
  const box = $('#mMore'), m = d.more;
  $('#mSay').onclick = () => speakDish(d);
  if (!m) { box.hidden = true; return; }
  box.hidden = false;
  const r = m.recipe || {};
  const tabs = [
    ['tip', '🍴 Ăn kiểu bản xứ', `<p>${esc(m.tip || '')}</p>`],
    ['cook', `👩‍🍳 Nấu ${r.min || 15}′`, `<div class="cook"><ul>${(r.need || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul><ol>${(r.steps || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ol></div>${r.buy ? `<p class="buy">🛒 ${esc(r.buy)}</p>` : ''}`],
    ['pair', '💞 Hợp với ai', `<p>${esc(m.pair || '')}</p>`],
    ['say', '🗣️ Đọc sao', `<p><b>${esc(d.name)}</b> → “${esc(m.say || '')}” <button class="link" data-say>🔊 nghe</button></p>`],
    ['near', '📍 Quán gần', '<div class="near-box"><button class="pill ghost" data-near>🔎 Tìm quán trong 5 km</button><p class="pp-hint">Cần vị trí của bạn (chỉ gửi tới OpenStreetMap để tìm quán).</p></div>'],
  ];
  box.innerHTML = `<div class="more-tabs" role="tablist">${tabs.map(([k, t], i) => `<button role="tab" data-t="${k}" aria-selected="${i === 0}">${t}</button>`).join('')}</div>
    ${tabs.map(([k, , h], i) => `<div class="more-pane" data-p="${k}" ${i ? 'hidden' : ''}>${h}</div>`).join('')}`;
  box.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => {
    sfx.tick();
    box.querySelectorAll('[data-t]').forEach((x) => x.setAttribute('aria-selected', x === b));
    box.querySelectorAll('.more-pane').forEach((p) => (p.hidden = p.dataset.p !== b.dataset.t));
  }));
  box.querySelector('[data-say]').onclick = () => speakDish(d);
  box.querySelector('[data-near]').onclick = (e) => nearby(d, e.target.closest('.near-box'));
}

/* ================= street-food ambience (real CC0 recordings) ================= */
let amb = null;
function toggleAmbience() {
  const btn = $('#ambBtn');
  if (amb) { amb.forEach((a) => a.pause()); amb = null; btn.setAttribute('aria-pressed', 'false'); return; }
  amb = [['sfx/amb-bep.mp3', 0.35], ['sfx/amb-cho.mp3', 0.18]].map(([src, v]) => Object.assign(new Audio(src), { loop: true, volume: v }));
  amb.forEach((a) => a.play().catch(() => {}));
  btn.setAttribute('aria-pressed', 'true');
  A.say('Nghe tiếng xèo xèo với tiếng chợ chưa? Đói thêm chưa? 😋', 'happy');
}

/* ================= PWA ================= */
function pwa() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

/* ================= init ================= */
export function initExtras(api) {
  A = api;
  seasonFx();
  renderCtx();
  loadWeather(false);
  const p = applyPet(false);
  store.set({ lastVisit: Date.now() });
  $('#mascot').addEventListener('click', () => { applyPet(true); sfx.pop(); });
  $('#voiceBtn').onclick = listen;
  $('#ambBtn').onclick = toggleAmbience;
  $('#ppBtn').onclick = () => { A.closeMenu(); openPassport(); };
  $('#ppClose').onclick = closePassport;
  $('#passport').onclick = (e) => { if (e.target.id === 'passport') closePassport(); };
  pwa();
  const line = p.cls === 'hungry' ? p.line : ctxLine();
  if (line) setTimeout(() => A.say(line, p.cls === 'hungry' ? 'sad' : 'happy'), 2600);
}
