import * as S from './state.js';
import { loadAvatarCatalog } from './data.js';

export const SELECTORS = {
  background: '.scene-background',
  moves: '.scene-moves',
  items: '.scene-items',
  choices: '.scene-choices',
  bubble: '#dialog-bubble-0',
  npcCanvas: '#static-npc-canvas',
  objectivesOverlay: '.objectives-overlay',
  objectivesSide: '.objectives-side-overlay',
  questItems: '.quest-items-list',
  lom: '.lom-gauge',
  lomHeart: '.lom-heart-value',
  playerThumb: '.player-thumbnail',
  avatarCanvas: '#avatar-small-canvas',
  notification: '.notification-panel-content'
};

let currentEpisodeData = null;
let idMap = {};
let currentCharacterSprites = {};
let activeMovesItemReq = {};
let itemsCatalog = {};

export function setEpisodeContext(episodeData, characters, items) {
  currentEpisodeData = episodeData;
  itemsCatalog = items || {};
  idMap = {};
  activeMovesItemReq = {};
  for (const entry of episodeData.data.storyline) {
    idMap[String(entry.id)] = entry;
  }
  const actors = episodeData.data.actors || {};
  currentCharacterSprites = {};
  for (const [actorId, actor] of Object.entries(actors)) {
    const char = characters[actorId] || {};
    const spriteBase = (char.sprites && char.sprites.base) || '';
    currentCharacterSprites[actorId] = {
      emotions: actor.emotions || {},
      base: spriteBase,
      charDir: spriteBase.substring(0, spriteBase.lastIndexOf('/') + 1)
    };
  }
}

export function getEntry(id) {
  return idMap[String(id)];
}

export function setBackground(image) {
  const el = document.querySelector(SELECTORS.background);
  el.src = image;
  el.classList.add('loaded');
}

export function firstEntryId() {
  return Object.keys(idMap)[0] || '0';
}

export function showRP() {
  const els = [
    document.querySelector(SELECTORS.bubble),
    document.querySelector(SELECTORS.choices),
    document.querySelector(SELECTORS.playerThumb)
  ];
  els.forEach(e => e && e.classList.remove('hidden'));
}

export function hideRP() {
  const els = [
    document.querySelector(SELECTORS.bubble),
    document.querySelector(SELECTORS.choices),
    document.querySelector(SELECTORS.playerThumb)
  ];
  els.forEach(e => e && e.classList.add('hidden'));
}

export function showEndInterface() {
  showRP();
}

function clearMoves() {
  const cont = document.querySelector(SELECTORS.moves);
  cont.innerHTML = '';
}

function clearItems() {
  const cont = document.querySelector(SELECTORS.items);
  cont.innerHTML = '';
}

let npcLoadId = 0;
export function drawNpc(characterId, emotion) {
  const canvas = document.querySelector(SELECTORS.npcCanvas);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sprite = currentCharacterSprites[characterId];
  if (!sprite) return;
  const file = sprite.emotions[emotion] || sprite.emotions['default'];
  const src = file
    ? sprite.charDir + file
    : sprite.base;
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = 1.5;
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (canvas.width - w) / 2 + 40, 20, w, h);
  };
  img.src = src;
}

export function setBubble(entry) {
  const el = document.querySelector(SELECTORS.bubble);
  const nameEl = el.querySelector('.bubble-npc-name');
  const textEl = el.querySelector('.bubble-text');
  if (nameEl) nameEl.textContent = entry.character || '';
  if (textEl) textEl.textContent = entry.text || '';
  el.style.left = (entry.x !== undefined ? entry.x : 0) + '%';
  el.style.top = (entry.y !== undefined ? entry.y : 0) + '%';
  el.style.maxWidth = (entry.maxWidth !== undefined ? entry.maxWidth : 30) + '%';
  el.classList.remove('hidden');
}

export function renderChoices(entry, onSelect) {
  const ol = document.querySelector(SELECTORS.choices).querySelector('ol');
  ol.innerHTML = '';
  const raw = entry.responses;
  let list = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === 'object' && 'goto' in item) {
        list.push(item);
      } else {
        for (const [t, meta] of Object.entries(item || {})) {
          list.push(typeof meta === 'string' ? { text: t, goto: meta } : { text: t, ...meta });
        }
      }
    }
  } else if (raw && typeof raw === 'object') {
    for (const [t, meta] of Object.entries(raw)) {
      list.push(typeof meta === 'string' ? { text: t, goto: meta } : { text: t, ...meta });
    }
  }

  for (const choice of list) {
    if (choice.condition && !S.evaluateCondition(choice.condition)) continue;
    const li = document.createElement('li');
    li.className = 'choice';
    li.textContent = choice.text;
    li.dataset.goto = String(choice.goto);
    li.addEventListener('click', () => onSelect(choice));
    ol.appendChild(li);
  }
  const container = document.querySelector(SELECTORS.choices);
  container.classList.remove('hidden');
}

export function renderMove(entry, onMove) {
  clearMoves();
  clearItems();
  const moves = entry.moves || [];
  if (entry.items) {
    const itemsCont = document.querySelector(SELECTORS.items);
    for (const item of entry.items) {
      const it = document.createElement('item');
      it.className = 'item-clickable';
      it.dataset.item = String(item.item);
      it.style.top = (item.top !== undefined ? item.top : 50) + '%';
      it.style.left = (item.left !== undefined ? item.left : 20) + '%';
      const img = document.createElement('img');
      const itemDef = itemsCatalog[String(item.item)];
      img.src = (itemDef && itemDef.image) ? itemDef.image : ('assets/img/' + item.item + '-icon.png');
      img.className = 'item-icon';
      img.alt = (itemDef && itemDef.name) || 'item';
      it.appendChild(img);
      it.addEventListener('click', () => onMove('pickup', item));
      itemsCont.appendChild(it);
    }
  }
  for (const m of moves) {
    const mv = document.createElement('move');
    mv.className = 'move';
    mv.dataset.goto = String(m.goto);
    mv.style.top = (m.top !== undefined ? m.top : 50) + '%';
    mv.style.left = (m.left !== undefined ? m.left : 50) + '%';
    const label = document.createElement('span');
    label.className = 'move-label';
    label.textContent = m.label || 'Ir';
    mv.appendChild(label);
    if (m.requiredItem) {
      mv.dataset.required = String(m.requiredItem);
      if (!S.getState().inventory.includes(String(m.requiredItem))) {
        mv.classList.add('disabled');
        mv.dataset.failed = m.failedMessage || 'Você precisa de um item para continuar.';
      }
    }
    mv.addEventListener('click', () => onMove('move', m, mv));
    document.querySelector(SELECTORS.moves).appendChild(mv);
  }
}

export function renderObjectives(entry) {
  for (const obj of entry.objectives || []) {
    addObjectiveToPanel(obj);
  }
}

function addObjectiveToPanel(obj) {
  const overlay = document.querySelector(SELECTORS.objectivesOverlay);
  const side = document.querySelector(SELECTORS.objectivesSide);
  const isCompleted = S.getState().objectives.completed.includes(String(obj.id));
  const item = document.createElement('li');
  item.dataset.objId = String(obj.id);
  item.textContent = obj.text;
  if (isCompleted) { item.classList.add('ended'); }
  overlay.appendChild(item);
  const clone = item.cloneNode(true);
  side.appendChild(clone);
}

export function completeObjectives(ids) {
  for (const id of ids || []) {
    S.completeObjective(id);
  }
  updateObjectivePanel();
}

function updateObjectivePanel() {
  document.querySelectorAll('[data-obj-id]').forEach(el => {
    if (S.getState().objectives.completed.includes(el.dataset.objId)) {
      el.classList.add('ended');
    }
  });
}

export function showNotification(msg) {
  const el = document.querySelector(SELECTORS.notification);
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

export function updateHud() {
  const s = S.getState();
  const paEl = document.querySelector('.hud-pa');
  const goldEl = document.querySelector('.hud-golds');
  const nameEl = document.querySelector('.hud-name');
  if (paEl) paEl.textContent = s.economy.pa;
  if (goldEl) goldEl.textContent = s.economy.golds;
  if (nameEl) nameEl.textContent = s.profile.playerName;
  updateLom();
  updateQuestItems();
}

export function updateLom() {
  const el = document.querySelector(SELECTORS.lomHeart);
  if (!el) return;
  const s = S.getState();
  const chars = Object.entries(s.relationships).filter(([k]) => !isNaN(k));
  const vals = Object.entries(s.relationships).map(([k, v]) => v);
  const max = vals.length ? Math.max(...vals) : 0;
  el.textContent = max + '%';
  const gauge = document.querySelector('.lom-gauge');
  if (gauge) gauge.style.height = Math.min(100, max) + '%';
}

export function updateQuestItems() {
  const cont = document.querySelector(SELECTORS.questItems);
  if (!cont) return;
  cont.innerHTML = '';
  const s = S.getState();
  for (const id of s.inventory) {
    const span = document.createElement('span');
    span.className = 'quest-item-chip';
    span.textContent = '#' + id;
    cont.appendChild(span);
  }
}

export async function renderAvatar(canvasId) {
  const canvas = document.querySelector(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const state = S.getState();
  const layers = state.profile.avatar || [];
  const catalog = await loadAvatarCatalog();
  const type = canvas.dataset.type || 'canva-face';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!layers.length) return;
  const images = [];
  for (const token of layers) {
    const parts = token.split(':');
    const section = parts[0];
    let node = catalog[section];
    let file = null;
    for (let i = 1; i < parts.length && node; i++) {
      node = node[parts[i]];
    }
    if (typeof node === 'string') file = node;
    else if (node) { file = typeof node === 'string' ? node : null; }
    if (file) {
      images.push(type === 'canva-body'
        ? 'assets/img/canva-body/' + file
        : 'assets/img/canva-face/' + file);
    }
  }
  let loaded = 0;
  if (!images.length) return;
  for (const src of images) {
    const img = new Image();
    img.onload = () => {
      loaded++;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = src;
  }
}

export { clearMoves, clearItems };
