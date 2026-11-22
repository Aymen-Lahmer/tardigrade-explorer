/**
 * Page /protein_details/ : afficher une structure .cif dans le viewer Mol*.
 *
 * Version autonome : la liste des structures est locale à ce fichier (les
 * fichiers de static/data/), pas d'appel à l'API Django. La recherche de
 * /explore_proteins/ vit dans static/js/explore_proteins.js.
 */

// 1. LISTE DES STRUCTURES DISPONIBLES

const proteins = [
  { name: "9RKP", file: "/static/data/9RKP.cif" },
  { name: "4R5J", file: "/static/data/4R5J.cif" },
  { name: "5HVM", file: "/static/data/5HVM.cif" },
];

// 2. INITIALISATION DU VIEWER

let viewer;

const vp = molstar.lib?.plugin?.PluginConfig?.Viewport;
const config = vp ? [
    [vp.ShowXR, 'never'],          
    [vp.ShowIllumination, false],  
] : [];

const viewerPromise = molstar.Viewer.create("viewer3", {
    layoutIsExpanded: false,
    layoutShowControls: true,        
    layoutShowRemoteState: false,
    layoutShowSequence: true,        
    layoutShowLog: false,            
    layoutShowLeftPanel: false,      
    collapseRightPanel: true,       
    viewportShowReset: true,
    viewportShowScreenshotControls: true,
    viewportShowControls: false,     
    viewportShowExpand: true,
    viewportShowToggleFullscreen: false,
    viewportShowSettings: true,
    viewportShowSelectionMode: false,
    viewportShowAnimation: false,
    viewportShowTrajectoryControls: false,
    config: config,                  
});

viewerPromise.then(async function (v) {
  viewer = v;

  try {
    await loadProtein(proteins[0]);
  } catch (error) {
    console.error("Erreur au chargement initial :", error);
    document.getElementById("selected-protein").textContent =
      "Erreur de chargement : " + error.message;
  }
});

// 3. CHARGEMENT D'UNE STRUCTURE

async function loadProtein(protein) {
  // Attendre que le viewer soit prêt
  if (!viewer) {
    viewer = await viewerPromise;
  }

  const builder = molstar.PluginExtensions.mvs.MVSData.createBuilder();

  const structure = builder
    .download({ url: protein.file })
    .parse({ format: "mmcif" })
    .modelStructure({});

  // Représentation des protéines
  structure
    .component({ selector: "polymer" })
    .representation({ type: "cartoon" })
    .color({ color: "green" });

  // Représentation des ligands
  structure
    .component({ selector: "ligand" })
    .representation({ type: "ball_and_stick" })
    .color({ color: "#cc3399" });

  const mvsData = builder.getState();

  await molstar.PluginExtensions.mvs.loadMVS(viewer.plugin, mvsData, {
    sourceUrl: undefined,
    sanityChecks: true,
    replaceExisting: true,
  });

  document.getElementById("selected-protein").textContent =
    "Currently displaying: " + protein.name;
    showProteinName(protein); 
}

// 4. RÉCUPÉRATION DES ÉLÉMENTS HTML

const searchInput = document.getElementById("protein-search");
const searchResults = document.getElementById("search-results");

// 5. AFFICHER LES STRUCTURES DISPONIBLES

function showProteins(query = "") {
  searchResults.innerHTML = "";

  // Filtrer les structures selon la recherche
  const results = proteins.filter(function (protein) {
    return protein.name.toLowerCase().includes(query.toLowerCase());
  });

  // Créer un bouton pour chaque structure
  results.forEach(function (protein) {
    const button = document.createElement("button");

    button.className = "search-result";
    button.textContent = protein.name;

    button.addEventListener("click", async function () {
      searchInput.value = protein.name;
      searchResults.hidden = true;

      document.getElementById("selected-protein").textContent =
        "Loading: " + protein.name + "...";

      try {
        await loadProtein(protein);
      } catch (error) {
        console.error("Erreur de chargement :", error);

        document.getElementById("selected-protein").textContent =
          "Error loading " + protein.name + ": " + error.message;
      }
    });

    searchResults.appendChild(button);
  });

  searchResults.hidden = results.length === 0;
}

// 6. RECHERCHE

// Afficher toutes les structures quand on clique dans la barre
searchInput.addEventListener("focus", function () {
  showProteins(searchInput.value.trim());
});

// Filtrer les structures quand on écrit
searchInput.addEventListener("input", function () {
  showProteins(searchInput.value.trim());
});

// 7. FERMER LES RÉSULTATS EN CLIQUANT AILLEURS

document.addEventListener("click", function (event) {
  if (
    !searchInput.contains(event.target) &&
    !searchResults.contains(event.target)
  ) {
    searchResults.hidden = true;
  }
});

// 8. NOM DE LA PROTÉINE (lu dans le fichier .cif local)

// Lit le nom de la première protéine (entité "polymer") dans un texte mmCIF
function readEntityName(cif) {
  const lines = cif.split('\n');
  const clean = (v) => v.replace(/^(['"])(.*)\1$/, '$2');

  // Cas A : plusieurs entités -> tableau "loop_" avec les colonnes _entity.xxx
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== 'loop_') continue;
    const cols = [];
    let j = i + 1;
    while (j < lines.length && lines[j].startsWith('_')) { cols.push(lines[j].trim()); j++; }
    if (!cols.length || !cols[0].startsWith('_entity.')) continue;

    const iType = cols.indexOf('_entity.type');
    const iDesc = cols.indexOf('_entity.pdbx_description');
    if (iDesc < 0) return null;

    const body = [];
    while (j < lines.length && !/^(#|loop_|_)/.test(lines[j])) { body.push(lines[j]); j++; }
    const values = body.join('\n').match(/\n?;[\s\S]*?\n;|'(?:[^']|'(?=\S))*'|"(?:[^"]|"(?=\S))*"|\S+/g) || [];
    const cell = (v) => v.startsWith('\n;') || v.startsWith(';') ? v.replace(/^\n?;/, '').replace(/\n;$/, '').trim() : clean(v);

    for (let r = 0; r + cols.length <= values.length; r += cols.length) {
      const type = iType >= 0 ? clean(values[r + iType]) : 'polymer';
      if (type === 'polymer') return cell(values[r + iDesc]);
    }
  }

  // Cas B : une seule entité -> "_entity.pdbx_description   valeur"
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('_entity.pdbx_description')) {
      const rest = lines[i].slice('_entity.pdbx_description'.length).trim();
      if (rest) return clean(rest);
      const next = lines[i + 1] || '';
      if (next.startsWith(';')) {
        const parts = [next.slice(1)];
        for (let k = i + 2; k < lines.length && !lines[k].startsWith(';'); k++) parts.push(lines[k]);
        return parts.join(' ').trim();
      }
      return clean(next.trim());
    }
  }
  return null;
}

// Remplit le tableau d'informations pour la structure affichée
async function showProteinName(protein) {
  

  const cell = document.getElementById("info-name");
  cell.textContent = "Loading…";

  try {
    const response = await fetch(protein.file);
    if (!response.ok) throw new Error("File not found");
    cell.textContent = readEntityName(await response.text()) || "—";
  } catch (error) {
    cell.textContent = "—";
  }
}