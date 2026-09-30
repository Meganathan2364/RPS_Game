// Procedural 3D hand: spheres + cylinders, no model files. Poses are 5 curl values (0 open, 1 closed).
const T = THREE;
export const POSE = { stone:[1,1,1,1,1], paper:[0,0,0,0,0], scissors:[.9,0,0,1,1] }; // thumb,index,middle,ring,pinky

function finger(len, r, m) {
  const root = new T.Group(), joints = [];
  let parent = root, prev = 0;
  [.42,.33,.25].forEach((f, i) => {
    const l = len * f, j = new T.Group();
    j.position.y = prev; parent.add(j);
    j.add(new T.Mesh(new T.SphereGeometry(r*1.05,16,12), m));
    const c = new T.Mesh(new T.CylinderGeometry(r*.92, r, l, 16), m); c.position.y = l/2; j.add(c);
    if (i === 2) { const t = new T.Mesh(new T.SphereGeometry(r*.92,16,12), m); t.position.y = l; j.add(t); }
    joints.push(j); parent = j; prev = l;
  });
  return { root, joints };
}

export function makeHand(color, flip) {
  const g = new T.Group(), m = new T.MeshStandardMaterial({ color, roughness:.45 }), f = [];
  g.add(new T.Mesh(new T.BoxGeometry(1.1,1.2,.42), m));
  const heel = new T.Mesh(new T.SphereGeometry(.55,24,16), m);
  heel.scale.set(1,.8,.45); heel.position.y = -.55; g.add(heel);
  const th = finger(.62,.13,m), pv = new T.Group();
  pv.position.set(-.55,-.2,0); pv.add(th.root); g.add(pv); th.pivot = pv; f.push(th);
  [[-.4,.6,.6,.11],[-.13,.6,.68,.115],[.13,.6,.6,.11],[.4,.6,.48,.095]].forEach(([x,y,l,r]) => {
    const s = finger(l,r,m); s.root.position.set(x,y,0); g.add(s.root); f.push(s);
  });
  const w = new T.Group(); w.add(g); w.userData.fingers = f;
  if (flip) w.scale.x = -1;
  return w;
}

export function applyPose(h, c) {
  const F = h.userData.fingers;
  F[0].pivot.rotation.z = .3 + .75 * (1 - c[0]);
  F[0].joints.forEach((j,i) => j.rotation.x = c[0] * [.6,.9,.8][i]);
  for (let k = 1; k < 5; k++) F[k].joints.forEach((j,i) => j.rotation.x = c[k] * [1.45,1.6,1.15][i]);
}
