// Pixel Slayer co-op relay server (Node.js + ws). Run: npm install && npm start
const http = require('http'), { WebSocketServer } = require('ws');
const srv = http.createServer((q, r) => { r.writeHead(200); r.end('Pixel Slayer server OK'); });
const wss = new WebSocketServer({ server: srv }), rooms = new Map();
let nid = 1;
const snd = (w, o) => w.readyState === 1 && w.send(JSON.stringify(o));
const code = () => { let c; do { c = Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.random() * 24 | 0]).join(''); } while (rooms.has(c)); return c; };
const info = r => r.m.forEach(m => snd(m.ws, { t: 'room', code: r.code, id: m.id, hostId: r.host, members: r.m.map(x => ({ id: x.id, name: x.name, ch: x.ch })) }));
function leave(me) {
  const r = me.room; if (!r) return; me.room = null; r.m = r.m.filter(x => x !== me);
  if (me.id === r.host) { r.m.forEach(x => { snd(x.ws, { t: 'closed' }); x.room = null; }); rooms.delete(r.code); }
  else if (r.m.length) info(r); else rooms.delete(r.code);
}
wss.on('connection', ws => {
  const me = { ws, id: String(nid++), name: 'Player', room: null };
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'create' || m.t === 'join') {
      leave(me); me.name = String(m.name || 'Player').replace(/\W/g, '').slice(0, 16) || 'Player';
      me.ch = String(m.ch || 'knight').replace(/\W/g, '').slice(0, 12) || 'knight';
      if (m.t === 'create') { const r = { code: code(), host: me.id, m: [me], started: false }; rooms.set(r.code, r); me.room = r; info(r); return; }
      const r = rooms.get(String(m.code || '').toUpperCase());
      if (!r) return snd(ws, { t: 'err', m: 'Room not found.' });
      if (r.started) return snd(ws, { t: 'err', m: 'That game already started.' });
      if (r.m.length >= 4) return snd(ws, { t: 'err', m: 'Room is full (4 players).' });
      r.m.push(me); me.room = r; info(r);
    } else if (m.t === 'r' && me.room && m.d) {
      const r = me.room, d = m.d;
      if (d.k === 'start' && me.id === r.host) r.started = true;
      const out = { t: 'from', from: me.id, d };
      if (m.to === 'a') r.m.forEach(x => x !== me && snd(x.ws, out));
      else if (m.to === 'h') { const h = r.m.find(x => x.id === r.host); if (h && h !== me) snd(h.ws, out); }
      else { const x = r.m.find(y => y.id === m.to); if (x) snd(x.ws, out); }
    }
  });
  ws.on('close', () => leave(me)); ws.on('error', () => {});
});
srv.listen(process.env.PORT || 8080, () => console.log('listening'));
