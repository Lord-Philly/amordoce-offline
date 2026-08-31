const STORAGE_KEY = 'amordoce_offline_save';
const DEFAULT_STATE = {
  schema: 1,
  profile: {
    playerName: 'Alice',
    avatar: []
  },
  progress: {
    currentEpisode: null,
    currentSceneId: null,
    currentPlace: null
  },
  variables: {},
  inventory: [],
  economy: {
    pa: 20,
    paLastGain: null,
    golds: 35
  },
  relationships: {},
  wardrobe: {
    owned: [],
    equipped: []
  },
  seenDialogues: [],
  objectives: {
    current: [],
    completed: []
  },
  history: []
};

let state = loadState();

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { return clone(DEFAULT_STATE); }
    const parsed = JSON.parse(raw);
    return mergeDeep(clone(DEFAULT_STATE), parsed);
  } catch (e) {
    return clone(DEFAULT_STATE);
  }
}

function mergeDeep(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return override !== undefined ? override : base;
  }
  const out = { ...base };
  for (const k of Object.keys(override || {})) {
    if (override[k] !== undefined) {
      if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        out[k] = mergeDeep(base[k], override[k]);
      } else {
        out[k] = override[k];
      }
    }
  }
  return out;
}

export function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  state = clone(DEFAULT_STATE);
  saveState();
  return state;
}

export function getState() {
  return state;
}

export function getVar(name) {
  return state.variables[name];
}

export function setVar(name, value) {
  state.variables[name] = value;
  return value;
}

function applyDelta(current, delta) {
  if (typeof delta === 'string') {
    const op = delta[0];
    const rest = delta.slice(1);
    if (op === '+') { return (Number(current) || 0) + Number(rest); }
    if (op === '-') { return (Number(current) || 0) - Number(rest); }
    if (op === '=') { return Number(rest); }
    return delta;
  }
  return delta;
}

export function applyEffects(effects) {
  if (!effects) return;
  for (const [key, value] of Object.entries(effects)) {
    if (key === 'pa') {
      state.economy.pa = Math.max(0, applyDelta(state.economy.pa, value));
    } else if (key === 'golds' || key === 'gold') {
      state.economy.golds = Math.max(0, applyDelta(state.economy.golds, value));
    } else if (key.endsWith('_love')) {
      const charId = key.replace('_love', '');
      state.relationships[charId] = applyDelta(state.relationships[charId] || 0, value);
    } else if (key === 'item') {
      const ids = Array.isArray(value) ? value : [value];
      for (const id of ids) {
        if (!state.inventory.includes(id)) { state.inventory.push(id); }
      }
    } else if (key === 'removeItem') {
      const ids = Array.isArray(value) ? value : [value];
      state.inventory = state.inventory.filter(i => !ids.includes(i));
    } else {
      state.variables[key] = applyDelta(state.variables[key], value);
    }
  }
}

export function evaluateCondition(condition) {
  if (!condition) return true;
  const { var: varName, op = '==', value } = condition;
  const current = state.variables[varName];
  switch (op) {
    case '==': return current == value;
    case '!=': return current != value;
    case '>': return Number(current) > Number(value);
    case '>=': return Number(current) >= Number(value);
    case '<': return Number(current) < Number(value);
    case '<=': return Number(current) <= Number(value);
    case 'set': return !!current;
    case 'not-set': return !current;
    case 'has-item': return state.inventory.includes(value);
    case 'not-has-item': return !state.inventory.includes(value);
    case 'love>=': return (state.relationships[value] || 0) >= (condition.threshold || 0);
    default: return true;
  }
}

export function isDialogueSeen(id) {
  return state.seenDialogues.includes(String(id));
}

export function markDialogueSeen(id) {
  const s = String(id);
  if (!state.seenDialogues.includes(s)) { state.seenDialogues.push(s); }
}

export function completeObjective(id) {
  const s = String(id);
  state.objectives.completed = state.objectives.completed.includes(s)
    ? state.objectives.completed
    : [...state.objectives.completed, s];
  state.objectives.current = state.objectives.current.filter(o => o.id !== s);
}

export function addObjective(obj) {
  if (!state.objectives.completed.includes(String(obj.id))) {
    state.objectives.current = state.objectives.current.filter(o => o.id !== String(obj.id));
    state.objectives.current.push({ ...obj, id: String(obj.id) });
  }
}

export function setObjectiveDone(id) {
  const s = String(id);
  state.objectives.current = state.objectives.current.map(o =>
    o.id === s ? { ...o, done: true } : o
  );
}

export function exportSave() {
  return JSON.stringify(state, null, 2);
}

export function importSave(json) {
  try {
    const parsed = JSON.parse(json);
    state = mergeDeep(clone(DEFAULT_STATE), parsed);
    saveState();
    return true;
  } catch (e) {
    return false;
  }
}
