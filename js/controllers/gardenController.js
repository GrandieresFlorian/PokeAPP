import { db } from '../firebase-config.js';
import { state } from '../state.js';
import { TOUTES_LES_BAIES, MUTATION_RECIPES } from '../utils.js';

let selectedPlot = null;
let mutationTick = 0; 
let activeTool = null; // null, { type: 'seed', id: 'ceriz' }, { type: 'trowel' }
let isDragging = false;
let lastProcessedIndex = null;
let currentFilter = ""; // Sauvegarde la recherche en cours

export function initGarden() {
    document.getElementById('nav-jardin').addEventListener('click', () => {
        if (!state.currentUser) return alert("Veuillez vous connecter pour accéder à la serre.");
        openGarden();
    });

    document.getElementById('btn-sell-berries').addEventListener('click', openSellMenu);
    renderPresetsUI();
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-preset-action]');
        if (!target) return;
        const action = target.dataset.presetAction;
        const presetId = parseInt(target.dataset.presetId);

        if (action === 'save') {
            savePreset(presetId);
        } else if (action === 'load') {
            loadPreset(presetId);
        }
    });
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('preset-name-input')) {
            const presetId = parseInt(e.target.dataset.presetId);
            const newName = e.target.value;
            const presets = state.currentUserData.gardenPresets || [];
            const preset = presets.find(p => p.id === presetId);
            if (preset) {
                preset.name = newName;
                saveGardenData();
            }
        }
    });

    // --- BOUCLE GLOBALE (Tourne en arrière-plan en permanence) ---
    setInterval(() => {
        // On met à jour les données et les mutations en arrière-plan
        mutationTick++;
        if (mutationTick >= 5) {
            checkMutations();
            mutationTick = 0;
        }

        // On rafraîchit l'affichage visuel UNIQUEMENT si l'onglet du jardin est ouvert
        const sect = document.getElementById('section-jardin');
        if (sect && !sect.classList.contains('hidden')) {
            renderGardenGrid();
            updateActionPanel();
        }
    }, 1000);

    const grid = document.getElementById('garden-grid');

    // Pointer events pour glisser/planter/récolter (drag & swipe)
    grid.addEventListener('pointerdown', (e) => {
        const plotEl = e.target.closest('.garden-plot');
        if(plotEl) {
            isDragging = true;
            const index = parseInt(plotEl.dataset.index);
            lastProcessedIndex = index;
            applyTool(index);
            grid.setPointerCapture(e.pointerId); // Force la capture du curseur
        }
    });

    grid.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        // Permet de trouver l'élément survolé même avec le curseur verrouillé
        const elementUnderPointer = document.elementFromPoint(e.clientX, e.clientY);
        if (!elementUnderPointer) return;
        
        const plotEl = elementUnderPointer.closest('.garden-plot');
        if(plotEl) {
            const index = parseInt(plotEl.dataset.index);
            if (index !== lastProcessedIndex) {
                lastProcessedIndex = index;
                applyTool(index);
            }
        }
    });

    grid.addEventListener('pointerup', (e) => {
        isDragging = false;
        lastProcessedIndex = null;
        grid.releasePointerCapture(e.pointerId);
    });

    // Empêcher le scroll intempestif sur mobile quand on drag
    grid.addEventListener('touchstart', (e) => { 
        if(activeTool) e.preventDefault(); 
    }, {passive: false});

    document.getElementById('garden-action-content').addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.dataset.action;
        const index = parseInt(target.dataset.index);
        const id = target.dataset.id;
        
        // --- NOUVELLE LOGIQUE DE VENTE ---
        if(action === 'sell_input') {
            const maxQty = parseInt(target.dataset.max);
            let qty = parseInt(document.getElementById(`sell-qty-${id}`).value);
            if (isNaN(qty) || qty < 1) qty = 1;
            if (qty > maxQty) qty = maxQty;
            sellBerry(id, qty);
        } else if (action === 'unlock') {
            unlockPlot(index);
        } else if (action === 'water') {
            waterPlot(index);
        } else if (action === 'harvest') {
            harvestPlot(index);
        } else if (action === 'clear') {
            clearPlot(index);
        } else if (action === 'select_seed') {
            activeTool = { type: 'seed', id: id };
            showDefaultTools();
        } else if (action === 'select_trowel') {
            activeTool = { type: 'trowel' };
            showDefaultTools();
        } else if (action === 'select_shovel') { // <--- NOUVEAU
            activeTool = { type: 'shovel' };
            showDefaultTools();
        } else if (action === 'deselect_tool') {
            activeTool = null;
            showDefaultTools();
        }
    });
}

function savePreset(presetId) {
    const garden = state.currentUserData.garden;
    if (!garden) return;

    // Sécurité : Si les presets n'existent pas encore dans l'objet utilisateur, on les initialise
    if (!state.currentUserData.gardenPresets) {
        state.currentUserData.gardenPresets = Array.from({length: 5}, (_, i) => ({
            id: i + 1, name: `Preset ${i + 1}`, layout: {}
        }));
    }

    const preset = state.currentUserData.gardenPresets.find(p => p.id === presetId);
    if (!preset) return;

    const layout = {};
    garden.forEach((plot, index) => {
        if (!plot.locked && plot.berryId) {
            layout[index] = plot.berryId;
        }
    });

    preset.layout = layout;
    saveGardenData();
    renderPresetsUI();
    alert(`Preset "${preset.name}" sauvegardé avec succès !`);
}

// --- CHARGER ET PLANTER UN PRESET ---
function loadPreset(presetId) {
    if (!state.currentUserData.gardenPresets) {
        state.currentUserData.gardenPresets = Array.from({length: 5}, (_, i) => ({
            id: i + 1, name: `Preset ${i + 1}`, layout: {}
        }));
    }
    const preset = state.currentUserData.gardenPresets.find(p => p.id === presetId);
    if (!preset || Object.keys(preset.layout).length === 0) {
        return alert("Ce preset est vide ! Configurez des baies dans votre jardin avant de sauvegarder.");
    }

    const garden = state.currentUserData.garden;
    const berriesInventory = state.currentUserData.berries;

    // 1. Calculer le nombre de chaque baie requise par le preset
    const requiredBerriesCount = {};
    Object.values(preset.layout).forEach(berryId => {
        requiredBerriesCount[berryId] = (requiredBerriesCount[berryId] || 0) + 1;
    });

    // 2. Compter ce que le joueur possède réellement en inventaire
    const inventoryCount = {};
    berriesInventory.forEach(b => {
        if (!['pomeg-berry', 'grena'].includes(b.id)) { // Exclure les baies non plantables
            inventoryCount[b.id] = (inventoryCount[b.id] || 0) + 1;
        }
    });

    // 3. Vérifier si le joueur a assez de chaque baie
    for (const [berryId, neededQty] of Object.entries(requiredBerriesCount)) {
        const availableQty = inventoryCount[berryId] || 0;
        if (availableQty < neededQty) {
            const baieDef = TOUTES_LES_BAIES.find(b => b.id === berryId);
            const berryName = baieDef ? (state.currentLang === 'en' ? baieDef.en : baieDef.fr) : berryId;
            return alert(`Stock insuffisant ! Il vous manque ${neededQty - availableQty}x ${berryName}.`);
        }
    }

    // 4. Vérifier si les plots cibles sont libres et débloqués
    for (const indexStr of Object.keys(preset.layout)) {
        const index = parseInt(indexStr);
        const plot = garden[index];
        if (!plot || plot.locked || plot.berryId !== null) {
            return alert(`Impossible de charger : Certains plots requis sont verrouillés ou occupés par une autre plante !`);
        }
    }

    // 5. Tout est bon : on retire les baies de l'inventaire et on plante sur la grille
    for (const [indexStr, berryId] of Object.entries(preset.layout)) {
        const index = parseInt(indexStr);
        
        // Supprimer 1 exemplaire de l'inventaire du joueur
        const itemIndex = berriesInventory.findIndex(b => b.id === berryId);
        if (itemIndex > -1) {
            berriesInventory.splice(itemIndex, 1);
        }

        // Planter sur le plot
        const plot = garden[index];
        plot.berryId = berryId;
        plot.plantedAt = Date.now();
        plot.lastWatered = Date.now();
    }

    saveGardenData();
    renderGardenGrid();
    showDefaultTools();
    alert(`Preset "${preset.name}" chargé et planté avec succès ! ✨`);
}

function renderPresetsUI() {
    const container = document.getElementById('garden-presets-container');
    if (!container) return;

    if (!state.currentUserData.gardenPresets) {
        state.currentUserData.gardenPresets = Array.from({length: 5}, (_, i) => ({
            id: i + 1, name: `Preset ${i + 1}`, layout: {}
        }));
    }

    let html = '';
    state.currentUserData.gardenPresets.forEach(preset => {
        const countBerries = Object.keys(preset.layout).length;
        html += `
            <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); padding: 10px 15px; border-radius: 8px; border: 1px solid #444; gap: 10px; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 200px;">
                    <input type="text" class="preset-name-input" data-preset-id="${preset.id}" value="${preset.name}" maxlength="20" style="background: #222; border: 1px solid #555; color: white; padding: 5px 10px; border-radius: 5px; font-weight: bold; width: 140px;">
                    <span style="font-size: 0.85rem; color: #aaa;">(${countBerries} baies configurées)</span>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.85rem;" data-preset-action="save" data-preset-id="${preset.id}">💾 Sauvegarder</button>
                    <button class="btn" style="padding: 6px 12px; font-size: 0.85rem; background: #2ecc71;" data-preset-action="load" data-preset-id="${preset.id}">🌱 Charger & Planter</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function applyTool(index) {
    if (!activeTool) {
        handlePlotClick(index); 
        return;
    }
    
    const plot = state.currentUserData.garden[index];
    const st = getPlotState(plot);
    
    if (activeTool.type === 'seed' && st.stage === 'empty' && !plot.locked) {
        plantSelectedSeed(index, activeTool.id);
    } else if (activeTool.type === 'trowel' && st.stage === 'ready') {
        harvestPlot(index);
    } else if (activeTool.type === 'shovel' && st.stage !== 'empty' && st.stage !== 'locked') {
        // La pelle nettoie le terrain peu importe l'état (sans rien redonner)
        clearPlot(index);
    }
}
function showDefaultTools() {
    selectedPlot = null;
    document.getElementById('garden-action-title').textContent = "Outils & Graines";
    const content = document.getElementById('garden-action-content');
    
    // Création de l'interface (Recherche + Conteneur Liste) uniquement si elle n'existe pas
    if (!document.getElementById('garden-search')) {
        content.innerHTML = `
            <input type="text" id="garden-search" placeholder="🔍 Rechercher une baie..." style="width:100%; padding:8px; margin-bottom:10px; border-radius:5px; border:1px solid #444; background:#1a1a1a; color:white; box-sizing:border-box;">
            <div id="tools-list-container" style="max-height: 300px; overflow-y: auto; padding-right:5px;"></div>
            <div id="tools-footer"></div>
        `;
        document.getElementById('garden-search').addEventListener('input', (e) => {
            currentFilter = e.target.value;
            renderToolsList();
        });
    }
    
    // Restaurer la valeur du champ de recherche
    const searchInput = document.getElementById('garden-search');
    if (searchInput && currentFilter) searchInput.value = currentFilter;

    renderToolsList();
}

function renderToolsList() {
    const container = document.getElementById('tools-list-container');
    const footer = document.getElementById('tools-footer');
    if (!container) return;

    let html = '';
    const isTrowelActive = activeTool && activeTool.type === 'trowel';
    const isShovelActive = activeTool && activeTool.type === 'shovel';
    html += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:10px; border-radius:5px; margin-bottom:8px; cursor:pointer; border:2px solid ${isShovelActive ? '#e74c3c' : '#444'};" data-action="select_shovel">
            <div style="display:flex; align-items:center; gap:10px; pointer-events:none;">
                <span style="font-size:1.5rem;">️ shov</span> <!-- Ou l'émoji de ton choix -->
                <span style="color:white; font-size:1rem; font-weight:bold;">Pelle (Arrachage Rapide)</span>
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:10px; border-radius:5px; margin-bottom:15px; cursor:pointer; border:2px solid ${isTrowelActive ? '#2ecc71' : '#444'};" data-action="select_trowel">
            <div style="display:flex; align-items:center; gap:10px; pointer-events:none;">
                <span style="font-size:1.5rem;">⛏️</span>
                <span style="color:white; font-size:1rem; font-weight:bold;">Truelle (Récolte Rapide)</span>
            </div>
        </div>
        <h4 style="margin-top:0; border-bottom:1px solid #444; padding-bottom:5px;">Vos Graines</h4>
    `;

    const mesBaies = state.currentUserData.berries || [];
    const advancedBerries = ['grena'];
    const baiesMap = {};
    mesBaies.forEach(b => { 
        const q = b.quantity || 1;
        baiesMap[b.id] = (baiesMap[b.id] || 0) + q; 
    });

    let countVisible = 0;
    Object.keys(baiesMap).forEach(id => {
        if (advancedBerries.includes(id)) return; // On ne peut pas la planter !
        const qty = baiesMap[id];
        const baieDef = TOUTES_LES_BAIES.find(b => b.id === id);
        if(!baieDef) return;
        
        let nameEn = baieDef.en;
        let nameFr = baieDef.fr;
        let currentName = state.currentLang === 'en' ? nameEn : nameFr;
        
        // Appliquer la recherche e(Filtre)
        if (currentFilter && !currentName.toLowerCase().includes(currentFilter.toLowerCase())) return;
        countVisible++;

        const conf = state.berryConfig[id] || state.berryConfig.default;
        const enNameImg = baieDef.en.toLowerCase().replace(/\s+/g, '-');
        const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${enNameImg}.png`;

        let timeStr = conf.growTime >= 3600000 
            ? `${Math.round(conf.growTime / 3600000)}h` 
            : `${Math.round(conf.growTime / 60000)}m`;

        const isSeedActive = activeTool && activeTool.type === 'seed' && activeTool.id === id;

        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:10px; border-radius:5px; margin-bottom:5px; cursor:pointer; border:2px solid ${isSeedActive ? '#2ecc71' : '#444'};" data-action="select_seed" data-id="${id}">
                <div style="display:flex; align-items:center; gap:10px; pointer-events:none;">
                    <img src="${imgUrl}" style="width:30px; height:30px; image-rendering:pixelated;">
                    <span class="pokemon-name" data-en="${nameEn} (x${qty})" data-fr="${nameFr} (x${qty})" style="color:white; font-size:0.9rem;">${currentName} (x${qty})</span>
                </div>
                <div style="font-size:0.8rem; color:#f1c40f; pointer-events:none;">
                    ⏱ ${timeStr}
                </div>
            </div>
        `;
    });
    
    if (countVisible === 0) html += '<p style="color:#777;">Aucune baie correspondante.</p>';
    container.innerHTML = html;
    
    if (activeTool) {
        footer.innerHTML = `<button class="btn btn-secondary" style="width:100%; margin-top:15px; background:#e74c3c;" data-action="deselect_tool">Désélectionner (Mode Clic & Inspecter)</button>`;
    } else {
        footer.innerHTML = `<p style="color:#777; font-size:0.85rem; margin-top:15px;">Sélectionnez une graine ou la truelle, puis glissez/maintenez sur la serre.</p>`;
    }
}

function plantSelectedSeed(index, berryId) {
    const berryEntry = state.currentUserData.berries.find(b => b.id === berryId);
    
    if (berryEntry) {
        // On décrémente la quantité de la baie
        berryEntry.quantity = (berryEntry.quantity || 1) - 1;
        
        // Si la quantité tombe à 0 ou moins, on retire la baie du tableau
        if (berryEntry.quantity <= 0) {
            const indexInArray = state.currentUserData.berries.indexOf(berryEntry);
            if (indexInArray > -1) {
                state.currentUserData.berries.splice(indexInArray, 1);
            }
        }
        
        const plot = state.currentUserData.garden[index];
        plot.berryId = berryId;
        plot.plantedAt = Date.now();
        plot.lastWatered = Date.now();
        
        saveGardenData();
        renderGardenGrid();
        
        if (!state.currentUserData.berries.some(b => b.id === berryId && (b.quantity || 1) > 0)) {
            activeTool = null; // Plus de graines de ce type, on déséquipe l'outil
        }
        
        if (document.getElementById('garden-action-title').textContent === "Outils & Graines") {
            showDefaultTools(); // Actualise les quantités en live
        }
    }
}

function openSellMenu() {
    activeTool = null;
    selectedPlot = null;
    const content = document.getElementById('garden-action-content');
    document.getElementById('garden-action-title').textContent = "Boutique (Vendre)";

    let html = '<div style="max-height: 250px; overflow-y: auto; padding-right:5px;">';
    const mesBaies = state.currentUserData.berries || [];
    const baiesMap = {};
    mesBaies.forEach(b => { baiesMap[b.id] = (baiesMap[b.id] || 0) + 1; });

    if (Object.keys(baiesMap).length === 0) {
        html += '<p style="color:#777;">Vous n\'avez aucune baie à vendre.</p>';
    }

    Object.keys(baiesMap).forEach(id => {
        const qty = baiesMap[id];
        const baieDef = TOUTES_LES_BAIES.find(b => b.id === id);
        if(!baieDef) return;
        const conf = state.berryConfig[id] || state.berryConfig.default;
        const enName = baieDef.en.toLowerCase().replace(/\s+/g, '-');
        const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${enName}.png`;

        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:10px; border-radius:5px; margin-bottom:5px; border:1px solid #444;">
                <div style="display:flex; align-items:center; gap:5px;">
                    <img src="${imgUrl}" style="width:30px; height:30px; image-rendering:pixelated;">
                    <span style="color:white; font-size:0.9rem;">(Max: ${qty})</span>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="color:#f1c40f; font-weight:bold; margin-right:10px; font-size:0.9rem;">+${conf.sellPrice}💰/u</span>
                    <input type="number" id="sell-qty-${id}" min="1" max="${qty}" value="1" style="width:40px; padding:4px; margin-right:5px; border-radius:3px; border:1px solid #444; background:#333; color:white; text-align:center;">
                    <button class="btn-small-action" style="background:#2ecc71; padding:4px 8px;" data-action="sell_input" data-id="${id}" data-max="${qty}">Vendre</button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    html += `<button class="btn btn-secondary" style="width:100%; margin-top:10px;" data-action="deselect_tool">Retour aux Outils</button>`;
    content.innerHTML = html;
}

function checkMutations() {
    const garden = state.currentUserData.garden;
    if (!garden) return;
    let mutated = false;
    
    garden.forEach((plot, i) => {
        if (plot.locked || plot.berryId !== null) return; 
        
        const row = Math.floor(i / 9);
        const col = i % 9;
        
        // --- 1. RÉCUPÉRATION DES 8 CASES ADJACENTES (Voisinage de Moore) ---
        const adjacentPlots = [];
        for (let rOffset = -1; rOffset <= 1; rOffset++) {
            for (let cOffset = -1; cOffset <= 1; cOffset++) {
                if (rOffset === 0 && cOffset === 0) continue;
                let nRow = row + rOffset;
                let nCol = col + cOffset;
                if (nRow >= 0 && nRow < 9 && nCol >= 0 && nCol < 9) {
                    let nIdx = nRow * 9 + nCol;
                    let p = garden[nIdx];
                    if (!p.locked && p.berryId !== null) {
                        const st = getPlotState(p);
                        if (st.stage === 'growing' || st.stage === 'thirsty' || st.stage === 'ready') {
                            adjacentPlots.push(p.berryId);
                        }
                    }
                }
            }
        }
        
        // --- 2. PRIORITÉ ABSOLUE : MUTATIONS AVANCÉES (ex: Baie Pomeg) ---
        // Figuy, Wiki, Mago, Gowav (nécessite exactement 2 de chaque -> 8 au total)
        const pomegReqs = ['figuy', 'wiki', 'mago', 'gowav'];
        let isPomegMutation = pomegReqs.every(bId => adjacentPlots.filter(b => b === bId).length >= 2);
        
        if (isPomegMutation && adjacentPlots.length >= 8) {
            if (Math.random() <= 0.2) { // 5% de chance par tick
                plot.berryId = 'grena';
                plot.plantedAt = Date.now();
                plot.lastWatered = Date.now();
                mutated = true;
                
                document.getElementById('garden-action-title').textContent = "Mutation Avancée ! ✨";
                document.getElementById('garden-action-content').innerHTML = `
                    <p style="color:#f1c40f; font-weight:bold;">Une mutation légendaire s'est produite !</p>
                    <p>Une <b style="color:#2ecc71;">Baie Pomeg</b> a germé au centre de vos cultures expertes !</p>
                    <button class="btn btn-secondary" style="width:100%; margin-top:10px;" data-action="deselect_tool">Retour aux Outils</button>
                `;
                activeTool = null;
                return; // Stoppe ici, aucune mutation classique ne peut se déclencher sur ce plot !
            }
            // Même si le jet à 5% échoue, on retourne directement pour interdire les mutations classiques sur ce plot encerclé
            return; 
        }
        
        // --- 3. MUTATIONS CLASSIQUES (Seulement si ce n'est PAS une configuration avancée) ---
        if (adjacentPlots.length >= 2) {
            for (let recipe of MUTATION_RECIPES) {
                const hasP1 = adjacentPlots.includes(recipe.p1);
                let hasP2 = false;
                
                if (recipe.p1 === recipe.p2) {
                    hasP2 = adjacentPlots.filter(b => b === recipe.p1).length >= 2;
                } else {
                    hasP2 = adjacentPlots.includes(recipe.p2);
                }
                
                if (hasP1 && hasP2) {
                    if (Math.random() <= recipe.chance) {
                        plot.berryId = recipe.result;
                        plot.plantedAt = Date.now();
                        plot.lastWatered = Date.now();
                        mutated = true;
                        
                        document.getElementById('garden-action-title').textContent = "Mutation ! ✨";
                        const baieDef = TOUTES_LES_BAIES.find(b => b.id === recipe.result);
                        let nameEn = baieDef.en;
                        let nameFr = baieDef.fr;
                        let currentName = state.currentLang === 'en' ? nameEn : nameFr;

                        document.getElementById('garden-action-content').innerHTML = `
                            <p style="color:#f1c40f; font-weight:bold;">Une nouvelle espèce est apparue !</p>
                            <p>Une <b class="pokemon-name" data-en="${nameEn}" data-fr="${nameFr}" style="color:#2ecc71;">${currentName}</b> a poussé spontanément grâce aux baies voisines !</p>
                            <button class="btn btn-secondary" style="width:100%; margin-top:10px;" data-action="deselect_tool">Retour aux Outils</button>
                        `;
                        activeTool = null;
                        break; 
                    }
                }
            }
        }
    });
    
    if (mutated) {
        saveGardenData();
        renderGardenGrid();
    }
}

function openGarden() {
    import('./navController.js').then(({allerASection}) => allerASection('section-jardin'));
    
    if (!state.currentUserData.garden) {
        state.currentUserData.garden = Array.from({length: 81}, (_, i) => ({
            locked: i !== 40,
            berryId: null,
            plantedAt: 0,
            lastWatered: 0
        }));
        saveGardenData();
    }
    if (state.currentUserData.pokeBerrys === undefined) {
        state.currentUserData.pokeBerrys = 0;
        saveGardenData();
    }

    renderGardenGrid();
    activeTool = null;
    showDefaultTools();
    document.getElementById('pokeberry-display').textContent = state.currentUserData.pokeBerrys;
    
    // --- AJOUTE CETTE LIGNE ICI ---
    renderPresetsUI(); 
}

function getPlotState(plot) {
    if (plot.locked) return { stage: 'locked', label: '' };
    if (!plot.berryId) return { stage: 'empty', label: '' };
    
    const conf = state.berryConfig[plot.berryId] || state.berryConfig.default;
    const now = Date.now();
    
    if (conf.needsWater && (now - plot.lastWatered > conf.witherTime)) {
        if (plot.plantedAt + conf.growTime <= plot.lastWatered + conf.witherTime) {
            return { stage: 'ready', label: '' };
        }
        return { stage: 'withered', label: '🥀' };
    }
    
    if (now - plot.plantedAt >= conf.growTime) return { stage: 'ready', label: '' };
    if (conf.needsWater && (now - plot.lastWatered > conf.waterInterval)) return { stage: 'thirsty', label: '' };
    
    return { stage: 'growing', label: '' };
}

function isAdjacentToUnlocked(index) {
    const row = Math.floor(index / 9);
    const col = index % 9;
    const garden = state.currentUserData.garden;
    
    if (row > 0 && !garden[index - 9].locked) return true;
    if (row < 8 && !garden[index + 9].locked) return true;
    if (col > 0 && !garden[index - 1].locked) return true;
    if (col < 8 && !garden[index + 1].locked) return true;
    return false;
}

function renderGardenGrid() {
    const grid = document.getElementById('garden-grid');
    const garden = state.currentUserData.garden;
    if (!grid || !garden) return;

    let html = '';
    garden.forEach((plot, i) => {
        const st = getPlotState(plot);
        let bgImage = '';
        let indicator = '';

        if (st.stage === 'locked') {
            if (isAdjacentToUnlocked(i)) html += `<div class="garden-plot locked adjacent" data-index="${i}">+</div>`;
            else html += `<div class="garden-plot locked" data-index="${i}"></div>`;
            return;
        } else if (plot.berryId && st.stage !== 'withered') {
            const baieDef = TOUTES_LES_BAIES.find(b => b.id === plot.berryId);
            const enName = (baieDef.en || baieDef.data.en).toLowerCase().replace(/\s+/g, '-');
            const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${enName}.png`;
            
            let size = st.stage === 'ready' ? '120%' : '70%';
            let opacity = st.stage === 'growing' || st.stage === 'thirsty' ? '0.8' : '1';
            bgImage = `background-image: url('${imgUrl}'); background-size: ${size}; background-repeat: no-repeat; background-position: center; opacity: ${opacity}; image-rendering: pixelated;`;
            
            if(st.stage === 'thirsty') indicator = '<div class="water-drop">💧</div>';
            if(st.stage === 'ready') indicator = '<div class="ready-sparkle">✨</div>';
        } else if (st.stage === 'withered') {
            indicator = '🥀';
        }

        html += `<div class="garden-plot ${st.stage}" data-index="${i}" style="${bgImage}">${indicator}</div>`;
    });
    grid.innerHTML = html;
}

function handlePlotClick(index) {
    selectedPlot = index;
    const plot = state.currentUserData.garden[index];
    const st = getPlotState(plot);
    const content = document.getElementById('garden-action-content');
    
    document.getElementById('garden-action-title').textContent = "Détails du Terrain";

    if (st.stage === 'locked') {
        const unlockedCount = state.currentUserData.garden.filter(p => !p.locked).length;
        const cost = unlockedCount * 10;
        
        if (isAdjacentToUnlocked(index)) {
            content.innerHTML = `
                <p style="color:#ccc;">Ce terrain est recouvert de ronces.</p>
                <p style="color:#f1c40f; font-weight:bold; font-size:1.2rem;">Coût : ${cost} 💰</p>
                <button class="btn" style="width:100%; background:#f1c40f; color:#333;" data-action="unlock" data-index="${index}">
                    Défricher le terrain
                </button>
                <button class="btn btn-secondary" style="width:100%; margin-top:10px;" data-action="deselect_tool">Retour aux Outils</button>
            `;
        } else {
            content.innerHTML = `
                <p style="color:#e74c3c;">Vous devez défricher un terrain adjacent d'abord.</p>
                <button class="btn btn-secondary" style="width:100%; margin-top:10px;" data-action="deselect_tool">Retour aux Outils</button>
            `;
        }
    } else if (st.stage === 'empty') {
        showDefaultTools();
    } else {
        const conf = state.berryConfig[plot.berryId] || state.berryConfig.default;
        const baieDef = TOUTES_LES_BAIES.find(b => b.id === plot.berryId);
        const now = Date.now();
        
        let timeRemaining = Math.max(0, conf.growTime - (now - plot.plantedAt));
        let hoursRemaining = Math.floor(timeRemaining / 3600000);
        let minsRemaining = Math.floor((timeRemaining % 3600000) / 60000);
        let secsRemaining = Math.floor((timeRemaining % 60000) / 1000);
        
        let tempsTexte = hoursRemaining > 0 
            ? `${hoursRemaining}h ${minsRemaining}m` 
            : `${minsRemaining}m ${secsRemaining}s`;
        
        let nameEn = baieDef.en;
        let nameFr = baieDef.fr;
        let currentName = state.currentLang === 'en' ? nameEn : nameFr;

        let html = `<h4 class="pokemon-name" data-en="${nameEn}" data-fr="${nameFr}" style="color:#fceea7; font-size:1.3rem; margin-top:0;">${currentName}</h4>`;
        
        if (st.stage === 'withered') {
            html += `<p style="color:#e74c3c;">La plante a fané par manque d'eau...</p>
                     <button class="btn btn-secondary" style="width:100%; background:#7f8c8d;" data-action="clear" data-index="${index}">Arracher la plante</button>`;
        } else if (st.stage === 'ready') {
            html += `<p style="color:#2ecc71;">La baie est parfaitement mûre !</p>
                     <button class="btn" style="width:100%; background:#2ecc71;" data-action="harvest" data-index="${index}">Récolter</button>`;
        } else {
            html += `<p style="color:#ccc;">Temps de pousse : <b style="color:white;">${tempsTexte}</b></p>`;
            if (st.stage === 'thirsty') {
                html += `<p style="color:#3498db; font-weight:bold;">La plante réclame de l'eau !</p>
                         <button class="btn" style="width:100%; background:#3498db;" data-action="water" data-index="${index}">Arroser 💧</button>`;
            } else if (conf.needsWater) {
                let waterTimeLeft = Math.max(0, conf.waterInterval - (now - plot.lastWatered));
                let wHours = Math.floor(waterTimeLeft / 3600000);
                let wMins = Math.floor((waterTimeLeft % 3600000) / 60000);
                let wSecs = Math.floor((waterTimeLeft % 60000) / 1000);
                
                let waterTexte = wHours > 0 ? `${wHours}h ${wMins}m` : `${wMins}m ${wSecs}s`;
                html += `<p style="font-size:0.9rem; color:#aaa;">Prochain besoin d'eau dans : ${waterTexte}</p>`;
            }
        }
        html += `<button class="btn btn-secondary" style="width:100%; margin-top:10px;" data-action="deselect_tool">Retour aux Outils</button>`;
        content.innerHTML = html;
    }
}

function updateActionPanel() {
    if(selectedPlot !== null) {
        const title = document.getElementById('garden-action-title').textContent;
        if (title === "Détails du Terrain") {
            const plot = state.currentUserData.garden[selectedPlot];
            const st = getPlotState(plot);
            if (st.stage === 'growing' || st.stage === 'thirsty') {
                handlePlotClick(selectedPlot);
            } else if (st.stage === 'ready' || st.stage === 'withered') {
                const content = document.getElementById('garden-action-content').innerHTML;
                if (!content.includes('mûre') && !content.includes('fané')) {
                     handlePlotClick(selectedPlot);
                }
            }
        }
    }
}

function unlockPlot(index) {
    const unlockedCount = state.currentUserData.garden.filter(p => !p.locked).length;
    const cost = unlockedCount * 10;
    if (state.currentUserData.pokeBerrys >= cost) {
        state.currentUserData.pokeBerrys -= cost;
        state.currentUserData.garden[index].locked = false;
        saveGardenData();
        document.getElementById('pokeberry-display').textContent = state.currentUserData.pokeBerrys;
        renderGardenGrid();
        handlePlotClick(index); 
    } else {
        alert("Pas assez de PokeBerrys !");
    }
}

function waterPlot(index) {
    state.currentUserData.garden[index].lastWatered = Date.now();
    saveGardenData();
    renderGardenGrid();
    handlePlotClick(index);
}

function harvestPlot(index) {
    const plot = state.currentUserData.garden[index];
    const conf = state.berryConfig[plot.berryId] || state.berryConfig.default;
    const baieDef = TOUTES_LES_BAIES.find(b => b.id === plot.berryId);
    
    const yieldAmount = Math.floor(Math.random() * (conf.yieldMax - conf.yieldMin + 1)) + conf.yieldMin;
    
    // Ajout dans le système de quantité des baies
    if (!state.currentUserData.berries) state.currentUserData.berries = [];
    const existingBerry = state.currentUserData.berries.find(b => b.id === baieDef.id);
    
    if (existingBerry) {
        existingBerry.quantity = (existingBerry.quantity || 1) + yieldAmount;
    } else {
        state.currentUserData.berries.push({
            data: baieDef, id: baieDef.id, date: Date.now(), quantity: yieldAmount
        });
    }
    
    plot.berryId = null;
    plot.plantedAt = 0;
    plot.lastWatered = 0;
    
    saveGardenData();
    renderGardenGrid();
    
    if (!activeTool) {
        let nameEn = baieDef.en;
        let nameFr = baieDef.fr;
        let currentName = state.currentLang === 'en' ? nameEn : nameFr;
        let enNameImg = baieDef.en.toLowerCase().replace(/\s+/g, '-');
        let imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${enNameImg}.png`;

        document.getElementById('garden-action-content').innerHTML = `
            <p style="color:#2ecc71; display:flex; align-items:center; justify-content:center; gap:8px; flex-wrap:wrap;">
                Vous avez récolté ${yieldAmount} 
                <img src="${imgUrl}" style="width:24px; height:24px; vertical-align:middle; image-rendering:pixelated;">
                <span class="pokemon-name" data-en="${nameEn}" data-fr="${nameFr}" style="font-size:inherit; font-weight:bold; color:white; text-transform:none;">${currentName}</span> !
            </p>
            <button class="btn btn-secondary" style="width:100%; margin-top:10px;" data-action="deselect_tool">Retour aux Outils</button>
        `;
    } else if (document.getElementById('garden-action-title').textContent === "Outils & Graines") {
        showDefaultTools(); 
    }
}

function clearPlot(index) {
    const plot = state.currentUserData.garden[index];
    plot.berryId = null;
    plot.plantedAt = 0;
    plot.lastWatered = 0;
    saveGardenData();
    renderGardenGrid();
    document.getElementById('garden-action-content').innerHTML = `
        <p style="color:#777;">Le terrain a été nettoyé.</p>
        <button class="btn btn-secondary" style="width:100%; margin-top:10px;" data-action="deselect_tool">Retour aux Outils</button>
    `;
}

function sellBerry(id, qty) {
    let sold = 0;
    for(let i = state.currentUserData.berries.length - 1; i >= 0; i--) {
        if(state.currentUserData.berries[i].id === id && sold < qty) {
            state.currentUserData.berries.splice(i, 1);
            sold++;
        }
    }
    
    const conf = state.berryConfig[id] || state.berryConfig.default;
    const gain = sold * conf.sellPrice;
    state.currentUserData.pokeBerrys += gain;
    
    saveGardenData();
    document.getElementById('pokeberry-display').textContent = state.currentUserData.pokeBerrys;
    openSellMenu();
}

// --- OPTIMISATION (DEBOUNCE) DE LA SAUVEGARDE SUR FIREBASE ---
// --- OPTIMISATION (DEBOUNCE) DE LA SAUVEGARDE SUR FIREBASE ---
let saveTimeout = null;

export function saveGardenData() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        db.collection('users').doc(state.currentUser).update({
            garden: state.currentUserData.garden,
            berries: state.currentUserData.berries,
            pokeBerrys: state.currentUserData.pokeBerrys,
            // C'EST CETTE LIGNE QUI SAUVEGARDE LES PRESETS DANS LE CLOUD :
            gardenPresets: state.currentUserData.gardenPresets || [] 
        }).catch(err => console.error(err));
    }, 1000); 
}