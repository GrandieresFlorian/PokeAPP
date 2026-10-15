import { db } from './firebase-config.js';
import { state, CONSTS } from './state.js';
import { initNav, updateAuthUI } from './controllers/navController.js';
import { initAuth } from './controllers/authController.js';
import { initBooster, updateBoosterLogic } from './controllers/boosterController.js';
import { initCollection } from './controllers/collectionController.js';
import { initFriends, startFriendsListener } from './controllers/friendsController.js';
import { initTrade } from './controllers/tradeController.js';
import { initCheats } from './controllers/cheatController.js';

document.addEventListener("DOMContentLoaded", () => {
    initNav();
    initAuth();
    initBooster();
    initCollection();
    initFriends();
    initTrade();
    initCheats();

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