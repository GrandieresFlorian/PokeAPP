// === 1. CONFIGURATION FIREBASE ===
// ⚠️ REMPLACEZ CE BLOC PAR VOTRE CONFIGURATION FIREBASE ⚠️
const firebaseConfig = {
  apiKey: "AIzaSyC2aHcIN_0Lgk-fSpCY-pHwMs2bL5nRJgM",
  authDomain: "pokeapp-40bae.firebaseapp.com",
  projectId: "pokeapp-40bae",
  storageBucket: "pokeapp-40bae.firebasestorage.app",
  messagingSenderId: "445091453076",
  appId: "1:445091453076:web:d6b18cc032f54116d7fc81",
  measurementId: "G-ML5HQKM389"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// === ÉLÉMENTS DU DOM ===
const boosterElement = document.getElementById('booster-pack');
const cardsContainer = document.getElementById('cards-container');
const resetButton = document.getElementById('reset-button');
const navLinks = document.querySelectorAll('.nav-links li');
const sections = document.querySelectorAll('.view-section');
const langToggle = document.getElementById('lang-toggle'); 

const authNavBtn = document.getElementById('auth-nav-btn');
const userNameDisplay = document.getElementById('user-name-display');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const usernameInput = document.getElementById('username-input');
const passwordInput = document.getElementById('password-input');
const authMessage = document.getElementById('auth-message');
const collectionContainer = document.getElementById('collection-container');
const collectionCount = document.getElementById('collection-count');
const navCollectionBtn = document.getElementById('nav-collection');

const tabNormal = document.getElementById('tab-normal'); 
const tabShiny = document.getElementById('tab-shiny');   
const tabMega = document.getElementById('tab-mega'); 
const tabMegaShiny = document.getElementById('tab-mega-shiny'); 

// Éléments du chrono
const boosterStatus = document.getElementById('booster-status');
const boosterCountDisplay = document.getElementById('booster-count-display');
const boosterTimerDisplay = document.getElementById('booster-timer-display');
const boosterTimerText = document.getElementById('booster-timer-text');

// Éléments des filtres
const filterRarity = document.getElementById('filter-rarity');
const filterOwned = document.getElementById('filter-owned');

const MAX_POKEMON = 1025;
const MAX_BOOSTERS = 10;
const REGEN_TIME_MS = 5 * 60 * 1000;

const megaIds = {
    3: ["mega"], 6: ["mega-x", "mega-y"], 9: ["mega"], 15: ["mega"], 18: ["mega"],
    65: ["mega"], 80: ["mega"], 94: ["mega"], 115: ["mega"], 127: ["mega"],
    130: ["mega"], 142: ["mega"], 150: ["mega-x", "mega-y"], 181: ["mega"],
    208: ["mega"], 212: ["mega"], 214: ["mega"], 229: ["mega"], 248: ["mega"],
    254: ["mega"], 257: ["mega"], 260: ["mega"], 282: ["mega"], 302: ["mega"],
    303: ["mega"], 306: ["mega"], 308: ["mega"], 310: ["mega"], 319: ["mega"],
    323: ["mega"], 334: ["mega"], 354: ["mega"], 359: ["mega"], 362: ["mega"],
    373: ["mega"], 376: ["mega"], 380: ["mega"], 381: ["mega"], 384: ["mega"],
    428: ["mega"], 445: ["mega"], 448: ["mega"], 460: ["mega"], 475: ["mega"],
    531: ["mega"], 719: ["mega"]
};

// === VARIABLES GLOBALES ===
let cartesRetournees = 0;
let currentLang = 'en'; 
let pokemonDataList = []; 
let collectionMode = 'normal'; 
let boosterTimerInterval = null;

let currentUser = localStorage.getItem('pokeAppCurrentUser') || null;
let currentUserData = { collection: [], boostersLeft: MAX_BOOSTERS, lastBoosterTime: Date.now() }; 

const couleursRarete = { "C": "#5a6369", "U": "#5eb84b", "R": "#3498db", "E": "#7d3c98", "L": "#b7950b", "M": "#a93226", "MG": "#111111" };
const poidsRarete = { "C": 1, "U": 2, "R": 3, "E": 4, "L": 5, "M": 6, "MG": 7 };

// === INITIALISATION ===
fetch('data.json')
    .then(response => response.json())
    .then(data => { pokemonDataList = data.pokemon; })
    .catch(error => { console.error("Erreur de chargement", error); });

if (currentUser) {
    db.collection('users').doc(currentUser).get().then(doc => {
        if (doc.exists) {
            currentUserData = doc.data();
            if (currentUserData.boostersLeft === undefined) {
                currentUserData.boostersLeft = MAX_BOOSTERS;
                currentUserData.lastBoosterTime = Date.now();
                db.collection('users').doc(currentUser).update({
                    boostersLeft: currentUserData.boostersLeft,
                    lastBoosterTime: currentUserData.lastBoosterTime
                });
            }
            updateAuthUI();
            updateBoosterLogic();
        } else {
            currentUser = null; localStorage.removeItem('pokeAppCurrentUser'); updateAuthUI();
        }
    }).catch(err => console.error("Erreur Firebase:", err));
} else {
    updateAuthUI();
}

// === GESTION DU TEMPS ET DES BOOSTERS ===
function updateBoosterLogic() {
    if (!currentUser) {
        boosterStatus.classList.add('hidden');
        clearInterval(boosterTimerInterval);
        return;
    }
    
    boosterStatus.classList.remove('hidden');
    const now = Date.now();

    if (currentUserData.boostersLeft < MAX_BOOSTERS) {
        const timePassed = now - currentUserData.lastBoosterTime;
        const boostersGained = Math.floor(timePassed / REGEN_TIME_MS);

        if (boostersGained > 0) {
            currentUserData.boostersLeft = Math.min(MAX_BOOSTERS, currentUserData.boostersLeft + boostersGained);
            if (currentUserData.boostersLeft === MAX_BOOSTERS) {
                currentUserData.lastBoosterTime = now;
            } else {
                currentUserData.lastBoosterTime += boostersGained * REGEN_TIME_MS;
            }
            db.collection('users').doc(currentUser).update({
                boostersLeft: currentUserData.boostersLeft,
                lastBoosterTime: currentUserData.lastBoosterTime
            });
        }
    } else {
        currentUserData.lastBoosterTime = now;
    }

    renderBoosterStatus();
    
    clearInterval(boosterTimerInterval);
    boosterTimerInterval = setInterval(() => {
        if (currentUserData.boostersLeft < MAX_BOOSTERS) {
            const currentNow = Date.now();
            const timePassed = currentNow - currentUserData.lastBoosterTime;
            
            if (timePassed >= REGEN_TIME_MS) {
                currentUserData.boostersLeft++;
                if (currentUserData.boostersLeft === MAX_BOOSTERS) {
                    currentUserData.lastBoosterTime = currentNow;
                } else {
                    currentUserData.lastBoosterTime += REGEN_TIME_MS;
                }
                db.collection('users').doc(currentUser).update({
                    boostersLeft: currentUserData.boostersLeft,
                    lastBoosterTime: currentUserData.lastBoosterTime
                });
            }
            renderBoosterStatus();
        } else {
            renderBoosterStatus();
        }
    }, 1000);
}

function renderBoosterStatus() {
    boosterCountDisplay.textContent = currentUserData.boostersLeft;
    
    if (currentUserData.boostersLeft >= MAX_BOOSTERS) {
        boosterTimerText.style.display = 'none';
    } else {
        boosterTimerText.style.display = 'block';
        const now = Date.now();
        const timeLeft = REGEN_TIME_MS - (now - currentUserData.lastBoosterTime);
        const minutes = Math.floor(timeLeft / 60000);
        const seconds = Math.floor((timeLeft % 60000) / 1000);
        
        boosterTimerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}

// === GESTION DE L'AUTHENTIFICATION ===
loginBtn.addEventListener('click', async () => {
    const user = usernameInput.value.trim(); const pass = passwordInput.value;
    if (!user || !pass) return authMessage.textContent = "Veuillez remplir tous les champs.";
    
    authMessage.textContent = "Connexion...";
    try {
        const doc = await db.collection('users').doc(user).get();
        if (doc.exists && doc.data().password === pass) {
            currentUser = user;
            currentUserData = doc.data();
            localStorage.setItem('pokeAppCurrentUser', currentUser);
            authMessage.textContent = ""; usernameInput.value = ""; passwordInput.value = "";
            updateAuthUI(); 
            updateBoosterLogic();
            allerASection('section-boosters'); 
        } else { 
            authMessage.textContent = "Identifiants incorrects."; 
        }
    } catch (error) { authMessage.textContent = "Erreur de connexion au serveur."; }
});

signupBtn.addEventListener('click', async () => {
    const user = usernameInput.value.trim(); const pass = passwordInput.value;
    if (!user || !pass) return authMessage.textContent = "Veuillez remplir tous les champs.";
    
    authMessage.textContent = "Création du compte...";
    try {
        const docRef = db.collection('users').doc(user);
        const doc = await docRef.get();
        if (doc.exists) {
            authMessage.textContent = "Ce nom d'utilisateur existe déjà.";
        } else {
            currentUserData = { password: pass, collection: [], boostersLeft: MAX_BOOSTERS, lastBoosterTime: Date.now() };
            await docRef.set(currentUserData);
            
            currentUser = user; 
            localStorage.setItem('pokeAppCurrentUser', currentUser);
            authMessage.textContent = ""; usernameInput.value = ""; passwordInput.value = "";
            updateAuthUI(); 
            updateBoosterLogic();
            allerASection('section-boosters');
        }
    } catch (error) { authMessage.textContent = "Erreur lors de la création du compte."; }
});

authNavBtn.addEventListener('click', () => {
    if (currentUser) {
        currentUser = null; currentUserData = { collection: [] };
        localStorage.removeItem('pokeAppCurrentUser');
        updateAuthUI(); 
        updateBoosterLogic();
        allerASection('section-boosters');
    } else { allerASection('section-auth'); }
});

function updateAuthUI() {
    if (currentUser) {
        userNameDisplay.textContent = `Joueur : ${currentUser}`;
        authNavBtn.textContent = "Se déconnecter"; authNavBtn.style.backgroundColor = "#e74c3c"; 
    } else {
        userNameDisplay.textContent = "Non connecté";
        authNavBtn.textContent = "Se connecter"; authNavBtn.style.backgroundColor = "#3498db"; 
        collectionContainer.innerHTML = ""; collectionCount.textContent = `0 / ${MAX_POKEMON}`;
    }
}

// === SAUVEGARDE DES CARTES ===
function sauvegarderCarte(pokemonData, numeroPokedex, isShiny, isMega, megaForm) {
    if (!currentUser) return; 
    currentUserData.collection.push({
        data: pokemonData, pokedexNumber: numeroPokedex, shiny: isShiny, mega: isMega, megaForm: megaForm, date: new Date().getTime()
    });
    db.collection('users').doc(currentUser).update({ collection: currentUserData.collection })
        .catch(err => console.error("Erreur de sauvegarde:", err));
}

function formatMegaName(nom, form) {
    if (form === "mega-x") return `Méga ${nom} X`;
    if (form === "mega-y") return `Méga ${nom} Y`;
    return `Méga ${nom}`;
}

// === GESTION DES 4 ONGLETS DE COLLECTION ===
function setTabActive(activeTab) {
    [tabNormal, tabShiny, tabMega, tabMegaShiny].forEach(tab => tab.classList.remove('active'));
    activeTab.classList.add('active');
    
    // Si on est sur un onglet Méga, le filtre de rareté n'a plus de sens
    if (activeTab === tabMega || activeTab === tabMegaShiny) {
        filterRarity.value = "all";
        filterRarity.disabled = true;
    } else {
        filterRarity.disabled = false;
    }
}

tabNormal.addEventListener('click', () => { collectionMode = 'normal'; setTabActive(tabNormal); afficherCollection(); });
tabShiny.addEventListener('click', () => { collectionMode = 'shiny'; setTabActive(tabShiny); afficherCollection(); });
tabMega.addEventListener('click', () => { collectionMode = 'mega'; setTabActive(tabMega); afficherCollection(); });
tabMegaShiny.addEventListener('click', () => { collectionMode = 'mega-shiny'; setTabActive(tabMegaShiny); afficherCollection(); });

// Écouteurs pour les filtres
filterRarity.addEventListener('change', afficherCollection);
filterOwned.addEventListener('change', afficherCollection);
navCollectionBtn.addEventListener('click', afficherCollection);


// === AFFICHAGE DE LA COLLECTION ===
function afficherCollection() {
    if (!currentUser) return collectionContainer.innerHTML = "<p>Veuillez vous connecter.</p>", collectionCount.textContent = `0 / ${MAX_POKEMON}`;
    if (pokemonDataList.length === 0) return collectionContainer.innerHTML = "<p>Chargement des données...</p>";

    const maCollection = currentUserData.collection || [];
    const cartesPossedeesMap = {}; 
    
    // Valeurs des filtres
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
    collectionContainer.innerHTML = ""; 

    const renderCard = (i, form = null) => {
        const dataOrigine = pokemonDataList[i - 1]; 
        if (!dataOrigine) return;

        let pokemonRarity = (collectionMode === 'mega' || collectionMode === 'mega-shiny') ? "MG" : dataOrigine.rarity;
        
        let possedeLaCarte = false; let quantite = 0; let afficheHolo = false;
        
        if (collectionMode === 'normal') { 
            possedeLaCarte = cartesPossedeesMap[i]?.normal > 0; quantite = cartesPossedeesMap[i]?.normal || 0; 
        } else if (collectionMode === 'shiny') { 
            possedeLaCarte = cartesPossedeesMap[i]?.shiny > 0; quantite = cartesPossedeesMap[i]?.shiny || 0; afficheHolo = true; 
        } else if (collectionMode === 'mega') {
            possedeLaCarte = cartesPossedeesMap[i]?.megas[form]?.normal > 0; quantite = cartesPossedeesMap[i]?.megas[form]?.normal || 0;
        } else if (collectionMode === 'mega-shiny') {
            possedeLaCarte = cartesPossedeesMap[i]?.megas[form]?.shiny > 0; quantite = cartesPossedeesMap[i]?.megas[form]?.shiny || 0; afficheHolo = true;
        }

        // === APPLICATION DES FILTRES ===
        if (rarityVal !== 'all' && pokemonRarity !== rarityVal) return; // Ignore la carte si elle n'a pas la bonne rareté
        if (ownedOnlyVal && !possedeLaCarte) return; // Ignore la carte si l'option "Possédées uniquement" est cochée

        maxAffiche++;
        if (possedeLaCarte) uniquesCount++;

        let nomEn = dataOrigine.en; let nomFr = dataOrigine.fr;
        let nomAffiche = currentLang === 'en' ? nomEn : nomFr;
        if (form) nomAffiche = formatMegaName(nomAffiche, form);

        let numeroFormate = String(i).padStart(3, '0');
        let nomPourUrl = nomEn.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace('♀', '-f').replace('♂', '-m').replace(/['’.]/g, '').replace(/\s+/g, "-");
        
        let imageUrlNormale = form ? `https://img.pokemondb.net/sprites/home/normal/${nomPourUrl}-${form}.png` : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${i}.png`;

        let htmlInner = "";
        if (possedeLaCarte) {
            const bgColor = couleursRarete[pokemonRarity];
            let classFond = "card-front"; let styleFond = "";
            if (form && afficheHolo) classFond += " mega-shiny-bg";
            else if (form) classFond += " mega-bg";
            else if (afficheHolo) classFond += " shiny-bg";
            else styleFond = `style="background-color: ${bgColor}"`;

            let textCount = quantite > 1 ? ` (x${quantite})` : ""; 
            let finalImageUrl = imageUrlNormale;
            if (form && afficheHolo) finalImageUrl = `https://img.pokemondb.net/sprites/home/shiny/${nomPourUrl}-${form}.png`;
            else if (!form && afficheHolo) finalImageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${i}.png`;

            htmlInner = `
                <div class="${classFond}" ${styleFond}>
                    <div class="card-header"><h1 class="pokemon-name" data-en="${form ? formatMegaName(nomEn, form) : nomEn}" data-fr="${form ? formatMegaName(nomFr, form) : nomFr}" data-count="${quantite}">${nomAffiche}${textCount}</h1><div class="icon">${pokemonRarity}</div></div>
                    <div class="image-wrapper"><img class="pokemon-image" src="${finalImageUrl}" alt="Image"><span class="image-id">#${numeroFormate}</span></div>
                    <div class="card-subtext">Pokémon</div>
                    <div class="stats-bar"><span class="pokemon-pow">...</span><span class="pokemon-aura">N° ${numeroFormate}</span></div>
                </div>`;
        } else {
            htmlInner = `
                <div class="card-front locked-card" style="background-color: #1a1a1a;">
                    <div class="card-header"><h1 class="pokemon-name" style="color: #555;">???</h1><div class="icon" style="background-color: #333; color: #555;">?</div></div>
                    <div class="image-wrapper" style="background-color: #222;"><div class="question-mark">?</div><img class="pokemon-image silhouette" src="${imageUrlNormale}" alt="Caché"><span class="image-id" style="color: #555;">#${numeroFormate}</span></div>
                    <div class="card-subtext" style="color: #555;">Inconnu</div>
                    <div class="stats-bar" style="background-color: #111; color: #555;"><span class="pokemon-pow">POW ???</span><span class="pokemon-aura">N° ${numeroFormate}</span></div>
                </div>`;
        }
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `<div class="card flipped" style="cursor: default;"><div class="card-inner">${htmlInner}</div></div>`;
        collectionContainer.appendChild(tempDiv.firstElementChild);
    };

    if (collectionMode === 'mega' || collectionMode === 'mega-shiny') {
        Object.keys(megaIds).map(Number).sort((a,b)=>a-b).forEach(i => megaIds[i].forEach(form => renderCard(i, form)));
    } else {
        for (let i = 1; i <= MAX_POKEMON; i++) renderCard(i);
    }
    
    // Met à jour le compteur dynamique avec le résultat des filtres
    collectionCount.textContent = `${uniquesCount} / ${maxAffiche}`;
}

navLinks.forEach(link => { link.addEventListener('click', () => allerASection(link.getAttribute('data-target'))); });
function allerASection(targetId) {
    navLinks.forEach(l => l.classList.remove('active'));
    const link = Array.from(navLinks).find(l => l.getAttribute('data-target') === targetId);
    if(link) link.classList.add('active');
    sections.forEach(sec => sec.classList.add('hidden')); document.getElementById(targetId).classList.remove('hidden');
}

langToggle.addEventListener('click', () => {
    currentLang = currentLang === 'en' ? 'fr' : 'en'; langToggle.textContent = currentLang === 'en' ? '🇬🇧 EN' : '🇫🇷 FR';
    document.querySelectorAll('.pokemon-name').forEach(el => {
        const nomTraduit = el.getAttribute(`data-${currentLang}`);
        if (nomTraduit) { const count = el.getAttribute('data-count'); el.textContent = count && parseInt(count) > 1 ? `${nomTraduit} (x${count})` : nomTraduit; }
    });
});

function tirerRarete() {
    const chance = Math.random() * 100; 
    if (chance < 60) return "C"; if (chance < 80) return "U"; if (chance < 90) return "R"; 
    if (chance < 97) return "E"; if (chance < 99) return "L"; return "M";                  
}

function creerCarte(pokemonData, numeroPokedex, index) {
    let nomEn = pokemonData.en; let nomFr = pokemonData.fr; let pokemonRarity = pokemonData.rarity;
    
    let isMega = false; let selectedMegaForm = null;
    if (megaIds[numeroPokedex] && Math.floor(Math.random() * 50) === 0) {
        isMega = true; pokemonRarity = "MG";
        const possibles = megaIds[numeroPokedex];
        selectedMegaForm = possibles[Math.floor(Math.random() * possibles.length)];
    }

    const isShiny = Math.floor(Math.random() * 250) === 0;
    let nomAffiche = currentLang === 'en' ? nomEn : nomFr;
    if (isMega) nomAffiche = formatMegaName(nomAffiche, selectedMegaForm);

    let numeroFormate = String(numeroPokedex).padStart(3, '0');
    const bgColor = couleursRarete[pokemonRarity];
    
    let imageUrl = ""; let classFond = "card-front"; let styleFond = "";
    let nomPourUrl = nomEn.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace('♀', '-f').replace('♂', '-m').replace(/['’.]/g, '').replace(/\s+/g, "-");
    
    if (isMega) {
        let megaUrlName = `${nomPourUrl}-${selectedMegaForm}`;
        if (isShiny) {
            imageUrl = `https://img.pokemondb.net/sprites/home/shiny/${megaUrlName}.png`; classFond += " mega-shiny-bg"; 
        } else {
            imageUrl = `https://img.pokemondb.net/sprites/home/normal/${megaUrlName}.png`; classFond += " mega-bg"; 
        }
    } else {
        if (isShiny) {
            imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${numeroPokedex}.png`; classFond += " shiny-bg";
        } else {
            imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${numeroPokedex}.png`; styleFond = `style="background-color: ${bgColor}"`;
        }
    }

    const cardHTML = `
        <div class="card">
            <div class="card-inner">
                <div class="card-back"><div class="card-back-design">PokéApp</div></div>
                <div class="${classFond}" ${styleFond}>
                    <div class="card-header"><h1 class="pokemon-name" data-en="${isMega ? formatMegaName(nomEn, selectedMegaForm) : nomEn}" data-fr="${isMega ? formatMegaName(nomFr, selectedMegaForm) : nomFr}">${nomAffiche}</h1><div class="icon">${pokemonRarity}</div></div>
                    <div class="image-wrapper"><img class="pokemon-image" src="${imageUrl}" alt="Image"><span class="image-id">#${numeroFormate}</span></div>
                    <div class="card-subtext">Pokémon</div>
                    <div class="stats-bar"><span class="pokemon-pow">POW ...</span><span class="pokemon-aura">N° ${numeroFormate}</span></div>
                </div>
            </div>
        </div>`;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cardHTML;
    const nouvelleCarte = tempDiv.firstElementChild;
    const powElement = nouvelleCarte.querySelector('.pokemon-pow');

    nouvelleCarte.addEventListener('click', () => {
        if (index !== cartesRetournees) return; 
        if (!nouvelleCarte.classList.contains('flipped')) {
            nouvelleCarte.classList.add('flipped'); cartesRetournees++; 
            sauvegarderCarte(pokemonData, numeroPokedex, isShiny, isMega, selectedMegaForm);
            if (cartesRetournees === 5) resetButton.disabled = false;
        }
    });

    cardsContainer.appendChild(nouvelleCarte);
    fetch(`https://pokeapi.co/api/v2/pokemon/${numeroPokedex}`)
        .then(response => response.json())
        .then(apiData => {
            let totalStats = 0; apiData.stats.forEach(s => totalStats += s.base_stat);
            if (isMega) totalStats += 100; powElement.textContent = `POW ${totalStats}`;
        }).catch(error => { powElement.textContent = `POW ???`; });
}

function ouvrirBooster() {
    if (!currentUser) return alert("Vous devez être connecté !"), allerASection('section-auth');
    if (pokemonDataList.length === 0) return alert("Les données chargent...");

    if (currentUserData.boostersLeft <= 0) {
        alert("Vous n'avez plus de boosters ! Revenez plus tard.");
        return;
    }

    currentUserData.boostersLeft--;
    if (currentUserData.boostersLeft === MAX_BOOSTERS - 1) {
        currentUserData.lastBoosterTime = Date.now();
    }
    
    db.collection('users').doc(currentUser).update({
        boostersLeft: currentUserData.boostersLeft,
        lastBoosterTime: currentUserData.lastBoosterTime
    });
    renderBoosterStatus();

    boosterElement.classList.add('hidden'); cardsContainer.classList.remove('hidden'); cartesRetournees = 0; 
    let cartesTirees = [];
    
    const pokemonListAvecIndex = pokemonDataList.map((pokemon, index) => { return { donnees: pokemon, vraiNumero: index + 1 }; });
    
    for(let i = 0; i < 5; i++) {
        const rareteCible = tirerRarete();
        const pokemonsPossibles = pokemonListAvecIndex.filter(p => p.donnees.rarity === rareteCible);
        if (pokemonsPossibles.length === 0) { i--; continue; }

        const randomPossibiliteIndex = Math.floor(Math.random() * pokemonsPossibles.length);
        cartesTirees.push({ data: pokemonsPossibles[randomPossibiliteIndex].donnees, pokedexNumber: pokemonsPossibles[randomPossibiliteIndex].vraiNumero });
    }
    
    cartesTirees.sort((a, b) => poidsRarete[a.data.rarity] - poidsRarete[b.data.rarity]);
    cartesTirees.forEach((carte, index) => creerCarte(carte.data, carte.pokedexNumber, index));
    setTimeout(() => { resetButton.classList.remove('hidden'); resetButton.disabled = true; }, 1000);
}

boosterElement.addEventListener('click', ouvrirBooster);
resetButton.addEventListener('click', () => { cardsContainer.innerHTML = ''; ouvrirBooster(); });

// === OUTILS DE TEST ===
const btnUnlockAll = document.getElementById('cheat-unlock-all');
const btnClearAll = document.getElementById('cheat-clear-all');
const btnRefillBoosters = document.getElementById('cheat-refill-boosters'); 

btnUnlockAll.addEventListener('click', async () => {
    if (!currentUser) return alert("Vous devez être connecté !");
    if (pokemonDataList.length === 0) return alert("Les données chargent...");

    currentUserData.collection = [];
    pokemonDataList.forEach((pokemon, index) => {
        const id = index + 1;
        currentUserData.collection.push({ data: pokemon, pokedexNumber: id, shiny: false, mega: false, megaForm: null, date: Date.now() });
        currentUserData.collection.push({ data: pokemon, pokedexNumber: id, shiny: true, mega: false, megaForm: null, date: Date.now() });
        if (megaIds[id]) {
            megaIds[id].forEach(form => {
                currentUserData.collection.push({ data: pokemon, pokedexNumber: id, shiny: false, mega: true, megaForm: form, date: Date.now() });
                currentUserData.collection.push({ data: pokemon, pokedexNumber: id, shiny: true, mega: true, megaForm: form, date: Date.now() });
            });
        }
    });
    
    await db.collection('users').doc(currentUser).update({ collection: currentUserData.collection });
    alert("Triche activée : Collection complète synchronisée en ligne !");
});

btnClearAll.addEventListener('click', async () => {
    if (!currentUser) return;
    currentUserData.collection = [];
    await db.collection('users').doc(currentUser).update({ collection: [] });
    alert("Collection vidée en ligne !");
});

btnRefillBoosters.addEventListener('click', async () => {
    if (!currentUser) return;
    currentUserData.boostersLeft = MAX_BOOSTERS;
    currentUserData.lastBoosterTime = Date.now();
    await db.collection('users').doc(currentUser).update({
        boostersLeft: currentUserData.boostersLeft,
        lastBoosterTime: currentUserData.lastBoosterTime
    });
    updateBoosterLogic();
    alert("Triche activée : Vous avez récupéré vos 10 boosters !");
});