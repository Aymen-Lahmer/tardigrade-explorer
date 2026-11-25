
/**
 * Page /protein_details/ : afficher une structure CIF dans Mol*.
 * Les fichiers CIF sont récupérés via l'API Django /rcsb/.
 */


// 1. INITIALISATION DU VIEWER

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

viewerPromise.then(function (v) {
    viewer = v;
});


// 2. RÉCUPÉRATION DES ÉLÉMENTS HTML

const form = document.getElementById("prot_form");
const input = document.getElementById("prot");
const message = document.getElementById("message");


// 3. CHARGEMENT D'UNE STRUCTURE

async function loadProtein(proteinId) {

    // Attendre que le viewer soit prêt
    if (!viewer) {
        viewer = await viewerPromise;
    }


    // Construire l'URL de l'API Django
    const url = `/rcsb/?id=${encodeURIComponent(proteinId)}`;

    try {

        // Récupérer le fichier CIF depuis Django
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Erreur HTTP : " + response.status);
        }

        const cif = await response.text();

        // Construire la structure avec Mol*
        const builder = molstar.PluginExtensions.mvs.MVSData.createBuilder();

        const structure = builder
            .download({ url: url })
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

        await molstar.PluginExtensions.mvs.loadMVS(
            viewer.plugin,
            mvsData,
            {
                sourceUrl: undefined,
                sanityChecks: true,
                replaceExisting: true,
            }
        );

        // Récupérer les informations de la protéine
        showProteinInfo(proteinId);

    } catch (error) {

        console.error("Erreur de chargement :", error);

        message.textContent =
            "Erreur lors du chargement de " + proteinId + " : " + error.message;
    }


}


// 4. FORMULAIRE DE RECHERCHE

form.addEventListener("submit", async function (event) {

    event.preventDefault();

    const proteinId = input.value.trim().toUpperCase();

    await loadProtein(proteinId);
    
    message.textContent = "Prot affihcée " + proteinId + "...";


});

// 5. INFORMATIONS SUR LA PROTÉINE

async function showProteinInfo(proteinId) {

    const set = (id, value) => {
        const cell = document.getElementById(id);
        if (cell) cell.textContent = value || "—";
    };

    set("info-id", proteinId);
    set("info-name", "Loading…");

    try {

        const response = await fetch(
            `https://data.rcsb.org/rest/v1/core/polymer_entity/${proteinId}/1`
        );

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();

        const length = data.entity_poly?.rcsb_sample_sequence_length;
        const weight = data.rcsb_polymer_entity?.formula_weight;

        set("info-name", data.rcsb_polymer_entity?.pdbx_description);
        set("info-length", length && length + " aa");
        set("info-weight", weight && weight + " kDa");

        set(
            "info-uniprot",
            data.rcsb_polymer_entity_container_identifiers?.uniprot_ids?.[0]
        );

    } catch (error) {

        console.error("Informations indisponibles :", error);

        set("info-name", "");
        set("info-length", "");
        set("info-weight", "");
        set("info-uniprot", "");
    }

    set("selected-protein", proteinId)
}