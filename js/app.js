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

document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initAuth();
    initBooster();
    initCollection();
    initFriends();
    initTrade();
    initCheats();
    initProfile();

    db.collection('settings').doc('probabilities').get().then(doc => {
        if (doc.exists) {
            // Fusionne les paramètres par défaut avec ceux de Firebase
            state.probabilities = { ...state.probabilities, ...doc.data() };
            console.log("Probabilités synchronisées avec Firebase :", state.probabilities);
        } else {
            console.log("Paramètres introuvables sur Firebase, utilisation des valeurs par défaut.");
        }
    }).catch(e => console.error("Erreur de chargement des probabilités :", e));

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