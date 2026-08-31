// Integration test harness — simulates browser env with mocks, runs engine logic.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- Mock localStorage ----------
const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; },
};

// ---------- Mock fetch: read from data/ ----------
const fetchCache = {};
globalThis.fetch = async (url) => {
  if (fetchCache[url]) return fetchCache[url];
  const file = path.join(ROOT, url.replace(/^\//, ''));
  if (!fs.existsSync(file)) throw new Error('Not found: ' + url);
  const text = fs.readFileSync(file, 'utf8');
  return { ok: true, json: async () => JSON.parse(text) };
};

// ---------- Mocks of DOM needed by engine ----------
function makeEl() {
  const ctxMock = {
    clearRect: () => {}, drawImage: () => {}, fillRect: () => {}, set fillStyle(v) {}, get fillStyle() { return ''; },
  };
  return {
    style: {}, dataset: {}, classList: {
      add: () => {}, remove: () => {}, toggle: () => {},
      contains: () => false,
    },
    querySelector: () => makeEl(),
    querySelectorAll: () => [makeEl()],
    addEventListener: () => {},
    appendChild: () => {}, removeChild: () => {},
    getContext: () => ctxMock,
    width: 978, height: 660,
    set innerHTML(v) {}, get innerHTML() { return ''; },
    set textContent(v) {}, get textContent() { return ''; },
    set src(v) {}, get src() { return ''; },
  };
}
const elCache = {};
globalThis.document = {
  querySelector: (sel) => { if (!elCache[sel]) elCache[sel] = makeEl(); return elCache[sel]; },
  querySelectorAll: () => [],
  createElement: () => makeEl(),
  getElementById: () => makeEl(),
  body: makeEl(),
};
globalThis.Image = class { set src(v) {} };
globalThis.alert = () => {};
globalThis.confirm = () => true;

// ---------- Import engine modules ----------
const S = await import('file://' + path.join(ROOT, 'engine/state.js'));
const dataMod = await import('file://' + path.join(ROOT, 'engine/data.js'));
const Scenes = await import('file://' + path.join(ROOT, 'engine/scenes.js'));
const Game = await import('file://' + path.join(ROOT, 'engine/game.js'));
let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  PASS: ' + msg); }
  else { fail++; console.log('  FAIL: ' + msg); }
}

// ---------- Test 1: state basics ----------
console.log('\n[1] State / economy / variables');
S.resetState();
S.applyEffects({ pa: '+5', golds: '-3' });
assert(S.getState().economy.pa === 25, 'pa starts 20 +5 = 25 (got ' + S.getState().economy.pa + ')');
assert(S.getState().economy.golds === 32, 'golds starts 35 -3 = 32 (got ' + S.getState().economy.golds + ')');
S.applyEffects({ pa: '+100', golds: '+5', chinomimi_love: '+3' });
assert(S.getState().economy.pa === 125, 'pa +100 -> 125');
assert(S.getState().relationships.chinomimi === 3, 'chinomimi_love +3 = 3 (key=chinomimi)');
S.applyEffects({ item: '1' });
assert(S.getState().inventory.includes('1'), 'item added to inventory');
assert(S.evaluateCondition({ var: 'x', op: '==', value: undefined }) === true, 'unset var == undefined true (treat as unset)');

// ---------- Test 2: episode data integrity ----------
console.log('\n[2] Episode data integrity');
const index = await dataMod.loadGameIndex();
assert(index.episodes.length >= 1, 'at least 1 episode defined');
const ep = index.episodes[0];
const { data } = await dataMod.loadEpisode(ep.id);
assert(data.storyline.length > 40, 'storyline has many entries (got ' + data.storyline.length + ')');

// validate ids unique
const ids = data.storyline.map(e => String(e.id));
assert(new Set(ids).size === ids.length, 'all storyline ids unique');

// validate every goto target exists
let missingGoto = 0;
const missingList = new Set();
const checkTarget = (t) => {
  if (t !== undefined && t !== null && !ids.includes(String(t))) { missingGoto++; missingList.add(String(t)); }
};
for (const entry of data.storyline) {
  let respMap = entry.responses;
  if (Array.isArray(respMap)) {
    for (const r of respMap) {
      if (r && typeof r === 'object' && r.goto) { checkTarget(r.goto); continue; }
      for (const v of Object.values(r || {})) if (typeof v === 'string') checkTarget(v);
    }
  } else if (respMap && typeof respMap === 'object') {
    for (const v of Object.values(respMap)) if (typeof v === 'string') checkTarget(v);
  }
  if (entry.moves) for (const m of entry.moves) checkTarget(m && m.goto);
  if (entry.auto) checkTarget(entry.auto);
}
if (missingGoto) console.log('  DEBUG missing targets:', JSON.stringify([...missingList]));
assert(missingGoto === 0, 'all goto targets resolvable (missing=' + missingGoto + ')');

// validate actor emotions reference existing sprite files OR the map handles base
const chars = await dataMod.loadCharacters();
for (const [actorId, actor] of Object.entries(data.actors)) {
  assert(chars[actorId], 'actor ' + actorId + ' defined in characters.json');
  const charPath = chars[actorId].sprites.base;
  assert(fs.existsSync(path.join(ROOT, charPath)), 'base sprite exists for ' + actorId);
  for (const [emo, file] of Object.entries(actor.emotions)) {
    const full = charPath.substring(0, charPath.lastIndexOf('/') + 1) + file;
    assert(fs.existsSync(path.join(ROOT, full)), 'emotion sprite ' + emo + ' exists for ' + actorId);
  }
}

// validate item images
const items = await dataMod.loadItems();
for (const [id, item] of Object.entries(items)) {
  assert(fs.existsSync(path.join(ROOT, item.image)), 'item image exists for ' + id);
}
// confirm the item referenced in scene exists
let itemRefs = 0;
for (const e of data.storyline) {
  if (e.type === 'pickup' || (e.items)) {
    const refs = e.type === 'pickup' ? [e.item] : e.items.map(i => String(i.item));
    for (const r of refs) { if (!items[String(r)]) itemRefs++; }
  }
}
assert(itemRefs === 0, 'all scene item refs exist in items.json');

// ---------- Test 3: scene graph walk simulation ----------
console.log('\n[3] Simulation of playable flow');
S.resetState();
S.getState().profile.playerName = 'Test';
S.saveState();
await Game.startEpisode('ep-00');

// The engine's renderEntry dispatches on entry.type. Simulate choices.
function simChoice(entry, idx) {
  let list = entry.responses;
  if (Array.isArray(list) && list.length && !('goto' in list[0])) {
    list = Object.entries(list[0]).map(([text, meta]) => (typeof meta === 'string' ? { text, goto: meta } : { text, ...meta }));
  }
  if (!Array.isArray(list)) { list = Object.entries(list).map(([text, meta]) => (typeof meta === 'string' ? { text, goto: meta } : { text, ...meta })); }
  return list[idx] || list[0];
}

// walk: start at 0, follow non-branching auto path with defaults, cap loops
let cur = '0';
let steps = 0;
const maxSteps = 300;
const visited = {};
let stuck = null;
while (steps < maxSteps) {
  const entry = Scenes.getEntry(cur);
  if (!entry) { stuck = 'missing ' + cur; break; }
  if (entry.type === 'end-episode') { doneCtrl: { stuck = null; } break; }
  if (visited[cur] > 5) { stuck = 'loop at ' + cur; break; }
  visited[cur] = (visited[cur] || 0) + 1;

  if (entry.type === 'dialog' || entry.type === 'dialog-end') {
    const c = simChoice(entry, 0);
    S.applyEffects(c.set);
    S.saveState();
    cur = String(c.goto);
  } else if (entry.type === 'move') {
    // take first non-required move; if required and not owned, still follow (simulation picks 0)
    cur = String(entry.moves[0].goto);
  } else if (entry.type === 'pickup') {
    cur = String(entry.auto || (Number(cur) + 1));
  } else {
    // bubble/objective -> advance to next numeric id
    cur = String(Number(cur) + 1);
  }
  steps++;
}
assert(!stuck, 'completed main flow without infinite loop / dead end (stuck=' + stuck + ', steps=' + steps + ')');

// After main flow, some economy effects applied (e.g., +100 PA at end)
console.log('  Final economy: pa=' + S.getState().economy.pa + ' golds=' + S.getState().economy.golds + ' love=' + JSON.stringify(S.getState().relationships));

// ---------- Test 4: branching / conditions ----------
console.log('\n[4] Branching via variables');
// Choice at id 14 (Sim/Não) changes chinomimi_love differently; verify both paths lead back to valid ids.
const e14 = Scenes.getEntry('14');
const opts = e14.responses;
console.log('  [14] responses:', JSON.stringify(opts));
assert(opts.length === 2, 'id 14 has exactly 2 choices');
const loopTarget = opts.find(o => o.set && o.set['chinomimi_love'] === '-1');
assert(loopTarget && loopTarget.goto, 'negative-love choice repeats tutorial (target ' + (loopTarget && loopTarget.goto) + ')');

// ---------- Test 5: save export/import round trip ----------
console.log('\n[5] Save export/import');
const json = S.exportSave();
assert(typeof json === 'string' && json.length > 0, 'can export save');
assert(S.importSave(json) === true, 'can import same save');
assert(S.getState().profile.playerName === 'Test', 'import preserves playerName');

console.log('\n=== RESULTADO: ' + pass + ' passou, ' + fail + ' falhou ===');
process.exit(fail ? 1 : 0);
