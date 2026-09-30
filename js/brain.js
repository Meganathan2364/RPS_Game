// The learning bot: several "experts" each predict the player's next move; a Thompson-sampling
// bandit picks which expert to trust per player. Nothing is pre-trained: it all starts uniform.
export const MOVES = ['stone', 'paper', 'scissors'];
export const counter = m => (m + 1) % 3;           // the move that beats m
export const EXPERTS = ['freq', 'markov1', 'markov2', 'reaction', 'global', 'twoStep'];
const uni = () => [1/3, 1/3, 1/3];
const norm = c => { const s = c[0] + c[1] + c[2]; return c.map(x => x / s); };
const argmax = d => { const m = Math.max(...d), ix = d.map((v,i) => v === m ? i : -1).filter(i => i >= 0); return ix[Math.random() * ix.length | 0]; };
const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());

// counts of "situation -> next player move", recent rounds weigh more; only pairs inside one match
function markov(h, keyOf, cur) {
  const n = h.length; if (!n || h[n-1].m !== cur) return uni();
  const kNow = keyOf(h, n - 1); if (kNow == null) return uni();
  const c = [.5, .5, .5];
  for (let i = 1; i < n; i++) if (h[i].m === h[i-1].m && keyOf(h, i - 1) === kNow) c[h[i].p] += Math.pow(.97, n - 1 - i);
  return norm(c);
}
const E = {
  freq:     h => { const c = [1,1,1], n = h.length; h.forEach((r,i) => c[r.p] += Math.pow(.9, n - 1 - i)); return norm(c); },
  markov1:  (h, cur) => markov(h, (h,i) => h[i].p, cur),                                   // after my last move
  markov2:  (h, cur) => markov(h, (h,i) => i > 0 && h[i-1].m === h[i].m ? h[i-1].p * 3 + h[i].p : null, cur), // after my last two
  reaction: (h, cur) => markov(h, (h,i) => h[i].p * 3 + h[i].b, cur),                      // after my move + the bot's move (win/lose habits)
  global:   (h, cur, G) => norm(G[h.length && h[h.length-1].m === cur ? h[h.length-1].p : 3]), // what everyone tends to do
  twoStep:  (h, cur) => { const d = E.markov1(h, cur), o = [0,0,0]; d.forEach((v,m) => o[(m + 2) % 3] = v); return o; } // player expects a counter and beats it
};

export function buildGlobal(db) {
  const G = [[1,1,1],[1,1,1],[1,1,1],[1,1,1]]; // rows: last move stone/paper/scissors, or 3 = first round of a match
  Object.values(db.players).forEach(P => P.rounds.forEach((r,i,a) => G[i > 0 && a[i-1].m === r.m ? a[i-1].p : 3][r.p]++));
  return G;
}

export function makeBrain(saved, G) {
  const B = saved || Object.fromEntries(EXPERTS.map(e => [e, { a: e === 'global' ? 2 : 1, b: 1 }])); // Beta(a,b) trust per expert
  return {
    B,
    decide(h, cur) {
      const dists = {}; EXPERTS.forEach(e => dists[e] = E[e](h, cur, G));
      let best = null, top = -1;
      EXPERTS.forEach(e => { const { a, b } = B[e], m = a / (a + b), sd = Math.sqrt(a * b / ((a + b) ** 2 * (a + b + 1))), x = m + sd * gauss(); if (x > top) { top = x; best = e; } });
      const d = dists[best], pred = argmax(d), explore = Math.random() < .08; // small random share keeps it unpredictable
      return { expert: best, dists, pred, conf: Math.max(...d), explore, move: explore ? Math.random() * 3 | 0 : counter(pred) };
    },
    learn(h, cur, rec, actual) {   // every expert is scored on every round, whichever one played
      EXPERTS.forEach(e => { const p = rec.dists[e][actual], x = B[e]; x.a = Math.max(1, x.a * .97 + p); x.b = Math.max(1, x.b * .97 + 1 - p); });
      G[h.length && h[h.length-1].m === cur ? h[h.length-1].p : 3][actual]++;
    }
  };
}
