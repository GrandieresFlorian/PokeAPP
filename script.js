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
const autoOpenBtn = document.getElementById('auto-open-btn');
let isOpening = false; // Pour éviter les clics multiples pendant l'animation
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
let currentPulls = []; 
let currentPullIndex = 0;
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
            startFriendsListener();
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
            startFriendsListener();
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
            currentUserData = { password: pass, collection: [], boostersLeft: MAX_BOOSTERS, lastBoosterTime: Date.now(), friends: [], friendRequests: [], trades: [] };
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
        if (friendsListener) { friendsListener(); friendsListener = null; }
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

    // === GESTION DES AUTORISATIONS DE DEBUG ===
    const debugTools = document.getElementById('debug-tools');
    const debugDenied = document.getElementById('debug-denied');
    
    if (debugTools && debugDenied) {
        if (currentUser === 'test') {
            // Afficher les outils si c'est le compte admin
            debugTools.classList.remove('hidden');
            debugDenied.classList.add('hidden');
        } else {
            // Cacher pour tous les autres comptes (ou si non connecté)
            debugTools.classList.add('hidden');
            debugDenied.classList.remove('hidden');
        }
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

// === CORRECTION DU POW (Chargement paresseux) ===
function chargerPowDynamiquement() {
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const span = entry.target;
                const id = span.dataset.id;
                const isMega = span.dataset.mega === "true";
                
                // Vérifie si on a déjà enregistré le POW pour éviter de requêter l'API
                const cacheKey = `powCache_${id}`;
                const cachedPow = localStorage.getItem(cacheKey);
                
                if (cachedPow) {
                    let totalStats = parseInt(cachedPow);
                    if (isMega) totalStats += 100;
                    span.textContent = `POW ${totalStats}`;
                } else {
                    // Sinon, on requête PokéAPI et on sauvegarde le résultat
                    fetch(`https://pokeapi.co/api/v2/pokemon/${id}`)
                        .then(res => res.json())
                        .then(apiData => {
                            let totalStats = 0; 
                            apiData.stats.forEach(s => totalStats += s.base_stat);
                            localStorage.setItem(cacheKey, totalStats); // Mise en cache
                            if (isMega) totalStats += 100;
                            span.textContent = `POW ${totalStats}`;
                        }).catch(() => {
                            span.textContent = "POW ???";
                        });
                }
                obs.unobserve(span); // On arrête d'observer cet élément une fois chargé
            }
        });
    }, { rootMargin: "300px" }); // Charge les POW des cartes juste avant qu'elles n'apparaissent à l'écran

    // On observe uniquement les cartes que l'utilisateur possède ("...")
    document.querySelectorAll('.pokemon-pow').forEach(span => {
        if (span.textContent === "...") observer.observe(span);
    });
}
// === AFFICHAGE DE LA COLLECTION ===

function afficherCollection() {
    if (!currentUser) return collectionContainer.innerHTML = "<p>Veuillez vous connecter.</p>", collectionCount.textContent = `0 / ${MAX_POKEMON}`;
    if (pokemonDataList.length === 0) return collectionContainer.innerHTML = "<p>Chargement des données...</p>";

    const maCollection = currentUserData.collection || [];
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
    let htmlContent = ""; // OPTIMISATION 1 : Stocker le HTML en mémoire plutôt que de modifier le DOM à chaque boucle

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

        if (rarityVal !== 'all' && pokemonRarity !== rarityVal) return; 
        if (ownedOnlyVal && !possedeLaCarte) return; 

        maxAffiche++;
        if (possedeLaCarte) uniquesCount++;

        let nomEn = dataOrigine.en; let nomFr = dataOrigine.fr;
        let nomAffiche = currentLang === 'en' ? nomEn : nomFr;
        if (form) nomAffiche = formatMegaName(nomAffiche, form);

        let numeroFormate = String(i).padStart(3, '0');
        let nomPourUrl = nomEn.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace('♀', '-f').replace('♂', '-m').replace(/['’.]/g, '').replace(/\s+/g, "-");
        
        let imageUrlNormale = form ? `https://img.pokemondb.net/sprites/home/normal/${nomPourUrl}-${form}.png` : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${i}.png`;

        // OPTIMISATION 2 : Ajout de l'attribut loading="lazy" sur les images pour éviter de tout télécharger d'un coup
        // OPTIMISATION 3 : Ajout des attributs data-id et data-mega sur le <span> POW pour notre script de chargement
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

    if (collectionMode === 'mega' || collectionMode === 'mega-shiny') {
        Object.keys(megaIds).map(Number).sort((a,b)=>a-b).forEach(i => megaIds[i].forEach(form => renderCard(i, form)));
    } else {
        for (let i = 1; i <= MAX_POKEMON; i++) renderCard(i);
    }
    
    collectionContainer.innerHTML = htmlContent; // Injection dans le DOM en 1 seule fois
    collectionCount.textContent = `${uniquesCount} / ${maxAffiche}`;

    chargerPowDynamiquement(); // Lance le script qui récupère les POW sans faire ramer la page
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
        if (!nouvelleCarte.classList.contains('flipped')) {
            nouvelleCarte.classList.add('flipped'); 
            cartesRetournees++; 
            sauvegarderCarte(pokemonData, numeroPokedex, isShiny, isMega, selectedMegaForm);
            
            // APPARITION DE LA CARTE SUIVANTE
            if (currentPullIndex < 4) {
                currentPullIndex++;
                setTimeout(() => {
                    const nextCard = currentPulls[currentPullIndex];
                    creerCarte(nextCard.data, nextCard.pokedexNumber, currentPullIndex);
                }, 400); // 400ms d'attente avant que la nouvelle carte apparaisse
            }

            // SI TOUTES LES CARTES SONT RETOURNÉES
            if (cartesRetournees === 5) {
                setTimeout(() => {
                    resetButton.classList.remove('hidden');
                    resetButton.disabled = false;
                    autoOpenBtn.classList.add('hidden'); // On cache le bouton Auto
                }, 600);
            }
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

    if (isOpening) return; 
    isOpening = true;

    currentUserData.boostersLeft--;
    if (currentUserData.boostersLeft === MAX_BOOSTERS - 1) {
        currentUserData.lastBoosterTime = Date.now();
    }
    
    db.collection('users').doc(currentUser).update({
        boostersLeft: currentUserData.boostersLeft,
        lastBoosterTime: currentUserData.lastBoosterTime
    });
    renderBoosterStatus();

    // 1. DÉMARRE L'ANIMATION DU BOOSTER
    boosterElement.classList.add('booster-animating');

    // 2. ATTEND LA FIN DE L'ANIMATION
    setTimeout(() => {
        boosterElement.classList.remove('booster-animating');
        boosterElement.classList.add('hidden'); 
        
        cardsContainer.innerHTML = ''; // Nettoyer l'ancien tirage
        cardsContainer.classList.remove('hidden'); 
        cartesRetournees = 0; 
        
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
        
        // On sauvegarde le tirage pour l'apparition 1 par 1
        currentPulls = cartesTirees;
        currentPullIndex = 0;
        
        // Affiche le bouton Auto et cache le bouton Reset
        autoOpenBtn.classList.remove('hidden');
        autoOpenBtn.disabled = false;
        resetButton.classList.add('hidden');

        // FAIT APPARAÎTRE LA PREMIÈRE CARTE AU CENTRE
        creerCarte(currentPulls[0].data, currentPulls[0].pokedexNumber, 0);

        isOpening = false; 
    }, 1200); 
}
// === ÉVÈNEMENTS D'OUVERTURE ===
boosterElement.addEventListener('click', ouvrirBooster);

// Fait réapparaître le booster plutôt que de l'ouvrir directement
resetButton.addEventListener('click', () => { 
    cardsContainer.innerHTML = ''; 
    cardsContainer.classList.add('hidden');
    resetButton.classList.add('hidden');
    boosterElement.classList.remove('hidden'); // Le booster réapparaît !
});

// === ÉVÈNEMENT DU BOUTON OUVERTURE AUTO ===
autoOpenBtn.addEventListener('click', () => {
    autoOpenBtn.disabled = true; // Empêche le spam clic
    
    function flipNextAutomatically() {
        const unflippedCard = cardsContainer.querySelector('.card:not(.flipped)');
        
        if (unflippedCard) {
            unflippedCard.click(); // Retourne la carte actuelle, ce qui invoque la suivante !
            
            // On attend 800ms (le temps du retournement + le temps que la suivante spawn)
            setTimeout(flipNextAutomatically, 800); 
        } else if (cartesRetournees < 5) {
            // Si la carte suivante n'a pas encore eu le temps d'apparaître, on revérifie
            setTimeout(flipNextAutomatically, 100);
        }
    }
    
    flipNextAutomatically();
});
// === OUTILS DE TEST ===
// === OUTILS DE TEST ===
const btnUnlockAll = document.getElementById('cheat-unlock-all');
const btnClearAll = document.getElementById('cheat-clear-all');
const btnRefillBoosters = document.getElementById('cheat-refill-boosters'); 

btnUnlockAll.addEventListener('click', async () => {
    if (currentUser !== 'test') return alert("Accès refusé : compte administrateur requis.");
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
    if (currentUser !== 'test') return alert("Accès refusé : compte administrateur requis.");
    currentUserData.collection = [];
    await db.collection('users').doc(currentUser).update({ collection: [] });
    alert("Collection vidée en ligne !");
});

btnRefillBoosters.addEventListener('click', async () => {
    if (currentUser !== 'test') return alert("Accès refusé : compte administrateur requis.");
    currentUserData.boostersLeft = MAX_BOOSTERS;
    currentUserData.lastBoosterTime = Date.now();
    await db.collection('users').doc(currentUser).update({
        boostersLeft: currentUserData.boostersLeft,
        lastBoosterTime: currentUserData.lastBoosterTime
    });
    updateBoosterLogic();
    alert("Triche activée : Vous avez récupéré vos 10 boosters !");
});

// === GESTION DES AMIS ===
const friendIdInput = document.getElementById('friend-id-input');
const addFriendBtn = document.getElementById('add-friend-btn');
const friendMessage = document.getElementById('friend-message');
const friendsList = document.getElementById('friends-list');
const friendRequestsList = document.getElementById('friend-requests-list');
let friendsListener = null;

// Lance l'écoute en temps réel du document du joueur
function startFriendsListener() {
    if (!currentUser) return;
    if (friendsListener) friendsListener(); // Coupe l'ancienne écoute
    
    friendsListener = db.collection('users').doc(currentUser).onSnapshot(doc => {
        if (doc.exists) {
            const data = doc.data();
            currentUserData.friends = data.friends || [];
            currentUserData.friendRequests = data.friendRequests || [];
            renderFriendsUI();
        }
    });
}

// Affichage dynamique des amis et demandes
function renderFriendsUI() {
    if (!currentUser) return;
    
    friendsList.innerHTML = "";
    friendRequestsList.innerHTML = "";
    
    const friends = currentUserData.friends || [];
    const requests = currentUserData.friendRequests || [];
    
    // Rendu des Amis
// Rendu des Amis (Modifié pour ajouter le bouton Échanger)
    if (friends.length === 0) {
        friendsList.innerHTML = "<li class='friend-item' style='color: #777;'>Aucun ami pour le moment.</li>";
    } else {
        friends.forEach(friend => {
            friendsList.innerHTML += `
                <li class="friend-item">
                    <span>${friend}</span>
                    <button class="btn-small-action" style="background-color: #9b59b6;" onclick="initierEchange('${friend}')">Échanger 🔄</button>
                </li>`;
        });
    }

    // NOUVEAU : Rendu des Propositions d'Échange
    const tradeRequestsList = document.getElementById('trade-requests-list');
    const trades = currentUserData.trades || [];
    tradeRequestsList.innerHTML = "";

    if (trades.length === 0) {
        tradeRequestsList.innerHTML = "<li class='friend-item' style='color: #777;'>Aucune proposition.</li>";
    } else {
        trades.forEach(trade => {
            const li = document.createElement('li');
            li.className = "friend-item";
            li.style.flexDirection = "column";
            li.style.alignItems = "flex-start";
            li.innerHTML = `
                <div style="width: 100%; display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span><b>${trade.from}</b> propose un échange :</span>
                    <div>
                        <button class="btn-small-action btn-accept" onclick="accepterEchange('${trade.id}', '${trade.from}')">✔ Accepter</button>
                        <button class="btn-small-action btn-reject" onclick="refuserEchange('${trade.id}')">✖ Refuser</button>
                    </div>
                </div>
                <div style="font-size: 0.9rem; color: #aaa;">
                    <b>Il offre :</b> ${trade.offer.length} carte(s)<br>
                    <b>Il demande :</b> ${trade.request.length} carte(s)
                </div>`;
            tradeRequestsList.appendChild(li);
        });
    }
    
    // Rendu des Demandes
    if (requests.length === 0) {
        friendRequestsList.innerHTML = "<li class='friend-item' style='color: #777;'>Aucune demande en attente.</li>";
    } else {
        requests.forEach(req => {
            const li = document.createElement('li');
            li.className = "friend-item";
            li.innerHTML = `<span>${req}</span>
                <div>
                    <button class="btn-small-action btn-accept" onclick="acceptFriend('${req}')">✔</button>
                    <button class="btn-small-action btn-reject" onclick="rejectFriend('${req}')">✖</button>
                </div>`;
            friendRequestsList.appendChild(li);
        });
    }
}

// Envoyer une demande d'ami
addFriendBtn.addEventListener('click', async () => {
    const targetId = friendIdInput.value.trim();
    if (!currentUser) return;
    if (!targetId) return friendMessage.textContent = "Veuillez entrer un pseudo.", friendMessage.style.color = "#e74c3c";
    if (targetId === currentUser) return friendMessage.textContent = "Vous ne pouvez pas vous ajouter vous-même.", friendMessage.style.color = "#e74c3c";
    
    friendMessage.textContent = "Recherche...";
    friendMessage.style.color = "#f1c40f";
    
    try {
        const targetRef = db.collection('users').doc(targetId);
        const targetDoc = await targetRef.get();
        
        if (!targetDoc.exists) return friendMessage.textContent = "Joueur introuvable.", friendMessage.style.color = "#e74c3c";
        
        const targetData = targetDoc.data();
        const targetRequests = targetData.friendRequests || [];
        const targetFriends = targetData.friends || [];
        
        if (targetFriends.includes(currentUser)) return friendMessage.textContent = "Vous êtes déjà amis !", friendMessage.style.color = "#e74c3c";
        if (targetRequests.includes(currentUser)) return friendMessage.textContent = "Demande déjà envoyée.", friendMessage.style.color = "#e74c3c";
        
        targetRequests.push(currentUser);
        await targetRef.update({ friendRequests: targetRequests });
        
        friendMessage.textContent = "Demande envoyée avec succès !";
        friendMessage.style.color = "#2ecc71";
        friendIdInput.value = "";
        setTimeout(() => friendMessage.textContent = "", 3000);
    } catch (error) {
        friendMessage.textContent = "Erreur de connexion.";
        friendMessage.style.color = "#e74c3c";
    }
});

// Accepter l'ami (ajoute l'id chez les deux joueurs)
window.acceptFriend = async function(friendId) {
    if (!currentUser) return;
    try {
        let myRequests = currentUserData.friendRequests.filter(id => id !== friendId);
        let myFriends = currentUserData.friends || [];
        if (!myFriends.includes(friendId)) myFriends.push(friendId);
        
        // Met à jour MON profil
        await db.collection('users').doc(currentUser).update({ friendRequests: myRequests, friends: myFriends });
        
        // Met à jour LE profil de l'autre
        const friendRef = db.collection('users').doc(friendId);
        const friendDoc = await friendRef.get();
        if (friendDoc.exists) {
            let theirFriends = friendDoc.data().friends || [];
            if (!theirFriends.includes(currentUser)) {
                theirFriends.push(currentUser);
                await friendRef.update({ friends: theirFriends });
            }
        }
    } catch(e) { console.error(e); }
};

// Refuser l'ami
window.rejectFriend = async function(friendId) {
    if (!currentUser) return;
    let myRequests = currentUserData.friendRequests.filter(id => id !== friendId);
    await db.collection('users').doc(currentUser).update({ friendRequests: myRequests });
};

// === SYSTÈME D'ÉCHANGE ===
let currentTradeTarget = null;
let targetCollectionCache = [];
let myOfferSelection = [];
let theirOfferSelection = [];

function getMiniCardUrl(carte) {
    let nomEn = carte.data.en;
    let nomPourUrl = nomEn.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace('♀', '-f').replace('♂', '-m').replace(/['’.]/g, '').replace(/\s+/g, "-");
    if (carte.mega) return carte.shiny ? `https://img.pokemondb.net/sprites/home/shiny/${nomPourUrl}-${carte.megaForm}.png` : `https://img.pokemondb.net/sprites/home/normal/${nomPourUrl}-${carte.megaForm}.png`;
    return carte.shiny ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${carte.pokedexNumber}.png` : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${carte.pokedexNumber}.png`;
}

window.initierEchange = async function(friendId) {
    currentTradeTarget = friendId;
    myOfferSelection = [];
    theirOfferSelection = [];
    document.getElementById('trade-target-name').textContent = friendId;
    document.getElementById('trade-message').textContent = "";
    
    // Récupérer la collection de l'ami
    try {
        const doc = await db.collection('users').doc(friendId).get();
        if (!doc.exists) return alert("Joueur introuvable.");
        targetCollectionCache = doc.data().collection || [];
    } catch (e) { return alert("Erreur réseau."); }

    renderTradeGrids();
    allerASection('section-trade');
};

function renderTradeGrids() {
    const myGrid = document.getElementById('my-trade-collection');
    const theirGrid = document.getElementById('their-trade-collection');
    const mySelectionBox = document.getElementById('my-trade-selection');
    const theirSelectionBox = document.getElementById('their-trade-selection');

    const createMiniCard = (carte, isMine) => {
        const div = document.createElement('div');
        const isSelected = isMine ? myOfferSelection.some(c => c.date === carte.date) : theirOfferSelection.some(c => c.date === carte.date);
        
        div.className = `mini-card ${isSelected ? 'selected' : ''}`;
        div.style.backgroundImage = `url('${getMiniCardUrl(carte)}')`;
        div.style.backgroundColor = couleursRarete[carte.mega ? "MG" : carte.data.rarity];
        
        if (carte.shiny || (carte.mega && carte.shiny)) div.innerHTML = '<div class="mini-card-holo"></div>';

        div.onclick = () => {
            if (isMine) {
                if (isSelected) myOfferSelection = myOfferSelection.filter(c => c.date !== carte.date);
                else myOfferSelection.push(carte);
            } else {
                if (isSelected) theirOfferSelection = theirOfferSelection.filter(c => c.date !== carte.date);
                else theirOfferSelection.push(carte);
            }
            renderTradeGrids();
        };
        return div;
    };

    myGrid.innerHTML = ""; theirGrid.innerHTML = "";
    mySelectionBox.innerHTML = ""; theirSelectionBox.innerHTML = "";

    (currentUserData.collection || []).forEach(carte => myGrid.appendChild(createMiniCard(carte, true)));
    targetCollectionCache.forEach(carte => theirGrid.appendChild(createMiniCard(carte, false)));

    myOfferSelection.forEach(carte => {
        let clone = createMiniCard(carte, true); clone.onclick = null; mySelectionBox.appendChild(clone);
    });
    theirOfferSelection.forEach(carte => {
        let clone = createMiniCard(carte, false); clone.onclick = null; theirSelectionBox.appendChild(clone);
    });
}

document.getElementById('cancel-trade-btn').addEventListener('click', () => allerASection('section-amis'));

document.getElementById('send-trade-btn').addEventListener('click', async () => {
    if (myOfferSelection.length === 0 && theirOfferSelection.length === 0) return alert("Sélectionnez au moins une carte.");
    
    const tradeMsg = document.getElementById('trade-message');
    tradeMsg.textContent = "Envoi en cours..."; tradeMsg.style.color = "#f1c40f";
    document.getElementById('send-trade-btn').disabled = true;

    try {
        const targetRef = db.collection('users').doc(currentTradeTarget);
        const doc = await targetRef.get();
        let targetTrades = doc.data().trades || [];
        
        targetTrades.push({
            id: Date.now().toString(),
            from: currentUser,
            offer: myOfferSelection,
            request: theirOfferSelection
        });

        await targetRef.update({ trades: targetTrades });
        tradeMsg.textContent = "Proposition envoyée !"; tradeMsg.style.color = "#2ecc71";
        setTimeout(() => { document.getElementById('send-trade-btn').disabled = false; allerASection('section-amis'); }, 1500);
    } catch (e) {
        tradeMsg.textContent = "Erreur lors de l'envoi."; tradeMsg.style.color = "#e74c3c";
        document.getElementById('send-trade-btn').disabled = false;
    }
});

window.refuserEchange = async function(tradeId) {
    if (!currentUser) return;
    let myTrades = (currentUserData.trades || []).filter(t => t.id !== tradeId);
    await db.collection('users').doc(currentUser).update({ trades: myTrades });
};

window.accepterEchange = async function(tradeId, senderId) {
    if (!currentUser) return;
    const trade = currentUserData.trades.find(t => t.id === tradeId);
    if (!trade) return;

    try {
        const senderRef = db.collection('users').doc(senderId);
        const senderDoc = await senderRef.get();
        if (!senderDoc.exists) return alert("Le joueur n'existe plus.");
        
        let senderData = senderDoc.data();
        let myCollection = [...currentUserData.collection];
        let senderCollection = [...(senderData.collection || [])];

        // 1. Vérification que les cartes existent toujours chez les deux joueurs (basé sur la date unique d'obtention)
        const iHaveCards = trade.request.every(reqCard => myCollection.some(c => c.date === reqCard.date));
        const senderHasCards = trade.offer.every(offCard => senderCollection.some(c => c.date === offCard.date));

        if (!iHaveCards || !senderHasCards) {
            alert("Échange impossible : Une ou plusieurs cartes ne sont plus possédées.");
            return refuserEchange(tradeId); // Annule l'échange obsolète
        }

        // 2. Transfert des cartes
        // Je donne (request de son point de vue)
        trade.request.forEach(reqCard => {
            myCollection = myCollection.filter(c => c.date !== reqCard.date);
            senderCollection.push(reqCard);
        });

        // Il donne (offer de son point de vue)
        trade.offer.forEach(offCard => {
            senderCollection = senderCollection.filter(c => c.date !== offCard.date);
            myCollection.push(offCard);
        });

        // 3. Mise à jour des deux bases de données et suppression de la requête
        let myTrades = currentUserData.trades.filter(t => t.id !== tradeId);
        await db.collection('users').doc(currentUser).update({ collection: myCollection, trades: myTrades });
        await senderRef.update({ collection: senderCollection });
        
        alert("Échange réussi !");
    } catch(e) { alert("Erreur lors de la transaction."); }
};