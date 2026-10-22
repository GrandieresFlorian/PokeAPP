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

    fetch('moves.json')
        .then(r => r.json())
        .then(data => { state.movesData = data; })
        .catch(e => console.error("Fichier moves.json introuvable :", e));

        if (state.currentUser) {
            db.collection('users').doc(state.currentUser).get().then(doc => {
                if (doc.exists) {
                    state.currentUserData = doc.data();
                    
                    // --- SCRIPT DE MIGRATION ANTI-DOUBLONS (CARTES) ---
                    if (state.currentUserData.collection && state.currentUserData.collection.length > 0) {
                        let collectionNeedsUpdate = false;
                        let groupedMap = {};
                        
                        state.currentUserData.collection.forEach(card => {
                            // Clé plus robuste pour éviter les bugs avec undefined
                            const key = `${card.pokedexNumber}_${!!card.shiny}_${!!card.mega}_${card.megaForm || 'none'}`;
                            
                            if (!groupedMap[key]) {
                                groupedMap[key] = { ...card, quantity: Number(card.quantity || 1) };
                            } else {
                                collectionNeedsUpdate = true;
                                groupedMap[key].quantity += Number(card.quantity || 1);
                                
                                if ((card.maxLevel || 20) > (groupedMap[key].maxLevel || 20)) {
                                    const totalQty = groupedMap[key].quantity;
                                    groupedMap[key] = { ...card, quantity: totalQty };
                                }
                            }
                        });
    
                        if (collectionNeedsUpdate) {
                            // L'astuce magique JSON nettoie les 'undefined' que Firebase refuse d'enregistrer
                            state.currentUserData.collection = JSON.parse(JSON.stringify(Object.values(groupedMap)));
                            db.collection('users').doc(state.currentUser).update({
                                collection: state.currentUserData.collection
                            }).then(() => console.log("✅ Collection optimisée avec succès !"))
                              .catch(err => console.error("❌ Erreur Firebase Collection :", err));
                        }
                    }
                    
                    // --- SCRIPT DE MIGRATION ANTI-DOUBLONS (BAIES) ---
                    if (state.currentUserData.berries && state.currentUserData.berries.length > 0) {
                        let berriesNeedUpdate = false;
                        let groupedBerries = {};
                        
                        state.currentUserData.berries.forEach(berry => {
                            if (!groupedBerries[berry.id]) {
                                groupedBerries[berry.id] = { ...berry, quantity: Number(berry.quantity || 1) };
                            } else {
                                berriesNeedUpdate = true;
                                groupedBerries[berry.id].quantity += Number(berry.quantity || 1);
                            }
                        });
    
                        if (berriesNeedUpdate) {
                            state.currentUserData.berries = JSON.parse(JSON.stringify(Object.values(groupedBerries)));
                            db.collection('users').doc(state.currentUser).update({
                                berries: state.currentUserData.berries
                            }).then(() => console.log("✅ Baies optimisées avec succès !"))
                              .catch(err => console.error("❌ Erreur Firebase Baies :", err));
                        }
                    }
    
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