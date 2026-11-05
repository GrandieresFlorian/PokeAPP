import { state } from '../state.js';
import { ITEMS_DB } from './campagneBattleController.js';
import { db } from '../firebase-config.js';

export function initMenus() {
    document.getElementById('nav-sac')?.addEventListener('click', renderSac);
    document.getElementById('nav-recherche')?.addEventListener('click', renderRecherche);
    document.getElementById('nav-boutique')?.addEventListener('click', renderBoutique);
    
    document.getElementById('search-recherche')?.addEventListener('input', renderRecherche);
}

// ==========================================
// BOUTIQUE
// ==========================================
export function renderBoutique() {
    const container = document.getElementById('boutique-container');
    if (!container) return;
    container.innerHTML = "";
    
    const pdDisplay = document.getElementById('boutique-pd-display');
    if (pdDisplay) pdDisplay.textContent = state.currentUserData?.pokeDollars || 0;
    
    for (let itemId in ITEMS_DB) {
        let item = ITEMS_DB[itemId];
        if (!item.price) continue;
        
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
    
    state.currentUserData.pokeDollars -= item.price;
    if (!state.currentUserData.inventory) state.currentUserData.inventory = {};
    state.currentUserData.inventory[itemId] = (state.currentUserData.inventory[itemId] || 0) + 1;
    
    const mainPdDisplay = document.getElementById('pokedollar-display');
    if (mainPdDisplay) mainPdDisplay.textContent = state.currentUserData.pokeDollars;
    
    renderBoutique();
    
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
    if (!container) return;
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
// RECHERCHE & PALIERS (AVEC RÉCUPÉRATION & INFOS)
// ==========================================
export function renderRecherche() {
    const container = document.getElementById('recherche-container');
    if (!container) return;
    container.innerHTML = "";

    if (!state.currentUserData.mastery) {
        state.currentUserData.mastery = { ko: {}, catch: {}, claimed: {} };
    }
    if (!state.currentUserData.mastery.claimed) {
        state.currentUserData.mastery.claimed = { ko: {}, catch: {} };
    }
    
    const pokePtsDisplay = document.getElementById('recherche-pokepts');
    if (pokePtsDisplay) pokePtsDisplay.textContent = state.currentUserData?.pokePts || 0;
    
    const searchVal = document.getElementById('search-recherche')?.value.toLowerCase() || "";
    
    const KO_THRESHOLDS = [10, 25, 50, 100, 200, 350, 500, 750, 1000, 1500];
    const CATCH_THRESHOLDS = [2, 5, 10, 20, 40, 70, 110, 160, 220, 300];

    function getTier(val, thresholds) {
        let tier = 0;
        for (let i = 0; i < thresholds.length; i++) {
            if (val >= thresholds[i]) tier = i + 1;
            else break;
        }
        return tier;
    }

    function getProgressDetails(currentVal, thresholds) {
        let currentTier = getTier(currentVal, thresholds);
        if (currentTier >= 10) return { tier: 10, percent: 100, text: "MAX" };

        let prevThreshold = currentTier === 0 ? 0 : thresholds[currentTier - 1];
        let nextThreshold = thresholds[currentTier];

        let currentProgress = currentVal - prevThreshold;
        let totalNeeded = nextThreshold - prevThreshold;
        let percent = Math.min(100, Math.max(0, Math.floor((currentProgress / totalNeeded) * 100)));

        return { tier: currentTier, percent: percent, text: `${currentVal}/${nextThreshold}` };
    }
    
    let html = "";
    const masteryKo = state.currentUserData.mastery.ko || {};
    const masteryCatch = state.currentUserData.mastery.catch || {};
    const claimed = state.currentUserData.mastery.claimed || { ko: {}, catch: {} };
    if (!claimed.ko) claimed.ko = {};
    if (!claimed.catch) claimed.catch = {};

    const recordedIds = new Set([...Object.keys(masteryKo), ...Object.keys(masteryCatch)]);

    recordedIds.forEach(idStr => {
        let koCount = Number(masteryKo[idStr] || 0);
        let catchCount = Number(masteryCatch[idStr] || 0);
        
        if (koCount === 0 && catchCount === 0) return;
        
        let pokedexNum = Number(idStr);
        const pkmnData = state.pokemonDataList[pokedexNum - 1];
        if (!pkmnData) return;
        
        let nameFr = pkmnData.fr || "";
        let nameEn = pkmnData.en || "";
        let displayName = state.currentLang === 'en' ? nameEn : nameFr;
        
        if (searchVal && !nameFr.toLowerCase().includes(searchVal) && !nameEn.toLowerCase().includes(searchVal)) return;

        let koTier = getTier(koCount, KO_THRESHOLDS);
        let catchTier = getTier(catchCount, CATCH_THRESHOLDS);

        let koClaimedCount = Number(claimed.ko[idStr] || 0);
        let catchClaimedCount = Number(claimed.catch[idStr] || 0);

        let koClaimable = koTier > koClaimedCount;
        let catchClaimable = catchTier > catchClaimedCount;

        let koProg = getProgressDetails(koCount, KO_THRESHOLDS);
        let catchProg = getProgressDetails(catchCount, CATCH_THRESHOLDS);
        let sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokedexNum}.png`;
        
        html += `
            <div class="glass-panel" style="width: 250px; padding: 15px; display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,0.5);">
                <img src="${sprite}" style="width: 80px; height: 80px; object-fit: contain; filter: drop-shadow(0 0 5px rgba(255,255,255,0.2));">
                <h4 style="margin: 5px 0; font-size:1.1rem;">${displayName} <span style="font-size:0.8rem; color:#777;">#${pokedexNum}</span></h4>
                
                <!-- K.O. Section -->
                <div style="width: 100%; margin-top: 12px; font-size: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <span>⚔️ K.O. (${koProg.text})</span>
                        <div style="display:flex; align-items:center; gap:5px;">
                            <span style="color: ${koTier === 10 ? '#f1c40f' : '#fff'}; font-weight:bold;">Palier ${koTier}/10</span>
                            ${koClaimable ? `<button id="claim-ko-${pokedexNum}" class="btn" style="padding: 2px 6px; font-size: 0.7rem; background: #f1c40f; color: #000; font-weight: bold; border-radius: 4px; cursor: pointer;">Récupérer</button>` : ''}
                        </div>
                    </div>
                    <div style="background: #222; height: 8px; border-radius: 4px; width: 100%; border: 1px solid #444; overflow:hidden;">
                        <div style="background: linear-gradient(90deg, #c0392b, #e74c3c); height: 100%; width: ${koProg.percent}%; border-radius: 3px;"></div>
                    </div>
                </div>
                
                <!-- Capture Section -->
                <div style="width: 100%; margin-top: 12px; font-size: 0.85rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <span>🎯 Capture (${catchProg.text})</span>
                        <div style="display:flex; align-items:center; gap:5px;">
                            <span style="color: ${catchTier === 10 ? '#f1c40f' : '#fff'}; font-weight:bold;">Palier ${catchTier}/10</span>
                            ${catchClaimable ? `<button id="claim-catch-${pokedexNum}" class="btn" style="padding: 2px 6px; font-size: 0.7rem; background: #2ecc71; color: #fff; font-weight: bold; border-radius: 4px; cursor: pointer;">Récupérer</button>` : ''}
                        </div>
                    </div>
                    <div style="background: #222; height: 8px; border-radius: 4px; width: 100%; border: 1px solid #444; overflow:hidden;">
                        <div style="background: linear-gradient(90deg, #27ae60, #2ecc71); height: 100%; width: ${catchProg.percent}%; border-radius: 3px;"></div>
                    </div>
                </div>
            </div>
        `;
    });
    
    if (html === "") {
        container.innerHTML = `<p style='color: #aaa; width:100%; text-align:center;'>Aucun Pokémon trouvé. Partez en explorer d'autres !</p>`;
    } else {
        container.innerHTML = html;
        
        // Attacher les clics sur les boutons de récupération
        recordedIds.forEach(idStr => {
            let pokedexNum = Number(idStr);
            let btnKo = document.getElementById(`claim-ko-${pokedexNum}`);
            if (btnKo) btnKo.onclick = () => claimReward(pokedexNum, 'ko');
            
            let btnCatch = document.getElementById(`claim-catch-${pokedexNum}`);
            if (btnCatch) btnCatch.onclick = () => claimReward(pokedexNum, 'catch');
        });
    }

    // Affichage de l'aide sur les bonus de paliers en bas du labo
    let infoPanel = document.getElementById('recherche-info-panel');
    if (!infoPanel) {
        infoPanel = document.createElement('div');
        infoPanel.id = 'recherche-info-panel';
        infoPanel.className = 'glass-panel';
        infoPanel.style.cssText = "max-width: 650px; margin: 30px auto 10px auto; padding: 15px; font-size: 0.8rem; color: #ccc; text-align: left;";
        container.parentNode.appendChild(infoPanel);
    }
    infoPanel.innerHTML = `
        <h4 style="color: #f1c40f; margin-top: 0; text-align: center;">📖 Guide détaillé des Bonus de Maîtrise</h4>
        <p style="margin-bottom: 10px; text-align: center;">Chaque palier validé rapporte <b>1 PokePt</b> via le bouton "Récupérer". Les bonus s'appliquent spécifiquement à chaque espèce :</p>
        
        <div style="display: flex; gap: 15px; justify-content: space-between; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 260px; background: rgba(0,0,0,0.4); padding: 10px; border-radius: 6px; border-left: 3px solid #e74c3c;">
                <strong style="color: #e74c3c;">⚔️ Paliers K.O. :</strong>
                <ul style="padding-left: 15px; margin: 5px 0 0 0; line-height: 1.4; font-size: 0.75rem;">
                    <li><b>Palier 1 :</b> +5% d'XP gagnée</li>
                    <li><b>Palier 2 :</b> +5% de dégâts infligés</li>
                    <li><b>Palier 3 :</b> +10% d'XP gagnée</li>
                    <li><b>Palier 4 :</b> +10% de dégâts infligés</li>
                    <li><b>Palier 5 :</b> +20% d'XP gagnée</li>
                    <li><b>Palier 6 :</b> +15% de dégâts infligés</li>
                    <li><b>Palier 7 :</b> +5% de chances de coup critique</li>
                    <li><b>Palier 8 :</b> +30% d'XP gagnée</li>
                    <li><b>Palier 9 :</b> +20% de dégâts infligés</li>
                    <li><b>Palier 10 :</b> +10% de chances de coup critique</li>
                </ul>
            </div>
            
            <div style="flex: 1; min-width: 260px; background: rgba(0,0,0,0.4); padding: 10px; border-radius: 6px; border-left: 3px solid #2ecc71;">
                <strong style="color: #2ecc71;">🎯 Paliers Capture :</strong>
                <ul style="padding-left: 15px; margin: 5px 0 0 0; line-height: 1.4; font-size: 0.75rem;">
                    <li><b>Palier 1 :</b> +5% de bonus de capture</li>
                    <li><b>Palier 2 :</b> Réduction de 5% des dégâts subis</li>
                    <li><b>Palier 3 :</b> +10% de bonus de capture</li>
                    <li><b>Palier 4 :</b> Réduction de 10% des dégâts subis</li>
                    <li><b>Palier 5 :</b> +15% de bonus de capture</li>
                    <li><b>Palier 6 :</b> Réduction de 15% des dégâts subis</li>
                    <li><b>Palier 7 :</b> +20% de bonus de capture</li>
                    <li><b>Palier 8 :</b> Réduction de 20% des dégâts subis</li>
                    <li><b>Palier 9 :</b> +25% de bonus de capture</li>
                    <li><b>Palier 10 :</b> Réduction de 30% des dégâts subis</li>
                </ul>
            </div>
        </div>
    `;
}

function claimReward(pokedexNum, type) {
    if (!state.currentUserData.mastery) state.currentUserData.mastery = { ko: {}, catch: {}, claimed: {} };
    if (!state.currentUserData.mastery.claimed) state.currentUserData.mastery.claimed = { ko: {}, catch: {} };
    
    let claimed = state.currentUserData.mastery.claimed;
    if (!claimed.ko) claimed.ko = {};
    if (!claimed.catch) claimed.catch = {};

    let currentCount = type === 'ko' ? (state.currentUserData.mastery.ko[pokedexNum] || 0) : (state.currentUserData.mastery.catch[pokedexNum] || 0);
    let thresholds = type === 'ko' ? [10, 25, 50, 100, 200, 350, 500, 750, 1000, 1500] : [2, 5, 10, 20, 40, 70, 110, 160, 220, 300];
    
    let currentTier = 0;
    for (let i = 0; i < thresholds.length; i++) {
        if (currentCount >= thresholds[i]) currentTier = i + 1;
        else break;
    }

    let alreadyClaimed = Number(claimed[type][pokedexNum] || 0);
    let diff = currentTier - alreadyClaimed;

    if (diff > 0) {
        claimed[type][pokedexNum] = currentTier;
        state.currentUserData.pokePts = (state.currentUserData.pokePts || 0) + diff;

        // Mise à jour de l'affichage des PokePts
        const pokePtsDisplay = document.getElementById('recherche-pokepts');
        if (pokePtsDisplay) pokePtsDisplay.textContent = state.currentUserData.pokePts;

        // Sauvegarde Firebase
        db.collection('users').doc(state.currentUser).update({
            mastery: state.currentUserData.mastery,
            pokePts: state.currentUserData.pokePts
        }).then(() => {
            renderRecherche(); // On rafraîchit l'interface pour faire disparaître le bouton récupéré
        }).catch(e => console.error("Erreur de récupération des PokePts :", e));
    }
}