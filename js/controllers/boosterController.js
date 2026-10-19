import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { allerASection } from './navController.js';
import { tirerRarete, formatMegaName, sauvegarderCarte, getCardImageUrl, getPokemonDetails, generateTypeBadgesHTML, pokemonTypeCache } from '../utils.js';

export function updateBoosterLogic() {
    const boosterStatus = document.getElementById('booster-status');
    const boosterCountDisplay = document.getElementById('booster-count-display');
    const boosterTimerText = document.getElementById('booster-timer-text');
    const boosterTimerDisplay = document.getElementById('booster-timer-display');

    if (!state.currentUser) {
        boosterStatus.classList.add('hidden');
        clearInterval(state.boosterTimerInterval);
        return;
    }
    
    boosterStatus.classList.remove('hidden');
    const now = Date.now();

    if (state.currentUserData.boostersLeft < CONSTS.MAX_BOOSTERS) {
        const timePassed = now - state.currentUserData.lastBoosterTime;
        const boostersGained = Math.floor(timePassed / CONSTS.REGEN_TIME_MS);

        if (boostersGained > 0) {
            state.currentUserData.boostersLeft = Math.min(CONSTS.MAX_BOOSTERS, state.currentUserData.boostersLeft + boostersGained);
            if (state.currentUserData.boostersLeft === CONSTS.MAX_BOOSTERS) {
                state.currentUserData.lastBoosterTime = now;
            } else {
                state.currentUserData.lastBoosterTime += boostersGained * CONSTS.REGEN_TIME_MS;
            }
            db.collection('users').doc(state.currentUser).update({
                boostersLeft: state.currentUserData.boostersLeft,
                lastBoosterTime: state.currentUserData.lastBoosterTime
            });
        }
    } else {
        state.currentUserData.lastBoosterTime = now;
    }

    renderBoosterStatus(boosterCountDisplay, boosterTimerText, boosterTimerDisplay);
    updateSpecialBoosterUI();
    
    clearInterval(state.boosterTimerInterval);
    state.boosterTimerInterval = setInterval(() => {
        if (state.currentUserData.boostersLeft < CONSTS.MAX_BOOSTERS) {
            const currentNow = Date.now();
            const timePassed = currentNow - state.currentUserData.lastBoosterTime;
            
            if (timePassed >= CONSTS.REGEN_TIME_MS) {
                state.currentUserData.boostersLeft++;
                if (state.currentUserData.boostersLeft === CONSTS.MAX_BOOSTERS) {
                    state.currentUserData.lastBoosterTime = currentNow;
                } else {
                    state.currentUserData.lastBoosterTime += CONSTS.REGEN_TIME_MS;
                }
                db.collection('users').doc(state.currentUser).update({
                    boostersLeft: state.currentUserData.boostersLeft,
                    lastBoosterTime: state.currentUserData.lastBoosterTime
                });
            }
            renderBoosterStatus(boosterCountDisplay, boosterTimerText, boosterTimerDisplay);
        } else {
            renderBoosterStatus(boosterCountDisplay, boosterTimerText, boosterTimerDisplay);
        }
    }, 1000);
}

function renderBoosterStatus(countDisplay, textDisplay, timerDisplay) {
    countDisplay.textContent = state.currentUserData.boostersLeft;
    
    if (state.currentUserData.boostersLeft >= CONSTS.MAX_BOOSTERS) {
        textDisplay.style.display = 'none';
    } else {
        textDisplay.style.display = 'block';
        const now = Date.now();
        const timeLeft = CONSTS.REGEN_TIME_MS - (now - state.currentUserData.lastBoosterTime);
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        
        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}

export function updateSpecialBoosterUI() {
    const sbPack = document.getElementById('special-booster-pack');
    const sbCount = document.getElementById('special-booster-count');
    if (!state.currentUser || state.currentUserData.specialBoostersLeft === undefined) {
        if(sbPack) sbPack.classList.add('hidden');
        return;
    }
    if (state.currentUserData.specialBoostersLeft > 0) {
        if(!state.isOpening) sbPack.classList.remove('hidden');
        sbCount.textContent = `${state.currentUserData.specialBoostersLeft} disponible(s)`;
    } else {
        sbPack.classList.add('hidden');
    }
}

export function initBooster() {
    const boosterElement = document.getElementById('booster-pack');
    const specialBoosterElement = document.getElementById('special-booster-pack');
    const resetButton = document.getElementById('reset-button');
    const autoOpenBtn = document.getElementById('auto-open-btn');
    const cardsContainer = document.getElementById('cards-container');

    boosterElement.addEventListener('click', () => ouvrirBooster(false));
    specialBoosterElement.addEventListener('click', () => ouvrirBooster(true));

    resetButton.addEventListener('click', () => { 
        cardsContainer.innerHTML = ''; 
        cardsContainer.classList.add('hidden');
        resetButton.classList.add('hidden');
        
        boosterElement.classList.remove('hidden'); 
        updateSpecialBoosterUI(); 
    });

    autoOpenBtn.addEventListener('click', () => {
        autoOpenBtn.disabled = true; 
        
        function flipNextAutomatically() {
            const unflippedCard = cardsContainer.querySelector('.card:not(.flipped)');
            
            if (unflippedCard) {
                unflippedCard.click(); 
                setTimeout(flipNextAutomatically, 200); 
            } else if (state.cartesRetournees < 5) {
                setTimeout(flipNextAutomatically, 100);
            }
        }
        
        flipNextAutomatically();
    });
}

function creerCarte(pokemonData, numeroPokedex, index) {
    let nomEn = pokemonData.en; let nomFr = pokemonData.fr; let pokemonRarity = pokemonData.rarity;
    
    let isMega = false; let selectedMegaForm = null;
    const chanceMega = Math.random() * 100;
    
    if (CONSTS.megaIds[numeroPokedex] && chanceMega <= state.probabilities.mega) {
        isMega = true; pokemonRarity = "MG";
        const possibles = CONSTS.megaIds[numeroPokedex];
        selectedMegaForm = possibles[Math.floor(Math.random() * possibles.length)];
    }

    const chanceShiny = Math.random() * 100;
    const shinyThreshold = state.currentPullIsSpecial ? (state.probabilities.shiny * 3) : state.probabilities.shiny;
    const isShiny = chanceShiny <= shinyThreshold;

    let nomAffiche = state.currentLang === 'en' ? nomEn : nomFr;
    if (isMega) nomAffiche = formatMegaName(nomAffiche, selectedMegaForm);

    let numeroFormate = String(numeroPokedex).padStart(3, '0');
    const bgColor = CONSTS.couleursRarete[pokemonRarity];
    
    const carteTemp = {
        data: pokemonData,
        pokedexNumber: numeroPokedex,
        mega: isMega,
        megaForm: selectedMegaForm,
        shiny: isShiny
    };

    let imageUrl = getCardImageUrl(carteTemp);
    let classFond = "card-front"; let styleFond = "";
    
    if (isMega) {
        classFond += isShiny ? " mega-shiny-bg" : " mega-bg";
    } else {
        if (isShiny) classFond += " shiny-bg";
        else styleFond = `style="background-color: ${bgColor}"`;
    }

    const cardHTML = `
        <div class="card">
            <div class="card-inner">
                <div class="card-back"><div class="card-back-design">PokéApp</div></div>
                <div class="${classFond}" ${styleFond}>
                    <div class="card-header"><h1 class="pokemon-name" data-en="${isMega ? formatMegaName(nomEn, selectedMegaForm) : nomEn}" data-fr="${isMega ? formatMegaName(nomFr, selectedMegaForm) : nomFr}">${nomAffiche}</h1><div class="icon">${pokemonRarity}</div></div>
                    <div class="image-wrapper"><img class="pokemon-image" src="${imageUrl}" alt="Image"><span class="image-id">#${numeroFormate}</span></div>
                    <div class="card-subtext" id="type-container-boost-${index}">Pokémon</div>
                    <div class="stats-bar"><span class="pokemon-pow">POW ...</span><span class="pokemon-aura">N° ${numeroFormate}</span></div>
                </div>
            </div>
        </div>`;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cardHTML;
    const nouvelleCarte = tempDiv.firstElementChild;
    const powElement = nouvelleCarte.querySelector('.pokemon-pow');

    nouvelleCarte.addEventListener('click', () => {
        if (!nouvelleCarte.classList.contains('flipped')) {
            
            const estDoublon = state.currentUserData.collection.some(c => 
                c.pokedexNumber === numeroPokedex && 
                c.shiny === isShiny && 
                c.mega === isMega && 
                c.megaForm === selectedMegaForm
            );
            
            const badge = document.createElement('div');
            badge.className = `badge-status ${estDoublon ? 'badge-doublon' : 'badge-nouveau'}`;
            badge.textContent = estDoublon ? 'Doublon' : 'Nouveau !';
            
            nouvelleCarte.querySelector('.card-front').appendChild(badge);

            nouvelleCarte.classList.add('flipped'); 
            state.cartesRetournees++; 
            sauvegarderCarte(pokemonData, numeroPokedex, isShiny, isMega, selectedMegaForm);
            
            if (state.currentPullIndex < 4) {
                state.currentPullIndex++;
                setTimeout(() => {
                    const nextCard = state.currentPulls[state.currentPullIndex];
                    creerCarte(nextCard.data, nextCard.pokedexNumber, state.currentPullIndex);
                }, 150); 
            }

            if (state.cartesRetournees === 5) {
                setTimeout(() => {
                    const resetButton = document.getElementById('reset-button');
                    const autoOpenBtn = document.getElementById('auto-open-btn');
                    resetButton.classList.remove('hidden');
                    resetButton.disabled = false;
                    autoOpenBtn.classList.add('hidden'); 
                }, 200);
            }
        }
    });
    document.getElementById('cards-container').appendChild(nouvelleCarte);
    
    // NOUVEAUTÉ : Chargement du POW + des Types
    getPokemonDetails(carteTemp).then(details => {
        powElement.textContent = `POW ${details.pow}`;
        const typeContainer = document.getElementById(`type-container-boost-${index}`);
        if(typeContainer) {
            typeContainer.innerHTML = generateTypeBadgesHTML(details.types);
        }
    });
}

function ouvrirBooster(isSpecial = false) {
    if (!state.currentUser) { alert("Vous devez être connecté !"); return allerASection('section-auth'); }
    if (state.pokemonDataList.length === 0) return alert("Les données chargent...");

    if (isSpecial) {
        if (state.currentUserData.specialBoostersLeft <= 0) {
            alert("Vous n'avez pas de boosters spéciaux ! Remportez des combats pour en gagner.");
            return;
        }
    } else {
        if (state.currentUserData.boostersLeft <= 0) {
            alert("Vous n'avez plus de boosters ! Revenez plus tard.");
            return;
        }
    }

    if (state.isOpening) return; 
    state.isOpening = true;
    state.currentPullIsSpecial = isSpecial;

    if (isSpecial) {
        state.currentUserData.specialBoostersLeft--;
        db.collection('users').doc(state.currentUser).update({
            specialBoostersLeft: state.currentUserData.specialBoostersLeft
        });
    } else {
        state.currentUserData.boostersLeft--;
        if (state.currentUserData.boostersLeft === CONSTS.MAX_BOOSTERS - 1) {
            state.currentUserData.lastBoosterTime = Date.now();
        }
        db.collection('users').doc(state.currentUser).update({
            boostersLeft: state.currentUserData.boostersLeft,
            lastBoosterTime: state.currentUserData.lastBoosterTime
        });
    }
    
    updateBoosterLogic();

    const normalBoosterElement = document.getElementById('booster-pack');
    const specialBoosterElement = document.getElementById('special-booster-pack');
    const activeBooster = isSpecial ? specialBoosterElement : normalBoosterElement;
    
    const cardsContainer = document.getElementById('cards-container');
    const autoOpenBtn = document.getElementById('auto-open-btn');
    const resetButton = document.getElementById('reset-button');

    activeBooster.classList.add('booster-animating');

    setTimeout(() => {
        activeBooster.classList.remove('booster-animating');
        normalBoosterElement.classList.add('hidden'); 
        specialBoosterElement.classList.add('hidden');
        
        cardsContainer.innerHTML = ''; 
        cardsContainer.classList.remove('hidden'); 
        state.cartesRetournees = 0; 
        
        let cartesTirees = [];
        const pokemonListAvecIndex = state.pokemonDataList.map((pokemon, index) => { return { donnees: pokemon, vraiNumero: index + 1 }; });
        
        for(let i = 0; i < 5; i++) {
            const rareteCible = tirerRarete();
            const pokemonsPossibles = pokemonListAvecIndex.filter(p => p.donnees.rarity === rareteCible);
            if (pokemonsPossibles.length === 0) { i--; continue; }

            const randomPossibiliteIndex = Math.floor(Math.random() * pokemonsPossibles.length);
            cartesTirees.push({ data: pokemonsPossibles[randomPossibiliteIndex].donnees, pokedexNumber: pokemonsPossibles[randomPossibiliteIndex].vraiNumero });
        }
        
        cartesTirees.sort((a, b) => CONSTS.poidsRarete[a.data.rarity] - CONSTS.poidsRarete[b.data.rarity]);
        
        state.currentPulls = cartesTirees;
        state.currentPullIndex = 0;
        
        autoOpenBtn.classList.remove('hidden');
        autoOpenBtn.disabled = false;
        resetButton.classList.add('hidden');

        creerCarte(state.currentPulls[0].data, state.currentPulls[0].pokedexNumber, 0);

        state.isOpening = false; 
    }, 600); 
}