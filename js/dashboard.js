import * as store from './storage.js';
import { MOVES, EXPERTS } from './brain.js';
const $ = s => document.querySelector(s), db = store.load(), names = Object.keys(db.players);
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
const pct = x => Math.round(x * 100) + '%', mean = a => a.length ? a.reduce((x,y) => x + y, 0) / a.length : 0;
$('#who').innerHTML = '<option value="*">All players</option>' + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
$('#who').onchange = draw;
$('#clr').onclick = () => { if (confirm('Delete every saved round and match?')) { store.clearAll(); location.reload(); } };
$('#exp').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 1)], { type:'application/json' })); a.download = 'rps-data.json'; a.click(); };

function line(v, note) {
  if (v.length < 2) return '<p class="muted">Not enough data yet.</p>';
  const W = 560, H = 170, p = 26, x = i => p + i * (W - 2*p) / (v.length - 1), y = t => H - p - t * (H - 2*p);
  const pts = v.map((t,i) => `${x(i).toFixed(1)},${y(t).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}"><line class="base" x1="${p}" x2="${W-p}" y1="${y(1/3)}" y2="${y(1/3)}"/><line class="half" x1="${p}" x2="${W-p}" y1="${y(.5)}" y2="${y(.5)}"/>
  <text x="${p}" y="${y(1/3) + 12}">33% = a random bot</text><text x="${p}" y="${y(.5) - 4}">50%</text><polyline class="ln" points="${pts}"/></svg><p class="muted">${note}</p>`;
}
const bars = (items, cls = '') => items.map(([l, v]) => `<div class="bar ${cls}"><span>${l}</span><i style="width:${Math.max(2, v * 100)}%"></i><span>${pct(v)}</span></div>`).join('');

function draw() {
  const who = $('#who').value, out = $('#out');
  const rows = (who === '*' ? names.flatMap(n => db.players[n].rounds) : (db.players[who] ? db.players[who].rounds : [])).slice().sort((a,b) => a.t - b.t);
  const matches = db.matches.filter(m => who === '*' || m.name === who);
  if (!rows.length) { out.innerHTML = '<section class="wide"><h2>No rounds yet</h2><p class="muted">Play a match, then come back. Every round is saved as it happens.</p></section>'; return; }
  const n = rows.length, botWins = rows.map(r => r.res === 'loss' ? 1 : 0);
  const roll = botWins.map((_, i) => mean(botWins.slice(Math.max(0, i - 9), i + 1)));
  const perMatch = [...new Set(rows.map(r => r.m))].map(m => mean(rows.filter(r => r.m === m).map(r => r.res === 'loss' ? 1 : 0)));

  const dist = [0,1,2].map(m => [MOVES[m], rows.filter(r => r.p === m).length / n]);
  const T = [0,1,2].map(() => [0,0,0]);
  rows.forEach((r,i) => { const q = rows[i-1]; if (q && q.m === r.m) T[q.p][r.p]++; });
  const heat = T.map((row, i) => { const s = row[0] + row[1] + row[2];
    return `<tr><td class="h">after ${MOVES[i]}</td>${row.map(c => `<td style="background:rgba(255,210,63,${s ? .15 + .75 * c / s : 0})">${s ? pct(c / s) : '-'}</td>`).join('')}</tr>`; }).join('');

  const habit = ['win', 'loss', 'tie'].map(k => {
    const xs = rows.filter((r,i) => r.res === k && rows[i+1] && rows[i+1].m === r.m).map(r => rows[rows.indexOf(r) + 1]);
    const src = rows.filter((r,i) => r.res === k && rows[i+1] && rows[i+1].m === r.m);
    const stay = mean(src.map((r,i) => xs[i].p === r.p ? 1 : 0)), beat = mean(src.map((r,i) => xs[i].p === (r.b + 1) % 3 ? 1 : 0));
    return `<tr><td>after you ${k === 'win' ? 'win' : k === 'loss' ? 'lose' : 'tie'}</td><td>${src.length ? pct(stay) : '-'}</td><td>${src.length ? pct(beat) : '-'}</td><td>${src.length}</td></tr>`;
  }).join('');

  const bandits = (who === '*' ? names.map(x => db.players[x].bandit) : [db.players[who] && db.players[who].bandit]).filter(Boolean);
  const trust = EXPERTS.map(e => [e, mean(bandits.map(b => b[e].a / (b[e].a + b[e].b)))]);
  const names_ = { freq:'recent habit', markov1:'last move', markov2:'last two moves', reaction:'reacts to result', global:'all players', twoStep:'outsmarts bot' };
  const used = EXPERTS.map(e => [names_[e], rows.filter(r => r.expert === e).length / n]);

  out.innerHTML = `
  <section class="wide"><div class="tiles">
    <div><b>${n}</b><span>rounds</span></div><div><b>${matches.length}</b><span>matches</span></div>
    <div><b>${pct(mean(botWins))}</b><span>bot wins (random bot: 33%)</span></div>
    <div><b>${pct(mean(rows.map(r => r.res === 'win' ? 1 : 0)))}</b><span>you win</span></div>
    <div><b>${pct(mean(rows.map(r => r.hit)))}</b><span>bot guessed your move (chance: 33%)</span></div></div></section>
  <section class="wide"><h2>Bot win rate over the last 10 rounds</h2>${line(roll, 'Above the 33% line means the bot is reading this player.')}</section>
  <section><h2>Bot win rate per match</h2>${line(perMatch, 'One point per match, oldest to newest. Rising means it improves across games.')}</section>
  <section><h2>What you play</h2>${bars(dist)}</section>
  <section><h2>Your next move, given your last</h2><table class="heat"><tr><th></th>${MOVES.map(m => `<th>${m}</th>`).join('')}</tr>${heat}</table></section>
  <section><h2>Your habits after each result</h2><table><tr><th></th><th>repeat</th><th>beat bot's last</th><th>times</th></tr>${habit}</table></section>
  <section><h2>Which prediction the bot trusts</h2>${bars(trust.map(([e, v]) => [names_[e], v]), 'c')}<p class="muted">Each bar is how often that method guessed right. The bot leans on the best one.</p></section>
  <section><h2>Which one it actually played</h2>${bars(used, 'c')}</section>
  <section class="wide"><h2>Matches</h2><table><tr><th>when</th><th>player</th><th>you - bot</th><th>rounds</th><th>bot wins</th></tr>
  ${matches.slice().reverse().map(m => `<tr><td>${new Date(m.t).toLocaleString()}</td><td>${esc(m.name)}</td><td>${m.ys} - ${m.bs}</td><td>${m.rounds}</td><td>${pct(mean(rows.filter(r => r.m === m.m).map(r => r.res === 'loss' ? 1 : 0)))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No finished matches yet.</td></tr>'}</table></section>`;
}
draw();
