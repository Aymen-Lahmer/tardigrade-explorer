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
    showProteinInfo(protein); 
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

// 8. TABLEAU D'INFORMATIONS (données de la base PDB, via l'identifiant)

async function showProteinInfo(protein) {
  // Écrit une valeur dans une case ; ignore les cases absentes du HTML
  const set = (id, value) => {
    const cell = document.getElementById(id);
    if (cell) cell.textContent = value || "—";
  };

  set("info-id", protein.name);
  set("info-name", "Loading…");

  try {
    const response = await fetch(
      `https://data.rcsb.org/rest/v1/core/polymer_entity/${protein.name}/1`
    );
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();

    const length = data.entity_poly?.rcsb_sample_sequence_length;
    const weight = data.rcsb_polymer_entity?.formula_weight;

    set("info-name", data.rcsb_polymer_entity?.pdbx_description);
    set("info-length", length && length + " aa");
    set("info-weight", weight && weight + " kDa");
    set("info-uniprot", data.rcsb_polymer_entity_container_identifiers?.uniprot_ids?.[0]);
  } catch (error) {
    console.error("Infos indisponibles pour " + protein.name + " :", error);
    set("info-name", "");
    set("info-length", "");
    set("info-weight", "");
    set("info-uniprot", "");
  }
}