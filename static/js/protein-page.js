/**
 * Page /protein/ : fiche complète d'une protéine.
 *
 * Avec ?id=3, affiche l'enregistrement correspondant ; sans paramètre, liste
 * les protéines pour en choisir une. Tout vient de /api/proteins/.
 */

const detail = document.getElementById('protein-detail');
const id = new URLSearchParams(location.search).get('id');

function paragraph(text) {
  const element = document.createElement('p');
  element.textContent = text;
  return element;
}

function renderRecord(protein) {
  const title = document.createElement('h1');
  title.textContent = protein.name;

  const meta = document.createElement('dl');
  meta.className = 'grid';

  const rows = [
    ['UniProt', protein.uniprot_id || '—', protein.uniprot_id
      ? `https://www.uniprot.org/uniprotkb/${protein.uniprot_id}`
      : null],
    ['Weight', protein.molecular_weight_kda
      ? `${Math.round(protein.molecular_weight_kda)} kDa`
      : '—', null],
    ['Record', `#${protein.id}`, null],
  ];

  for (const [term, value, href] of rows) {
    const box = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = term;
    const dd = document.createElement('dd');

    if (href) {
      const link = document.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = value;
      dd.append(link);
    } else {
      dd.textContent = value;
    }

    box.append(dt, dd);
    meta.append(box);
  }

  detail.replaceChildren(title, meta, paragraph(protein.description));
}

function renderChoices(proteins) {
  const title = document.createElement('h1');
  title.textContent = 'Protein details';

  const list = document.createElement('div');
  list.className = 'cards';

  for (const protein of proteins) {
    const link = document.createElement('a');
    link.className = 'card';
    link.href = `/protein/?id=${protein.id}`;

    const name = document.createElement('h2');
    name.textContent = protein.name;

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = protein.uniprot_id || 'No UniProt id';

    link.append(name, meta);
    list.append(link);
  }

  detail.replaceChildren(title, paragraph('Pick a record to see its full entry.'), list);
}

async function load() {
  const endpoint = id ? `/api/proteins/?id=${encodeURIComponent(id)}` : '/api/proteins/';

  try {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error('The Django protein API is unreachable.');
    const data = await response.json();

    if (!id) {
      renderChoices(data.results);
    } else if (!data.count) {
      detail.replaceChildren(paragraph(`No protein with record #${id}.`));
    } else {
      renderRecord(data.results[0]);
    }
  } catch (error) {
    detail.replaceChildren(paragraph(`${error.message} Start the site with “python manage.py runserver”.`));
  }
}

load();
