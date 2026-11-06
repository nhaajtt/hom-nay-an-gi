// localStorage-backed state
const KEY = 'homnayangi:v1';
const DAY = 864e5;
const defaults = {
  history: [], fav: [], ban: [],
  filters: { region: [], meal: [], kind: [], tag: [], price: [] },
  noRepeat: true, mode: 'quiz', quizLevel: 'kho', quizKind: 'tron', quizBest: 0, quizSeen: [], cupSize: 16, theme: null, sound: true,
};
let s;
try { s = { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { s = { ...defaults }; }
s.filters = { ...defaults.filters, ...s.filters };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

export const store = {
  get: () => s,
  set(patch) { Object.assign(s, patch); save(); },
  toggleIn(list, id) {
    const a = s[list], i = a.indexOf(id);
    i < 0 ? a.push(id) : a.splice(i, 1);
    if (list === 'fav') s.ban = s.ban.filter((x) => x !== id);
    if (list === 'ban') s.fav = s.fav.filter((x) => x !== id);
    save();
    return i < 0;
  },
  eat(id) {
    s.history = [{ id, ts: Date.now() }, ...s.history.filter((h) => h.id !== id || Date.now() - h.ts > DAY)].slice(0, 30);
    save();
  },
  recentIds(days = 7) {
    const cut = Date.now() - days * DAY;
    return new Set(s.history.filter((h) => h.ts > cut).map((h) => h.id));
  },
};
