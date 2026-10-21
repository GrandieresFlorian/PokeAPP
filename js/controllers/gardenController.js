import { db } from '../firebase-config.js';
import { state } from '../state.js';
import { TOUTES_LES_BAIES, MUTATION_RECIPES } from '../utils.js';

let selectedPlot = null;
let mutationTick = 0; 
let activeTool = null; // null, { type: 'seed', id: 'ceriz' }, { type: 'trowel' }
let isDragging = false;
let lastProcessedIndex = null;

export function initGarden() {
    document.getElementById('nav-jardin').addEventListener('click', () => {
        if (!state.currentUser) return alert("Veuillez vous connecter pour accéder à la serre.");
        openGarden();
    });

    document.getElementById('btn-sell-berries').addEventListener('click', openSellMenu);

    setInterval(() => {
        const sect = document.getElementById('section-jardin');
        if (sect && !sect.classList.contains('hidden')) {
            renderGardenGrid();
            updateActionPanel();
            
            mutationTick++;
            if (mutationTick >= 5) {
                checkMutations();
                mutationTick = 0;
            }
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
        
        if(action === 'sell') {
            const qty = parseInt(target.dataset.qty);
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
        } else if (action === 'deselect_tool') {
            activeTool = null;
            showDefaultTools();
        }
    });
}

function applyTool(index) {
    if (!activeTool) {
        handlePlotClick(index); // S'il n'y a pas d'outil, on inspecte le terrain
        return;
    }
    
    const plot = state.currentUserData.garden[index];
    const st = getPlotState(plot);
    
    if (activeTool.type === 'seed' && st.stage === 'empty' && !plot.locked) {
        plantSelectedSeed(index, activeTool.id);
    } else if (activeTool.type === 'trowel' && st.stage === 'ready') {
        harvestPlot(index);
    }
}

function showDefaultTools() {
    selectedPlot = null;
    document.getElementById('garden-action-title').textContent = "Outils & Graines";
    const content = document.getElementById('garden-action-content');
    
    let html = '<div style="max-height: 350px; overflow-y: auto; padding-right:5px;">';
    
    const isTrowelActive = activeTool && activeTool.type === 'trowel';
    html += `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:10px; border-radius:5px; margin-bottom:15px; cursor:pointer; border:2px solid ${isTrowelActive ? '#2ecc71' : '#444'};" data-action="select_trowel">
            <div style="display:flex; align-items:center; gap:10px; pointer-events:none;">
                <span style="font-size:1.5rem;">⛏️</span>
                <span style="color:white; font-size:1rem; font-weight:bold;">Truelle (Récolte Rapide)</span>
            </div>
        </div>
        <h4 style="margin-top:0; border-bottom:1px solid #444; padding-bottom:5px;">Vos Graines</h4>
    `;

    const mesBaies = state.currentUserData.berries || [];
    const baiesMap = {};
    mesBaies.forEach(b => { baiesMap[b.id] = (baiesMap[b.id] || 0) + 1; });

    if (Object.keys(baiesMap).length === 0) {
        html += '<p style="color:#777;">Aucune baie en inventaire.</p>';
    }

    Object.keys(baiesMap).forEach(id => {
        const qty = baiesMap[id];
        const baieDef = TOUTES_LES_BAIES.find(b => b.id === id);
        if(!baieDef) return;
        const conf = state.berryConfig[id] || state.berryConfig.default;
        const enNameImg = baieDef.en.toLowerCase().replace(/\s+/g, '-');
        const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${enNameImg}.png`;

        let timeStr = conf.growTime >= 3600000 
            ? `${Math.round(conf.growTime / 3600000)}h` 
            : `${Math.round(conf.growTime / 60000)}m`;

        let nameEn = baieDef.en;
        let nameFr = baieDef.fr;
        let currentName = state.currentLang === 'en' ? nameEn : nameFr;

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
    html += '</div>';
    
    if (activeTool) {
        html += `<button class="btn btn-secondary" style="width:100%; margin-top:15px; background:#e74c3c;" data-action="deselect_tool">Désélectionner (Mode Clic & Inspecter)</button>`;
    } else {
        html += `<p style="color:#777; font-size:0.85rem; margin-top:15px;">Sélectionnez une graine ou la truelle, puis glissez/maintenez sur la serre.</p>`;
    }
    
    content.innerHTML = html;
}

function plantSelectedSeed(index, berryId) {
    const indexInArray = state.currentUserData.berries.findIndex(b => b.id === berryId);
    
    if (indexInArray > -1) {
        state.currentUserData.berries.splice(indexInArray, 1);
        
        const plot = state.currentUserData.garden[index];
        plot.berryId = berryId;
        plot.plantedAt = Date.now();
        plot.lastWatered = Date.now();
        
        saveGardenData();
        renderGardenGrid();
        
        if (!state.currentUserData.berries.some(b => b.id === berryId)) {
            activeTool = null; // Plus de graines, on déséquipe
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

    if (mesBaies.length === 0) {
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
                    <span style="color:white; font-size:0.9rem;">(x${qty})</span>
                </div>
                <div style="display:flex; align-items:center;">
                    <span style="color:#f1c40f; font-weight:bold; margin-right:10px; font-size:0.9rem;">+${conf.sellPrice}💰</span>
                    <button class="btn-small-action" style="background:#3498db; padding:4px 8px; margin-right:4px;" data-action="sell" data-id="${id}" data-qty="1">1</button>
                    <button class="btn-small-action" style="background:#e74c3c; padding:4px 8px;" data-action="sell" data-id="${id}" data-qty="${qty}">Max</button>
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
        const adjacentBerries = [];
        
        const checkAndAdd = (idx) => {
            const p = garden[idx];
            if (!p.locked && p.berryId !== null) {
                const st = getPlotState(p);
                if (st.stage === 'growing' || st.stage === 'thirsty' || st.stage === 'ready') {
                    adjacentBerries.push(p.berryId);
                }
            }
        };
        
        if (row > 0) checkAndAdd(i - 9); 
        if (row < 8) checkAndAdd(i + 9); 
        if (col > 0) checkAndAdd(i - 1); 
        if (col < 8) checkAndAdd(i + 1); 
        
        if (adjacentBerries.length >= 2) {
            for (let recipe of MUTATION_RECIPES) {
                const hasP1 = adjacentBerries.includes(recipe.p1);
                let hasP2 = false;
                
                if (recipe.p1 === recipe.p2) {
                    hasP2 = adjacentBerries.filter(b => b === recipe.p1).length >= 2;
                } else {
                    hasP2 = adjacentBerries.includes(recipe.p2);
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
                        activeTool = null; // Stoppe l'action du joueur pour qu'il le voie
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
    
    for(let i=0; i<yieldAmount; i++) {
        state.currentUserData.berries.push({
            data: baieDef, id: baieDef.id, date: Date.now() + i
        });
    }
    
    plot.berryId = null;
    plot.plantedAt = 0;
    plot.lastWatered = 0;
    
    saveGardenData();
    renderGardenGrid();
    
    // Si on ramasse "manuellement" via l'inspecteur, on affiche un message. 
    // Sinon, la truelle amasse silencieusement et rafraîchit l'inventaire des Outils.
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
        showDefaultTools(); // Actualise les inventaires de la barre latérale en temps réel
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

function saveGardenData() {
    db.collection('users').doc(state.currentUser).update({
        garden: state.currentUserData.garden,
        berries: state.currentUserData.berries,
        pokeBerrys: state.currentUserData.pokeBerrys
    }).catch(err => console.error(err));
}