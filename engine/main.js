import * as S from './state.js';
import * as Game from './game.js';
import { loadGameIndex, loadCharacters } from './data.js';
import * as Scenes from './scenes.js';

const views = ['home', 'episodes', 'profile', 'save', 'game'];
let gameIndex = null;

function showView(name) {
  for (const v of views) {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = (v === name) ? 'block' : 'none';
  }
  document.querySelectorAll('#main-menu button').forEach(b => {
    b.style.fontWeight = (b.dataset.view === name) ? 'bold' : 'normal';
  });
}

function updateHud() {
  Scenes.updateHud();
}

function refreshHome() {
  const state = S.getState();
  const hasProgress = state.progress.currentEpisode != null;
  document.getElementById('home-new').style.display = hasProgress ? 'none' : 'block';
  document.getElementById('home-continue').style.display = hasProgress ? 'block' : 'none';
  if (hasProgress) {
    document.getElementById('home-return-name').textContent = state.profile.playerName;
  }
}

async function refreshEpisodes() {
  gameIndex = gameIndex || await loadGameIndex();
  const list = document.getElementById('episode-list');
  list.innerHTML = '';
  const state = S.getState();
  for (const ep of gameIndex.episodes) {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.innerHTML = `<strong>Episódio ${ep.number} — ${ep.name}</strong><br><small>${ep.id}${state.progress.currentEpisode === ep.id ? ' (em progresso)' : ''}</small>`;
    const btn = document.createElement('button');
    btn.textContent = (state.progress.currentEpisode === ep.id) ? 'Continuar' : 'Jogar';
    btn.addEventListener('click', () => enterEpisode(ep.id, state.progress.currentEpisode === ep.id));
    li.appendChild(info);
    li.appendChild(btn);
    list.appendChild(li);
  }
}

async function enterEpisode(episodeId, resume) {
  showView('game');
  document.getElementById('current-episode-label').textContent = 'Episódio ' + episodeId;
  await Game.startEpisode(episodeId);
  if (resume && S.getState().progress.currentSceneId) {
    const id = S.getState().progress.currentSceneId;
    // re-aplicar lugar de forma idêntica
    Game.renderEntry(id);
  }
  updateHud();
}

function refreshProfile() {
  const state = S.getState();
  document.getElementById('profile-name').textContent = state.profile.playerName;
  document.getElementById('profile-name-input').value = state.profile.playerName;
  Scenes.renderAvatar('#avatar-profile-canvas');
}

function refreshSave() {
  updateHud();
}

async function init() {
  gameIndex = await loadGameIndex();
  wireNav();
  wireHome();
  wireEpisodes();
  wireProfile();
  wireSave();
  updateHud();
  refreshHome();
}

function wireNav() {
  document.querySelectorAll('#main-menu button').forEach(b => {
    b.addEventListener('click', () => {
      showView(b.dataset.view);
      if (b.dataset.view === 'episodes') refreshEpisodes();
      if (b.dataset.view === 'profile') refreshProfile();
      if (b.dataset.view === 'save') refreshSave();
    });
  });
}

function wireHome() {
  document.getElementById('btn-create').addEventListener('click', () => {
    const name = document.getElementById('new-player-name').value.trim() || 'Alice';
    const st = S.getState();
    st.profile.playerName = name;
    st.profile.avatar = ['corpo', 'boca:neutro-2', 'roupa:pijama', 'olho:open:marrom', 'sombrancelha:normal:marrom', 'cabelo:cacheado:marrom'];
    st.progress.currentEpisode = 'ep-00';
    st.progress.currentSceneId = '0';
    S.saveState();
    refreshHome();
    refreshEpisodes();
    enterEpisode('ep-00', false);
  });

  document.getElementById('btn-continue-episode').addEventListener('click', () => {
    const ep = S.getState().progress.currentEpisode || 'ep-00';
    enterEpisode(ep, true);
  });

  document.getElementById('btn-new-game').addEventListener('click', () => {
    S.resetState();
    refreshHome();
    showView('home');
  });

  document.getElementById('btn-auto-skip').addEventListener('click', () => {
    const st = S.getState();
    st.economy.pa += 20;
    S.saveState();
    updateHud();
  });

  document.getElementById('btn-back-to-episodes').addEventListener('click', () => {
    refreshEpisodes();
    showView('episodes');
  });
}

function wireEpisodes() {
  // list rebuilt on refresh
}

function wireProfile() {
  document.getElementById('btn-save-profile').addEventListener('click', () => {
    const name = document.getElementById('profile-name-input').value.trim() || 'Alice';
    S.getState().profile.playerName = name;
    S.saveState();
    alert('Perfil salvo!');
    updateHud();
  });
}

function wireSave() {
  const exportBtn = document.getElementById('btn-export');
  const importBtn = document.getElementById('btn-import');
  const fileInput = document.getElementById('save-file-input');
  const resetBtn = document.getElementById('btn-reset');

  exportBtn.addEventListener('click', () => {
    const json = S.exportSave();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = 'amordoce-save-' + d.toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (S.importSave(reader.result)) {
        alert('Save importado com sucesso!');
        refreshHome();
        updateHud();
      } else {
        alert('Erro ao importar save.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  resetBtn.addEventListener('click', () => {
    if (confirm('Apagar todo o progresso e recomeçar?')) {
      S.resetState();
      refreshHome();
      showView('home');
    }
  });
}

init();
