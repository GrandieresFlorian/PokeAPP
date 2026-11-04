import { state } from '../state.js';
import { ITEMS_DB, getKOMastery, getCatchMastery } from './campagneBattleController.js';
import { db } from '../firebase-config.js'; // Nécessaire pour sauvegarder les achats

export function initMenus() {
    document.getElementById('nav-sac').addEventListener('click', renderSac);
    document.getElementById('nav-recherche').addEventListener('click', renderRecherche);
    document.getElementById('nav-boutique').addEventListener('click', renderBoutique);
    
    document.getElementById('search-recherche').addEventListener('input', renderRecherche);
}

// ==========================================
// BOUTIQUE
// ==========================================
export function renderBoutique() {
    const container = document.getElementById('boutique-container');
    container.innerHTML = "";
    
    const pdDisplay = document.getElementById('boutique-pd-display');
    if (pdDisplay) pdDisplay.textContent = state.currentUserData?.pokeDollars || 0;
    
    for (let itemId in ITEMS_DB) {
        let item = ITEMS_DB[itemId];
        if (!item.price) continue; // On n'affiche que les objets qui ont un prix
        
        let name = state.currentLang === 'en' ? item.nameEn : item.nameFr;
        let imgHtml = item.img ? `<img src="${item.img}" style="width: 60px; height: 60px; object-fit: contain;">` : `<div style="font-size: 3rem;">${item.icon}</div>`;
        
        container.innerHTML += `
            <div class="glass-panel" style="width: 180px; text-align: center; padding: 15px; display: flex; flex-direction: column; align-items: center;">
                ${imgHtml}
                <h4 style="margin: 10px 0 5px 0; color: #fff;">${name}</h4>
                <div style="font-size: 0.75rem; color: #aaa; margin-bottom: 15px; height: 30px;">${item.desc}</div>
                <button id="buy-${itemId}" class="btn btn-secondary" style="width: 100%; background: #2ecc71; border-color: #27ae60;">Acheter (${item.price} PD$)</button>
            </div>
        `;
    }
    
    // Attacher les événements d'achat après avoir généré le HTML
    for (let itemId in ITEMS_DB) {
        let btn = document.getElementById(`buy-${itemId}`);
        if (btn) btn.onclick = () => buyItem(itemId);
    }
}

function buyItem(itemId) {
    let item = ITEMS_DB[itemId];
    if (!item || !item.price) return;
    
    if ((state.currentUserData.pokeDollars || 0) < item.price) {
        return alert(state.currentLang === 'en' ? "Not enough PokéDollars!" : "Fonds insuffisants !");
    }
    
    // On déduit l'argent et on ajoute l'objet
    state.currentUserData.pokeDollars -= item.price;
    if (!state.currentUserData.inventory) state.currentUserData.inventory = {};
    state.currentUserData.inventory[itemId] = (state.currentUserData.inventory[itemId] || 0) + 1;
    
    // Mise à jour de l'affichage global de l'argent
    const mainPdDisplay = document.getElementById('pokedollar-display');
    if (mainPdDisplay) mainPdDisplay.textContent = state.currentUserData.pokeDollars;
    
    renderBoutique(); // On rafraîchit la boutique
    
    // Sauvegarde en base de données
    db.collection('users').doc(state.currentUser).update({
        pokeDollars: state.currentUserData.pokeDollars,
        inventory: state.currentUserData.inventory
    }).catch(e => console.error("Erreur d'achat :", e));
}

// ==========================================
// SAC À DOS
// ==========================================
export function renderSac() {
    const container = document.getElementById('sac-container');
    container.innerHTML = "";
    
    const inventory = state.currentUserData?.inventory || {};
    let hasItems = false;
    
    for (let itemId in inventory) {
        let qty = inventory[itemId];
        if (qty > 0 && ITEMS_DB[itemId]) {
            hasItems = true;
            let item = ITEMS_DB[itemId];
            let name = state.currentLang === 'en' ? item.nameEn : item.nameFr;
            let imgHtml = item.img ? `<img src="${item.img}" style="width: 50px; height: 50px; object-fit: contain; margin-bottom:10px;">` : `<div style="font-size: 3rem; margin-bottom:10px;">${item.icon}</div>`;
            
            container.innerHTML += `
                <div class="glass-panel" style="width: 160px; text-align: center; padding: 15px; position: relative; display: flex; flex-direction: column; align-items: center;">
                    <div class="badge-quantite" style="top: -10px; right: -10px; font-size:1rem;">x${qty}</div>
                    ${imgHtml}
                    <h4 style="margin: 0 0 5px 0; color: #fff;">${name}</h4>
                    <div style="font-size: 0.75rem; color: #aaa;">${item.desc}</div>
                </div>
            `;
        }
    }
    
    if (!hasItems) {
        container.innerHTML = `<p style='color: #aaa; width:100%; text-align:center;'>Votre sac est vide. Achetez des objets à la boutique !</p>`;
    }
}

// ==========================================
// RECHERCHE (PALIERS)
// ==========================================
// ==========================================
// RECHERCHE (PALIERS)
// ==========================================
export function renderRecherche() {
    const container = document.getElementById('recherche-container');
    container.innerHTML = "";

    if (!state.currentUserData.mastery) {
        state.currentUserData.mastery = { ko: {}, catch: {} };
    }
    
    const pokePtsDisplay = document.getElementById('recherche-pokepts');
    if (pokePtsDisplay) pokePtsDisplay.textContent = state.currentUserData?.pokePts || 0;
    
    const searchVal = document.getElementById('search-recherche').value.toLowerCase();
    
    const seen = state.currentUserData?.seen || [];
    const collectionIds = (state.currentUserData?.collection || []).map(c => c.pokedexNumber);
    const knownIds = new Set([...seen, ...collectionIds]);
    
    // Seuils des 10 paliers
    const KO_THRESHOLDS = [10, 25, 50, 100, 200, 350, 500, 750, 1000, 1500];
    const CATCH_THRESHOLDS = [2, 5, 10, 20, 40, 70, 110, 160, 220, 300];

    // Fonction pour calculer la progression vers le prochain palier (en pourcentage)
    function getProgressDetails(currentVal, thresholds) {
        let currentTier = 0;
        for (let i = 0; i < thresholds.length; i++) {
            if (currentVal >= thresholds[i]) currentTier = i + 1;
            else break;
        }

        // Si le palier max (10) est atteint
        if (currentTier >= 10) {
            return { tier: 10, percent: 100, text: "MAX" };
        }

        // Seuil du palier précédent (ou 0 pour le premier palier)
        let prevThreshold = currentTier === 0 ? 0 : thresholds[currentTier - 1];
        // Seuil du palier suivant à atteindre
        let nextThreshold = thresholds[currentTier];

        let currentProgress = currentVal - prevThreshold;
        let totalNeeded = nextThreshold - prevThreshold;
        let percent = Math.min(100, Math.max(0, Math.floor((currentProgress / totalNeeded) * 100)));

        return { tier: currentTier, percent: percent, text: `${currentVal}/${nextThreshold}` };
    }
    
    let html = "";
    
    for (let i = 1; i <= 1025; i++) {
        let koCount = (state.currentUserData.mastery?.ko?.[i]) || (state.currentUserData.mastery?.ko?.[String(i)]) || 0;
        let catchCount = (state.currentUserData.mastery?.catch?.[i]) || (state.currentUserData.mastery?.catch?.[String(i)]) || 0;
        if (koCount === 0 && catchCount === 0) continue;
        
        const pkmnData = state.pokemonDataList[i - 1];
        if (!pkmnData) continue;
        
        let nameFr = pkmnData.fr || "";
        let nameEn = pkmnData.en || "";
        let displayName = state.currentLang === 'en' ? nameEn : nameFr;
        
        if (searchVal && !nameFr.toLowerCase().includes(searchVal) && !nameEn.toLowerCase().includes(searchVal)) continue;

        let koProg = getProgressDetails(koCount, KO_THRESHOLDS);
        let catchProg = getProgressDetails(catchCount, CATCH_THRESHOLDS);

        let sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${i}.png`;
        
        html += `
            <div class="glass-panel" style="width: 240px; padding: 15px; display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.4);">
                <img src="${sprite}" style="width: 80px; height: 80px; object-fit: contain; filter: drop-shadow(0 0 5px rgba(255,255,255,0.2));">
                <h4 style="margin: 5px 0; font-size:1.1rem;">${displayName} <span style="font-size:0.8rem; color:#777;">#${i}</span></h4>
                
                <!-- Barre de Progression K.O. -->
                <div style="width: 100%; margin-top: 15px; font-size: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span>⚔️ K.O. (${koProg.text})</span>
                        <span style="color: ${koProg.tier === 10 ? '#f1c40f' : '#fff'}; font-weight:bold;">Palier ${koProg.tier}/10</span>
                    </div>
                    <div style="background: #222; height: 8px; border-radius: 4px; width: 100%; border: 1px solid #444; overflow:hidden;">
                        <div style="background: linear-gradient(90deg, #c0392b, #e74c3c); height: 100%; width: ${koProg.percent}%; border-radius: 3px; transition: 0.5s;"></div>
                    </div>
                </div>
                
                <!-- Barre de Progression Capture -->
                <div style="width: 100%; margin-top: 15px; font-size: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                        <span>🎯 Capture (${catchProg.text})</span>
                        <span style="color: ${catchProg.tier === 10 ? '#f1c40f' : '#fff'}; font-weight:bold;">Palier ${catchProg.tier}/10</span>
                    </div>
                    <div style="background: #222; height: 8px; border-radius: 4px; width: 100%; border: 1px solid #444; overflow:hidden;">
                        <div style="background: linear-gradient(90deg, #27ae60, #2ecc71); height: 100%; width: ${catchProg.percent}%; border-radius: 3px; transition: 0.5s;"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    if (html === "") container.innerHTML = `<p style='color: #aaa; width:100%; text-align:center;'>Aucun Pokémon trouvé. Partez en explorer d'autres !</p>`;
    else container.innerHTML = html;
}