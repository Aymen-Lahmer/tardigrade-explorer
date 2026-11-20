/**
 * Point d'entrée de l'interface.
 *
 * Rôle : relier index.html à la scène 3D (scene.js) et à l'API Django.
 * Aucun framework : on sélectionne les éléments et on écoute leurs événements.
 */

import { loadAtlas, loadGeometries } from './atlas.js';
import { createTardigradeScene } from './scene.js';

const $ = (id) => document.getElementById(id);

const state = {
  atlas: null,
  proteinTimer: 0,
  proteinAbort: null,
};

// La scène est créée tout de suite : elle affiche le fond et gère le survol
// pendant que les données arrivent. En cas d'échec WebGL, on affiche l'erreur.
let scene = null;
try {
  scene = createTardigradeScene($('scene'));
} catch (error) {
  showError(error.message);
}

// --- Panneaux --------------------------------------------------------------

/** Panneaux internes à la page (le menu de gauche ouvre d'autres pages). */
const PANEL_IDS = ['search-panel', 'about'];

/** Ferme tous les panneaux (et la fiche) sauf celui passé en argument. */
function closePanels(except) {
  for (const id of PANEL_IDS) {
    if (id !== except) $(id).hidden = true;
  }
  closeDetails();
}

function openPanel(id) {
  closePanels(id);
  $(id).hidden = false;

  if (id === 'search-panel') {
    const input = $('protein-search');
    input.focus();
    input.select();
    scheduleProteinSearch(input.value);
  }
}

function closePanel(id) {
  $(id).hidden = true;
}

// --- Recherche -------------------------------------------------------------

const openSearch = () => openPanel('search-panel');
const closeSearch = () => closePanel('search-panel');

// --- Protéines (API Django) ------------------------------------------------

function scheduleProteinSearch(term) {
  clearTimeout(state.proteinTimer);
  state.proteinAbort?.abort();
  state.proteinTimer = setTimeout(() => searchProteins(term), 250);
}

async function searchProteins(term) {
  const controller = new AbortController();
  state.proteinAbort = controller;

  try {
    const response = await fetch(`/api/proteins/?q=${encodeURIComponent(term)}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('The Django protein API is unreachable.');
    const data = await response.json();
    renderProteins(data.results, term);
  } catch (error) {
    if (error.name === 'AbortError') return;
    renderProteins([], term, error.message);
  }
}

function renderProteins(results, term, errorMessage) {
  const container = $('protein-results');
  const note = $('proteins-note');
  container.replaceChildren();

  if (errorMessage) {
    note.textContent = `${errorMessage} Start the site with “python manage.py runserver”.`;
    return;
  }

  if (!results.length) {
    note.textContent = term
      ? 'No protein matches this name in the database.'
      : 'Type a protein name — results come from the Django API.';
    return;
  }

  note.textContent = `${results.length} protein${results.length > 1 ? 's' : ''} from the Django API.`;

  for (const protein of results) {
    const button = document.createElement('button');
    button.type = 'button';

    const name = document.createElement('span');
    name.textContent = protein.name;

    const hint = document.createElement('span');
    hint.className = 'hint';
    hint.textContent = protein.uniprot_id || '';

    button.append(name, hint);
    button.addEventListener('click', () => showProtein(protein));
    container.append(button);
  }
}

// --- Fiches ----------------------------------------------------------------

function openDetails({ kind, title, description, meta, link }) {
  closePanels();

  $('detail-kind').textContent = kind;
  $('detail-title').textContent = title;
  $('detail-description').textContent = description;

  const metaList = $('detail-meta');
  metaList.replaceChildren();
  for (const [term, value] of meta) {
    const group = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = term;
    dd.textContent = value;
    group.append(dt, dd);
    metaList.append(group);
  }

  const linkElement = $('detail-link');
  if (link) {
    linkElement.href = link.href;
    linkElement.textContent = link.label;
    linkElement.hidden = false;
  } else {
    linkElement.hidden = true;
  }

  $('details').hidden = false;
}

function closeDetails() {
  $('details').hidden = true;
}

function showProtein(protein) {
  scene?.select(null);

  openDetails({
    kind: 'Protein · Django database',
    title: protein.name,
    description: protein.description,
    meta: [
      ['UniProt', protein.uniprot_id || '—'],
      ['Weight', protein.molecular_weight_kda ? `${Math.round(protein.molecular_weight_kda)} kDa` : '—'],
    ],
    link: protein.uniprot_id
      ? { href: `https://www.uniprot.org/uniprotkb/${protein.uniprot_id}`, label: 'UniProt entry ↗' }
      : null,
  });
}

// --- Contrôles 3D ----------------------------------------------------------

function setActiveView(view) {
  document.querySelectorAll('[data-view]').forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function setRotate(on) {
  scene?.setRotate(on);
  const button = $('rotate-toggle');
  button.classList.toggle('active', on);
  button.setAttribute('aria-pressed', String(on));
  button.textContent = on ? '⏸' : '⟳';
}

function updateZoom(value) {
  $('zoom-value').textContent = `${value}%`;
  $('caption-text').textContent = value >= 50 ? 'Protein layer' : 'Water bear · Tardigrada';
  scene?.setZoom(value / 100);
}

/** Unité affichée à droite de chaque curseur du dock. */
const SLIDER_UNITS = { temperature: '°C', hydration: '%' };

function updateSliderOutput(inputId, outputId) {
  const value = $(inputId).value;
  $(outputId).textContent = `${value}${SLIDER_UNITS[inputId] ?? ''}`;
}

function resetStudio() {
  $('zoom').value = '0';
  updateZoom(0);
  for (const id of ['temperature']) {
    $(id).value = '0';
    updateSliderOutput(id, `${id}-value`);
  }
  setActiveView('three-quarter');
  setRotate(false);
  scene?.reset();
  closePanels();
}

// --- Événements ------------------------------------------------------------

$('search-toggle').addEventListener('click', () => {
  if ($('search-panel').hidden) openSearch();
  else closeSearch();
});
$('search-close').addEventListener('click', closeSearch);

$('protein-search').addEventListener('input', (event) => scheduleProteinSearch(event.target.value));

$('zoom').addEventListener('input', (event) => updateZoom(Number(event.target.value)));
for (const id of ['temperature', 'hydration']) {
  $(id).addEventListener('input', () => updateSliderOutput(id, `${id}-value`));
}

document.querySelectorAll('[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    scene?.setView(button.dataset.view);
    setActiveView(button.dataset.view);
    setRotate(false);
  });
});

$('rotate-toggle').addEventListener('click', () => {
  setRotate($('rotate-toggle').getAttribute('aria-pressed') !== 'true');
});

$('reset-view').addEventListener('click', resetStudio);
$('reset-dock').addEventListener('click', resetStudio);
$('detail-close').addEventListener('click', closeDetails);

$('about-toggle').addEventListener('click', () => {
  if ($('about').hidden) openPanel('about');
  else closePanel('about');
});
$('about-close').addEventListener('click', () => closePanel('about'));

$('error-reload').addEventListener('click', () => location.reload());

document.addEventListener('keydown', (event) => {
  const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

  if (event.key === '/' && !typing) {
    event.preventDefault();
    openSearch();
  }

  if (event.key === 'Escape') {
    closePanels();
  }
});

// --- Démarrage -------------------------------------------------------------

async function boot() {
  try {
    const atlas = await loadAtlas();
    state.atlas = atlas;

    $('piece-count').textContent = `Protein sites `;
    $('loading-detail').textContent = 'Loading the geometry…';

    const geometries = await loadGeometries(atlas);
    scene?.setPieces(atlas, geometries);

    $('loading').hidden = true;
  } catch (error) {
    showError(error.message);
  }
}

function showError(message) {
  $('loading').hidden = true;
  $('error-message').textContent = message;
  $('error').hidden = false;
}

boot();
