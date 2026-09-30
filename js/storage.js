// Everything is saved in this browser's localStorage. One row per round, written immediately.
const KEY = 'rps.v1';
export const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { players:{}, matches:[] }; } catch { return { players:{}, matches:[] }; } };
export const save = db => localStorage.setItem(KEY, JSON.stringify(db));
export const player = (db, name) => db.players[name] || (db.players[name] = { created:Date.now(), rounds:[], bandit:null });
export const clearAll = () => localStorage.removeItem(KEY);
