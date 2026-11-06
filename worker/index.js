// Cloudflare Worker: serves the static site and a small API.
//   /api/room            POST -> create a group room, returns { code }
//   /api/room/:code/ws   WebSocket for a room (Durable Object "Room")
//   /api/lb              GET weekly leaderboard, POST a daily-quiz score (Durable Object "Board")
//   /api/push            POST subscribe / DELETE unsubscribe for the 11am reminder (stored in "Board")
// Hourly cron sends the lunch reminder (payload-less Web Push with VAPID).
import { DurableObject } from 'cloudflare:workers';

const JSON_H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: JSON_H });
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const ID_RE = /^[a-z0-9-]{1,64}$/;
const clean = (s, n) => String(s ?? '').replace(/[<>&"'`\u0000-\u001f]/g, '').trim().slice(0, n);
const rnd = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      if (p === '/api/room' && req.method === 'POST') {
        const code = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => CODE_ABC[b % CODE_ABC.length]).join('');
        return json({ code });
      }
      const m = p.match(/^\/api\/room\/([A-Z]{4})\/ws$/);
      if (m) {
        if (req.headers.get('upgrade') !== 'websocket') return json({ error: 'websocket only' }, 426);
        return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req);
      }
      if (p === '/api/lb' || p === '/api/push') return env.BOARD.get(env.BOARD.idFromName('main')).fetch(req);
      return json({ error: 'not found' }, 404);
    } catch (e) {
      return json({ error: 'server error' }, 500);
    }
  },
  async scheduled(_ev, env) {
    await env.BOARD.get(env.BOARD.idFromName('main')).fetch('https://do/api/push/send', { method: 'POST' });
  },
};

/* ================= group room ================= */
// phases: lobby -> veto -> cup | swipe -> done
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.s = null;
    ctx.blockConcurrencyWhile(async () => { this.s = (await ctx.storage.get('s')) || null; });
  }
  fresh() { return { players: {}, host: null, phase: 'lobby', game: 'cup', cands: [], vetoes: {}, round: [], next: [], idx: 0, votes: {}, likes: {}, result: null, created: Date.now() }; }
  async save() { await this.ctx.storage.put('s', this.s); }
  view() {
    const s = this.s;
    const players = Object.entries(s.players).map(([pid, p]) => ({ pid, name: p.name, emoji: p.emoji, online: this.online(pid), veto: s.vetoes[pid] || null, voted: pid in s.votes, liked: (s.likes[pid] || []).length }));
    return { phase: s.phase, game: s.game, host: s.host, players, cands: s.cands, vetoes: s.vetoes, round: s.round, idx: s.idx, votes: s.votes, result: s.result, roundSize: s.round.length };
  }
  broadcast(extra) {
    const msg = JSON.stringify({ t: 'state', state: this.view(), ...extra });
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(msg); } catch {} }
  }
  async fetch(req) {
    if (!this.s) { this.s = this.fresh(); await this.save(); await this.ctx.storage.setAlarm(Date.now() + 8 * 36e5); }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }
  async alarm() { await this.ctx.storage.deleteAll(); this.s = null; for (const ws of this.ctx.getWebSockets()) ws.close(1000, 'room expired'); }
  async webSocketClose(ws) { if (this.s) this.broadcast(); }
  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 4096) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    const s = this.s;
    let pid;
    if (m.t === 'hello' && m.tv) { ws.serializeAttachment({ tv: true }); return ws.send(JSON.stringify({ t: 'state', state: this.view() })); }
    if (m.t === 'hello') {
      const known = Object.entries(s.players).find(([, p]) => p.token && p.token === m.token);
      if (known) pid = known[0];
      else {
        if (Object.keys(s.players).length >= 12) return ws.send(JSON.stringify({ t: 'error', msg: 'Phòng đầy rồi (12 người).' }));
        pid = rnd(6);
        s.players[pid] = { name: clean(m.name, 16) || 'Thực khách', emoji: clean(m.emoji, 8) || '🙂', token: rnd(16) };
        if (!s.host) s.host = pid;
      }
      // re-tag this socket with the player id
      ws.serializeAttachment({ pid });
      ws.send(JSON.stringify({ t: 'you', pid, token: s.players[pid].token }));
      await this.save();
      return this.broadcast();
    }
    pid = ws.deserializeAttachment()?.pid;
    if (!pid || !s.players[pid]) return;
    const isHost = pid === s.host;
    const ok = (ids) => Array.isArray(ids) && ids.length >= 2 && ids.length <= 32 && ids.every((x) => typeof x === 'string' && ID_RE.test(x));

    if (m.t === 'rename') { s.players[pid].name = clean(m.name, 16) || s.players[pid].name; s.players[pid].emoji = clean(m.emoji, 8) || s.players[pid].emoji; }
    else if (m.t === 'prepare' && isHost && ok(m.ids) && ['cup', 'swipe'].includes(m.game)) {
      Object.assign(s, { phase: 'veto', game: m.game, cands: [...new Set(m.ids)], vetoes: {}, votes: {}, likes: {}, result: null });
    } else if (m.t === 'veto' && s.phase === 'veto' && s.cands.includes(m.id)) {
      s.vetoes[pid] = s.vetoes[pid] === m.id ? null : m.id;
    } else if (m.t === 'start' && isHost && s.phase === 'veto') {
      const banned = new Set(Object.values(s.vetoes).filter(Boolean));
      let left = s.cands.filter((x) => !banned.has(x));
      if (left.length < 2) left = s.cands.slice(0, 2);
      shuffle(left);
      if (s.game === 'cup') { let n = 1; while (n * 2 <= left.length) n *= 2; left = left.slice(0, n); s.round = left; s.next = []; s.idx = 0; s.votes = {}; s.phase = 'cup'; }
      else { s.round = left; s.likes = {}; s.phase = 'swipe'; }
    } else if (m.t === 'vote' && s.phase === 'cup' && (m.k === 0 || m.k === 1)) {
      s.votes[pid] = m.k;
      const online = Object.keys(s.players).filter((p) => this.online(p));
      if (online.every((p) => p in s.votes)) this.settleMatch();
    } else if (m.t === 'settle' && isHost && s.phase === 'cup') {
      this.settleMatch();
    } else if (m.t === 'like' && s.phase === 'swipe' && s.round.includes(m.id)) {
      const L = new Set(s.likes[pid] || []);
      m.v ? L.add(m.id) : L.delete(m.id);
      s.likes[pid] = [...L];
      const online = Object.keys(s.players).filter((p) => this.online(p));
      if (online.length && online.every((p) => (s.likes[p] || []).includes(m.id))) { s.result = m.id; s.phase = 'done'; await this.save(); return this.broadcast({ match: m.id }); }
    } else if (m.t === 'endswipe' && isHost && s.phase === 'swipe') {
      const count = {};
      Object.values(s.likes).flat().forEach((x) => (count[x] = (count[x] || 0) + 1));
      s.result = Object.keys(count).sort((a, b) => count[b] - count[a])[0] || s.round[Math.floor(Math.random() * s.round.length)];
      s.phase = 'done';
    } else if (m.t === 'reset' && isHost) {
      Object.assign(s, { phase: 'lobby', cands: [], vetoes: {}, round: [], next: [], idx: 0, votes: {}, likes: {}, result: null });
    } else return;
    await this.save();
    this.broadcast();
  }
  online(pid) { return this.ctx.getWebSockets().some((ws) => ws.deserializeAttachment()?.pid === pid); }
  settleMatch() {
    const s = this.s;
    const v = Object.values(s.votes);
    const a = v.filter((x) => x === 0).length, b = v.length - a;
    const win = a > b ? 0 : b > a ? 1 : Math.random() < 0.5 ? 0 : 1;
    s.next.push(s.round[s.idx + win]);
    s.idx += 2; s.votes = {};
    if (s.idx >= s.round.length) {
      if (s.next.length === 1) { s.result = s.next[0]; s.phase = 'done'; return; }
      s.round = s.next; s.next = []; s.idx = 0;
    }
  }
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/* ================= leaderboard + push subscriptions ================= */
const weekOf = (day) => { const d = new Date(day + 'T12:00:00Z'); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return d.toISOString().slice(0, 10); };
export class Board extends DurableObject {
  async fetch(req) {
    const url = new URL(req.url);
    const st = this.ctx.storage;
    if (url.pathname === '/api/lb') {
      if (req.method === 'GET') {
        const w = weekOf(new Date().toISOString().slice(0, 10));
        const rows = (await st.get('w:' + w)) || {};
        const top = Object.values(rows).sort((a, b) => b.score - a.score).slice(0, 20).map(({ name, score, days }) => ({ name, score, days }));
        return json({ week: w, top, players: Object.keys(rows).length });
      }
      if (req.method === 'POST') {
        const b = await req.json().catch(() => ({}));
        const uid = clean(b.uid, 40), name = clean(b.name, 16), day = String(b.day || ''), score = Math.floor(+b.score);
        if (!/^[a-f0-9]{16,40}$/.test(uid) || !name || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !(score >= 0 && score <= 1200)) return json({ error: 'bad input' }, 400);
        const skew = Math.abs(Date.parse(day + 'T12:00:00Z') - Date.now());
        if (skew > 1.6 * 864e5) return json({ error: 'wrong day' }, 400);
        // light rate limit per IP per day
        const ip = req.headers.get('cf-connecting-ip') || 'x', rk = `rl:${day}:${ip}`;
        const n = ((await st.get(rk)) || 0) + 1;
        if (n > 30) return json({ error: 'slow down' }, 429);
        await st.put(rk, n);
        const w = weekOf(day), key = 'w:' + w;
        const rows = (await st.get(key)) || {};
        const r = rows[uid] || { name, score: 0, days: 0, seen: [] };
        r.name = name;
        if (!r.seen.includes(day)) { r.seen.push(day); r.score += score; r.days++; }
        rows[uid] = r;
        await st.put(key, rows);
        const rank = Object.values(rows).sort((a, b) => b.score - a.score).findIndex((x) => x === r) + 1;
        return json({ ok: true, rank, score: r.score, players: Object.keys(rows).length });
      }
    }
    if (url.pathname === '/api/push') {
      const subs = (await st.get('subs')) || {};
      if (req.method === 'GET') return json({ key: this.env.VAPID_PUBLIC || null });
      const b = await req.json().catch(() => ({}));
      const ep = String(b.endpoint || '');
      if (!/^https:\/\/[a-z0-9.-]+\/[\w\-./:%~+=]{8,600}$/i.test(ep)) return json({ error: 'bad endpoint' }, 400);
      const id = await sha(ep);
      if (req.method === 'DELETE') delete subs[id];
      else if (req.method === 'POST') {
        if (Object.keys(subs).length > 5000) return json({ error: 'full' }, 503);
        const tz = Math.max(-840, Math.min(840, Math.round(+b.tz || 0)));
        subs[id] = { ep, tz, hour: Math.max(0, Math.min(23, Math.round(+b.hour || 11))) };
      }
      await st.put('subs', subs);
      return json({ ok: true });
    }
    if (url.pathname === '/api/push/send' && req.method === 'POST' && !req.headers.get('cf-connecting-ip')) {
      const subs = (await st.get('subs')) || {};
      const nowMin = new Date().getUTCHours() * 60;
      let sent = 0, dead = 0;
      for (const [id, s] of Object.entries(subs)) {
        const local = (((nowMin - s.tz) % 1440) + 1440) % 1440; // tz = getTimezoneOffset() minutes
        if (Math.floor(local / 60) !== s.hour) continue;
        const r = await sendPush(s.ep, this.env).catch(() => null);
        if (r && (r.status === 404 || r.status === 410)) { delete subs[id]; dead++; } else sent++;
      }
      await st.put('subs', subs);
      return json({ sent, dead });
    }
    return json({ error: 'not found' }, 404);
  }
}
async function sha(s) { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join(''); }

/* payload-less Web Push: only a VAPID JWT (ES256) is needed, the service worker picks the text */
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
async function sendPush(endpoint, env) {
  if (!env.VAPID_PRIVATE_JWK || !env.VAPID_PUBLIC) return null;
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const aud = new URL(endpoint).origin;
  const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));
  const head = enc({ typ: 'JWT', alg: 'ES256' }), body = enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'https://angi.nhaajt.com' });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  const jwt = `${head}.${body}.${b64u(sig)}`;
  void unb64u;
  return fetch(endpoint, { method: 'POST', headers: { TTL: '3600', Urgency: 'normal', Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC}`, 'Content-Length': '0' } });
}
