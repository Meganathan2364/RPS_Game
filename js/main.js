import { makeHand, applyPose, POSE } from './hand3d.js';
import { makeSymbols } from './symbols.js';
import { tracker, startCamera, track, classify, avg } from './tracker.js';
import * as store from './storage.js';
import { makeBrain, buildGlobal } from './brain.js';

const $ = id => document.getElementById(id);
const NAMES = ['stone','paper','scissors'], BEATS = { stone:'scissors', paper:'stone', scissors:'paper' };
// defaults; the start screen lets you change points to win, beat speed and reaction window
let BEAT = 650, LOCK_BEFORE = 40, LOCK_AFTER = 200, WIN = 10;

/* ---- scene ---- */
const renderer = new THREE.WebGLRenderer({ canvas:$('c'), antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(45, 1, .1, 50);
scene.add(new THREE.HemisphereLight(0xffffff, 0x3040a0, .95));
const key = new THREE.DirectionalLight(0xffffff, .9); key.position.set(2,4,6); scene.add(key);
const you = makeHand(0xffd23f, false), bot = makeHand(0xff6a4d, true);
you.rotation.set(-.15,.45,.1); bot.rotation.set(-.15,-.45,-.1);
const sym = makeSymbols();
scene.add(you, bot, sym.group);
function resize() {
  const w = innerWidth, h = innerHeight, a = w / h;
  renderer.setSize(w, h, false); camera.aspect = a;
  camera.position.set(0, .3, a < 1 ? 13 : 8.5); camera.lookAt(0, -.1, 0); camera.updateProjectionMatrix();
  const x = a < 1 ? 1.6 : 2.6; you.position.x = -x; bot.position.x = x;
  sym.group.position.y = a < 1 ? -3.6 : -2.7; sym.group.scale.setScalar(a < 1 ? 1.5 : 1);
}
addEventListener('resize', resize); resize();

/* ---- input: camera gesture, keyboard, or clicking a 3D symbol ---- */
let manualG = null, manualUntil = 0, hoverKind = null, px = 0, py = 0;
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
function aim(e) {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); px = mouse.x; py = mouse.y;
  ray.setFromCamera(mouse, camera); hoverKind = $('ov').hidden ? sym.pick(ray) : null;
  $('c').style.cursor = hoverKind ? 'pointer' : 'default';
}
addEventListener('pointermove', aim);
addEventListener('pointerdown', e => { aim(e); if (hoverKind) { manualG = hoverKind; manualUntil = performance.now() + 450; } });
addEventListener('keydown', e => {
  const g = { r:'stone', p:'paper', s:'scissors' }[e.key.toLowerCase()];
  if (g) { manualG = g; manualUntil = performance.now() + 450; }
});
const currentGesture = now => now < manualUntil ? manualG : (tracker.on && now - tracker.seen < 300 ? classify(tracker.sm) : null);

/* ---- game state machine (timestamp based) ---- */
let phase = 'idle', t0 = 0, shootT = 0, botMove = 'stone', samples = [], ys = 0, bs = 0, lockedG = null;
const rounds = []; window.rounds = rounds;
let db, me, brain, matchId, hist = [], rec = null;

function updScore(w) {
  $('ys').textContent = ys; $('bs').textContent = bs;
  if (w) { const el = $(w === 'y' ? 'sy' : 'sb'); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
}
function begin() {
  me = ($('name').value.trim() || 'Guest').slice(0, 20); localStorage.setItem('rps.last', me);
  const num = (id, lo, hi, d) => Math.min(hi, Math.max(lo, +$(id).value || d));
  WIN = num('win', 1, 50, 10); BEAT = num('beat', 300, 1500, 650); LOCK_AFTER = num('lock', 100, 600, 200);
  localStorage.setItem('rps.cfg', JSON.stringify([WIN, BEAT, LOCK_AFTER]));
  document.querySelectorAll('.score small').forEach(s => s.textContent = '/' + WIN);
  db = store.load(); const P = store.player(db, me); brain = makeBrain(P.bandit, buildGlobal(db)); hist = P.rounds; matchId = Date.now();
  $('ov').hidden = true; ys = bs = 0; $('hist').innerHTML = ''; rounds.length = 0; updScore(); nextRound(); }
function nextRound() {
  rec = brain.decide(hist, matchId); botMove = NAMES[rec.move]; // bot commits before it can see you
  t0 = performance.now() + 900; shootT = t0 + 3 * BEAT; samples = []; lockedG = null; phase = 'count'; $('msg').textContent = '';
}
function resolve() {
  const votes = {};
  samples.filter(s => s.g && s.t >= shootT - LOCK_BEFORE && s.t <= shootT + LOCK_AFTER).forEach(s => votes[s.g] = (votes[s.g] || 0) + 1);
  const top = Object.entries(votes).sort((a,b) => b[1] - a[1])[0];
  phase = 'reveal';
  if (!top || top[1] < 3) { $('msg').textContent = "Didn't catch your hand. Replaying the round."; setTimeout(nextRound, 1800); return; }
  lockedG = top[0]; let out = 'tie';
  if (BEATS[lockedG] === botMove) { out = 'win'; ys++; updScore('y'); }
  else if (BEATS[botMove] === lockedG) { out = 'loss'; bs++; updScore('b'); }
  const pi = NAMES.indexOf(lockedG); // learn right now, save right now
  const row = { m:matchId, n:rounds.length + 1, p:pi, b:NAMES.indexOf(botMove), res:out, pred:rec.pred, conf:+rec.conf.toFixed(2), expert:rec.expert, hit:rec.pred === pi ? 1 : 0, rnd:rec.explore ? 1 : 0, t:Date.now() };
  brain.learn(hist, matchId, rec, pi); hist.push(row); store.player(db, me).bandit = brain.B; store.save(db);
  $('msg').textContent = { win:'You win this round', loss:'Bot wins this round', tie:'Tie, nobody scores' }[out] + ` (${lockedG} vs ${botMove})`;
  const dot = document.createElement('i'); dot.className = out === 'win' ? 'w' : out === 'loss' ? 'l' : ''; $('hist').append(dot);
  if ($('hist').children.length > 14) $('hist').firstChild.remove();
  rounds.push({ n:rounds.length + 1, player:lockedG, bot:botMove, result:out, scoreBefore:[ys - (out === 'win'), bs - (out === 'loss')], trackMs:Math.round(avg(tracker.lat)) });
  const revealDelay = ys >= WIN || bs >= WIN ? 2200 : 1800;
  setTimeout(ys >= WIN || bs >= WIN ? over : nextRound, revealDelay);
}
function over() {
  db.matches.push({ m:matchId, name:me, ys, bs, rounds:rounds.length, t:Date.now() }); store.save(db);
  phase = 'idle'; $('cd').textContent = ''; $('msg').textContent = '';
  $('ov').querySelector('h1').textContent = ys >= WIN ? 'You beat the bot' : 'The bot got to 10';
  $('ovp').textContent = `Final score ${ys} to ${bs}. Every round is saved. Open the dashboard to see how the bot read you.`;
  $('bcam').textContent = 'Play again'; $('bcam').onclick = begin; $('bkey').style.display = 'none'; $('ov').hidden = false;
}

/* ---- main loop ---- */
const labs = [...document.querySelectorAll('.lab')], tmp = new THREE.Vector3();
const cur = [1,1,1,1,1], bcur = [1,1,1,1,1]; let wasVis = false;
function frame(now) {
  requestAnimationFrame(frame);
  track(now);
  const g = currentGesture(now); let bobY = 0;
  if (phase === 'count') {
    const el = now - t0;
    if (now < t0) { $('cd').textContent = 'Ready'; $('cd').className = ''; }
    else if (now < shootT) {
      $('cd').textContent = 3 - Math.floor(el / BEAT); $('cd').className = '';
      bobY = .45 * Math.abs(Math.sin((el % BEAT) / BEAT * Math.PI)); // both hands bounce on the beat
    } else {
      $('cd').textContent = 'Shoot!'; $('cd').className = 'shoot';
      samples.push({ t:now, g });
      if (now >= shootT + LOCK_AFTER + 20) resolve();
    }
  }
  const wantY = phase === 'reveal' && lockedG ? POSE[lockedG] : (g && now < manualUntil ? POSE[g] : (tracker.on ? tracker.sm : POSE.stone));
  const wantB = phase === 'reveal' && lockedG ? POSE[botMove] : POSE.stone; // bot stays a fist until the lock window closes
  // keyboard/mouse mode: no hands until the reveal, then both appear already showing their sign
  const vis = tracker.on || (phase === 'reveal' && lockedG);
  if (vis && !wasVis && !tracker.on) { cur.splice(0, 5, ...wantY); bcur.splice(0, 5, ...wantB); }
  wasVis = vis; you.visible = bot.visible = vis;
  for (let i = 0; i < 5; i++) { cur[i] += (wantY[i] - cur[i]) * .4; bcur[i] += (wantB[i] - bcur[i]) * .45; }
  applyPose(you, cur); applyPose(bot, bcur);
  const idle = Math.sin(now / 600) * .05;
  you.position.y = bot.position.y = -.3 + bobY + idle;
  const reveal = phase === 'reveal' && lockedG;
  sym.update(now, hoverKind, reveal ? lockedG : g, reveal ? botMove : null);
  $('hud').textContent = tracker.on ? `tracking ${avg(tracker.lat).toFixed(0)} ms · seeing ${g || 'no hand'}` : 'click a symbol or press R, P, S';
  camera.position.x += (px * .7 - camera.position.x) * .05; camera.position.y += (.3 + py * .35 - camera.position.y) * .05; camera.lookAt(0, -.1, 0); // scene follows the mouse
  camera.updateMatrixWorld();
  labs.forEach(el => { const s = sym.group.scale.x; tmp.set({ stone:-1.7, paper:0, scissors:1.7 }[el.dataset.k] * s, sym.group.position.y - .95 * s, 0).project(camera);
    el.style.left = (tmp.x * .5 + .5) * innerWidth + 'px'; el.style.top = (-tmp.y * .5 + .5) * innerHeight + 'px';
    el.classList.toggle('on', el.dataset.k === hoverKind || el.dataset.k === (reveal ? lockedG : g)); });
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

$('newplayer').onclick = () => {
  $('name').value = '';
  localStorage.removeItem('rps.last');
  $('name').focus();
};
$('bcam').onclick = async () => {
  $('ovp').textContent = 'Loading hand tracking…';
  try { await startCamera($('cam')); begin(); }
  catch (e) { console.error(e); $('ovp').textContent = 'Camera or tracking could not start (' + (e.message || e) + '). Serve this folder over http://localhost and allow the camera, or play with the mouse or keyboard.'; }
};
$('bkey').onclick = begin;
$('name').value = localStorage.getItem('rps.last') || '';
try { const c = JSON.parse(localStorage.getItem('rps.cfg')); if (c) { $('win').value = c[0]; $('beat').value = c[1]; $('lock').value = c[2]; } } catch {}
