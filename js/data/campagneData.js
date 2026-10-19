import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { getCardImageUrl, getPokemonDetails, getEffectiveness, formatMegaName, getMovesForLevel, getMoveDetails, TYPE_TRANSLATIONS } from '../utils.js';
import { allerASection, applyTranslation } from './navController.js';

const ZONES = [
    { id: "route1", name: "Route 1", minLvl: 2, maxLvl: 5, encounters: [{id: 16, chance: 50}, {id: 19, chance: 50}] },
    { id: "route2", name: "Route 2", minLvl: 3, maxLvl: 6, encounters: [{id: 19, chance: 45}, {id: 16, chance: 45}, {id: 10, chance: 5}, {id: 13, chance: 5}] },
    { id: "foretjade", name: "Forêt de Jade", minLvl: 4, maxLvl: 8, encounters: [{id: 10, chance: 40}, {id: 13, chance: 40}, {id: 11, chance: 10}, {id: 14, chance: 5}, {id: 25, chance: 5}] },
    { id: "route3", name: "Route 3", minLvl: 6, maxLvl: 10, encounters: [{id: 16, chance: 45}, {id: 21, chance: 45}, {id: 39, chance: 10}] },
    { id: "montselenite", name: "Mont Sélénite", minLvl: 8, maxLvl: 12, encounters: [{id: 41, chance: 70}, {id: 74, chance: 20}, {id: 46, chance: 9}, {id: 35, chance: 1}] },
    { id: "route4", name: "Route 4", minLvl: 10, maxLvl: 14, encounters: [{id: 19, chance: 40}, {id: 21, chance: 40}, {id: 23, chance: 20}] },
    { id: "route24", name: "Routes 24 & 25", minLvl: 10, maxLvl: 15, encounters: [{id: 13, chance: 30}, {id: 10, chance: 30}, {id: 63, chance: 20}, {id: 43, chance: 15}, {id: 69, chance: 5}] },
    { id: "route5", name: "Routes 5 & 6", minLvl: 13, maxLvl: 17, encounters: [{id: 16, chance: 40}, {id: 43, chance: 30}, {id: 52, chance: 30}] },
    { id: "cavetaupiqueur", name: "Cave Taupiqueur", minLvl: 15, maxLvl: 22, encounters: [{id: 50, chance: 95}, {id: 51, chance: 5}] },
    { id: "route9", name: "Routes 9 & 10", minLvl: 14, maxLvl: 19, encounters: [{id: 19, chance: 30}, {id: 21, chance: 30}, {id: 23, chance: 20}, {id: 100, chance: 20}] },
    { id: "grottesombre", name: "Grotte Sombre", minLvl: 16, maxLvl: 22, encounters: [{id: 41, chance: 60}, {id: 74, chance: 30}, {id: 66, chance: 9}, {id: 95, chance: 1}] },
    { id: "lavanville", name: "Tour Pokémon", minLvl: 20, maxLvl: 26, encounters: [{id: 92, chance: 85}, {id: 93, chance: 9}, {id: 104, chance: 6}] },
    { id: "route12", name: "Routes 12 à 15", minLvl: 22, maxLvl: 28, encounters: [{id: 43, chance: 30}, {id: 48, chance: 30}, {id: 16, chance: 20}, {id: 132, chance: 20}] },
    { id: "pistecyclable", name: "Piste Cyclable", minLvl: 24, maxLvl: 30, encounters: [{id: 84, chance: 40}, {id: 88, chance: 40}, {id: 20, chance: 20}] },
    { id: "parcsafari", name: "Parc Safari", minLvl: 25, maxLvl: 35, encounters: [{id: 32, chance: 20}, {id: 29, chance: 20}, {id: 102, chance: 20}, {id: 111, chance: 15}, {id: 114, chance: 10}, {id: 123, chance: 5}, {id: 127, chance: 5}, {id: 128, chance: 4}, {id: 113, chance: 1}] },
    { id: "ilesecume", name: "Îles Écume", minLvl: 28, maxLvl: 36, encounters: [{id: 41, chance: 40}, {id: 86, chance: 30}, {id: 90, chance: 20}, {id: 124, chance: 10}] },
    { id: "manoir", name: "Manoir Pokémon", minLvl: 30, maxLvl: 38, encounters: [{id: 88, chance: 30}, {id: 109, chance: 30}, {id: 77, chance: 20}, {id: 37, chance: 10}, {id: 126, chance: 10}] },
    { id: "centrale", name: "Centrale", minLvl: 32, maxLvl: 40, encounters: [{id: 81, chance: 40}, {id: 100, chance: 40}, {id: 25, chance: 10}, {id: 26, chance: 5}, {id: 125, chance: 5}] },
    { id: "route21", name: "Chenal 21 (Surf)", minLvl: 25, maxLvl: 35, encounters: [{id: 72, chance: 90}, {id: 73, chance: 10}] },
    { id: "routevictoire", name: "Route Victoire", minLvl: 40, maxLvl: 50, encounters: [{id: 74, chance: 40}, {id: 41, chance: 40}, {id: 66, chance: 15}, {id: 95, chance: 5}] },
    { id: "caverneazure", name: "Caverne Azurée", minLvl: 55, maxLvl: 65, encounters: [{id: 42, chance: 25}, {id: 132, chance: 25}, {id: 105, chance: 15}, {id: 64, chance: 15}, {id: 47, chance: 10}, {id: 108, chance: 5}, {id: 113, chance: 5}] }
];

// LISTES DES MÉCANIQUES SPÉCIALES
const USELESS_MOVES = ["splash"];
const PRIORITY_MOVES = ["quick-attack", "mach-punch", "extreme-speed", "aqua-jet", "bullet-punch", "ice-shard", "sucker-punch", "fake-out", "shadow-sneak", "vacuum-wave"];
const HEAL_MOVES = ["recover", "roost", "soft-boiled", "synthesis", "morning-sun", "moonlight", "heal-order", "milk-drink", "slack-off"];
const DRAIN_MOVES = ["absorb", "mega-drain", "giga-drain", "leech-life", "drain-punch", "horn-leech", "dream-eater"];
const RECOIL_MOVES = ["take-down", "double-edge", "submission", "wood-hammer", "flare-blitz", "brave-bird", "wild-charge"];

// NOUVEAU : LISTES DES ATTAQUES À EFFETS
const MULTI_HIT_2_5 = ["fury-attack", "fury-swipes", "double-slap", "bullet-seed", "icicle-spear", "rock-blast", "pin-missile", "bone-rush", "arm-thrust", "tail-slap"];
const MULTI_HIT_2 = ["double-kick", "twin-needle", "bonemerang", "gear-grind", "dual-chop"];
const FLINCH_MOVES = ["bite", "headbutt", "air-slash", "iron-head", "zen-headbutt", "waterfall", "dark-pulse", "astonish", "fake-out"];

// NOUVEAU : EFFETS SECONDAIRES DES ATTAQUES (Dégâts ET changement de stat)
const SECONDARY_EFFECTS = {
    "close-combat": { target: "self", effects: [{stat: "def", stage: -1}, {stat: "spdef", stage: -1}], chance: 1 },
    "superpower": { target: "self", effects: [{stat: "atk", stage: -1}, {stat: "def", stage: -1}], chance: 1 },
    "overheat": { target: "self", effects: [{stat: "spatk", stage: -2}], chance: 1 },
    "leaf-storm": { target: "self", effects: [{stat: "spatk", stage: -2}], chance: 1 },
    "draco-meteor": { target: "self", effects: [{stat: "spatk", stage: -2}], chance: 1 },
    "power-up-punch": { target: "self", effects: [{stat: "atk", stage: 1}], chance: 1 },
    "flame-charge": { target: "self", effects: [{stat: "speed", stage: 1}], chance: 1 },
    "rock-tomb": { target: "enemy", effects: [{stat: "speed", stage: -1}], chance: 1 },
    "icy-wind": { target: "enemy", effects: [{stat: "speed", stage: -1}], chance: 1 },
    "crunch": { target: "enemy", effects: [{stat: "def", stage: -1}], chance: 0.2 },
    "shadow-ball": { target: "enemy", effects: [{stat: "spdef", stage: -1}], chance: 0.2 },
    "psychic": { target: "enemy", effects: [{stat: "spdef", stage: -1}], chance: 0.1 },
    "moonblast": { target: "enemy", effects: [{stat: "spatk", stage: -1}], chance: 0.3 }
};

const STATUS_MOVES = {
    "growl": { effects: [{stat: "atk", stage: -1}], target: "enemy", fr: "l'Attaque", en: "Attack" },
    "tail-whip": { effects: [{stat: "def", stage: -1}], target: "enemy", fr: "la Défense", en: "Defense" },
    "leer": { effects: [{stat: "def", stage: -1}], target: "enemy", fr: "la Défense", en: "Defense" },
    "string-shot": { effects: [{stat: "speed", stage: -1}], target: "enemy", fr: "la Vitesse", en: "Speed" },
    "sand-attack": { effects: [{stat: "speed", stage: -1}], target: "enemy", fr: "la Précision", en: "Accuracy" },
    "screech": { effects: [{stat: "def", stage: -2}], target: "enemy", fr: "la Défense", en: "Defense" },
    "charm": { effects: [{stat: "atk", stage: -2}], target: "enemy", fr: "l'Attaque", en: "Attack" },
    "scary-face": { effects: [{stat: "speed", stage: -2}], target: "enemy", fr: "la Vitesse", en: "Speed" },
    
    "swords-dance": { effects: [{stat: "atk", stage: 2}], target: "self", fr: "l'Attaque", en: "Attack" },
    "harden": { effects: [{stat: "def", stage: 1}], target: "self", fr: "la Défense", en: "Defense" },
    "withdraw": { effects: [{stat: "def", stage: 1}], target: "self", fr: "la Défense", en: "Defense" },
    "defense-curl": { effects: [{stat: "def", stage: 1}], target: "self", fr: "la Défense", en: "Defense" },
    "amnesia": { effects: [{stat: "spdef", stage: 2}], target: "self", fr: "la Déf. Spé", en: "Sp. Def" },
    "agility": { effects: [{stat: "speed", stage: 2}], target: "self", fr: "la Vitesse", en: "Speed" },
    "iron-defense": { effects: [{stat: "def", stage: 2}], target: "self", fr: "la Défense", en: "Defense" },
    "acid-armor": { effects: [{stat: "def", stage: 2}], target: "self", fr: "la Défense", en: "Defense" },
    "barrier": { effects: [{stat: "def", stage: 2}], target: "self", fr: "la Défense", en: "Defense" },
    "howl": { effects: [{stat: "atk", stage: 1}], target: "self", fr: "l'Attaque", en: "Attack" },
    "bulk-up": { effects: [{stat: "atk", stage: 1}, {stat: "def", stage: 1}], target: "self", fr: "l'Att. et la Déf.", en: "Attack and Defense" },
    "calm-mind": { effects: [{stat: "spatk", stage: 1}, {stat: "spdef", stage: 1}], target: "self", fr: "l'Att. Spé et Déf. Spé", en: "Sp. Atk and Sp. Def" },
    "dragon-dance": { effects: [{stat: "atk", stage: 1}, {stat: "speed", stage: 1}], target: "self", fr: "l'Att. et la Vitesse", en: "Attack and Speed" },
    "nasty-plot": { effects: [{stat: "spatk", stage: 2}], target: "self", fr: "l'Att. Spé", en: "Sp. Atk" },
    "tail-glow": { effects: [{stat: "spatk", stage: 3}], target: "self", fr: "l'Att. Spé", en: "Sp. Atk" },
};

const STAT_NAMES = {
    fr: { atk: "Atk", def: "Déf", spatk: "AtkS", spdef: "DéfS", speed: "Vit" },
    en: { atk: "Atk", def: "Def", spatk: "SpA", spdef: "SpD", speed: "Spe" }
};

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

    document.getElementById('campagne-sort')?.addEventListener('change', renderTeamSelection);
    
    document.getElementById('btn-battle-flee').addEventListener('click', () => {
        if(isAnimating) return;
        logMessage(state.currentLang === 'en' ? "You fled... 🏃" : "Vous prenez la fuite... 🏃");
        toggleMoves(true);
        setTimeout(() => {
            document.getElementById('campagne-battle-arena').classList.add('hidden');
            document.getElementById('campagne-select-zone').classList.remove('hidden');
            renderZones();
        }, 1500);
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
        renderZones();
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

    const uniqueCardsMap = {};
    myCollection.forEach(c => {
        const key = `${c.pokedexNumber}_${c.shiny}_${c.mega}_${c.megaForm}`;
        if (!uniqueCardsMap[key] || (c.level || 1) > (uniqueCardsMap[key].level || 1)) {
            uniqueCardsMap[key] = c;
        }
    });

    let uniqueCardsArray = Object.values(uniqueCardsMap);
    const sortDropdown = document.getElementById('campagne-sort');
    const sortMode = sortDropdown ? sortDropdown.value : 'pokedex';

    uniqueCardsArray.sort((a, b) => {
        if (sortMode === 'level') return ((b.level || 1) - (a.level || 1)) || (a.pokedexNumber - b.pokedexNumber);
        else if (sortMode === 'rarity') {
            const rarityA = a.mega ? "MG" : (a.data.rarity || "C");
            const rarityB = b.mega ? "MG" : (b.data.rarity || "C");
            return (CONSTS.poidsRarete[rarityB] || 0) - (CONSTS.poidsRarete[rarityA] || 0) || (a.pokedexNumber - b.pokedexNumber);
        } else if (sortMode === 'alpha') {
            const nameA = state.currentLang === 'en' ? a.data.en : a.data.fr;
            const nameB = state.currentLang === 'en' ? b.data.en : b.data.fr;
            return nameA.localeCompare(nameB) || (a.pokedexNumber - b.pokedexNumber);
        } else return a.pokedexNumber - b.pokedexNumber;
    });

    uniqueCardsArray.forEach(carte => {
        const div = document.createElement('div');
        div.className = `mini-card`;
        div.style.backgroundImage = `url('${getCardImageUrl(carte)}')`;
        const rarete = carte.mega ? "MG" : (carte.data.rarity || "C");
        div.style.backgroundColor = CONSTS.couleursRarete[rarete] || "#333";
        if (carte.shiny || (carte.mega && carte.shiny)) div.innerHTML = '<div class="mini-card-holo"></div>';

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
    let nameEn = activeFighter.data.en;
    let nameFr = activeFighter.data.fr;
    if (activeFighter.mega) {
        nameEn = formatMegaName(nameEn, activeFighter.megaForm);
        nameFr = formatMegaName(nameFr, activeFighter.megaForm);
    }
    let currentName = state.currentLang === 'en' ? nameEn : nameFr;
    let lvlStr = activeFighter.level || 1;
    
    badge.innerHTML = `
        <img src="${getCardImageUrl(activeFighter)}" style="width:40px; height:40px; object-fit:cover; border-radius:50%; background:#222;">
        <span data-en="${nameEn} (Niv. ${lvlStr})" data-fr="${nameFr} (Niv. ${lvlStr})">${currentName} (Niv. ${lvlStr})</span>
    `;
}

function renderZones() {
    const list = document.getElementById('campagne-zones-list');
    list.innerHTML = "";
    
    const seenArray = state.currentUserData.seen || [];
    const collectionIds = (state.currentUserData.collection || []).map(c => c.pokedexNumber);
    
    ZONES.forEach(z => {
        const div = document.createElement('div');
        div.className = "zone-card";
        
        let tooltipHtml = `<div class="zone-tooltip">
            <div class="zone-tooltip-title" data-en="Wild Pokémon" data-fr="Pokémon Sauvages">Pokémon Sauvages</div>
            <div class="zone-tooltip-grid">`;
        
        const totalChance = z.encounters.reduce((sum, enc) => sum + enc.chance, 0);

        z.encounters.forEach(enc => {
            const proba = Math.round((enc.chance / totalChance) * 100);
            const isKnown = seenArray.includes(enc.id) || collectionIds.includes(enc.id);
            
            if (isKnown) {
                const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${enc.id}.png`;
                tooltipHtml += `
                    <div class="tooltip-pkmn">
                        <img src="${spriteUrl}" alt="pkmn">
                        <span>${proba}%</span>
                    </div>`;
            } else {
                tooltipHtml += `
                    <div class="tooltip-pkmn unknown">
                        <div class="unknown-sprite">?</div>
                        <span>? %</span>
                    </div>`;
            }
        });

        tooltipHtml += `</div></div>`;

        div.innerHTML = `
            <h4>${z.name}</h4>
            <p><span class="translatable" data-fr="Niveau des Pokémon :" data-en="Pokémon Levels :">Niveau des Pokémon :</span> <span class="text-accent">${z.minLvl} - ${z.maxLvl}</span></p>
            ${tooltipHtml}
        `;
        div.onclick = () => startBattle(z);
        list.appendChild(div);
    });
    applyTranslation();
}

function calcStats(baseStats, level, evs = { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 }) {
    return {
        maxHp: Math.floor(((2 * baseStats.hp + Math.floor(evs.hp / 4)) * level) / 100) + level + 10,
        hp: Math.floor(((2 * baseStats.hp + Math.floor(evs.hp / 4)) * level) / 100) + level + 10,
        atk: Math.floor(((2 * baseStats.atk + Math.floor(evs.atk / 4)) * level) / 100) + 5,
        def: Math.floor(((2 * baseStats.def + Math.floor(evs.def / 4)) * level) / 100) + 5,
        spatk: Math.floor(((2 * baseStats.spatk + Math.floor(evs.spatk / 4)) * level) / 100) + 5,
        spdef: Math.floor(((2 * baseStats.spdef + Math.floor(evs.spdef / 4)) * level) / 100) + 5,
        speed: Math.floor(((2 * baseStats.speed + Math.floor(evs.speed / 4)) * level) / 100) + 5,
    };
}

function getEffectiveStat(entity, statName) {
    let base = entity.battleStats[statName];
    let stage = entity.modifiers[statName];
    let multiplier = Math.max(2, 2 + stage) / Math.max(2, 2 - stage);
    return Math.floor(base * multiplier);
}

async function startBattle(zone) {
    document.getElementById('campagne-select-zone').classList.add('hidden');
    document.getElementById('campagne-battle-arena').classList.remove('hidden');
    
    document.getElementById('enemy-name').textContent = "Recherche...";
    document.getElementById('enemy-sprite').src = "";
    let msgStart = state.currentLang === 'en' ? `You walk into ${zone.name}...` : `Vous marchez dans la zone : ${zone.name}...`;
    document.getElementById('battle-log').innerHTML = msgStart;
    
    document.getElementById('moves-container').innerHTML = `<p style="color:#aaa; text-align:center; grid-column: span 2; margin-top:20px;">Chargement des capacités...</p>`;
    document.getElementById('btn-battle-flee').disabled = true;

    const possibleEncounters = zone.encounters;
    const totalChance = possibleEncounters.reduce((sum, enc) => sum + enc.chance, 0);
    let randomVal = Math.random() * totalChance;
    
    let randomPokedexNumber = possibleEncounters[0].id;
    for (let enc of possibleEncounters) {
        if (randomVal < enc.chance) {
            randomPokedexNumber = enc.id;
            break;
        }
        randomVal -= enc.chance;
    }

    const wData = state.pokemonDataList[randomPokedexNumber - 1];
    const wId = randomPokedexNumber;

    if (!state.currentUserData.seen) state.currentUserData.seen = [];
    if (!state.currentUserData.seen.includes(wId)) {
        state.currentUserData.seen.push(wId);
        db.collection('users').doc(state.currentUser).update({ seen: state.currentUserData.seen }).catch(e => console.error(e));
    }
    
    const wLevel = Math.floor(Math.random() * (zone.maxLvl - zone.minLvl + 1)) + zone.minLvl;
    
    const wDetails = await getPokemonDetails({ pokedexNumber: wId, mega: false });
    const pDetails = await getPokemonDetails(activeFighter);

    currentEnemy = {
        nameEn: wData.en,
        nameFr: wData.fr,
        level: wLevel,
        baseStats: wDetails.baseStats, 
        battleStats: calcStats(wDetails.baseStats, wLevel),
        modifiers: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 },
        sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${wId}.png`
    };
    currentEnemy.battleStats.types = wDetails.types;

    if (!activeFighter.evs) activeFighter.evs = { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };
    
    activeFighter.battleStats = calcStats(pDetails.baseStats, activeFighter.level || 1, activeFighter.evs);
    activeFighter.battleStats.types = pDetails.types;
    activeFighter.modifiers = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };

    currentEnemy.moves = await getMovesForLevel(wId, wLevel);
    
    if (!activeFighter.moves || activeFighter.moves.length === 0) {
        activeFighter.moves = await getMovesForLevel(activeFighter.pokedexNumber, activeFighter.level || 1);
        db.collection('users').doc(state.currentUser).update({ collection: state.currentUserData.collection });
    }
    
    updateBattleUI();
    renderMovesUI();
    toggleMoves(false);

    let eName = state.currentLang === 'en' ? currentEnemy.nameEn : currentEnemy.nameFr;
    let msgApp = state.currentLang === 'en' ? `A wild <b>${eName}</b> appears! (Lvl ${currentEnemy.level})` : `Un <b>${eName}</b> sauvage apparaît ! (Niv. ${currentEnemy.level})`;
    logMessage(msgApp);
}

function renderMovesUI() {
    const container = document.getElementById('moves-container');
    container.innerHTML = "";
    
    activeFighter.moves.forEach(move => {
        const btn = document.createElement('button');
        btn.className = `move-btn type-${move.type}`;
        const moveName = state.currentLang === 'en' ? move.nameEn : move.nameFr;
        
        let displayPower = (move.damageClass === "status" || USELESS_MOVES.includes(move.nameEn)) ? "-" : move.power;
        btn.innerHTML = `<span class="move-name" data-en="${move.nameEn}" data-fr="${move.nameFr}">${moveName}</span><span style="font-size:0.7rem; opacity:0.8; font-weight:normal;">POW ${displayPower}</span>`;
        btn.onclick = () => processTurn(move);
        container.appendChild(btn);
    });
}

function toggleMoves(disabled) {
    const btns = document.querySelectorAll('.move-btn');
    btns.forEach(b => b.disabled = disabled);
    document.getElementById('btn-battle-flee').disabled = disabled;
}

// NOUVEAU : Création des badges d'effets visuels (+1 / -1)
function renderModifiersUI(entity, containerId) {
    let container = document.getElementById(containerId);
    if (!container) {
        const parent = document.getElementById(containerId === 'player-modifiers' ? 'player-hp-text' : 'enemy-hp-text').parentElement.parentElement;
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'stat-modifiers-container';
        parent.appendChild(container);
    }
    container.innerHTML = "";
    
    const langDict = state.currentLang === 'en' ? STAT_NAMES.en : STAT_NAMES.fr;
    for (let stat in entity.modifiers) {
        let stage = entity.modifiers[stat];
        if (stage !== 0) {
            let badge = document.createElement('span');
            badge.className = `mod-badge ${stage > 0 ? 'mod-up' : 'mod-down'}`;
            badge.textContent = `${langDict[stat]} ${stage > 0 ? '+' : ''}${stage}`;
            container.appendChild(badge);
        }
    }
}

function updateBattleUI() {
    const enemyNameEl = document.getElementById('enemy-name');
    enemyNameEl.setAttribute('data-en', currentEnemy.nameEn);
    enemyNameEl.setAttribute('data-fr', currentEnemy.nameFr);
    enemyNameEl.textContent = state.currentLang === 'en' ? currentEnemy.nameEn : currentEnemy.nameFr;
    
    document.getElementById('enemy-lvl').textContent = `Niv. ${currentEnemy.level}`;
    document.getElementById('enemy-hp-text').textContent = `${Math.max(0, currentEnemy.battleStats.hp)} / ${currentEnemy.battleStats.maxHp}`;
    document.getElementById('enemy-hp-fill').style.width = `${(Math.max(0, currentEnemy.battleStats.hp) / currentEnemy.battleStats.maxHp) * 100}%`;
    document.getElementById('enemy-sprite').src = currentEnemy.sprite;
    updateBarColor('enemy-hp-fill', currentEnemy.battleStats.hp, currentEnemy.battleStats.maxHp);
    renderModifiersUI(currentEnemy, 'enemy-modifiers');

    const playerNameEl = document.getElementById('player-name');
    let pNameEn = activeFighter.data.en;
    let pNameFr = activeFighter.data.fr;
    if (activeFighter.mega) {
        pNameEn = formatMegaName(pNameEn, activeFighter.megaForm);
        pNameFr = formatMegaName(pNameFr, activeFighter.megaForm);
    }
    playerNameEl.setAttribute('data-en', pNameEn);
    playerNameEl.setAttribute('data-fr', pNameFr);
    playerNameEl.textContent = state.currentLang === 'en' ? pNameEn : pNameFr;
    
    document.getElementById('player-lvl').textContent = `Niv. ${activeFighter.level || 1}`;
    document.getElementById('player-hp-text').textContent = `${Math.max(0, activeFighter.battleStats.hp)} / ${activeFighter.battleStats.maxHp}`;
    document.getElementById('player-hp-fill').style.width = `${(Math.max(0, activeFighter.battleStats.hp) / activeFighter.battleStats.maxHp) * 100}%`;
    document.getElementById('player-sprite').src = getCardImageUrl(activeFighter);
    updateBarColor('player-hp-fill', activeFighter.battleStats.hp, activeFighter.battleStats.maxHp);
    renderModifiersUI(activeFighter, 'player-modifiers');
    
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

// Fonction centrale d'attaque retournant un objet contenant un éventuel Flinch (Peur)
async function executeMove(attacker, defender, move, isPlayer) {
    if(attacker.battleStats.hp <= 0 || defender.battleStats.hp <= 0) return { flinched: false };

    let aName = isPlayer ? (state.currentLang === 'en' ? attacker.data.en : attacker.data.fr) : (state.currentLang === 'en' ? attacker.nameEn : attacker.nameFr);
    if (isPlayer && attacker.mega) aName = formatMegaName(aName, attacker.megaForm);
    let defName = isPlayer ? (state.currentLang === 'en' ? defender.nameEn : defender.nameFr) : (state.currentLang === 'en' ? defender.data.en : defender.data.fr);
    
    let mName = state.currentLang === 'en' ? move.nameEn : move.nameFr;
    let colorClass = isPlayer ? "var(--accent)" : "var(--danger)";
    
    logMessage(`<b>${aName}</b> ${state.currentLang === 'en'?'uses':'utilise'} <b style="color:${colorClass};">${mName}</b> !`);
    
    if (USELESS_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        logMessage(state.currentLang === 'en' ? `But nothing happened...` : `Mais il ne se passe rien...`);
        await new Promise(r => setTimeout(r, 800));
        return { flinched: false };
    }

    if (HEAL_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        let healAmount = Math.floor(attacker.battleStats.maxHp / 2);
        attacker.battleStats.hp = Math.min(attacker.battleStats.maxHp, attacker.battleStats.hp + healAmount);
        logMessage(`<span style="color:#2ecc71">${state.currentLang === 'en' ? `${aName} recovered HP!` : `${aName} regagne des PV !`}</span>`);
        updateBattleUI();
        await new Promise(r => setTimeout(r, 800));
        return { flinched: false };
    }

    if (move.damageClass === "status") {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        const statusData = STATUS_MOVES[move.nameEn];
        if (statusData) {
            let targetEntity = statusData.target === "enemy" ? defender : attacker;
            let targetName = statusData.target === "enemy" ? defName : aName;
            
            for (let effect of statusData.effects) {
                targetEntity.modifiers[effect.stat] = Math.max(-6, Math.min(6, targetEntity.modifiers[effect.stat] + effect.stage));
                let statName = state.currentLang === 'en' ? statusData.en : statusData.fr;
                if (effect.stage > 0) logMessage(`<span style="color:#3498db">${state.currentLang === 'en' ? `${targetName}'s${statName} rose!` : `${statName} de${targetName} augmente !`}</span>`);
                else logMessage(`<span style="color:#e74c3c">${state.currentLang === 'en' ? `${targetName}'s${statName} fell!` : `${statName} de${targetName} diminue !`}</span>`);
            }
        } else {
            logMessage(state.currentLang === 'en' ? `It has a mysterious effect...` : `Cela produit un effet mystérieux...`);
        }
        updateBattleUI();
        await new Promise(r => setTimeout(r, 800));
        return { flinched: false }; 
    }

    // --- CALCUL DES COUPS MULTIPLES ---
    let hitCount = 1;
    if (MULTI_HIT_2_5.includes(move.nameEn)) {
        const rng = Math.random();
        if (rng < 0.35) hitCount = 2; else if (rng < 0.7) hitCount = 3; else if (rng < 0.85) hitCount = 4; else hitCount = 5;
    } else if (MULTI_HIT_2.includes(move.nameEn)) { hitCount = 2; }

    let totalDamage = 0;
    for (let i = 0; i < hitCount; i++) {
        if (defender.battleStats.hp <= 0) break;

        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 400)); // Animation plus rapide pour les coups multiples

        let isCrit = Math.random() < 0.0625; 
        let level = attacker.level || 1;
        
        let A = move.damageClass === 'special' ? getEffectiveStat(attacker, 'spatk') : getEffectiveStat(attacker, 'atk');
        let D = move.damageClass === 'special' ? getEffectiveStat(defender, 'spdef') : getEffectiveStat(defender, 'def');
        
        let baseDmg = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * move.power * A / D) / 50) + 2;
        let stab = attacker.battleStats.types.includes(move.type) ? 1.5 : 1;
        let mult = getEffectiveness(move.type, defender.battleStats.types);
        let random = (Math.random() * (1 - 0.85) + 0.85);
        let critMult = isCrit ? 1.5 : 1;

        let damage = Math.floor(baseDmg * stab * mult * random * critMult);
        if (mult === 0) damage = 0; else damage = Math.max(1, damage);

        defender.battleStats.hp -= damage;
        totalDamage += damage;
        playAnimation(isPlayer ? 'enemy-sprite' : 'player-sprite', 'anim-damage');

        if (damage > 0 && isCrit && hitCount === 1) logMessage(state.currentLang === 'en' ? `<span style="color:#f39c12">A critical hit!</span>` : `<span style="color:#f39c12">Coup critique !</span>`);
        
        if (i === hitCount - 1) { // Afficher l'efficacité au dernier coup
            if (mult > 1) logMessage(state.currentLang === 'en' ? `It's super effective!` : `C'est super efficace !`);
            else if (mult > 0 && mult < 1) logMessage(state.currentLang === 'en' ? `It's not very effective.` : `Ce n'est pas très efficace.`);
            else if (mult === 0) logMessage(state.currentLang === 'en' ? `It has no effect...` : `Ça n'a aucun effet...`);
        }
        updateBattleUI();
        await new Promise(r => setTimeout(r, 400));
    }

    if (hitCount > 1 && totalDamage > 0) logMessage(state.currentLang === 'en' ? `Hit ${hitCount} times!` : `Touché ${hitCount} fois !`);
    if (totalDamage > 0) logMessage(`(${totalDamage} ${state.currentLang === 'en' ? 'dmg' : 'dégâts'})`);

    // EFFETS SECONDAIRES (Vole-Vie, Contrecoup, Buffs/Debuffs) après le calcul des dégâts
    if (totalDamage > 0) {
        if (DRAIN_MOVES.includes(move.nameEn)) {
            let drainHeal = Math.max(1, Math.floor(totalDamage / 2));
            attacker.battleStats.hp = Math.min(attacker.battleStats.maxHp, attacker.battleStats.hp + drainHeal);
            logMessage(`<span style="color:#2ecc71">${state.currentLang === 'en' ? `${defName} had its energy drained!` : `${defName} voit son énergie aspirée !`}</span>`);
        }
        
        if (RECOIL_MOVES.includes(move.nameEn)) {
            let recoilDmg = Math.max(1, Math.floor(totalDamage / 3));
            attacker.battleStats.hp -= recoilDmg;
            logMessage(`<span style="color:#e74c3c">${state.currentLang === 'en' ? `${aName} is hit with recoil!` : `${aName} est blessé par le contrecoup !`}</span>`);
        }

        const secEffect = SECONDARY_EFFECTS[move.nameEn];
        if (secEffect && Math.random() <= secEffect.chance) {
            let targetEntity = secEffect.target === "enemy" ? defender : attacker;
            let targetName = secEffect.target === "enemy" ? defName : aName;
            
            for (let effect of secEffect.effects) {
                targetEntity.modifiers[effect.stat] = Math.max(-6, Math.min(6, targetEntity.modifiers[effect.stat] + effect.stage));
                const langDict = state.currentLang === 'en' ? STAT_NAMES.en : STAT_NAMES.fr;
                let statName = langDict[effect.stat];
                if (effect.stage > 0) logMessage(`<span style="color:#3498db">${state.currentLang === 'en' ? `${targetName}'s${statName} rose!` : `${statName} de${targetName} augmente !`}</span>`);
                else logMessage(`<span style="color:#e74c3c">${state.currentLang === 'en' ? `${targetName}'s${statName} fell!` : `${statName} de${targetName} diminue !`}</span>`);
            }
        }
    }

    updateBattleUI();
    
    // GESTION DU FLINCH (Peur)
    let flinched = false;
    if (FLINCH_MOVES.includes(move.nameEn) && totalDamage > 0 && Math.random() < 0.3) {
        flinched = true;
    }

    await new Promise(r => setTimeout(r, 600));
    return { flinched };
}

async function processTurn(playerMove) {
    if (isAnimating || !currentEnemy || currentEnemy.battleStats.hp <= 0 || activeFighter.battleStats.hp <= 0) return;
    isAnimating = true;
    toggleMoves(true);

    let pPriority = PRIORITY_MOVES.includes(playerMove.nameEn) ? 1 : 0;
    
    let bestEnemyMove = currentEnemy.moves[0];
    let maxExpectedDamage = -1;
    
    currentEnemy.moves.forEach(m => {
        let expected = 0;
        if (USELESS_MOVES.includes(m.nameEn)) {
            expected = -1;
        } else if (HEAL_MOVES.includes(m.nameEn)) {
            if (currentEnemy.battleStats.hp < currentEnemy.battleStats.maxHp / 2) expected = 1000;
            else expected = -1;
        } else if (m.damageClass === "status") {
            if (Math.random() < 0.1 && maxExpectedDamage < 10) expected = 10;
        } else {
            let mMult = getEffectiveness(m.type, activeFighter.battleStats.types);
            let stab = currentEnemy.battleStats.types.includes(m.type) ? 1.5 : 1;
            let A = m.damageClass === 'special' ? getEffectiveStat(currentEnemy, 'spatk') : getEffectiveStat(currentEnemy, 'atk');
            let D = m.damageClass === 'special' ? getEffectiveStat(activeFighter, 'spdef') : getEffectiveStat(activeFighter, 'def');
            expected = m.power * mMult * stab * (A / D);
        }
        
        if (expected > maxExpectedDamage) {
            maxExpectedDamage = expected;
            bestEnemyMove = m;
        }
    });

    let ePriority = PRIORITY_MOVES.includes(bestEnemyMove.nameEn) ? 1 : 0;
    
    let playerGoesFirst;
    if (pPriority > ePriority) playerGoesFirst = true;
    else if (ePriority > pPriority) playerGoesFirst = false;
    else {
        let playerSpeed = getEffectiveStat(activeFighter, 'speed');
        let enemySpeed = getEffectiveStat(currentEnemy, 'speed');
        playerGoesFirst = playerSpeed >= enemySpeed;
        if (playerSpeed === enemySpeed) playerGoesFirst = Math.random() > 0.5;
    }

    if (playerGoesFirst) {
        let pResult = await executeMove(activeFighter, currentEnemy, playerMove, true);
        if (currentEnemy.battleStats.hp > 0) {
            if (pResult.flinched) {
                let eName = state.currentLang === 'en' ? currentEnemy.nameEn : currentEnemy.nameFr;
                logMessage(`<span style="color:#f39c12">${state.currentLang === 'en' ? `${eName} flinched and couldn't move!` : `${eName} a la trouille, il passe son tour !`}</span>`);
                await new Promise(r => setTimeout(r, 1000));
            } else {
                await executeMove(currentEnemy, activeFighter, bestEnemyMove, false);
            }
        }
    } else {
        let eResult = await executeMove(currentEnemy, activeFighter, bestEnemyMove, false);
        if (activeFighter.battleStats.hp > 0) {
            if (eResult.flinched) {
                let pName = state.currentLang === 'en' ? activeFighter.data.en : activeFighter.data.fr;
                if (activeFighter.mega) pName = formatMegaName(pName, activeFighter.megaForm);
                logMessage(`<span style="color:#f39c12">${state.currentLang === 'en' ? `${pName} flinched and couldn't move!` : `${pName} a la trouille, il passe son tour !`}</span>`);
                await new Promise(r => setTimeout(r, 1000));
            } else {
                await executeMove(activeFighter, currentEnemy, playerMove, true);
            }
        }
    }

    if (currentEnemy.battleStats.hp <= 0) {
        await winBattle();
    } else if (activeFighter.battleStats.hp <= 0) {
        let pName = state.currentLang === 'en' ? activeFighter.data.en : activeFighter.data.fr;
        if (activeFighter.mega) pName = formatMegaName(pName, activeFighter.megaForm);
        let msgFaint = state.currentLang === 'en' ? `<span class="text-danger">${pName} fainted! You flee...</span>` : `<span class="text-danger">${pName} est K.O. ! Vous fuyez en urgence...</span>`;
        logMessage(msgFaint);
        setTimeout(() => {
            document.getElementById('campagne-battle-arena').classList.add('hidden');
            document.getElementById('campagne-select-zone').classList.remove('hidden');
        }, 2500);
    } else {
        toggleMoves(false);
    }
    
    isAnimating = false;
}

function promptLearnMove(newMove) {
    return new Promise(resolve => {
        const modal = document.getElementById('move-learn-modal');
        const text = document.getElementById('move-learn-text');
        const list = document.getElementById('current-moves-list');
        const skipBtn = document.getElementById('btn-skip-move');
        
        let pName = state.currentLang === 'en' ? activeFighter.data.en : activeFighter.data.fr;
        let mName = state.currentLang === 'en' ? newMove.nameEn : newMove.nameFr;
        let displayPower = (newMove.damageClass === "status" || USELESS_MOVES.includes(newMove.nameEn)) ? "-" : newMove.power;
        
        let promptText = state.currentLang === 'en' 
            ? `<b>${pName}</b> wants to learn <b class="text-accent">${mName}</b> (POW ${displayPower}).<br>But it already knows 4 moves! Which move should be forgotten?` 
            : `<b>${pName}</b> veut apprendre <b class="text-accent">${mName}</b> (POW ${displayPower}).<br>Mais il connaît déjà 4 capacités ! Laquelle oublier ?`;
        
        text.innerHTML = promptText;
        list.innerHTML = '';
        
        activeFighter.moves.forEach((m, index) => {
            const btn = document.createElement('button');
            btn.className = `move-btn type-${m.type}`;
            let currentMName = state.currentLang === 'en' ? m.nameEn : m.nameFr;
            let mPow = (m.damageClass === "status" || USELESS_MOVES.includes(m.nameEn)) ? "-" : m.power;
            btn.innerHTML = `<span class="move-name" data-en="${m.nameEn}" data-fr="${m.nameFr}">${currentMName}</span><span style="font-size:0.7rem; font-weight:normal;">POW ${mPow}</span>`;
            
            btn.onclick = () => {
                let oldName = state.currentLang === 'en' ? m.nameEn : m.nameFr;
                let msgLearn = state.currentLang === 'en' ? `1, 2 and... Poof! ${pName} forgot ${oldName} and learned ${mName}!` : `1, 2 et... Pouf ! ${pName} a oublié ${oldName} et appris ${mName} !`;
                logMessage(msgLearn);
                activeFighter.moves[index] = newMove;
                closeModal();
            };
            list.appendChild(btn);
        });
        
        skipBtn.onclick = () => {
            logMessage(state.currentLang === 'en' ? `${pName} did not learn ${mName}.` : `${pName} n'a pas appris ${mName}.`);
            closeModal();
        };
        
        function closeModal() {
            modal.classList.add('hidden');
            resolve();
        }
        
        modal.classList.remove('hidden');
        applyTranslation();
    });
}

async function handleLevelUpMoves(oldLvl, newLvl) {
    const details = await getPokemonDetails(activeFighter);
    let newMovesInfo = details.allMoves.filter(m => m.level > oldLvl && m.level <= newLvl);
    newMovesInfo.sort((a,b) => a.level - b.level);
    
    for (let mInfo of newMovesInfo) {
        const moveData = await getMoveDetails(mInfo.name); 
        if (activeFighter.moves.some(m => m.nameEn === moveData.nameEn)) continue;
        
        if (activeFighter.moves.length < 4) {
            activeFighter.moves.push(moveData);
            let moveName = state.currentLang === 'en' ? moveData.nameEn : moveData.nameFr;
            let pName = state.currentLang === 'en' ? activeFighter.data.en : activeFighter.data.fr;
            let msg = state.currentLang === 'en' ? `✨ ${pName} learned ${moveName}!` : `✨ ${pName} a appris ${moveName} !`;
            logMessage(msg);
        } else {
            await promptLearnMove(moveData);
        }
    }
}

async function winBattle() {
    let eName = state.currentLang === 'en' ? currentEnemy.nameEn : currentEnemy.nameFr;
    logMessage(`<b style="color:#2ecc71;">${eName} ${state.currentLang === 'en' ? 'defeated!' : 'sauvage est vaincu !'}</b>`);
    
    let highestStat = 'hp';
    let highestValue = 0;
    for (const [stat, val] of Object.entries(currentEnemy.baseStats)) {
        if (val > highestValue) {
            highestValue = val;
            highestStat = stat;
        }
    }
    
    let evYield = currentEnemy.level >= 40 ? 3 : (currentEnemy.level >= 20 ? 2 : 1);
    let totalEVs = Object.values(activeFighter.evs).reduce((a, b) => a + b, 0);
    let evsToAdd = 0;
    
    if (totalEVs < 510 && activeFighter.evs[highestStat] < 252) {
        let spaceLeftInTotal = 510 - totalEVs;
        let spaceLeftInStat = 252 - activeFighter.evs[highestStat];
        evsToAdd = Math.min(evYield, spaceLeftInTotal, spaceLeftInStat);
        
        if (evsToAdd > 0) {
            activeFighter.evs[highestStat] += evsToAdd;
            const statNamesFR = { hp: "PV", atk: "Attaque", def: "Défense", spatk: "Attaque Spéciale", spdef: "Défense Spéciale", speed: "Vitesse" };
            const statNamesEN = { hp: "HP", atk: "Attack", def: "Defense", spatk: "Special Attack", spdef: "Special Defense", speed: "Speed" };
            
            let statName = state.currentLang === 'en' ? statNamesEN[highestStat] : statNamesFR[highestStat];
            let msgEV = state.currentLang === 'en' ? `+${evsToAdd} ${statName} Effort Values (EV)!` : `+${evsToAdd} EV en ${statName} !`;
            logMessage(`<span style="color:#3498db; font-size:0.9rem;">${msgEV}</span>`);
        }
    }

    let xpGained = currentEnemy.level * 15;
    logMessage(state.currentLang === 'en' ? `You gained <span class="text-accent">${xpGained} XP</span>!` : `Vous gagnez <span class="text-accent">${xpGained} XP</span> !`);
    
    let oldLvl = activeFighter.level || 1;
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
        currentXp = 0; 
    }
    
    activeFighter.level = currentLvl;
    activeFighter.xp = currentXp;
    
    if (leveledUp) {
        logMessage(state.currentLang === 'en' ? `<span class="text-accent font-bold">🎉 LEVEL UP! (Level ${currentLvl})</span>` : `<span class="text-accent font-bold">🎉 NIVEAU SUPÉRIEUR ! (Niveau ${currentLvl})</span>`);
        await handleLevelUpMoves(oldLvl, currentLvl);
        if (currentLvl === maxLvl) {
            logMessage(state.currentLang === 'en' ? `<span class="text-danger">Max Rank reached! Merge duplicates in Collection to go higher.</span>` : `<span class="text-danger">Rang Max atteint ! Fusionnez des doublons dans la collection pour aller plus haut.</span>`);
        }
    }
    
    updateBattleUI();
    renderMovesUI(); 
    applyTranslation();
    
    try {
        await db.collection('users').doc(state.currentUser).update({
            collection: state.currentUserData.collection
        });
    } catch(e) { console.error("Erreur de sauvegarde XP", e); }
    
    setTimeout(() => {
        document.getElementById('campagne-battle-arena').classList.add('hidden');
        document.getElementById('campagne-select-zone').classList.remove('hidden');
        updateFighterBadge(); 
        renderZones(); 
    }, 4000);
}