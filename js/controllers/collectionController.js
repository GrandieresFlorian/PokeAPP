import { state } from '../state.js';

export function initCollection() {
    document.getElementById('nav-collection').addEventListener('click', afficherCollection);
}

export function afficherCollection() {
    const collectionContainer = document.getElementById('collection-container');
    collectionContainer.innerHTML = "<p style='color:gray;'>Affichage modulaire actif. Implémentez la boucle render ici.</p>";
}