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
import { initCampagne } from './controllers/campagneController.js';

document.addEventListener("DOMContentLoaded", () => {
    initNav(); 
    initAuth(); 
    initBooster(); 
    initCollection(); 
    initFriends();
    initTrade(); 
    initCheats(); 
    initProfile(); 
    initGarden(); 
    initCampagne();

    db.collection('settings').doc('probabilities').get().then(doc => {
        if (doc.exists) state.probabilities = { ...state.probabilities, ...doc.data() };
    }).catch(e => console.error(e));

    db.collection('settings').doc('berries').get().then(doc => {
        if (doc.exists) state.berryConfig = { ...state.berryConfig, ...doc.data() };
    }).catch(e => console.error(e));

    fetch('data.json')
        .then(r => r.json())
        .then(data => { state.pokemonDataList = data.pokemon; })
        .catch(e => console.error(e));

    // NOUVEAU : Chargement de la mémoire des attaques !
    fetch('moves.json')
        .then(r => r.json())
        .then(data => { state.movesData = data; })
        .catch(e => console.error("Fichier moves.json introuvable :", e));

    if (state.currentUser) {
        db.collection('users').doc(state.currentUser).get().then(doc => {
            if (doc.exists) {
                state.currentUserData = doc.data();
                
                // --- SCRIPT DE MIGRATION ANTI-DOUBLONS (OPTIMISATION FIREBASE) ---
                if (state.currentUserData.collection && state.currentUserData.collection.length > 0) {
                    let collectionNeedsUpdate = false;
                    let groupedMap = {};
                    
                    state.currentUserData.collection.forEach(card => {
                        // On crée une clé unique pour chaque variante de Pokémon
                        const key = `${card.pokedexNumber}_${card.shiny}_${card.mega}_${card.megaForm}`;
                        
                        if (!groupedMap[key]) {
                            // Première fois qu'on voit ce Pokémon, on l'ajoute avec quantité
                            groupedMap[key] = { ...card, quantity: card.quantity || 1 };
                        } else {
                            // C'est un doublon ! On l'efface en augmentant la quantité du principal
                            collectionNeedsUpdate = true;
                            groupedMap[key].quantity += (card.quantity || 1);
                            
                            // Si ce doublon avait un meilleur niveau/rang, on garde ses stats
                            if ((card.maxLevel || 20) > (groupedMap[key].maxLevel || 20)) {
                                const totalQty = groupedMap[key].quantity;
                                groupedMap[key] = { ...card, quantity: totalQty };
                            }
                        }
                    });

                    // S'il y avait des doublons à nettoyer, on met à jour Firebase instantanément
                    if (collectionNeedsUpdate) {
                        state.currentUserData.collection = Object.values(groupedMap);
                        db.collection('users').doc(state.currentUser).update({
                            collection: state.currentUserData.collection
                        }).then(() => console.log("Collection optimisée avec succès (doublons fusionnés) !"));
                    }
                }
                // -----------------------------------------------------------------

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