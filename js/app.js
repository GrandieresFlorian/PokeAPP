import { db } from './firebase-config.js';
import { state, CONSTS } from './state.js';
import { initNav, updateAuthUI,startNotificationListener } from './controllers/navController.js';
import { initAuth } from './controllers/authController.js';
import { initBooster, updateBoosterLogic } from './controllers/boosterController.js';
import { initCollection } from './controllers/collectionController.js';
import { initFriends, startFriendsListener } from './controllers/friendsController.js';
import { initTrade } from './controllers/tradeController.js';
import { initCheats } from './controllers/cheatController.js';
import { initProfile } from './controllers/profileController.js';
import { initGarden } from './controllers/gardenController.js';
import { initCampagne } from './controllers/campagneController.js';
import { initQuests } from './controllers/questController.js';
import { initMenus } from './controllers/menusController.js';
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

    db.collection('settings').doc('probabilities').get().then(doc => {
        if (doc.exists) state.probabilities = { ...state.probabilities, ...doc.data() };
    }).catch(e => console.error(e));

    db.collection('settings').doc('trainerConfig').get().then(doc => {
        if (doc.exists) state.trainerConfig = { ...state.trainerConfig, ...doc.data() };
        const maxDisplay = document.getElementById('trainer-max-display');
            if (maxDisplay) {
                maxDisplay.textContent = `/ ${state.trainerConfig.maxBoosters}`;
            }
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
    
    fetch('dresseurs.json')
        .then(r => r.json())
        .then(data => { state.dresseursData = data; })
        .catch(e => console.error("Fichier dresseurs.json introuvable :", e));

    if (state.currentUser) {
        db.collection('users').doc(state.currentUser).get().then(doc => {
            if (doc.exists) {
                state.currentUserData = doc.data();
                
                // --- 1. MIGRATION ET COMPRESSION DES CARTES ---
                if (state.currentUserData.collection && state.currentUserData.collection.length > 0) {
                    console.log(`🔄 Analyse de la collection : ${state.currentUserData.collection.length} éléments trouvés...`);
                    
                    let groupedMap = {};
                    state.currentUserData.collection.forEach(card => {
                        // --- SÉCURITÉ : Si c'est un dresseur, on le garde tel quel sans le supprimer ---
                        if (card.isTrainer) {
                            const key = `trainer_${card.variantId}`;
                            if (!groupedMap[key]) {
                                groupedMap[key] = { ...card, quantity: Number(card.quantity || 1) };
                            } else {
                                groupedMap[key].quantity += Number(card.quantity || 1);
                            }
                            return;
                        }

                        // Sinon, c'est un Pokémon classique :
                        const rawNum = card.pokedexNumber || (card.data && card.data.pokedexNumber);
                        if (!rawNum) return; // SÉCURITÉ : On ignore les cartes corrompues sans ID
                        
                        const num = Number(rawNum);
                        const isShiny = card.shiny ? "1" : "0";
                        const isMega = card.mega ? "1" : "0";
                        const megaForm = card.megaForm || "none";
                        
                        const key = `p_${num}_s_${isShiny}_m_${isMega}_f_${megaForm}`;
                        
                        if (!groupedMap[key]) {
                            groupedMap[key] = {
                                ...card,
                                pokedexNumber: num,
                                quantity: Number(card.quantity || 1)
                            };
                        } else {
                            groupedMap[key].quantity += Number(card.quantity || 1);
                            if ((card.maxLevel || 20) > (groupedMap[key].maxLevel || 20)) {
                                groupedMap[key].maxLevel = card.maxLevel;
                                groupedMap[key].level = card.level;
                            }
                        }
                    });

                    const nouvelleCollection = Object.values(groupedMap);
                    console.log(`✨ Fusion cartes terminée ! Réduit à ${nouvelleCollection.length} cartes uniques.`);
                    state.currentUserData.collection = JSON.parse(JSON.stringify(nouvelleCollection));
                }
                
                // --- 2. MIGRATION ET COMPRESSION DES BAIES ---
                if (state.currentUserData.berries && state.currentUserData.berries.length > 0) {
                    console.log(`🔄 Analyse des baies : ${state.currentUserData.berries.length} éléments trouvés...`);
                    
                    let groupedBerries = {};
                    state.currentUserData.berries.forEach(berry => {
                        const berryId = berry.id || berry.data?.id || "unknown";
                        
                        if (!groupedBerries[berryId]) {
                            groupedBerries[berryId] = {
                                ...berry,
                                id: berryId,
                                quantity: Number(berry.quantity || 1)
                            };
                        } else {
                            groupedBerries[berryId].quantity += Number(berry.quantity || 1);
                        }
                    });

                    const nouvellesBaies = Object.values(groupedBerries);
                    console.log(`✨ Fusion baies terminée ! Réduit à ${nouvellesBaies.length} types de baies uniques.`);
                    state.currentUserData.berries = JSON.parse(JSON.stringify(nouvellesBaies));
                }

                // --- 3. SAUVEGARDE GLOBALE VERS FIREBASE ---
                db.collection('users').doc(state.currentUser).update({
                    collection: state.currentUserData.collection || [],
                    berries: state.currentUserData.berries || []
                }).then(() => {
                    console.log("🔥 SUCCÈS : Firebase a reçu les données compressées (Cartes + Baies) !");
                }).catch(err => {
                    console.error("❌ ERREUR FIREBASE :", err);
                });

                if (state.currentUserData.boostersLeft === undefined) {
                    state.currentUserData.boostersLeft = CONSTS.MAX_BOOSTERS;
                    state.currentUserData.lastBoosterTime = Date.now();
                }
                if (state.currentUserData.pokeBerrys === undefined) {
                    state.currentUserData.pokeBerrys = 0;
                }
                if (state.currentUserData.pokeDollars === undefined) {
                    state.currentUserData.pokeDollars = 0;
                }
                if (state.currentUserData.pokePts === undefined) {
                    state.currentUserData.pokePts = 0;
                }
                if (!state.currentUserData.mastery) {
                    state.currentUserData.mastery = { ko: {}, catch: {} };
                }
                if (state.currentUserData.trainerBoostersLeft === undefined) {
                    state.currentUserData.trainerBoostersLeft = state.trainerConfig.maxBoosters;
                    state.currentUserData.lastTrainerBoosterTime = Date.now();
                }
                
                initQuests();
                updateAuthUI(); 
                updateBoosterLogic(); 
                startNotificationListener();
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