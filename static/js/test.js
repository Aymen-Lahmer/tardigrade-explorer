// 1. Liste des protéines disponibles
let proteins = ["4R5J", "4RPK"];

// 2. Récupérer les éléments HTML
let proteinInput = document.getElementById("protein-search");
let proteinList = document.getElementById("protein-list");
let selectedProtein = document.getElementById("selected-protein");

// 3. Ajouter les protéines dans la liste
proteins.forEach(function(protein) {

    let option = document.createElement("option");

    option.value = protein;

    proteinList.appendChild(option);

});

// 4. Détecter la protéine sélectionnée
proteinInput.addEventListener("input", function() {

    let proteinName = proteinInput.value.trim().toUpperCase();

    if (proteins.includes(proteinName)) {

        selectedProtein.textContent =
            "Currently displaying: " + proteinName;

    }

});

console.log("Mon fichier JavaScript est chargé !");
console.log("Molstar :", molstar);