/**
 * Page /explore_proteins/ : liste et filtre les protéines servies par Django.
 */

// 1. RÉCUPÉRATION DES ÉLÉMENTS HTML

const searchInput = document.getElementById("protein-search");
const searchField = document.getElementById("search-field");
const searchStatus = document.getElementById("search-status");
const proteinTable = document.getElementById("protein-table");
const proteinRows = document.getElementById("protein-rows");
const filtersPanel = document.querySelector(".filters");
const lengthMin = document.getElementById("length-min");
const lengthMax = document.getElementById("length-max");
const lengthMinValue = document.getElementById("length-min-value");
const lengthMaxValue = document.getElementById("length-max-value");
const openDetailsButton = document.getElementById("open-details");
const exportFastaButton = document.getElementById("export-fasta");
const exportCsvButton = document.getElementById("export-csv");

// Protéines actuellement affichées (utilisées par les exports) et ligne choisie
let currentResults = [];
let selectedId = null;

// Texte d'aide de la barre selon le champ choisi dans le sélecteur
const PLACEHOLDERS = {
  name: "Protein or family name, e.g. CAHS, Dsup...",
  uniprot: "UniProt ID, e.g. P0DOW4, J7M799...",
  pdb: "PDB code, e.g. 9RKP, 4R5J...",
  description: "A function or a keyword, e.g. chaperone...",
};

// 2. APPEL À L'API DJANGO

// `field` dit à l'API dans quel champ chercher, `filters` contient les filtres
// du panneau de gauche. Tant que le backend ne les gère pas (étape suivante),
// il les ignore et cherche comme avant.
async function fetchProteins(query, field, filters) {
  const params = new URLSearchParams(filters);
  params.set("q", query);
  params.set("field", field);
  const response = await fetch("/api/proteins/?" + params.toString());
  if (!response.ok) {
    throw new Error("HTTP " + response.status);
  }
  return response.json();
}

// 3. AFFICHAGE DES RÉSULTATS

// Texte d'une cellule, ou « — » quand la donnée n'existe pas encore.
const EMPTY = "\u2014";

function makeCell(text) {
  const cell = document.createElement("td");
  cell.textContent = text || EMPTY;
  return cell;
}

function renderProteins(data) {
  proteinRows.innerHTML = "";
  currentResults = data.results;
  resetSelection();

  data.results.forEach(function (protein) {
    const row = document.createElement("tr");
    row.dataset.id = protein.id;
    row.title = protein.description; // survol : description complète

    // Colonnes du tableau : Name, UniProt ID, PDB code, Length, Mass, Structure.
    // name, uniprot_id et molecular_weight_kda viennent déjà de la base ;
    // pdb_code, length et structure_type seront fournis par l'API quand le
    // backend aura ces champs ; d'ici là ces cellules affichent « — ».
    row.appendChild(makeCell(protein.name));
    row.appendChild(makeCell(protein.uniprot_id));
    row.appendChild(makeCell(protein.pdb_code));
    row.appendChild(makeCell(protein.length ? protein.length + " aa" : ""));
    row.appendChild(makeCell(protein.molecular_weight_kda));
    row.appendChild(makeCell(capitalize(protein.structure_type)));

    proteinRows.appendChild(row);
  });

  const n = data.count;
  proteinTable.hidden = n === 0;
  exportCsvButton.disabled = exportFastaButton.disabled = n === 0;
  searchStatus.textContent = n === 0
    ? "No protein found."
    : n + (n === 1 ? " protein" : " proteins");
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

// 4. RECHERCHE

// Numéro de la dernière recherche lancée : une réponse plus lente qui arrive
// après une recherche plus récente est ignorée.
let lastSearch = 0;

async function search() {
  const thisSearch = ++lastSearch;
  try {
    const data = await fetchProteins(
      searchInput.value.trim(), searchField.value, getFilterParams()
    );
    if (thisSearch !== lastSearch) return;
    renderProteins(data);
  } catch (error) {
    if (thisSearch !== lastSearch) return;
    console.error("Erreur de recherche :", error);
    proteinRows.innerHTML = "";
    proteinTable.hidden = true;
    currentResults = [];
    resetSelection();
    exportCsvButton.disabled = exportFastaButton.disabled = true;
    searchStatus.textContent = "Search failed: " + error.message;
  }
}

// Attendre 250 ms après la dernière frappe avant d'interroger l'API
let timer;
function scheduleSearch() {
  clearTimeout(timer);
  timer = setTimeout(search, 250);
}
searchInput.addEventListener("input", scheduleSearch);

// Changer de champ : adapter l'aide de la barre et relancer la recherche
searchField.addEventListener("change", function () {
  searchInput.placeholder = PLACEHOLDERS[searchField.value];
  search();
});
searchInput.placeholder = PLACEHOLDERS[searchField.value];

// 5. FILTRES (panneau de gauche)

// Construit les paramètres envoyés à l'API : family, structure et disorder
// (un paramètre par case cochée), length_min / length_max.
function getFilterParams() {
  const params = new URLSearchParams();

  ["family", "structure", "disorder"].forEach(function (name) {
    document.querySelectorAll('input[name="' + name + '"]:checked')
      .forEach(function (box) { params.append(name, box.value); });
  });

  // La longueur n'est envoyée que si le curseur a bougé : par défaut aucune
  // protéine n'est écartée (même plus longue que le maximum du curseur).
  if (Number(lengthMin.value) > Number(lengthMin.min)) {
    params.set("length_min", lengthMin.value);
  }
  if (Number(lengthMax.value) < Number(lengthMax.max)) {
    params.set("length_max", lengthMax.value);
  }
  return params;
}

// Affiche les valeurs des curseurs et empêche min > max
function syncLengthSliders(changed) {
  if (Number(lengthMin.value) > Number(lengthMax.value)) {
    if (changed === lengthMin) lengthMax.value = lengthMin.value;
    else lengthMin.value = lengthMax.value;
  }
  lengthMinValue.textContent = lengthMin.value;
  lengthMaxValue.textContent = lengthMax.value;
}

filtersPanel.addEventListener("input", function (event) {
  if (event.target.type === "range") {
    syncLengthSliders(event.target);
    scheduleSearch();
  }
});
filtersPanel.addEventListener("change", function (event) {
  if (event.target.type === "checkbox") scheduleSearch();
});

// 6. SÉLECTION D'UNE LIGNE ET BOUTON « OPEN DETAILS »

function resetSelection() {
  selectedId = null;
  openDetailsButton.disabled = true;
}

function selectRow(row) {
  proteinRows.querySelectorAll("tr.selected").forEach(function (other) {
    other.classList.remove("selected");
  });
  row.classList.add("selected");
  selectedId = row.dataset.id;
  openDetailsButton.disabled = false;
}

// La page de détails ne lit pas encore ce paramètre : elle s'ouvre simplement.
function openDetails() {
  if (selectedId) {
    window.location.href = "/protein_details/?id=" + encodeURIComponent(selectedId);
  }
}

proteinRows.addEventListener("click", function (event) {
  const row = event.target.closest("tr");
  if (row) selectRow(row);
});
proteinRows.addEventListener("dblclick", function (event) {
  const row = event.target.closest("tr");
  if (row) {
    selectRow(row);
    openDetails();
  }
});
openDetailsButton.addEventListener("click", openDetails);

// 7. EXPORTS (les protéines actuellement affichées)

function downloadFile(filename, text, type) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([text], { type: type }));
  link.download = filename;
  link.click();
  setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
}

const CSV_COLUMNS = [
  "name", "family", "uniprot_id", "pdb_code",
  "length", "molecular_weight_kda", "structure_type", "disorder", "description",
];

// Entoure de guillemets les valeurs contenant virgule, guillemet ou saut de ligne
function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function exportCsv() {
  if (currentResults.length === 0) return;
  const lines = [CSV_COLUMNS.join(",")];
  currentResults.forEach(function (protein) {
    lines.push(CSV_COLUMNS.map(function (col) { return csvEscape(protein[col]); }).join(","));
  });
  // \uFEFF : permet à Excel de lire correctement les accents
  downloadFile("proteins.csv", "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8");
}

// FASTA : nécessite le champ `sequence` dans l'API (pas encore en base)
function exportFasta() {
  const withSequence = currentResults.filter(function (protein) { return protein.sequence; });
  if (withSequence.length === 0) {
    searchStatus.textContent = "No sequence available for these proteins yet.";
    return;
  }
  const text = withSequence.map(function (protein) {
    const id = protein.uniprot_id || protein.pdb_code || "protein_" + protein.id;
    const lines = protein.sequence.replace(/\s+/g, "").match(/.{1,60}/g);
    return ">" + id + " " + protein.name + "\n" + lines.join("\n");
  }).join("\n") + "\n";
  downloadFile("proteins.fasta", text, "text/plain;charset=utf-8");
}

exportCsvButton.addEventListener("click", exportCsv);
exportFastaButton.addEventListener("click", exportFasta);

// Afficher toutes les protéines au chargement de la page
search();
