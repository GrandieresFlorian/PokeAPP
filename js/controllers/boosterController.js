import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { allerASection } from './navController.js';
import { tirerRarete, formatMegaName, sauvegarderCarte, getCardImageUrl, getPokemonDetails, generateTypeBadgesHTML, BAIES_BOOSTERS, sauvegarderBaie, getRandomTrainer, sauvegarderDresseur } from '../utils.js';
export function updateBoosterLogic() {
    if (!state.currentUser) {
        clearInterval(state.boosterTimerInterval);
        return;
    }

    const maxDisplay = document.getElementById('trainer-max-display');
    if (maxDisplay) {
        maxDisplay.textContent = `/ ${state.trainerConfig.maxBoosters}`;
    }

    document.getElementById('trainer-max-display').textContent = `/ ${state.trainerConfig.maxBoosters}`;

    clearInterval(state.boosterTimerInterval);
    state.boosterTimerInterval = setInterval(() => {
        const now = Date.now();
        let needsUpdate = false;

        // 1. CALCUL POKÉMON
        if (state.currentUserData.boostersLeft < CONSTS.MAX_BOOSTERS) {
            const timePassed = now - state.currentUserData.lastBoosterTime;
            if (timePassed >= CONSTS.REGEN_TIME_MS) {
                const boostersGained = Math.floor(timePassed / CONSTS.REGEN_TIME_MS);
                state.currentUserData.boostersLeft = Math.min(CONSTS.MAX_BOOSTERS, state.currentUserData.boostersLeft + boostersGained);
                state.currentUserData.lastBoosterTime += boostersGained * CONSTS.REGEN_TIME_MS;
                needsUpdate = true;
            }
        }

        // 2. CALCUL DRESSEUR
        if (state.currentUserData.trainerBoostersLeft < state.trainerConfig.maxBoosters) {
            const trainerTimePassed = now - state.currentUserData.lastTrainerBoosterTime;
            if (trainerTimePassed >= state.trainerConfig.regenTimeMs) {
                const trainerBoostersGained = Math.floor(trainerTimePassed / state.trainerConfig.regenTimeMs);
                state.currentUserData.trainerBoostersLeft = Math.min(state.trainerConfig.maxBoosters, state.currentUserData.trainerBoostersLeft + trainerBoostersGained);
                state.currentUserData.lastTrainerBoosterTime += trainerBoostersGained * state.trainerConfig.regenTimeMs;
                needsUpdate = true;
            }
        }

        // Sauvegarde silencieuse si un booster a été gagné
        if (needsUpdate) {
            db.collection('users').doc(state.currentUser).update({
                boostersLeft: state.currentUserData.boostersLeft,
                lastBoosterTime: state.currentUserData.lastBoosterTime,
                trainerBoostersLeft: state.currentUserData.trainerBoostersLeft,
                lastTrainerBoosterTime: state.currentUserData.lastTrainerBoosterTime
            });
        }

        // 3. AFFICHAGE POKÉMON EN TEMPS RÉEL
        document.getElementById('booster-count-display').textContent = state.currentUserData.boostersLeft;
        const pkmTimerText = document.getElementById('booster-timer-text');
        if (state.currentUserData.boostersLeft >= CONSTS.MAX_BOOSTERS) {
            pkmTimerText.style.display = 'none';
        } else {
            pkmTimerText.style.display = 'block';
            const timeLeft = CONSTS.REGEN_TIME_MS - (now - state.currentUserData.lastBoosterTime);
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            document.getElementById('booster-timer-display').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        // 4. AFFICHAGE DRESSEUR EN TEMPS RÉEL
        document.getElementById('trainer-count-display').textContent = state.currentUserData.trainerBoostersLeft;
        const trainerTimerText = document.getElementById('trainer-timer-text');
        if (state.currentUserData.trainerBoostersLeft >= state.trainerConfig.maxBoosters) {
            trainerTimerText.style.display = 'none';
        } else {
            trainerTimerText.style.display = 'block';
            const tLeft = state.trainerConfig.regenTimeMs - (now - state.currentUserData.lastTrainerBoosterTime);
            const tHours = Math.floor(tLeft / 3600000);
            const tMins = Math.floor((tLeft % 3600000) / 60000);
            const tSecs = Math.floor((tLeft % 60000) / 1000);
            document.getElementById('trainer-booster-timer-display').textContent = `${String(tHours).padStart(2, '0')}:${String(tMins).padStart(2, '0')}:${String(tSecs).padStart(2, '0')}`;
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
    
    // Si l'élément n'existe pas dans le HTML actuel, on arrête tout simplement
    if (!sbPack) return; 

    if (!state.currentUser || state.currentUserData.specialBoostersLeft === undefined) {
        sbPack.classList.add('hidden');
        return;
    }
    if (state.currentUserData.specialBoostersLeft > 0) {
        if(!state.isOpening) sbPack.classList.remove('hidden');
        if(sbCount) sbCount.textContent = `${state.currentUserData.specialBoostersLeft} disponible(s)`;
    } else {
        sbPack.classList.add('hidden');
    }
}

export function initBooster() {
    const boosterElement = document.getElementById('booster-pack');
    const specialBoosterElement = document.getElementById('special-booster-pack');
    const trainerBoosterElement = document.getElementById('trainer-booster-pack');
    const resetButton = document.getElementById('reset-button');
    const autoOpenBtn = document.getElementById('auto-open-btn');
    const cardsContainer = document.getElementById('cards-container');
    const sectionBoosters = document.getElementById('section-boosters');
    

    if (boosterElement) boosterElement.addEventListener('click', () => ouvrirBooster(false));
    if (specialBoosterElement) specialBoosterElement.addEventListener('click', () => ouvrirBooster(true));
    if (trainerBoosterElement) trainerBoosterElement.addEventListener('click', ouvrirBoosterDresseur);

    // --- SÉCURISATION DE RESETBUTTON ---
    if (resetButton) {
        resetButton.addEventListener('click', () => { 
            if (cardsContainer) {
                cardsContainer.innerHTML = ''; 
                cardsContainer.classList.add('hidden');
            }
            resetButton.classList.add('hidden');
            
            const boosterCarousel = document.getElementById('booster-carousel');
            if (boosterCarousel) boosterCarousel.classList.remove('hidden');
            
            updateSpecialBoosterUI(); 
        });
    }

    if (autoOpenBtn) {
        autoOpenBtn.addEventListener('click', () => {
            autoOpenBtn.disabled = true; 
            
            function flipNextAutomatically() {
                const unflippedCard = cardsContainer ? cardsContainer.querySelector('.card:not(.flipped)') : null;
                
                if (unflippedCard) {
                    unflippedCard.click(); 
                    setTimeout(flipNextAutomatically, 200); 
                } else if (state.cartesRetournees < state.currentPulls.length) {
                    setTimeout(flipNextAutomatically, 100);
                }
            }
            
            flipNextAutomatically();
        });
    }

    if (sectionBoosters) {
        sectionBoosters.addEventListener('click', (e) => {
            if (e.target.closest('.btn') || e.target.closest('.booster') || e.target.closest('.card')) return;
            if (cardsContainer && !cardsContainer.classList.contains('hidden')) {
                const unflippedCard = cardsContainer.querySelector('.card:not(.flipped)');
                if (unflippedCard) unflippedCard.click();
            }
        });
    }

    const btnPrev = document.getElementById('btn-prev-booster');
    const btnNext = document.getElementById('btn-next-booster');
    
    function switchBoosterSlide() {
        // Alterne entre 0 (Pokémon) et 1 (Dresseur)
        state.currentBoosterIndex = state.currentBoosterIndex === 0 ? 1 : 0;
        
        const slidePokemon = document.getElementById('slide-pokemon');
        const slideTrainer = document.getElementById('slide-trainer');
        
        if (state.currentBoosterIndex === 0) {
            // Afficher Pokémon, cacher Dresseur
            if (slidePokemon) {
                slidePokemon.style.display = 'flex';
                slidePokemon.classList.remove('hidden');
            }
            if (slideTrainer) {
                slideTrainer.style.display = 'none';
                slideTrainer.classList.add('hidden');
            }
        } else {
            // Cacher Pokémon, afficher Dresseur
            if (slidePokemon) {
                slidePokemon.style.display = 'none';
                slidePokemon.classList.add('hidden');
            }
            if (slideTrainer) {
                slideTrainer.style.display = 'flex';
                slideTrainer.classList.remove('hidden');
            }
        }
    }

    if (btnPrev) btnPrev.addEventListener('click', switchBoosterSlide);
    if (btnNext) btnNext.addEventListener('click', switchBoosterSlide);
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
            let lbl = estDoublon ? (state.currentLang === 'en' ? 'Duplicate' : 'Doublon') : (state.currentLang === 'en' ? 'New!' : 'Nouveau !');
            badge.textContent = lbl;
            
            nouvelleCarte.querySelector('.card-front').appendChild(badge);

            nouvelleCarte.classList.add('flipped'); 
            state.cartesRetournees++; 
            sauvegarderCarte(pokemonData, numeroPokedex, isShiny, isMega, selectedMegaForm);
            
            if (state.currentPullIndex < state.currentPulls.length - 1) {
                state.currentPullIndex++;
                setTimeout(() => {
                    const nextItem = state.currentPulls[state.currentPullIndex];
                    if (nextItem.isBaie) creerCarteBaie(nextItem.data, state.currentPullIndex);
                    else creerCarte(nextItem.data, nextItem.pokedexNumber, state.currentPullIndex);
                }, 150); 
            }

            if (state.cartesRetournees === state.currentPulls.length) {
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
    
    getPokemonDetails(carteTemp).then(details => {
        powElement.textContent = `POW ${details.pow}`;
        const typeContainer = document.getElementById(`type-container-boost-${index}`);
        if(typeContainer) {
            typeContainer.innerHTML = generateTypeBadgesHTML(details.types);
        }
    });
}

function ouvrirBooster(isSpecial = false) {
    if (!state.currentUser) { 
        alert(state.currentLang==='en'?"You must be logged in to open packs and save your progress!":"Vous devez être connecté ou créer un compte pour ouvrir des boosters et sauvegarder votre progression !"); 
        return allerASection('section-auth'); 
    }
    
    if (state.pokemonDataList.length === 0) return alert(state.currentLang==='en'?"Loading data...":"Les données chargent...");

    if (isSpecial) {
        if (state.currentUserData.specialBoostersLeft <= 0) {
            alert(state.currentLang==='en'?"You have no special packs left!":"Vous n'avez pas de boosters spéciaux !");
            return;
        }
    } else {
        if (state.currentUserData.boostersLeft <= 0) {
            alert(state.currentLang==='en'?"You have no packs left! Come back later.":"Vous n'avez plus de boosters ! Revenez plus tard.");
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
    const boosterCarousel = document.getElementById('booster-carousel');

    if (activeBooster) activeBooster.classList.add('booster-animating');

    setTimeout(() => {
        if (activeBooster) activeBooster.classList.remove('booster-animating');
        
        // On cache le carrousel complet au lieu des éléments individuels
        if (boosterCarousel) boosterCarousel.classList.add('hidden');
        
        if (cardsContainer) {
            cardsContainer.innerHTML = ''; 
            cardsContainer.classList.remove('hidden'); 
        }
        state.cartesRetournees = 0; 
        
        let cartesTirees = [];
        const pokemonListAvecIndex = state.pokemonDataList.map((pokemon, index) => { return { donnees: pokemon, vraiNumero: index + 1 }; });
        
        for(let i = 0; i < 5; i++) {
            const rareteCible = tirerRarete();
            const pokemonsPossibles = pokemonListAvecIndex.filter(p => p.donnees.rarity === rareteCible);
            if (pokemonsPossibles.length === 0) { i--; continue; }

            const randomPossibiliteIndex = Math.floor(Math.random() * pokemonsPossibles.length);
            cartesTirees.push({ isBaie: false, data: pokemonsPossibles[randomPossibiliteIndex].donnees, pokedexNumber: pokemonsPossibles[randomPossibiliteIndex].vraiNumero });
        }
        
        cartesTirees.sort((a, b) => CONSTS.poidsRarete[a.data.rarity] - CONSTS.poidsRarete[b.data.rarity]);
        
        if (Math.random() * 100 <= 5) {
            const randomBaie = BAIES_BOOSTERS[Math.floor(Math.random() * BAIES_BOOSTERS.length)];
            cartesTirees.push({ isBaie: true, data: randomBaie });
        }
        
        state.currentPulls = cartesTirees;
        state.currentPullIndex = 0;
        
        if (autoOpenBtn) {
            autoOpenBtn.classList.remove('hidden');
            autoOpenBtn.disabled = false;
        }
        if (resetButton) resetButton.classList.add('hidden');

        const firstItem = state.currentPulls[0];
        if (firstItem.isBaie) creerCarteBaie(firstItem.data, 0);
        else creerCarte(firstItem.data, firstItem.pokedexNumber, 0);

        state.isOpening = false; 
    }, 600); 
}

export function ouvrirBoosterDresseur() {
    if (!state.currentUser) { 
        alert(state.currentLang==='en'?"You must be logged in to open packs!":"Vous devez être connecté pour ouvrir des boosters !"); 
        return allerASection('section-auth'); 
    }

    // 1. On vérifie le STOCK (au lieu du cooldown manuel)
    if (state.currentUserData.trainerBoostersLeft <= 0) {
        alert(state.currentLang==='en'?"You have no Trainer packs left!":"Vous n'avez plus de boosters Dresseur ! Revenez plus tard.");
        return;
    }

    if (state.isOpening) return; 
    state.isOpening = true;
    
    // 2. Décrémenter le stock
    state.currentUserData.trainerBoostersLeft--;
    
    // Si on était au max (ex: 1/1), le fait d'ouvrir lance le chrono de régénération
    if (state.currentUserData.trainerBoostersLeft === state.trainerConfig.maxBoosters - 1) {
        state.currentUserData.lastTrainerBoosterTime = Date.now();
    }

    // Mise à jour de Firebase
    db.collection('users').doc(state.currentUser).update({
        trainerBoostersLeft: state.currentUserData.trainerBoostersLeft,
        lastTrainerBoosterTime: state.currentUserData.lastTrainerBoosterTime
    });

    updateBoosterLogic();
    
    // On masque le carrousel complet pendant l'animation
    document.getElementById('booster-carousel').classList.add('hidden');
    
    const trainerBoosterElement = document.getElementById('trainer-booster-pack');
    const cardsContainer = document.getElementById('cards-container');
    const autoOpenBtn = document.getElementById('auto-open-btn');
    const resetButton = document.getElementById('reset-button');

    trainerBoosterElement.classList.add('booster-animating');

    setTimeout(() => {
        trainerBoosterElement.classList.remove('booster-animating');
        
        cardsContainer.innerHTML = ''; 
        cardsContainer.classList.remove('hidden'); 
        state.cartesRetournees = 0; 
        
        // Tirage de 3 cartes Dresseur
        state.currentPulls = [getRandomTrainer(), getRandomTrainer(), getRandomTrainer()];
        state.currentPulls.sort((a, b) => CONSTS.poidsRarete[a.rarity] - CONSTS.poidsRarete[b.rarity]);
        state.currentPullIndex = 0;
        
        autoOpenBtn.classList.remove('hidden');
        autoOpenBtn.disabled = false;
        resetButton.classList.add('hidden');

        creerCarteDresseur(state.currentPulls[0], 0);
        state.isOpening = false; 
    }, 600);
}
export function creerCarteBaie(baieData, index) {
    let nomAffiche = state.currentLang === 'en' ? baieData.en : baieData.fr;
    let enName = baieData.en.toLowerCase().replace(/\s+/g, '-');
    let imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${enName}.png`;

    const cardHTML = `
        <div class="card">
            <div class="card-inner">
                <div class="card-back"><div class="card-back-design">PokéApp</div></div>
                <div class="card-front" style="background-color: #2ecc71; border-color: #27ae60;">
                    <div class="card-header"><h1 class="pokemon-name" data-en="${baieData.en}" data-fr="${baieData.fr}">${nomAffiche}</h1><div class="icon" style="background: white; color: #27ae60;">B</div></div>
                    <div class="image-wrapper" style="background-color: #fceea7;"><img class="pokemon-image" src="${imageUrl}" alt="Baie" style="object-fit: contain; height: 160px; padding: 15px; image-rendering: pixelated;"></div>
                    <div class="card-subtext" style="justify-content:center;">Objet Consommable</div>
                    <div class="stats-bar" style="justify-content:center;"><span style="font-weight:bold; color: white;">BAIE POKÉMON</span></div>
                </div>
            </div>
        </div>`;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cardHTML;
    const nouvelleCarte = tempDiv.firstElementChild;

    nouvelleCarte.addEventListener('click', () => {
        if (!nouvelleCarte.classList.contains('flipped')) {
            const mesBaies = state.currentUserData.berries || [];
            const estDoublon = mesBaies.some(b => b.id === baieData.id);

            const badge = document.createElement('div');
            badge.className = `badge-status ${estDoublon ? 'badge-doublon' : 'badge-nouveau'}`;
            let lbl = estDoublon ? (state.currentLang === 'en' ? 'Duplicate' : 'Doublon') : (state.currentLang === 'en' ? 'New!' : 'Nouveau !');
            badge.textContent = lbl;
            nouvelleCarte.querySelector('.card-front').appendChild(badge);

            nouvelleCarte.classList.add('flipped'); 
            state.cartesRetournees++; 
            sauvegarderBaie(baieData);
            
            if (state.currentPullIndex < state.currentPulls.length - 1) {
                state.currentPullIndex++;
                setTimeout(() => {
                    const nextItem = state.currentPulls[state.currentPullIndex];
                    if (nextItem.isBaie) creerCarteBaie(nextItem.data, state.currentPullIndex);
                    else creerCarte(nextItem.data, nextItem.pokedexNumber, state.currentPullIndex);
                }, 150); 
            }

            if (state.cartesRetournees === state.currentPulls.length) {
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
}

export function creerCarteDresseur(trainerData, index) {
    let nomAffiche = state.currentLang === 'en' ? trainerData.en : trainerData.fr;
    const bgColor = CONSTS.couleursRarete[trainerData.rarity] || "#3498db";

    const cardHTML = `
        <div class="card">
            <div class="card-inner">
                <div class="card-back"><div class="card-back-design">PokéApp</div></div>
                <!-- Application de la couleur de fond de rareté dynamique -->
                <div class="card-front" style="background-color: ${bgColor}; border-color: rgba(0,0,0,0.2);">
                    <div class="card-header"><h1 class="pokemon-name">${nomAffiche}</h1><div class="icon" style="background: white; color: #333;">${trainerData.rarity}</div></div>
                    <div class="image-wrapper" style="background-color: #ecf0f1;"><img class="pokemon-image" src="${trainerData.img}" alt="Dresseur" style="object-fit: contain; height: 160px; padding: 10px; image-rendering: pixelated;"></div>
                    <div class="card-subtext" style="justify-content:center;">Dresseur ${trainerData.gen}</div>
                    <div class="stats-bar" style="justify-content:center; background-color:rgba(0,0,0,0.3);"><span style="font-weight:bold; color: white;">CARTE DRESSEUR</span></div>
                </div>
            </div>
        </div>`;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cardHTML;
    const nouvelleCarte = tempDiv.firstElementChild;

    nouvelleCarte.addEventListener('click', () => {
        if (!nouvelleCarte.classList.contains('flipped')) {
            
            // 1. On vérifie SI c'est un doublon AVANT de sauvegarder
            if (!state.currentUserData.collection) state.currentUserData.collection = [];
            let existing = state.currentUserData.collection.find(c => c.isTrainer && c.variantId === trainerData.variantId);
            const estDoublon = !!existing;

            // 2. On affiche le badge
            const badge = document.createElement('div');
            badge.className = `badge-status ${estDoublon ? 'badge-doublon' : 'badge-nouveau'}`;
            let lbl = estDoublon ? (state.currentLang === 'en' ? 'Duplicate' : 'Doublon') : (state.currentLang === 'en' ? 'New!' : 'Nouveau !');
            badge.textContent = lbl;
            nouvelleCarte.querySelector('.card-front').appendChild(badge);

            // 3. On retourne la carte et on LA SAUVEGARDE MAINTENANT
            nouvelleCarte.classList.add('flipped'); 
            state.cartesRetournees++; 
            
            // --- MODIFICATION ICI : On utilise la fonction de sauvegarde dédiée au moment du clic ---
            sauvegarderDresseur(trainerData);
            
            if (state.currentPullIndex < state.currentPulls.length - 1) {
                state.currentPullIndex++;
                setTimeout(() => {
                    creerCarteDresseur(state.currentPulls[state.currentPullIndex], state.currentPullIndex);
                }, 150); 
            }

            if (state.cartesRetournees === state.currentPulls.length) {
                setTimeout(() => {
                    const resetButton = document.getElementById('reset-button');
                    const autoOpenBtn = document.getElementById('auto-open-btn');
                    if (resetButton) {
                        resetButton.classList.remove('hidden');
                        resetButton.disabled = false;
                    }
                    if (autoOpenBtn) autoOpenBtn.classList.add('hidden'); 
                }, 200);
            }
        }
    });
    
    document.getElementById('cards-container').appendChild(nouvelleCarte);
    // (J'ai supprimé l'appel à sauvegarderDresseur qui traînait ici par erreur)
}