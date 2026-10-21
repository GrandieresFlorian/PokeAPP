import { state, CONSTS } from '../state.js';
import { getPokemonDetails, formatMegaName, getCardImageUrl, generateTypeBadgesHTML, TOUTES_LES_BAIES, BAIES_BOOSTERS, MUTATION_RECIPES } from '../utils.js';

// ==========================================
// FICHE DÉTAILLÉE DU POKÉMON (100% LOCAL)
// ==========================================
export async function openCardDetails(carte) {
    const modal = document.getElementById('card-details-modal');
    modal.classList.remove('hidden');

    const closeBtn = document.getElementById('close-card-details');
    if (closeBtn) closeBtn.onclick = () => modal.classList.add('hidden');

    let d = carte.data || state.pokemonDataList[carte.pokedexNumber - 1] || {};
    let nameEn = d.en || "Unknown";
    let nameFr = d.fr || "Inconnu";

    if (carte.mega) {
        nameEn = formatMegaName(nameEn, carte.megaForm);
        nameFr = formatMegaName(nameFr, carte.megaForm);
    }

    const isEn = state.currentLang === 'en';

    document.getElementById('details-name').textContent = isEn ? nameEn : nameFr;
    let rarityStr = carte.mega ? "MG" : (d.rarity || "C");
    
    const lvlText = isEn ? "Lvl" : "Niv.";
    const rarityText = isEn ? "Rarity" : "Rareté";
    document.getElementById('details-level-rarity').textContent = `${lvlText} ${carte.level || 1} - ${rarityText} : ${rarityStr}`;

    const imgDiv = document.getElementById('details-card-image');
    if (imgDiv) {
        imgDiv.style.backgroundImage = `url('${getCardImageUrl(carte)}')`;
        imgDiv.style.backgroundColor = CONSTS.couleursRarete[rarityStr] || "#333";
        imgDiv.innerHTML = carte.shiny || (carte.mega && carte.shiny) ? '<div class="mini-card-holo"></div>' : '';
    }

    const details = await getPokemonDetails(carte); 
    document.getElementById('details-types').innerHTML = details.types.map(t => `<span class="type-badge type-${t}">${t.toUpperCase()}</span>`).join('');

    // Lecture robuste de la description
    let descText = isEn ? "No description available." : "Aucune description disponible.";
    const rawData = state.pokemonDataList[carte.pokedexNumber - 1];
    const descriptionObj = (carte.data && carte.data.description) ? carte.data.description : (rawData ? rawData.description : null);

    if (descriptionObj) {
        if (typeof descriptionObj === 'object') {
            descText = isEn ? (descriptionObj.en || descriptionObj.fr) : (descriptionObj.fr || descriptionObj.en);
        } else {
            descText = descriptionObj;
        }
    }
    descElement.textContent = descText;
    
    // --- FORCE LE RETOUR À LA LIGNE STRICT ---
    descElement.style.display = "block";
    descElement.style.width = "100%";
    descElement.style.maxWidth = "100%";
    descElement.style.whiteSpace = "normal"; 
    descElement.style.wordWrap = "break-word"; 
    descElement.style.overflowWrap = "break-word"; 
    descElement.style.lineHeight = "1.4";
    
    // Titres traduits dans la modale
    // Titres traduits dans la modale
    const descHeading = modal.querySelector('h3:nth-of-type(1)');
    if (descHeading) descHeading.textContent = isEn ? "Description" : "Description";

    const talentHeading = modal.querySelector('h3:nth-of-type(2)');
    if (talentHeading) {
        // Remplacement par Pomeg
        talentHeading.innerHTML = `${isEn ? "Ability (Special Trait)" : "Talent (Capacité Spéciale)"} <button id="btn-use-pomeg" class="btn btn-secondary" style="padding: 3px 10px; font-size: 0.75rem; margin:0;">🍒 ${isEn ? "Pomeg Berry" : "Baie Pomeg"}</button>`;
    }

    const statsHeading = modal.querySelector('h3:nth-of-type(3)');
    if (statsHeading) statsHeading.innerHTML = `${isEn ? "Statistics" : "Statistiques"} (${lvlText} <span id="details-stat-lvl">${carte.level || 1}</span>)`;

    const evHeading = modal.querySelector('h3:nth-of-type(4)');
    let totalEvs = Object.values(carte.evs || {}).reduce((a, b) => a + b, 0);
    if (evHeading) evHeading.innerHTML = `${isEn ? "Effort (EVs - Total" : "Effort (EVs - Total"} : <span id="details-ev-total" class="text-accent">${totalEvs}</span> / 510)`;

    // Affichage du Talent actuel
    let currentTalentFr = carte.talent ? carte.talent.fr : "Aucun";
    let currentTalentEn = carte.talent ? carte.talent.en : "None";
    document.getElementById('details-talent').textContent = isEn ? currentTalentEn : currentTalentFr;

    // --- GESTION DE LA BAIE POMEG ---
    const btnPomeg = document.getElementById('btn-use-pomeg');
    if (btnPomeg) {
        const newBtnPomeg = btnPomeg.cloneNode(true); 
        btnPomeg.parentNode.replaceChild(newBtnPomeg, btnPomeg);

        newBtnPomeg.onclick = async () => {
            if (!state.currentUserData.berries) state.currentUserData.berries = [];
            const berryIndex = state.currentUserData.berries.findIndex(b => b.id === 'pomeg-berry'); // ID mis à jour
            
            if (berryIndex === -1) {
                alert(isEn ? "You don't have a Pomeg Berry in your inventory!" : "Vous n'avez pas de Baie Pomeg dans votre inventaire !");
                return;
            }

            newBtnPomeg.disabled = true;
            newBtnPomeg.textContent = isEn ? "Awakening..." : "Éveil...";

            let possibleAbilities = d.abilities || [{en: "Overgrow", fr: "Engrais"}, {en: "Chlorophyll", fr: "Chlorophylle"}]; 
            const filteredAbilities = possibleAbilities.filter(ab => !carte.talent || ab.en !== carte.talent.en);

            if (filteredAbilities.length === 0) {
                alert(isEn ? "This Pokémon has no other possible abilities!" : "Ce Pokémon n'a pas d'autres talents possibles !");
                newBtnPomeg.disabled = false;
                newBtnPomeg.textContent = `🍒 ${isEn ? "Pomeg Berry" : "Baie Pomeg"}`;
                return;
            }

            state.currentUserData.berries.splice(berryIndex, 1);
            
            const randomTalent = filteredAbilities[Math.floor(Math.random() * filteredAbilities.length)];
            carte.talent = randomTalent;

            try {
                const { db } = await import('../firebase-config.js');
                await db.collection('users').doc(state.currentUser).update({ 
                    collection: state.currentUserData.collection,
                    berries: state.currentUserData.berries
                });
                
                document.getElementById('details-talent').textContent = isEn ? randomTalent.en : randomTalent.fr;
                alert(isEn ? `Success! New ability: ${randomTalent.en}` : `Succès ! Le Pokémon a éveillé le talent : ${randomTalent.fr} !`);
            } catch(e) {
                console.error(e);
                alert(isEn ? "Save error." : "Erreur de sauvegarde.");
            }

            newBtnPomeg.disabled = false;
            newBtnPomeg.textContent = `🍒 ${isEn ? "Pomeg Berry" : "Baie Pomeg"}`;
        };
    }

    // Calcul des Stats au niveau actuel
    let lvl = carte.level || 1;
    let maxHp = Math.floor(((2 * details.baseStats.hp) * lvl) / 100) + lvl + 10;
    let atk = Math.floor(((2 * details.baseStats.baseStats?.atk || details.baseStats.atk) * lvl) / 100) + 5;
    let def = Math.floor(((2 * details.baseStats.def) * lvl) / 100) + 5;
    let spatk = Math.floor(((2 * details.baseStats.spatk) * lvl) / 100) + 5;
    let spdef = Math.floor(((2 * details.baseStats.spdef) * lvl) / 100) + 5;
    let speed = Math.floor(((2 * details.baseStats.speed) * lvl) / 100) + 5;

    document.getElementById('details-stats-grid').innerHTML = `
        <div>❤️ HP/PV : <b style="color:#2ecc71">${maxHp}</b></div>
        <div>💨 ${isEn ? "Speed" : "Vitesse"} : <b style="color:#f39c12">${speed}</b></div>
        <div>⚔️ ${isEn ? "Attack" : "Attaque"} : <b>${atk}</b></div>
        <div>🛡️ ${isEn ? "Defense" : "Défense"} : <b>${def}</b></div>
        <div>🔥 ${isEn ? "Sp. Atk" : "Atk Spé"} : <b>${spatk}</b></div>
        <div>✨ ${isEn ? "Sp. Def" : "Déf Spé"} : <b>${spdef}</b></div>
    `;

    // Affichage des EVs du Pokémon
    if (!carte.evs) carte.evs = { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };

    document.getElementById('details-evs-grid').innerHTML = `
        <div>HP/PV : <b>${carte.evs.hp}/252</b></div>
        <div>Atk : <b>${carte.evs.atk}/252</b></div>
        <div>${isEn ? "Def" : "Déf"} : <b>${carte.evs.def}/252</b></div>
        <div>${isEn ? "Sp. Atk" : "Atk Spé"} : <b>${carte.evs.spatk}/252</b></div>
        <div>${isEn ? "Sp. Def" : "Déf Spé"} : <b>${carte.evs.spdef}/252</b></div>
        <div>${isEn ? "Spe" : "Vit"} : <b>${carte.evs.speed}/252</b></div>
    `;
}

// ==========================================
// AFFICHAGE ET GESTION DE LA COLLECTION
// ==========================================
export function initCollection() {
    const tabNormal = document.getElementById('tab-normal'); 
    const tabShiny = document.getElementById('tab-shiny');   
    const tabMega = document.getElementById('tab-mega'); 
    const tabMegaShiny = document.getElementById('tab-mega-shiny');
    const tabBaies = document.getElementById('tab-baies'); 
    const filterRarity = document.getElementById('filter-rarity');
    const filterOwned = document.getElementById('filter-owned');

    function setTabActive(activeTab) {
        [tabNormal, tabShiny, tabMega, tabMegaShiny, tabBaies].forEach(tab => { if(tab) tab.classList.remove('active'); });
        if (activeTab) activeTab.classList.add('active');
        if (activeTab === tabMega || activeTab === tabMegaShiny || activeTab === tabBaies) {
            filterRarity.value = "all"; filterRarity.disabled = true;
        } else filterRarity.disabled = false;
    }

    if(tabNormal) tabNormal.addEventListener('click', () => { state.collectionMode = 'normal'; setTabActive(tabNormal); afficherCollection(); });
    if(tabShiny) tabShiny.addEventListener('click', () => { state.collectionMode = 'shiny'; setTabActive(tabShiny); afficherCollection(); });
    if(tabMega) tabMega.addEventListener('click', () => { state.collectionMode = 'mega'; setTabActive(tabMega); afficherCollection(); });
    if(tabMegaShiny) tabMegaShiny.addEventListener('click', () => { state.collectionMode = 'mega-shiny'; setTabActive(tabMegaShiny); afficherCollection(); });
    if(tabBaies) tabBaies.addEventListener('click', () => { state.collectionMode = 'baies'; setTabActive(tabBaies); afficherCollection(); });

    if(filterRarity) filterRarity.addEventListener('change', afficherCollection);
    if(filterOwned) filterOwned.addEventListener('change', afficherCollection);
    const navCol = document.getElementById('nav-collection');
    if(navCol) navCol.addEventListener('click', afficherCollection);

    const containerCol = document.getElementById('collection-container');
    if(containerCol) {
        containerCol.addEventListener('click', (e) => {
            const btnUpgrade = e.target.closest('.btn-card-upgrade');
            const btnInfo = e.target.closest('.btn-card-info');

            if (btnUpgrade) {
                e.stopPropagation();
                upgradeCard(Number(btnUpgrade.dataset.date));
            } else if (btnInfo) {
                e.stopPropagation();
                const cardDate = Number(btnInfo.dataset.date);
                const carteTrouvee = state.currentUserData.collection.find(c => c.date === cardDate);
                if(carteTrouvee) openCardDetails(carteTrouvee);
            }
        });
    }
}

export function upgradeCard(cardDate) {
    const collection = state.currentUserData.collection;
    const mainCardIndex = collection.findIndex(c => c.date === cardDate);
    if (mainCardIndex === -1) return;
    
    const mainCard = collection[mainCardIndex];
    let maxLevel = mainCard.maxLevel || 20;
    
    let cost = 0;
    if (maxLevel === 20) cost = 1;
    else if (maxLevel === 40) cost = 2;
    else if (maxLevel === 60) cost = 3;
    else if (maxLevel === 80) cost = 4;
    else return; 
    
    const duplicates = collection.filter(c => 
        c.date !== mainCard.date && c.pokedexNumber === mainCard.pokedexNumber &&
        c.shiny === mainCard.shiny && c.mega === mainCard.mega && c.megaForm === mainCard.megaForm
    );
    
    if (duplicates.length < cost) return alert("Vous n'avez pas assez de doublons pour cette amélioration !");
    
    const datesToRemove = duplicates.slice(0, cost).map(c => c.date);
    state.currentUserData.collection = collection.filter(c => !datesToRemove.includes(c.date));
    
    const updatedMainCard = state.currentUserData.collection.find(c => c.date === cardDate);
    updatedMainCard.maxLevel = maxLevel + 20;
    
    import('../firebase-config.js').then(({db}) => {
        db.collection('users').doc(state.currentUser).update({ collection: state.currentUserData.collection })
            .then(() => afficherCollection())
            .catch(err => console.error("Erreur d'amélioration:", err));
    });
}

export function afficherCollection() {
    const collectionContainer = document.getElementById('collection-container');
    const collectionCount = document.getElementById('collection-count');
    const filterRarity = document.getElementById('filter-rarity');
    const filterOwned = document.getElementById('filter-owned');

    if (!collectionContainer || !collectionCount) return;

    if (state.collectionMode === 'baies') { afficherBaies(collectionContainer, collectionCount, filterOwned ? filterOwned.checked : false); return; }
    if (!state.currentUser) { collectionContainer.innerHTML = "<p>Veuillez vous connecter.</p>"; collectionCount.textContent = `0 / ${CONSTS.MAX_POKEMON}`; return; }
    if (state.pokemonDataList.length === 0) { collectionContainer.innerHTML = "<p>Chargement des données...</p>"; return; }

    const maCollection = state.currentUserData.collection || [];
    const cartesPossedeesMap = {}; 
    const rarityVal = filterRarity ? filterRarity.value : 'all'; 
    const ownedOnlyVal = filterOwned ? filterOwned.checked : false;
    
    maCollection.forEach(carte => {
        if (!cartesPossedeesMap[carte.pokedexNumber]) cartesPossedeesMap[carte.pokedexNumber] = { normal: [], shiny: [], megas: {} };
        if (carte.mega) {
            const form = carte.megaForm || "mega";
            if (!cartesPossedeesMap[carte.pokedexNumber].megas[form]) cartesPossedeesMap[carte.pokedexNumber].megas[form] = { normal: [], shiny: [] };
            carte.shiny ? cartesPossedeesMap[carte.pokedexNumber].megas[form].shiny.push(carte) : cartesPossedeesMap[carte.pokedexNumber].megas[form].normal.push(carte);
        } else carte.shiny ? cartesPossedeesMap[carte.pokedexNumber].shiny.push(carte) : cartesPossedeesMap[carte.pokedexNumber].normal.push(carte);
    });

    let maxAffiche = 0; let uniquesCount = 0; let htmlContent = ""; 

    const renderCard = (i, form = null) => {
        const dataOrigine = state.pokemonDataList[i - 1]; 
        if (!dataOrigine) return;

        let pokemonRarity = (state.collectionMode === 'mega' || state.collectionMode === 'mega-shiny') ? "MG" : dataOrigine.rarity;
        let list = [];
        if (state.collectionMode === 'normal') list = cartesPossedeesMap[i]?.normal || [];
        else if (state.collectionMode === 'shiny') list = cartesPossedeesMap[i]?.shiny || [];
        else if (state.collectionMode === 'mega') list = cartesPossedeesMap[i]?.megas?.[form]?.normal || [];
        else if (state.collectionMode === 'mega-shiny') list = cartesPossedeesMap[i]?.megas?.[form]?.shiny || [];

        let quantite = list.length; let possedeLaCarte = quantite > 0;
        let afficheHolo = state.collectionMode === 'shiny' || state.collectionMode === 'mega-shiny';

        if (rarityVal !== 'all' && pokemonRarity !== rarityVal) return; 
        if (ownedOnlyVal && !possedeLaCarte) return; 

        maxAffiche++; if (possedeLaCarte) uniquesCount++;

        let nomEn = dataOrigine.en; let nomFr = dataOrigine.fr;
        let nomAffiche = state.currentLang === 'en' ? nomEn : nomFr;
        if (form) nomAffiche = formatMegaName(nomAffiche, form);

        let numeroFormate = String(i).padStart(3, '0');
        const carteTemp = { data: dataOrigine, pokedexNumber: i, mega: form !== null, megaForm: form, shiny: afficheHolo };
        
        let finalImageUrl = getCardImageUrl(carteTemp);
        let imageUrlNormale = getCardImageUrl({ ...carteTemp, shiny: false, mega: false, megaForm: null });
        
        let pow = dataOrigine.pow || 300; if (form) pow += 100;
        const cachedTypes = dataOrigine.types ? generateTypeBadgesHTML(dataOrigine.types) : 'Pokémon';

        if (possedeLaCarte) {
            const mainCard = list.reduce((prev, curr) => (curr.maxLevel || 20) > (prev.maxLevel || 20) ? curr : prev);
            let currentLevel = mainCard.level || 1; let maxLevel = mainCard.maxLevel || 20; let doublons = quantite - 1;
            
            let cost = 0;
            if (maxLevel === 20) cost = 1; else if (maxLevel === 40) cost = 2; else if (maxLevel === 60) cost = 3; else if (maxLevel === 80) cost = 4;
            let canUpgrade = maxLevel < 100 && doublons >= cost;

            const bgColor = CONSTS.couleursRarete[pokemonRarity];
            let classFond = "card-front"; let styleFond = "";
            if (form && afficheHolo) classFond += " mega-shiny-bg"; else if (form) classFond += " mega-bg"; else if (afficheHolo) classFond += " shiny-bg"; else styleFond = `style="background-color: ${bgColor}"`;

            let badgeQuantite = quantite > 1 ? `<div class="badge-quantite">X${quantite}</div>` : ""; 

            let overlayHtml = `
                <div class="card-hover-actions">
                    <button class="btn-card-action btn-card-info" data-date="${mainCard.date}">👁️ Voir la Fiche</button>
                    ${maxLevel < 100 ? 
                        (canUpgrade ? `<button class="btn-card-action btn-card-upgrade" data-date="${mainCard.date}">⭐ Améliorer <br><span style="font-size:0.7rem; font-weight:normal;">(-${cost} doublon${cost>1?'s':''})</span></button>` : `<div class="upgrade-hint"><span class="translatable" data-fr="Manque ${cost - doublons} doublon(s)<br>pour le rang${maxLevel + 20}" data-en="Need ${cost - doublons} duplicate(s)<br>for rank${maxLevel + 20}">Manque ${cost - doublons} doublon(s)<br>pour le rang${maxLevel + 20}</span></div>`) 
                        : `<div class="upgrade-max">✨ RANG MAX ✨</div>`
                    }
                </div>`;

            htmlContent += `
                <div class="card flipped" style="cursor: default;">
                    <div class="card-inner">
                        <div class="${classFond}" ${styleFond}>
                            ${overlayHtml}${badgeQuantite}
                            <div class="card-header"><h1 class="pokemon-name" data-en="${form ? formatMegaName(nomEn, form) : nomEn}" data-fr="${form ? formatMegaName(nomFr, form) : nomFr}">${nomAffiche}</h1><div class="icon">${pokemonRarity}</div></div>
                            <div class="image-wrapper"><img class="pokemon-image" src="${finalImageUrl}" alt="Image" loading="lazy"><span class="image-id">#${numeroFormate}</span></div>
                            <div class="card-subtext type-container-col">${cachedTypes}</div>
                            <div class="stats-bar"><span class="pokemon-pow">POW ${pow}</span><span class="pokemon-aura">N° ${numeroFormate}</span></div>
                        </div>
                    </div>
                </div>`;
        } else {
            htmlContent += `
                <div class="card flipped" style="cursor: default;">
                    <div class="card-inner">
                        <div class="card-front locked-card" style="background-color: #1a1a1a;">
                            <div class="card-header"><h1 class="pokemon-name" style="color: #555;">???</h1><div class="icon" style="background-color: #333; color: #555;">?</div></div>
                            <div class="image-wrapper" style="background-color: #222;"><div class="question-mark">?</div><img class="pokemon-image silhouette" src="${imageUrlNormale}" alt="Caché" loading="lazy"><span class="image-id" style="color: #555;">#${numeroFormate}</span></div>
                            <div class="card-subtext" style="color: #555;">Inconnu</div>
                            <div class="stats-bar" style="background-color: #111; color: #555;"><span class="pokemon-pow">POW ???</span><span class="pokemon-aura">N° ${numeroFormate}</span></div>
                        </div>
                    </div>
                </div>`;
        }
    };

    if (state.collectionMode === 'mega' || state.collectionMode === 'mega-shiny') Object.keys(CONSTS.megaIds).map(Number).sort((a,b)=>a-b).forEach(i => CONSTS.megaIds[i].forEach(form => renderCard(i, form)));
    else for (let i = 1; i <= CONSTS.MAX_POKEMON; i++) renderCard(i);
    
    collectionContainer.innerHTML = htmlContent; 
    collectionCount.textContent = `${uniquesCount} / ${maxAffiche}`;
}

function getBerryHint(baieId) {
    if (BAIES_BOOSTERS.some(b => b.id === baieId)) return "Obtenable : Dans les Boosters Pokémon ✨";
    const recipe = MUTATION_RECIPES.find(r => r.result === baieId);
    if (recipe) {
        const p1Def = TOUTES_LES_BAIES.find(b => b.id === recipe.p1); const p2Def = TOUTES_LES_BAIES.find(b => b.id === recipe.p2);
        const name1 = p1Def ? p1Def.fr : recipe.p1; const name2 = p2Def ? p2Def.fr : recipe.p2;
        return `Indice de mutation 🔬 : Plantez une ${name1} à côté d'une ${name2}`;
    }
    return "Indice : Mutation secrète non découverte...";
}

function afficherBaies(container, countDisplay, ownedOnlyVal) {
    const mesBaies = state.currentUserData.berries || [];
    const baiesMap = {}; mesBaies.forEach(b => { baiesMap[b.id] = (baiesMap[b.id] || 0) + 1; });

    let maxAffiche = 0; let uniquesCount = 0; let htmlContent = "";

    TOUTES_LES_BAIES.forEach(baie => {
        const quantite = baiesMap[baie.id] || 0; const possedeLaCarte = quantite > 0;
        if (ownedOnlyVal && !possedeLaCarte) return;

        maxAffiche++; if (possedeLaCarte) uniquesCount++;
        let nomAffiche = state.currentLang === 'en' ? baie.en : baie.fr;
        let enName = baie.en.toLowerCase().replace(/\s+/g, '-');
        let finalImageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${enName}.png`;
        let hint = getBerryHint(baie.id);

        if (possedeLaCarte) {
            let badgeQuantite = quantite > 1 ? `<div class="badge-quantite">X${quantite}</div>` : "";
            htmlContent += `
                <div class="card flipped" style="cursor: help;" title="${hint}">
                    <div class="card-inner">
                        <div class="card-front" style="background-color: #2ecc71; border-color: #27ae60;">
                            ${badgeQuantite}
                            <div class="card-header"><h1 class="pokemon-name" data-en="${baie.en}" data-fr="${baie.fr}">${nomAffiche}</h1><div class="icon" style="background-color: white; color: #27ae60;">B</div></div>
                            <div class="image-wrapper" style="background-color: #fceea7;"><img class="pokemon-image" src="${finalImageUrl}" alt="Baie" style="object-fit: contain; height: 160px; padding: 15px; image-rendering: pixelated;" loading="lazy"></div>
                            <div class="card-subtext" style="justify-content:center;">Objet Consommable</div>
                            <div class="stats-bar" style="justify-content:center;"><span style="font-weight:bold; color: white;">BAIE POKÉMON</span></div>
                        </div>
                    </div>
                </div>`;
        } else {
            htmlContent += `
                <div class="card flipped" style="cursor: help;" title="${hint}">
                    <div class="card-inner">
                        <div class="card-front locked-card" style="background-color: #1a1a1a;">
                            <div class="card-header"><h1 class="pokemon-name" style="color: #555;">???</h1><div class="icon" style="background-color: #333; color: #555;">?</div></div>
                            <div class="image-wrapper" style="background-color: #222;"><div class="question-mark">?</div><img class="pokemon-image silhouette" src="${finalImageUrl}" alt="Caché" style="object-fit: contain; height: 160px; padding: 15px; image-rendering: pixelated;" loading="lazy"></div>
                            <div class="card-subtext" style="color: #555; justify-content:center;">Objet Inconnu</div>
                            <div class="stats-bar" style="background-color: #111; color: #555; justify-content:center;"><span style="font-weight:bold;">BAIE INCONNUE</span></div>
                        </div>
                    </div>
                </div>`;
        }
    });
    container.innerHTML = htmlContent; countDisplay.textContent = `${uniquesCount} / ${maxAffiche}`;
}