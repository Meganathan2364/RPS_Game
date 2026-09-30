// Three interactive 3D tokens: rock, paper sheet, scissors. Hover = spin + grow, glow = detected / bot pick.
const T = THREE;

function rock() {
  const geo = new T.IcosahedronGeometry(.5, 1), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + (Math.abs(Math.sin(x*12.9 + y*78.2 + z*37.7) * 43758.5) % 1) * .16; // same point = same jitter, no cracks
    p.setXYZ(i, x*k, y*k*.85, z*k);
  }
  geo.computeVertexNormals();
  return new T.Mesh(geo, new T.MeshStandardMaterial({ color:0xa3a9c4, roughness:.95, flatShading:true }));
}
function sheet() {
  const geo = new T.PlaneGeometry(.85, 1.1, 10, 10), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i)*4) * .07 + p.getY(i) * p.getY(i) * .1);
  geo.computeVertexNormals();
  return new T.Mesh(geo, new T.MeshStandardMaterial({ color:0xf7f5ee, roughness:.7, side:T.DoubleSide }));
}
function scissors() {
  const g = new T.Group(), steel = new T.MeshStandardMaterial({ color:0xd7dbe8, metalness:.6, roughness:.3 });
  const grip = new T.MeshStandardMaterial({ color:0xff6a4d, roughness:.5 }), blades = [];
  [1, -1].forEach(s => {
    const pv = new T.Group(), b = new T.Mesh(new T.BoxGeometry(.09,.85,.03), steel); b.position.y = .4;
    const h = new T.Mesh(new T.TorusGeometry(.14,.035,8,20), grip); h.position.set(-s*.06, -.3, 0);
    pv.add(b, h); pv.userData.s = s; g.add(pv); blades.push(pv);
  });
  g.userData.blades = blades; g.scale.setScalar(.8);
  return g;
}

export function makeSymbols() {
  const group = new T.Group(), items = {};
  [['stone', rock(), -1.7], ['paper', sheet(), 0], ['scissors', scissors(), 1.7]].forEach(([kind, obj, x]) => {
    const holder = new T.Group(); holder.position.x = x; holder.add(obj); group.add(holder);
    const mats = []; obj.traverse(o => { if (o.material) mats.push(o.material); o.userData.kind = kind; });
    items[kind] = { holder, obj, mats, hover:0, glow:0, base:1 };
  });

  function pick(ray) {
    const hit = ray.intersectObjects(group.children, true)[0];
    return hit ? hit.object.userData.kind : null;
  }

  // hoverKind: pointed at; activeKind: detected/locked player gesture; botKind: bot's revealed pick
  function update(now, hoverKind, activeKind, botKind) {
    for (const [kind, it] of Object.entries(items)) {
      it.hover += ((kind === hoverKind ? 1 : 0) - it.hover) * .15;
      const target = 1 + it.hover * .25 + (kind === botKind ? .3 : 0) + (kind === activeKind ? .12 : 0);
      it.base += (target - it.base) * .15;
      it.holder.scale.setScalar(it.base);
      it.holder.position.y = Math.sin(now/700 + it.holder.position.x) * .06;
      it.obj.rotation.y += .008 + it.hover * .05;
      if (kind === 'stone') it.obj.rotation.x += .004 + it.hover * .03;
      if (kind === 'paper') it.obj.rotation.x = Math.sin(now/900) * .15;
      if (kind === 'scissors') { // blades snip faster on hover
        const open = .28 + Math.sin(now/(240 - it.hover*120)) * (.05 + it.hover * .16);
        it.obj.userData.blades.forEach(b => b.rotation.z = b.userData.s * open);
      }
      const isBot = kind === botKind, isYou = kind === activeKind;
      it.glow += ((isBot ? .9 : isYou ? .7 : 0) - it.glow) * .2;
      it.mats.forEach(m => { m.emissive.setHex(isBot ? 0xff6a4d : 0xffd23f); m.emissiveIntensity = it.glow; });
    }
  }
  return { group, pick, update };
}
