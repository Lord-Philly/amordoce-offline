const cache = {};

export async function fetchJSON(url) {
  if (cache[url]) { return cache[url]; }
  const res = await fetch(url);
  if (!res.ok) { throw new Error('Falha ao carregar ' + url); }
  const data = await res.json();
  cache[url] = data;
  return data;
}

export async function loadGameIndex() {
  return fetchJSON('data/index.json');
}

export async function loadEpisode(id) {
  const index = await loadGameIndex();
  const meta = index.episodes.find(e => e.id === id);
  if (!meta) { throw new Error('Episódio desconhecido: ' + id); }
  const data = await fetchJSON('data/' + meta.file);
  return { meta, data };
}

export async function loadAvatarCatalog() {
  return fetchJSON('data/avatar-catalog.json');
}

export async function loadCharacters() {
  return fetchJSON('data/characters.json');
}

export async function loadItems() {
  return fetchJSON('data/items.json');
}
