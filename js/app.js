import { db } from './firebase-config.js';
import { state } from './state.js';
import { initNav, updateAuthUI } from './controllers/navController.js';
import { initAuth } from './controllers/authController.js';
import { initBooster } from './controllers/boosterController.js';
import { initCollection } from './controllers/collectionController.js';
import { initFriends } from './controllers/friendsController.js';
import { initTrade } from './controllers/tradeController.js';
import { initCheats } from './controllers/cheatController.js';
import { initProfile } from './controllers/profileController.js';
import { initGarden } from './controllers/gardenController.js';
import { initCampagne } from './controllers/campagneController.js';
import { initMenus } from './controllers/menusController.js';
import { loadUser, setReadyPromise } from './userService.js';

window.debugState = state; // ⚠️ à retirer en production

document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initMenus();
    initAuth();
    initBooster();
    initCollection();
    initFriends();
    initTrade();
    initCheats();
    initProfile();
    initGarden();
    initCampagne();

    // Toutes les données du jeu sont chargées AVANT de normaliser l'utilisateur
    // (les valeurs par défaut dépendent de trainerConfig, etc.)
    const safe = (promise, label) => promise.catch(e => console.error(label, e));

    const loads = [
        safe(db.collection('settings').doc('probabilities').get().then(doc => {
            if (doc.exists) state.probabilities = { ...state.probabilities, ...doc.data() };
        }), 'probabilities'),

        safe(db.collection('settings').doc('trainerConfig').get().then(doc => {
            if (doc.exists) state.trainerConfig = { ...state.trainerConfig, ...doc.data() };
            const maxDisplay = document.getElementById('trainer-max-display');
            if (maxDisplay) maxDisplay.textContent = `/ ${state.trainerConfig.maxBoosters}`;
        }), 'trainerConfig'),

        safe(db.collection('settings').doc('berries').get().then(doc => {
            if (doc.exists) state.berryConfig = { ...state.berryConfig, ...doc.data() };
        }), 'berries'),

        safe(fetch('data.json').then(r => r.json()).then(d => { state.pokemonDataList = d.pokemon; }), 'data.json'),
        safe(fetch('moves.json').then(r => r.json()).then(d => { state.movesData = d; }), 'moves.json'),
        safe(fetch('dresseurs.json').then(r => r.json()).then(d => { state.dresseursData = d; }), 'dresseurs.json')
    ];
    setReadyPromise(Promise.all(loads));

    if (state.currentUser) {
        loadUser(state.currentUser)
            .then(ok => {
                if (!ok) {
                    state.currentUser = null;
                    localStorage.removeItem('pokeAppCurrentUser');
                    updateAuthUI();
                }
            })
            .catch(err => {
                console.error('Erreur de chargement du profil :', err);
                updateAuthUI();
            });
    } else {
        updateAuthUI();
    }
});
