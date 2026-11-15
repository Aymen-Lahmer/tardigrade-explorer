/**
 * Page /proteins/ : liste et recherche les protéines servies par Django.
 *
 * Version autonome de la recherche de main.js : pas de scène 3D, pas de fiche,
 * juste l'appel à /api/proteins/ et le rendu des cartes.
 */

const input = document.getElementById('protein-search');
const cards = document.getElementById('protein-cards');
const note = document.getElementById('proteins-note');

let timer = 0;
let abort = null;

function buildCard(protein) {
  const article = document.createElement('article');
  article.className = 'card';

  const title = document.createElement('h2');
  title.textContent = protein.name;

  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = [
    protein.uniprot_id || 'No UniProt id',
    protein.molecular_weight_kda ? `${Math.round(protein.molecular_weight_kda)} kDa` : null,
  ].filter(Boolean).join(' · ');

  const description = document.createElement('p');
  description.textContent = protein.description;

  const link = document.createElement('a');
  link.className = 'card-link';
  link.href = `/protein/?id=${protein.id}`;
  link.textContent = 'Full record →';

  article.append(title, meta, description, link);
  return article;
}

async function search(term) {
  const controller = new AbortController();
  abort = controller;

  try {
    const response = await fetch(`/api/proteins/?q=${encodeURIComponent(term)}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('The Django protein API is unreachable.');

    const data = await response.json();
    cards.replaceChildren(...data.results.map(buildCard));
    note.textContent = data.count
      ? `${data.count} protein${data.count > 1 ? 's' : ''} from the Django API.`
      : 'No protein matches this name.';
  } catch (error) {
    if (error.name === 'AbortError') return;
    cards.replaceChildren();
    note.textContent = `${error.message} Start the site with “python manage.py runserver”.`;
  }
}

function scheduleSearch(term) {
  clearTimeout(timer);
  abort?.abort();
  timer = setTimeout(() => search(term), 250);
}

input.addEventListener('input', (event) => scheduleSearch(event.target.value));

const initialQuery = new URLSearchParams(location.search).get('q') ?? '';
input.value = initialQuery;
search(initialQuery);
