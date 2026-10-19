import { state, CONSTS } from '../state.js';
import { formatMegaName, getCardImageUrl, getPokemonDetails, generateTypeBadgesHTML, pokemonTypeCache, TOUTES_LES_BAIES, BAIES_BOOSTERS, MUTATION_RECIPES } from '../utils.js';

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
        activeTab.classList.add('active');
        
        if (activeTab === tabMega || activeTab === tabMegaShiny || activeTab === tabBaies) {
            filterRarity.value = "all";
            filterRarity.disabled = true;
        } else {
            filterRarity.disabled = false;
        }
    }

    tabNormal.addEventListener('click', () => { state.collectionMode = 'normal'; setTabActive(tabNormal); afficherCollection(); });
    tabShiny.addEventListener('click', () => { state.collectionMode = 'shiny'; setTabActive(tabShiny); afficherCollection(); });
    tabMega.addEventListener('click', () => { state.collectionMode = 'mega'; setTabActive(tabMega); afficherCollection(); });
    tabMegaShiny.addEventListener('click', () => { state.collectionMode = 'mega-shiny'; setTabActive(tabMegaShiny); afficherCollection(); });
    if(tabBaies) tabBaies.addEventListener('click', () => { state.collectionMode = 'baies'; setTabActive(tabBaies); afficherCollection(); });

    filterRarity.addEventListener('change', afficherCollection);
    filterOwned.addEventListener('change', afficherCollection);
    document.getElementById('nav-collection').addEventListener('click', afficherCollection);
}

export function afficherCollection() {
    const collectionContainer = document.getElementById('collection-container');
    const collectionCount = document.getElementById('collection-count');
    const filterRarity = document.getElementById('filter-rarity');
    const filterOwned = document.getElementById('filter-owned');

    if (state.collectionMode === 'baies') {
        afficherBaies(collectionContainer, collectionCount, filterOwned.checked);
        return;
    }
    if (!state.currentUser) {
        collectionContainer.innerHTML = "<p>Veuillez vous connecter.</p>";
        collectionCount.textContent = `0 / ${CONSTS.MAX_POKEMON}`;
        return;
    }
    if (state.pokemonDataList.length === 0) {
        collectionContainer.innerHTML = "<p>Chargement des données...</p>";
        return;
    }

    const maCollection = state.currentUserData.collection || [];
    const cartesPossedeesMap = {}; 
    
    const rarityVal = filterRarity.value;
    const ownedOnlyVal = filterOwned.checked;
    
    maCollection.forEach(carte => {
        if (!cartesPossedeesMap[carte.pokedexNumber]) cartesPossedeesMap[carte.pokedexNumber] = { normal: 0, shiny: 0, megas: {} };
        if (carte.mega) {
            const form = carte.megaForm || "mega";
            if (!cartesPossedeesMap[carte.pokedexNumber].megas[form]) cartesPossedeesMap[carte.pokedexNumber].megas[form] = { normal: 0, shiny: 0 };
            carte.shiny ? cartesPossedeesMap[carte.pokedexNumber].megas[form].shiny++ : cartesPossedeesMap[carte.pokedexNumber].megas[form].normal++;
        } else {
            carte.shiny ? cartesPossedeesMap[carte.pokedexNumber].shiny++ : cartesPossedeesMap[carte.pokedexNumber].normal++;
        }
    });

    let maxAffiche = 0; 
    let uniquesCount = 0;
    let htmlContent = ""; 

    const renderCard = (i, form = null) => {
        const dataOrigine = state.pokemonDataList[i - 1]; 
        if (!dataOrigine) return;

        let pokemonRarity = (state.collectionMode === 'mega' || state.collectionMode === 'mega-shiny') ? "MG" : dataOrigine.rarity;
        let possedeLaCarte = false; let quantite = 0; let afficheHolo = false;
        
        if (state.collectionMode === 'normal') { 
            quantite = (cartesPossedeesMap[i] && cartesPossedeesMap[i].normal) ? cartesPossedeesMap[i].normal : 0;
            possedeLaCarte = quantite > 0;
        } else if (state.collectionMode === 'shiny') { 
            quantite = (cartesPossedeesMap[i] && cartesPossedeesMap[i].shiny) ? cartesPossedeesMap[i].shiny : 0;
            possedeLaCarte = quantite > 0; 
            afficheHolo = true; 
        } else if (state.collectionMode === 'mega') {
            quantite = (cartesPossedeesMap[i] && cartesPossedeesMap[i].megas && cartesPossedeesMap[i].megas[form] && cartesPossedeesMap[i].megas[form].normal) ? cartesPossedeesMap[i].megas[form].normal : 0;
            possedeLaCarte = quantite > 0;
        } else if (state.collectionMode === 'mega-shiny') {
            quantite = (cartesPossedeesMap[i] && cartesPossedeesMap[i].megas && cartesPossedeesMap[i].megas[form] && cartesPossedeesMap[i].megas[form].shiny) ? cartesPossedeesMap[i].megas[form].shiny : 0;
            possedeLaCarte = quantite > 0; 
            afficheHolo = true;
        }

        if (rarityVal !== 'all' && pokemonRarity !== rarityVal) return; 
        if (ownedOnlyVal && !possedeLaCarte) return; 

        maxAffiche++;
        if (possedeLaCarte) uniquesCount++;

        let nomEn = dataOrigine.en; let nomFr = dataOrigine.fr;
        let nomAffiche = state.currentLang === 'en' ? nomEn : nomFr;
        if (form) nomAffiche = formatMegaName(nomAffiche, form);

        let numeroFormate = String(i).padStart(3, '0');
        
        const carteTemp = {
            data: dataOrigine,
            pokedexNumber: i,
            mega: form !== null,
            megaForm: form,
            shiny: afficheHolo
        };
        
        let finalImageUrl = getCardImageUrl(carteTemp);
        let imageUrlNormale = getCardImageUrl({ ...carteTemp, shiny: false, mega: false, megaForm: null });
        
        const cachedTypes = pokemonTypeCache[i] ? generateTypeBadgesHTML(pokemonTypeCache[i]) : 'Pokémon';

        if (possedeLaCarte) {
            const bgColor = CONSTS.couleursRarete[pokemonRarity];
            let classFond = "card-front"; let styleFond = "";
            if (form && afficheHolo) classFond += " mega-shiny-bg";
            else if (form) classFond += " mega-bg";
            else if (afficheHolo) classFond += " shiny-bg";
            else styleFond = `style="background-color: ${bgColor}"`;

            let badgeQuantite = quantite > 1 ? `<div class="badge-quantite">X${quantite}</div>` : ""; 

            htmlContent += `
                <div class="card flipped" style="cursor: default;">
                    <div class="card-inner">
                        <div class="${classFond}" ${styleFond}>
                            ${badgeQuantite}
                            <div class="card-header"><h1 class="pokemon-name" data-en="${form ? formatMegaName(nomEn, form) : nomEn}" data-fr="${form ? formatMegaName(nomFr, form) : nomFr}" data-count="${quantite}">${nomAffiche}</h1><div class="icon">${pokemonRarity}</div></div>
                            <div class="image-wrapper"><img class="pokemon-image" src="${finalImageUrl}" alt="Image" loading="lazy"><span class="image-id">#${numeroFormate}</span></div>
                            <div class="card-subtext type-container-col" data-id="${i}">${cachedTypes}</div>
                            <div class="stats-bar"><span class="pokemon-pow" data-id="${i}" data-mega="${form ? 'true' : 'false'}">...</span><span class="pokemon-aura">N° ${numeroFormate}</span></div>
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

    if (state.collectionMode === 'mega' || state.collectionMode === 'mega-shiny') {
        Object.keys(CONSTS.megaIds).map(Number).sort((a,b)=>a-b).forEach(i => CONSTS.megaIds[i].forEach(form => renderCard(i, form)));
    } else {
        for (let i = 1; i <= CONSTS.MAX_POKEMON; i++) renderCard(i);
    }
    
    collectionContainer.innerHTML = htmlContent; 
    collectionCount.textContent = `${uniquesCount} / ${maxAffiche}`;

    chargerPowDynamiquement(); 
}

function chargerPowDynamiquement() {
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const span = entry.target;
                const id = span.dataset.id;
                const isMega = span.dataset.mega === "true";
                
                const typeContainer = span.closest('.card-front').querySelector('.type-container-col');
                
                getPokemonDetails({ pokedexNumber: id, mega: isMega }).then(details => {
                    span.textContent = `POW ${details.pow}`;
                    if(typeContainer) {
                        typeContainer.innerHTML = generateTypeBadgesHTML(details.types);
                    }
                });

                obs.unobserve(span); 
            }
        });
    }, { rootMargin: "300px" }); 

    document.querySelectorAll('.pokemon-pow').forEach(span => {
        if (span.textContent === "...") observer.observe(span);
    });
}

function getBerryHint(baieId) {
    if (BAIES_BOOSTERS.some(b => b.id === baieId)) {
        return "Obtenable : Dans les Boosters Pokémon ✨";
    }
    const recipe = MUTATION_RECIPES.find(r => r.result === baieId);
    if (recipe) {
        const p1Def = TOUTES_LES_BAIES.find(b => b.id === recipe.p1);
        const p2Def = TOUTES_LES_BAIES.find(b => b.id === recipe.p2);
        const name1 = p1Def ? p1Def.fr : recipe.p1;
        const name2 = p2Def ? p2Def.fr : recipe.p2;
        return `Indice de mutation 🔬 : Plantez une ${name1} à côté d'une ${name2}`;
    }
    return "Indice : Mutation secrète non découverte...";
}

function afficherBaies(container, countDisplay, ownedOnlyVal) {
    const mesBaies = state.currentUserData.berries || [];
    const baiesMap = {};
    mesBaies.forEach(b => { baiesMap[b.id] = (baiesMap[b.id] || 0) + 1; });

    let maxAffiche = 0;
    let uniquesCount = 0;
    let htmlContent = "";

    TOUTES_LES_BAIES.forEach(baie => {
        const quantite = baiesMap[baie.id] || 0;
        const possedeLaCarte = quantite > 0;

        if (ownedOnlyVal && !possedeLaCarte) return;

        maxAffiche++;
        if (possedeLaCarte) uniquesCount++;

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

    container.innerHTML = htmlContent;
    countDisplay.textContent = `${uniquesCount} / ${maxAffiche}`;
}