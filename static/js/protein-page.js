/**
 * Page /protein/ : fiche complète d'une protéine.
 *
 * Avec ?id=3, affiche l'enregistrement correspondant ; sans paramètre, liste
 * les protéines pour en choisir une. Tout vient de /api/proteins/.
 */

const detail = document.getElementById('protein-detail');
const params = new URLSearchParams(location.search);
const id = params.get('id');

const structure = document.getElementById('structure');
const viewerNote = document.getElementById('viewer-note');
let viewer = null; // instance Mol*, créée une seule fois

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

/**
 * Affiche la structure 3D dans #viewer.
 *  - ?pdb=1ABC dans l'URL : charge cette entrée PDB (pratique pour tester) ;
 *  - sinon, si la protéine a un identifiant UniProt : prédiction AlphaFold DB ;
 *  - sinon : message « pas de structure ».
 */
async function showStructure(protein) {
  structure.hidden = false;
  const pdb = params.get('pdb');

  if (!pdb && !protein.uniprot_id) {
    viewerNote.textContent = 'No UniProt id for this record yet, so no structure to show.';
    return;
  }
  if (!window.molstar) {
    viewerNote.textContent = 'Mol* could not be loaded (check the internet connection).';
    return;
  }

  try {
    viewer = await molstar.Viewer.create('viewer', {
      layoutIsExpanded: false,
      layoutShowControls: false,
      layoutShowRemoteState: false,
      layoutShowLog: false,
      layoutShowLeftPanel: false,
      viewportShowExpand: false,
      viewportShowSelectionMode: false,
    });

    if (pdb) {
      await viewer.loadPdb(pdb);
      viewerNote.textContent = `Experimental structure PDB ${pdb.toUpperCase()}.`;
      return;
    }

    // L'API AlphaFold DB renvoie l'URL exacte du fichier de prédiction.
    const response = await fetch(`https://alphafold.ebi.ac.uk/api/prediction/${protein.uniprot_id}`);
    if (!response.ok) throw new Error('No AlphaFold prediction for this UniProt id.');
    const [prediction] = await response.json();
    await viewer.loadStructureFromUrl(prediction.cifUrl, 'mmcif');

    // Coloration par confiance pLDDT (bleu = fiable, orange = désordonné).
    try {
      const manager = viewer.plugin.managers.structure;
      const components = manager.hierarchy.current.structures.flatMap((s) => s.components);
      await manager.component.updateRepresentationsTheme(components, { color: 'plddt-confidence' });
    } catch { /* la structure reste affichée avec les couleurs par défaut */ }

    viewerNote.textContent = 'AlphaFold prediction, coloured by pLDDT confidence. '
      + 'Low confidence (orange) usually means an intrinsically disordered region.';
  } catch (error) {
    viewerNote.textContent = `3D structure unavailable: ${error.message}`;
  }
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
      showStructure(data.results[0]);
    }
  } catch (error) {
    detail.replaceChildren(paragraph(`${error.message} Start the site with “python manage.py runserver”.`));
  }
}

load();