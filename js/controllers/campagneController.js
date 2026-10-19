import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { getCardImageUrl, getPokemonDetails, getEffectiveness, formatMegaName } from '../utils.js';
import { allerASection } from './navController.js';

const ZONES = [
    { id: "route1", name: "Route 1", minLvl: 2, maxLvl: 5, types: ["normal", "flying"] },
    { id: "foretjade", name: "Forêt de Jade", minLvl: 4, maxLvl: 8, types: ["bug", "grass", "poison"] },
    { id: "montselenite", name: "Mont Sélénite", minLvl: 8, maxLvl: 12, types: ["rock", "ground", "fairy", "poison"] },
    { id: "azuria", name: "Cap d'Azuria", minLvl: 12, maxLvl: 18, types: ["water", "grass", "bug"] },
    { id: "lavanville", name: "Tour Pokémon (Lavanville)", minLvl: 20, maxLvl: 30, types: ["ghost", "poison"] },
    { id: "parcsafari", name: "Parc Safari", minLvl: 25, maxLvl: 35, types: ["normal", "grass", "poison", "psychic", "bug"] },
    { id: "routevictoire", name: "Route Victoire", minLvl: 40, maxLvl: 50, types: ["fighting", "rock", "ground", "dragon"] },
    { id: "caverneazure", name: "Caverne Azurée", minLvl: 60, maxLvl: 75, types: ["psychic", "water", "poison", "electric", "fire", "ice"] }
];

let activeFighter = null;
let currentEnemy = null;
let isAnimating = false;

export function initCampagne() {
    document.getElementById('nav-campagne').addEventListener('click', () => {
        if (!state.currentUser) return alert("Connectez-vous d'abord !");
        openCampagne();
    });

    document.getElementById('btn-change-fighter').addEventListener('click', () => {
        document.getElementById('campagne-select-zone').classList.add('hidden');
        document.getElementById('campagne-select-pokemon').classList.remove('hidden');
    });

    document.getElementById('btn-battle-attack').addEventListener('click', processTurn);
    
    document.getElementById('btn-battle-flee').addEventListener('click', () => {
        logMessage("Vous prenez la fuite... 🏃");
        setTimeout(() => {
            document.getElementById('campagne-battle-arena').classList.add('hidden');
            document.getElementById('campagne-select-zone').classList.remove('hidden');
        }, 1000);
    });
}

function openCampagne() {
    allerASection('section-campagne');
    document.getElementById('campagne-battle-arena').classList.add('hidden');
    
    if (!activeFighter) {
        document.getElementById('campagne-select-zone').classList.add('hidden');
        renderTeamSelection();
    } else {
        document.getElementById('campagne-select-pokemon').classList.add('hidden');
        document.getElementById('campagne-select-zone').classList.remove('hidden');
        updateFighterBadge();
    }
}

function renderTeamSelection() {
    const grid = document.getElementById('campagne-team-grid');
    grid.innerHTML = "";
    document.getElementById('campagne-select-pokemon').classList.remove('hidden');

    const myCollection = (state.currentUserData.collection || []).filter(c => !c.isBaie);
    if (myCollection.length === 0) {
        grid.innerHTML = "<p style='color:#ccc;'>Vous n'avez aucun Pokémon. Ouvrez des boosters !</p>";
        return;
    }

    // Regrouper par Pokémon unique (on prend celui avec le plus haut niveau)
    const uniqueCardsMap = {};
    myCollection.forEach(c => {
        const key = `${c.pokedexNumber}_${c.shiny}_${c.mega}_${c.megaForm}`;
        if (!uniqueCardsMap[key] || (c.level || 1) > (uniqueCardsMap[key].level || 1)) {
            uniqueCardsMap[key] = c;
        }
    });

    Object.values(uniqueCardsMap).forEach(carte => {
        const div = document.createElement('div');
        div.className = `mini-card`;
        div.style.backgroundImage = `url('${getCardImageUrl(carte)}')`;
        const rarete = carte.mega ? "MG" : (carte.data.rarity || "C");
        div.style.backgroundColor = CONSTS.couleursRarete[rarete] || "#333";
        if (carte.shiny || (carte.mega && carte.shiny)) div.innerHTML = '<div class="mini-card-holo"></div>';

        // Petit niveau affiché
        const lvlBadge = document.createElement('div');
        lvlBadge.textContent = `Niv. ${carte.level || 1}`;
        lvlBadge.style.cssText = "position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); color:white; font-size:0.7rem; font-weight:bold;";
        div.appendChild(lvlBadge);

        div.onclick = () => {
            activeFighter = carte;
            document.getElementById('campagne-select-pokemon').classList.add('hidden');
            document.getElementById('campagne-select-zone').classList.remove('hidden');
            updateFighterBadge();
            renderZones();
        };
        grid.appendChild(div);
    });
}

function updateFighterBadge() {
    if(!activeFighter) return;
    const badge = document.getElementById('campagne-active-pokemon');
    let name = state.currentLang === 'en' ? activeFighter.data.en : activeFighter.data.fr;
    if (activeFighter.mega) name = formatMegaName(name, activeFighter.megaForm);
    
    badge.innerHTML = `
        <img src="${getCardImageUrl(activeFighter)}" style="width:40px; height:40px; object-fit:cover; border-radius:50%; background:#222;">
        <span>${name} (Niv. ${activeFighter.level || 1})</span>
    `;
}

function renderZones() {
    const list = document.getElementById('campagne-zones-list');
    list.innerHTML = "";
    
    ZONES.forEach(z => {
        const div = document.createElement('div');
        div.className = "zone-card";
        div.innerHTML = `
            <h4>${z.name}</h4>
            <p>Niveau des Pokémon : <span class="text-accent">${z.minLvl} - ${z.maxLvl}</span></p>
        `;
        div.onclick = () => startBattle(z);
        list.appendChild(div);
    });
}

async function startBattle(zone) {
    document.getElementById('campagne-select-zone').classList.add('hidden');
    document.getElementById('campagne-battle-arena').classList.remove('hidden');
    
    // Set UI to loading
    document.getElementById('enemy-name').textContent = "Recherche...";
    document.getElementById('enemy-sprite').src = "";
    document.getElementById('battle-log').innerHTML = `Vous marchez dans la zone : ${zone.name}...`;

    // 1. Generation du Pokémon sauvage (Génération 1 uniquement : id <= 151)
    const gen1Pokemon = state.pokemonDataList.slice(0, 151);
    
    // Essayer de trouver un pokémon du bon type
    // On doit récupérer les détails pour connaître les types, mais pour aller vite on pioche au hasard et on vérifie si ça matche
    // Ou mieux, on pioche simplement un ID gen 1 au hasard et c'est tout, c'est plus rapide.
    const randIndex = Math.floor(Math.random() * gen1Pokemon.length);
    const wData = gen1Pokemon[randIndex];
    const wId = randIndex + 1;
    
    const wLevel = Math.floor(Math.random() * (zone.maxLvl - zone.minLvl + 1)) + zone.minLvl;
    
    // Obtenir les stats
    const wDetails = await getPokemonDetails({ pokedexNumber: wId, mega: false });
    const pDetails = await getPokemonDetails(activeFighter);

    // Formules de stats simplifiées
    const calcHP = (pow, lvl) => Math.floor(pow / 3) + (lvl * 5) + 10;
    const calcAtk = (pow, lvl) => Math.floor(pow / 5) + (lvl * 2) + 5;

    currentEnemy = {
        name: state.currentLang === 'en' ? wData.en : wData.fr,
        level: wLevel,
        maxHp: calcHP(wDetails.pow, wLevel),
        hp: calcHP(wDetails.pow, wLevel),
        atk: calcAtk(wDetails.pow, wLevel),
        types: wDetails.types,
        sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${wId}.png`
    };

    activeFighter.battleStats = {
        maxHp: calcHP(pDetails.pow, activeFighter.level || 1),
        hp: calcHP(pDetails.pow, activeFighter.level || 1),
        atk: calcAtk(pDetails.pow, activeFighter.level || 1),
        types: pDetails.types
    };

    updateBattleUI();
    logMessage(`Un <b>${currentEnemy.name}</b> sauvage apparaît ! (Niv. ${currentEnemy.level})`);
}

function updateBattleUI() {
    // Enemy
    document.getElementById('enemy-name').textContent = currentEnemy.name;
    document.getElementById('enemy-lvl').textContent = `Niv. ${currentEnemy.level}`;
    document.getElementById('enemy-hp-text').textContent = `${Math.max(0, currentEnemy.hp)} / ${currentEnemy.maxHp}`;
    document.getElementById('enemy-hp-fill').style.width = `${(Math.max(0, currentEnemy.hp) / currentEnemy.maxHp) * 100}%`;
    document.getElementById('enemy-sprite').src = currentEnemy.sprite;
    updateBarColor('enemy-hp-fill', currentEnemy.hp, currentEnemy.maxHp);

    // Player
    let pName = state.currentLang === 'en' ? activeFighter.data.en : activeFighter.data.fr;
    if (activeFighter.mega) pName = formatMegaName(pName, activeFighter.megaForm);
    document.getElementById('player-name').textContent = pName;
    document.getElementById('player-lvl').textContent = `Niv. ${activeFighter.level || 1}`;
    document.getElementById('player-hp-text').textContent = `${Math.max(0, activeFighter.battleStats.hp)} / ${activeFighter.battleStats.maxHp}`;
    document.getElementById('player-hp-fill').style.width = `${(Math.max(0, activeFighter.battleStats.hp) / activeFighter.battleStats.maxHp) * 100}%`;
    
    // Le sprite du joueur de dos est compliqué via l'API, on utilise de face mais inversé par le CSS
    document.getElementById('player-sprite').src = getCardImageUrl(activeFighter);
    updateBarColor('player-hp-fill', activeFighter.battleStats.hp, activeFighter.battleStats.maxHp);
    
    let xpVal = activeFighter.xp || 0;
    let nextLvl = (activeFighter.level || 1) * 100;
    document.getElementById('player-xp-text').textContent = `XP: ${xpVal}/${nextLvl}`;
}

function updateBarColor(id, hp, maxHp) {
    const el = document.getElementById(id);
    const ratio = hp / maxHp;
    if (ratio > 0.5) el.style.backgroundColor = "#2ecc71";
    else if (ratio > 0.2) el.style.backgroundColor = "#f39c12";
    else el.style.backgroundColor = "#e74c3c";
}

function logMessage(msg) {
    const log = document.getElementById('battle-log');
    log.innerHTML += `\n> ${msg}`;
    log.scrollTop = log.scrollHeight;
}

function playAnimation(id, animClass) {
    const el = document.getElementById(id).parentElement;
    el.classList.add(animClass);
    setTimeout(() => el.classList.remove(animClass), 500);
}

async function processTurn() {
    if (isAnimating || !currentEnemy || currentEnemy.hp <= 0 || activeFighter.battleStats.hp <= 0) return;
    isAnimating = true;

    // --- TOUR DU JOUEUR ---
    let pName = state.currentLang === 'en' ? activeFighter.data.en : activeFighter.data.fr;
    logMessage(`<b>${pName}</b> attaque !`);
    playAnimation('player-sprite', 'anim-attack');

    await new Promise(r => setTimeout(r, 600));

    // L'attaque prend le premier type du joueur
    let atkType = activeFighter.battleStats.types[0];
    let mult = getEffectiveness(atkType, currentEnemy.types);
    
    let damage = Math.floor(activeFighter.battleStats.atk * mult * (Math.random() * 0.2 + 0.9));
    damage = Math.max(1, damage); // Au moins 1 de dégat
    
    currentEnemy.hp -= damage;
    playAnimation('enemy-sprite', 'anim-damage');
    
    if (mult > 1) logMessage(`<span class="text-accent">C'est super efficace ! (${damage} dégâts)</span>`);
    else if (mult < 1) logMessage(`<span style="color:#aaa;">Ce n'est pas très efficace... (${damage} dégâts)</span>`);
    else logMessage(`Coup porté ! (${damage} dégâts)`);

    updateBattleUI();

    if (currentEnemy.hp <= 0) {
        await winBattle();
        isAnimating = false;
        return;
    }

    await new Promise(r => setTimeout(r, 1000));

    // --- TOUR DE L'ENNEMI ---
    logMessage(`<b>${currentEnemy.name}</b> sauvage réplique !`);
    playAnimation('enemy-sprite', 'anim-attack');

    await new Promise(r => setTimeout(r, 600));

    let eAtkType = currentEnemy.types[0];
    let eMult = getEffectiveness(eAtkType, activeFighter.battleStats.types);
    
    let eDamage = Math.floor(currentEnemy.atk * eMult * (Math.random() * 0.2 + 0.9));
    eDamage = Math.max(1, eDamage);
    
    activeFighter.battleStats.hp -= eDamage;
    playAnimation('player-sprite', 'anim-damage');
    
    if (eMult > 1) logMessage(`<span class="text-danger">C'est super efficace ! (${eDamage} dégâts reçus)</span>`);
    else if (eMult < 1) logMessage(`<span style="color:#aaa;">Ce n'est pas très efficace... (${eDamage} dégâts reçus)</span>`);
    else logMessage(`Coup reçu. (${eDamage} dégâts reçus)`);

    updateBattleUI();

    if (activeFighter.battleStats.hp <= 0) {
        logMessage(`<span class="text-danger">${pName} est K.O. ! Vous fuyez en urgence...</span>`);
        setTimeout(() => {
            document.getElementById('campagne-battle-arena').classList.add('hidden');
            document.getElementById('campagne-select-zone').classList.remove('hidden');
        }, 2500);
    }
    
    isAnimating = false;
}

async function winBattle() {
    logMessage(`<b style="color:#2ecc71;">${currentEnemy.name} sauvage est vaincu !</b>`);
    
    let xpGained = currentEnemy.level * 15;
    logMessage(`Vous gagnez <span class="text-accent">${xpGained} XP</span> !`);
    
    let currentLvl = activeFighter.level || 1;
    let currentXp = activeFighter.xp || 0;
    let maxLvl = activeFighter.maxLevel || 20;
    
    currentXp += xpGained;
    
    let xpNeeded = currentLvl * 100;
    let leveledUp = false;
    
    while (currentXp >= xpNeeded && currentLvl < maxLvl) {
        currentXp -= xpNeeded;
        currentLvl++;
        leveledUp = true;
        xpNeeded = currentLvl * 100;
    }
    
    if (currentLvl >= maxLvl) {
        currentLvl = maxLvl;
        currentXp = 0; // Bloqué au rang
    }
    
    activeFighter.level = currentLvl;
    activeFighter.xp = currentXp;
    
    if (leveledUp) {
        logMessage(`<span class="text-accent font-bold">🎉 NIVEAU SUPÉRIEUR ! (Niveau ${currentLvl})</span>`);
        if (currentLvl === maxLvl) {
            logMessage(`<span class="text-danger">Rang Max atteint ! Fusionnez des doublons dans la collection pour aller plus haut.</span>`);
        }
    }
    
    updateBattleUI();
    
    // Sauvegarder dans Firebase
    try {
        await db.collection('users').doc(state.currentUser).update({
            collection: state.currentUserData.collection
        });
    } catch(e) { console.error("Erreur de sauvegarde XP", e); }
    
    setTimeout(() => {
        document.getElementById('campagne-battle-arena').classList.add('hidden');
        document.getElementById('campagne-select-zone').classList.remove('hidden');
        updateFighterBadge(); // Mettre à jour l'affichage en haut
    }, 3000);
}