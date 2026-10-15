import { state, CONSTS } from '../state.js';
import { formatMegaName } from '../utils.js';
import { state, CONSTS } from '../state.js';
import { formatMegaName, getCardImageUrl } from '../utils.js'; // <- AJOUT DE getCardImageUrl

export function initCollection() {
    const tabNormal = document.getElementById('tab-normal'); 
    const tabShiny = document.getElementById('tab-shiny');   
    const tabMega = document.getElementById('tab-mega'); 
    const tabMegaShiny = document.getElementById('tab-mega-shiny'); 
    const filterRarity = document.getElementById('filter-rarity');
    const filterOwned = document.getElementById('filter-owned');

    function setTabActive(activeTab) {
        [tabNormal, tabShiny, tabMega, tabMegaShiny].forEach(tab => tab.classList.remove('active'));
        activeTab.classList.add('active');
        
        if (activeTab === tabMega || activeTab === tabMegaShiny) {
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

    filterRarity.addEventListener('change', afficherCollection);
    filterOwned.addEventListener('change', afficherCollection);
    document.getElementById('nav-collection').addEventListener('click', afficherCollection);
}

export function afficherCollection() {
    const collectionContainer = document.getElementById('collection-container');
    const collectionCount = document.getElementById('collection-count');
    const filterRarity = document.getElementById('filter-rarity');
    const filterOwned = document.getElementById('filter-owned');

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
            possedeLaCarte = cartesPossedeesMap[i]?.normal > 0; quantite = cartesPossedeesMap[i]?.normal || 0; 
        } else if (state.collectionMode === 'shiny') { 
            possedeLaCarte = cartesPossedeesMap[i]?.shiny > 0; quantite = cartesPossedeesMap[i]?.shiny || 0; afficheHolo = true; 
        } else if (state.collectionMode === 'mega') {
            possedeLaCarte = cartesPossedeesMap[i]?.megas[form]?.normal > 0; quantite = cartesPossedeesMap[i]?.megas[form]?.normal || 0;
        } else if (state.collectionMode === 'mega-shiny') {
            possedeLaCarte = cartesPossedeesMap[i]?.megas[form]?.shiny > 0; quantite = cartesPossedeesMap[i]?.megas[form]?.shiny || 0; afficheHolo = true;
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
        
        let imageUrlNormale = getCardImageUrl({ ...carteTemp, shiny: false });

        if (possedeLaCarte) {
            const bgColor = CONSTS.couleursRarete[pokemonRarity];
            let classFond = "card-front"; let styleFond = "";
            if (form && afficheHolo) classFond += " mega-shiny-bg";
            else if (form) classFond += " mega-bg";
            else if (afficheHolo) classFond += " shiny-bg";
            else styleFond = `style="background-color: ${bgColor}"`;

            let textCount = quantite > 1 ? ` (x${quantite})` : ""; 
            let finalImageUrl = getCardImageUrl(carteTemp);

            htmlContent += `
                <div class="card flipped" style="cursor: default;">
                    <div class="card-inner">
                        <div class="${classFond}" ${styleFond}>
                            <div class="card-header"><h1 class="pokemon-name" data-en="${form ? formatMegaName(nomEn, form) : nomEn}" data-fr="${form ? formatMegaName(nomFr, form) : nomFr}" data-count="${quantite}">${nomAffiche}${textCount}</h1><div class="icon">${pokemonRarity}</div></div>
                            <div class="image-wrapper"><img class="pokemon-image" src="${finalImageUrl}" alt="Image" loading="lazy"><span class="image-id">#${numeroFormate}</span></div>
                            <div class="card-subtext">Pokémon</div>
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
                
                const cacheKey = `powCache_${id}`;
                const cachedPow = localStorage.getItem(cacheKey);
                
                if (cachedPow) {
                    let totalStats = parseInt(cachedPow);
                    if (isMega) totalStats += 100;
                    span.textContent = `POW ${totalStats}`;
                } else {
                    fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
                        .then(res => res.json())
                        .then(apiData => {
                            let totalStats = 0; 
                            apiData.stats.forEach(s => totalStats += s.base_stat);
                            localStorage.setItem(cacheKey, totalStats); 
                            if (isMega) totalStats += 100;
                            span.textContent = `POW ${totalStats}`;
                        }).catch(() => {
                            span.textContent = "POW ???";
                        });
                }
                obs.unobserve(span); 
            }
        });
    }, { rootMargin: "300px" }); 

    document.querySelectorAll('.pokemon-pow').forEach(span => {
        if (span.textContent === "...") observer.observe(span);
    });
}