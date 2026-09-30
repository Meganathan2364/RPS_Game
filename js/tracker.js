// MediaPipe Hand Landmarker -> five smoothed finger curls -> stone / paper / scissors.
export const tracker = { on:false, sm:[1,1,1,1,1], lat:[], seen:0, lm:null, lastVT:-1, video:null };
const d = (a,b) => Math.hypot(a.x-b.x, a.y-b.y, (a.z-b.z)*.5);
const clamp = x => Math.max(0, Math.min(1, x));
export const avg = a => a.length ? a.reduce((x,y) => x+y, 0) / a.length : 0;

export async function startCamera(video) {
  tracker.video = video;
  const stream = await navigator.mediaDevices.getUserMedia({ video:{ width:640, height:480, facingMode:'user' } });
  video.srcObject = stream; await video.play(); video.style.display = 'block';
  const V = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
  const { FilesetResolver, HandLandmarker } = await import(V + '/vision_bundle.mjs');
  const fs = await FilesetResolver.forVisionTasks(V + '/wasm');
  tracker.lm = await HandLandmarker.createFromOptions(fs, {
    baseOptions:{ modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task', delegate:'GPU' },
    runningMode:'VIDEO', numHands:1
  });
  tracker.on = true;
}

export function track(now) {
  const v = tracker.video;
  if (!tracker.on || v.readyState < 2 || v.currentTime === tracker.lastVT) return;
  tracker.lastVT = v.currentTime;
  const t0 = performance.now(), r = tracker.lm.detectForVideo(v, t0);
  tracker.lat.push(performance.now() - t0); if (tracker.lat.length > 40) tracker.lat.shift();
  const L = r.landmarks && r.landmarks[0]; if (!L) return;
  tracker.seen = now; const w = L[0];
  const raw = [clamp((1 - d(L[4],L[9]) / d(w,L[9])) / .5)];
  [[5,8],[9,12],[13,16],[17,20]].forEach(([m,t]) => raw.push(clamp((1.85 - d(L[t],w) / d(L[m],w)) / .75)));
  raw.forEach((x,i) => tracker.sm[i] += (x - tracker.sm[i]) * .55); // light smoothing, low lag
}

export function classify(c) {
  const e = c.slice(1).map(v => v < .45), n = e.filter(Boolean).length;
  if (e[0] && e[1] && !e[2] && !e[3]) return 'scissors';
  if (n >= 3) return 'paper';
  if (n <= 1 && !(e[0] && e[1])) return 'stone';
  return null;
}
