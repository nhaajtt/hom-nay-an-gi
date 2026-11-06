// Skin (theme) registry, font loading, and the tear-off calendar sheet.
export const SKINS = [
  { id: 'note', name: 'Giấy kẻ vẽ tay', icon: '✏️', fonts: 'family=Pangolin&family=Patrick+Hand', bar: '#f3eee2' },
  { id: 'lich', name: 'Tờ lịch bóc', icon: '📅', fonts: 'family=Playfair+Display:wght@700;900&family=Be+Vietnam+Pro:wght@400;600;800', bar: '#e7e1d6' },
  { id: 'bento', name: 'Hộp cơm bento', icon: '🍱', fonts: 'family=Be+Vietnam+Pro:wght@400;600;800', bar: '#f1ede4' },
  { id: 'bill', name: 'Tờ hóa đơn', icon: '🧾', fonts: 'family=IBM+Plex+Mono:wght@400;600;700', bar: '#d9d6cf' },
  { id: 'neo', name: 'Neubrutalism', icon: '🟨', fonts: 'family=Space+Grotesk:wght@400;600;700', bar: '#b8ff5c' },
  { id: 'clay', name: 'Đất sét 3D', icon: '🧸', fonts: 'family=Baloo+2:wght@500;700;800', bar: '#f4e9ff' },
  { id: 'y2k', name: 'Y2K lấp lánh', icon: '💿', fonts: 'family=Chakra+Petch:wght@500;700&family=Nunito:wght@500;800', bar: '#e6ecff' },
  { id: 'riso', name: 'In risograph', icon: '🖨️', fonts: 'family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800', bar: '#f6f0e4' },
  { id: 'chalk', name: 'Bảng phấn quán', icon: '🖍️', fonts: 'family=Itim', bar: '#3d2614' },
  { id: 'neon', name: 'Neon phố đêm', icon: '🌃', fonts: 'family=Pacifico&family=Be+Vietnam+Pro:wght@400;700', bar: '#0b0716' },
  { id: 'pixel', name: 'Game 8-bit', icon: '👾', fonts: 'family=VT323', bar: '#262b44' },
  { id: 'gourou', name: 'Lễ hội màu', icon: '🎨', fonts: 'family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Be+Vietnam+Pro:wght@400;600', bar: '#14238c' },
  { id: 'tiger', name: 'Fiesta sticker', icon: '🌮', fonts: 'family=Baloo+2:wght@500;800', bar: '#ffd23f' },
  { id: 'ink', name: 'Mực đen truyện tranh', icon: '✒️', fonts: 'family=Amatic+SC:wght@400;700&family=Patrick+Hand', bar: '#fbfaf7' },
  { id: 'carton', name: 'Bìa carton dập nổi', icon: '📦', fonts: 'family=Be+Vietnam+Pro:wght@400;600;800;900', bar: '#d4b08f' },
];
export const DEFAULT_SKIN = 'note';
const byId = Object.fromEntries(SKINS.map((s) => [s.id, s]));

export function applySkin(id) {
  const s = byId[id] || byId[DEFAULT_SKIN];
  document.documentElement.dataset.skin = s.id;
  let link = document.getElementById('skinFont');
  if (!link) { link = Object.assign(document.createElement('link'), { id: 'skinFont', rel: 'stylesheet' }); document.head.appendChild(link); }
  link.href = `https://fonts.googleapis.com/css2?${s.fonts}&display=swap`;
  document.querySelector('meta[name=theme-color]').content = s.bar;
  return s.id;
}
export const randomSkin = (except) => {
  const list = SKINS.filter((s) => s.id !== except);
  return list[Math.floor(Math.random() * list.length)].id;
};

/* ---------- Vietnamese lunar calendar (Hồ Ngọc Đức's algorithm, UTC+7) ---------- */
const INT = Math.floor, PI = Math.PI;
function jdFromDate(dd, mm, yy) {
  const a = INT((14 - mm) / 12), y = yy + 4800 - a, m = mm + 12 * a - 3;
  let jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - INT(y / 100) + INT(y / 400) - 32045;
  if (jd < 2299161) jd = dd + INT((153 * m + 2) / 5) + 365 * y + INT(y / 4) - 32083;
  return jd;
}
function newMoon(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, dr = PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M) - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr) - 0.0004 * Math.sin(dr * 3 * Mpr)
    + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr)) - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M))
    - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr)) + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
  const deltat = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3 : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Jd1 + C1 - deltat;
}
const getNewMoonDay = (k, tz) => INT(newMoon(k) + 0.5 + tz / 24);
function sunLong(jdn) {
  const T = (jdn - 2451545.0) / 36525, T2 = T * T, dr = PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M) + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
  let L = (L0 + DL) * dr;
  L -= PI * 2 * INT(L / (PI * 2));
  return L;
}
const getSunLongitude = (dayNumber, tz) => INT(sunLong(dayNumber - 0.5 - tz / 24) / PI * 6);
function getLunarMonth11(yy, tz) {
  const off = jdFromDate(31, 12, yy) - 2415021;
  const k = INT(off / 29.530588853);
  let nm = getNewMoonDay(k, tz);
  if (getSunLongitude(nm, tz) >= 9) nm = getNewMoonDay(k - 1, tz);
  return nm;
}
function getLeapMonthOffset(a11, tz) {
  const k = INT((a11 - 2415021.076998695) / 29.530588853 + 0.5);
  let last, i = 1, arc = getSunLongitude(getNewMoonDay(k + i, tz), tz);
  do { last = arc; i++; arc = getSunLongitude(getNewMoonDay(k + i, tz), tz); } while (arc !== last && i < 14);
  return i - 1;
}
export function lunar(dd, mm, yy, tz = 7) {
  const dayNumber = jdFromDate(dd, mm, yy);
  const k = INT((dayNumber - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, tz);
  if (monthStart > dayNumber) monthStart = getNewMoonDay(k, tz);
  let a11 = getLunarMonth11(yy, tz), b11 = a11, lunarYear;
  if (a11 >= monthStart) { lunarYear = yy; a11 = getLunarMonth11(yy - 1, tz); } else { lunarYear = yy + 1; b11 = getLunarMonth11(yy + 1, tz); }
  const lunarDay = dayNumber - monthStart + 1;
  const diff = INT((monthStart - a11) / 29);
  let lunarMonth = diff + 11, leap = false;
  if (b11 - a11 > 365) {
    const leapDiff = getLeapMonthOffset(a11, tz);
    if (diff >= leapDiff) { lunarMonth = diff + 10; if (diff === leapDiff) leap = true; }
  }
  if (lunarMonth > 12) lunarMonth -= 12;
  if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
  return { day: lunarDay, month: lunarMonth, year: lunarYear, leap };
}
const CAN = ['Canh', 'Tân', 'Nhâm', 'Quý', 'Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ'];
const CHI = ['Thân', 'Dậu', 'Tuất', 'Hợi', 'Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi'];
export const canChi = (y) => `${CAN[y % 10]} ${CHI[y % 12]}`;

const QUOTES = [
  ['Có thực mới vực được đạo.', 'Tục ngữ'],
  ['Ăn no rồi mới tính chuyện thế giới.', 'Một người đói'],
  ['Hôm nay không biết ăn gì là chuyện thường, ngày mai cũng vậy.', 'Cái bát'],
  ['Đi đâu cũng được, miễn là có quán ngon.', 'Dân sành ăn'],
  ['Không có gì là không thể, trừ việc nhịn ăn trưa.', 'Dân văn phòng'],
  ['Ăn trông nồi, ngồi trông hướng.', 'Tục ngữ'],
  ['Một bát phở bằng mười lời an ủi.', 'Khoa học chưa chứng minh'],
  ['Calo nạp vào lúc vui thì không tính.', 'Ai đó rất tự tin'],
  ['Thèm gì ăn nấy, đời ngắn lắm.', 'Triết gia đường phố'],
  ['Đừng hỏi ăn gì, hãy hỏi còn quán nào mở.', '23 giờ đêm'],
];
const DOW = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

export function calendarHTML(date = new Date()) {
  const d = date.getDate(), m = date.getMonth() + 1, y = date.getFullYear();
  const L = lunar(d, m, y);
  const q = QUOTES[(d + m * 31) % QUOTES.length];
  return `<div class="cal-top"><span>Tháng ${m}</span><span>${y}</span></div>
    <div class="cal-day">${String(d).padStart(2, '0')}</div>
    <div class="cal-dow">${DOW[date.getDay()]}</div>
    <div class="cal-row"><span>Hôm nay<br><b>ăn gì?</b></span><span class="cal-lunar">Âm lịch<b>${L.day}</b>tháng ${L.month}${L.leap ? ' nhuận' : ''}</span><span>Năm<br><b>${canChi(L.year)}</b></span></div>
    <p class="cal-quote">“${q[0]}”<small>— ${q[1]}</small></p>`;
}
