import * as S from './state.js';
import * as Scenes from './scenes.js';
import { loadEpisode, loadCharacters, loadItems } from './data.js';

let activeEpisode = null;
let activeActors = {};

export async function startEpisode(episodeId) {
  const { meta, data } = await loadEpisode(episodeId);
  activeEpisode = { meta, data };
  const characters = await loadCharacters();
  const items = await loadItems();
  Scenes.setEpisodeContext({ meta, data }, characters, items);
  activeActors = characters;

  const state = S.getState();
  state.progress.currentEpisode = episodeId;
  state.progress.currentSceneId = null;
  S.saveState();

  S.markDialogueSeen('__start__');
  renderEntry(Scenes.firstEntryId());
  Scenes.updateHud();
}

export function loadIntoEpisode(episodeId, sceneId) {
  startEpisode(episodeId).then(() => {
    if (sceneId) renderEntry(sceneId);
  });
}

function resolveScenePlace(entry, data) {
  const locId = entry.place || S.getState().progress.currentPlace || data.place || 'corredor';
  const loc = data.locations && data.locations[locId];
  S.getState().progress.currentPlace = locId;
  S.saveState();
  return loc ? loc.image : null;
}

export function renderEntry(id) {
  const data = activeEpisode.data;
  const entry = Scenes.getEntry(id);
  if (!entry) {
    Scenes.showNotification('Entrada não encontrada: ' + id);
    return;
  }

  const state = S.getState();
  state.progress.currentSceneId = String(id);
  S.markDialogueSeen(id);
  S.saveState();

  const bg = resolveScenePlace(entry, data);
  if (bg) Scenes.setBackground(bg);

  switch (entry.type) {
    case 'bubble': {
      Scenes.hideRP();
      Scenes.clearMoves();
      Scenes.clearItems();
      Scenes.drawNpc(entry.character, entry.emotion);
      if ((entry.objectives || []).length) {
        Scenes.completeObjectives(entry.objectives.map(o => o.id));
      }
      if (entry.completeObjectives) {
        Scenes.completeObjectives(entry.completeObjectives);
      }
      Scenes.setBubble(entry);
      const next = Scenes.getEntry(String(Number(id) + 1));
      if (next && next.type === 'dialog') {
        Scenes.showRP();
        Scenes.renderChoices(next, onChoice);
      } else {
        Scenes.renderChoices({ responses: [{ text: '(Continuar)', goto: String(Number(id) + 1) }] }, onChoice);
      }
      break;
    }
    case 'dialog': {
      Scenes.showRP();
      Scenes.renderChoices(entry, onChoice);
      break;
    }
    case 'dialog-end': {
      Scenes.showEndInterface();
      Scenes.renderChoices(entry, onChoice);
      break;
    }
    case 'objective': {
      Scenes.hideRP();
      Scenes.renderObjectives(entry);
      const next = Scenes.getEntry(String(Number(id) + 1));
      if (next && (next.type === 'move')) { renderEntry(next.id); }
      else {
        Scenes.renderChoices({ responses: [{ text: '(Continuar)', goto: String(Number(id) + 1) }] }, onChoice);
      }
      break;
    }
    case 'move': {
      Scenes.hideRP();
      Scenes.renderMove(entry, onMove);
      break;
    }
    case 'pickup': {
      Scenes.hideRP();
      S.applyEffects({ item: entry.item });
      S.saveState();
      Scenes.showNotification((entry.received || []).join(' '));
      Scenes.updateQuestItems();
      const nextId = entry.auto || String(Number(id) + 1);
      renderEntry(nextId);
      break;
    }
    case 'end-episode': {
      Scenes.showEndInterface();
      Scenes.showNotification('Fim do episódio! Próximo: ' + entry.nextEpisode);
      break;
    }
    default: {
      Scenes.showNotification('Tipo desconhecido: ' + entry.type);
      break;
    }
  }
  Scenes.updateHud();
}

function applyResponseEffects(choice) {
  if (choice.set) S.applyEffects(choice.set);
  if (choice.item) S.applyEffects({ item: choice.item });
  if (choice.removeItem) S.applyEffects({ removeItem: choice.removeItem });
  S.saveState();
  Scenes.updateHud();
}

function onChoice(choice) {
  applyResponseEffects(choice);
  renderEntry(choice.goto);
}

function onMove(kind, itemOrMove, moveEl) {
  if (kind === 'pickup') {
    S.applyEffects({ item: itemOrMove.item });
    S.saveState();
    Scenes.updateQuestItems();
    Scenes.updateHud();
    const el = document.querySelector('.scene-items [data-item="' + itemOrMove.item + '"]');
    if (el) { el.classList.add('collected'); el.style.pointerEvents = 'none'; }
    Scenes.showNotification('Você pegou o item!');
    document.querySelectorAll('.scene-moves move.disabled').forEach(m => {
      if (m.dataset.required === String(itemOrMove.item)) {
        m.classList.remove('disabled');
      }
    });
  } else if (kind === 'move') {
    if (itemOrMove.requiredItem && !S.getState().inventory.includes(String(itemOrMove.requiredItem))) {
      if (moveEl) {
        moveEl.classList.add('disabled');
        Scenes.showNotification(itemOrMove.failedMessage || 'Você precisa de um item para continuar.');
      }
      return;
    }
    const state = S.getState();
    if (itemOrMove.place) { state.progress.currentPlace = itemOrMove.place; }
    S.saveState();
    renderEntry(itemOrMove.goto);
  }
}

export { onChoice, onMove };
