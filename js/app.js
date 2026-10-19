import { db } from './firebase-config.js';
import { state, CONSTS } from './state.js';
import { initNav, updateAuthUI } from './controllers/navController.js';
import { initAuth } from './controllers/authController.js';
import { initBooster, updateBoosterLogic } from './controllers/boosterController.js';
import { initCollection } from './controllers/collectionController.js';
import { initFriends, startFriendsListener } from './controllers/friendsController.js';
import { initTrade } from './controllers/tradeController.js';
import { initCheats } from './controllers/cheatController.js';
import { initProfile } from './controllers/profileController.js';
import { initGarden } from './controllers/gardenController.js';

document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initAuth();
    initBooster();
    initCollection();
    initFriends();
    initTrade();
    initCheats();
    initProfile();
    initGarden(); // <-- Initialisation du Jardin

    // Chargement des probabilités
    db.collection('settings').doc('probabilities').get().then(doc => {
        if (doc.exists) {
            state.probabilities = { ...state.probabilities, ...doc.data() };
            console.log("Probabilités synchronisées avec Firebase :", state.probabilities);
        }
    }).catch(e => console.error("Erreur de chargement des probabilités :", e));

    // Chargement de la configuration des baies (Pour régler leur temps de pousse sur Firebase)
    db.collection('settings').doc('berries').get().then(doc => {
        if (doc.exists) {
            state.berryConfig = { ...state.berryConfig, ...doc.data() };
            console.log("Configurations des baies synchronisées.");
        }
    }).catch(e => console.error("Erreur de chargement config baies :", e));

    fetch('data.json')
        .then(r => r.json())
        .then(data => { state.pokemonDataList = data.pokemon; })
        .catch(e => console.error(e));

    if (state.currentUser) {
        db.collection('users').doc(state.currentUser).get().then(doc => {
            if (doc.exists) {
                state.currentUserData = doc.data();
                if (state.currentUserData.boostersLeft === undefined) {
                    state.currentUserData.boostersLeft = CONSTS.MAX_BOOSTERS;
                    state.currentUserData.lastBoosterTime = Date.now();
                }
                if (state.currentUserData.pokeBerrys === undefined) {
                    state.currentUserData.pokeBerrys = 0;
                }
                updateAuthUI();
                updateBoosterLogic();
                startFriendsListener();
            } else {
                state.currentUser = null;
                localStorage.removeItem('pokeAppCurrentUser');
                updateAuthUI();
            }
        });
    } else {
        updateAuthUI();
    }
});