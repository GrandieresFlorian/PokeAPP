import { db } from '../firebase-config.js';
import { state } from '../state.js';
import { getCardImageUrl, getPokemonDetails, getEffectiveness, formatMegaName, getMovesForLevel, getMoveDetails } from '../utils.js';
import { applyTranslation } from './navController.js';
import { 
    USELESS_MOVES, PRIORITY_MOVES, HEAL_MOVES, DRAIN_MOVES, RECOIL_MOVES, MULTI_HIT_2_5, MULTI_HIT_2, 
    FLINCH_MOVES, SECONDARY_EFFECTS, STATUS_MOVES, STAT_NAMES, 
    OHKO_MOVES, KAMIKAZE_MOVES, FORCE_FLEE_MOVES, HIGH_CRIT_MOVES, STAT_CLEAR_MOVES, FIXED_DAMAGE_MOVES,
    STATUS_CONDITIONS, SECONDARY_STATUS
} from '../data/campagneData.js';

// Nouvelles mécaniques
const PROTECT_MOVES_LIST = ["protect", "detect"];
const SEED_MOVES_LIST = ["leech-seed"];
const ACCURACY_DROPS = ["smokescreen", "sand-attack", "flash", "kinesis", "mud-slap"];
const EVASION_UPS = ["double-team", "minimize"];
const WEATHER_MOVES_DICT = {
    "sunny-day": { weather: "sun", msg: "Le soleil brille intensément ☀️ !" },
    "rain-dance": { weather: "rain", msg: "Il commence à pleuvoir 🌧️ !" },
    "sandstorm": { weather: "sandstorm", msg: "Une tempête de sable se lève 🌪️ !" },
    "hail": { weather: "hail", msg: "Il commence à grêler ❄️ !" }
};
const EXTENDED_STAT_NAMES = { ...STAT_NAMES.fr, accuracy: "Précision", evasion: "Esquive" };

let activeFighter = null;
let currentEnemy = null;
let isAnimating = false;
let onBattleEndCallback = null;

// Météo locale
let currentWeather = 'none';
let weatherTurns = 0;

const STATUS_COLORS = { "BRN": "#e67e22", "PSN": "#9b59b6", "TOX": "#8e44ad", "PAR": "#f1c40f", "FRZ": "#3498db", "SLP": "#2c3e50" };

export function calcStats(baseStats, level, evs = { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 }) {
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

export function getEffectiveStat(entity, statName) {
    let base = entity.battleStats[statName];
    let stage = entity.modifiers[statName];
    let multiplier = Math.max(2, 2 + stage) / Math.max(2, 2 - stage);
    let finalStat = Math.floor(base * multiplier);
    
    if (statName === 'speed' && entity.status === 'PAR') finalStat = Math.floor(finalStat / 2);
    return finalStat;
}

export async function startBattle(zone, fighter, onEnd) {
    activeFighter = fighter;
    onBattleEndCallback = onEnd;
    isAnimating = false;
    currentWeather = 'none';
    weatherTurns = 0;

    const logEl = document.getElementById('battle-log');
    if (logEl) { logEl.classList.remove('translatable'); logEl.removeAttribute('data-fr'); logEl.removeAttribute('data-en'); }

    document.getElementById('enemy-name').textContent = "Recherche...";
    document.getElementById('enemy-sprite').src = "";
    document.getElementById('battle-log').innerHTML = state.currentLang === 'en' ? `You walk into ${zone.name}...` : `Vous marchez dans la zone : ${zone.name}...`;
    document.getElementById('moves-container').innerHTML = `<p style="color:#aaa; text-align:center; grid-column: span 2; margin-top:20px;">Chargement des capacités...</p>`;

    const possibleEncounters = zone.encounters;
    const totalChance = possibleEncounters.reduce((sum, enc) => sum + enc.chance, 0);
    let randomVal = Math.random() * totalChance;
    
    let randomPokedexNumber = possibleEncounters[0].id;
    for (let enc of possibleEncounters) {
        if (randomVal < enc.chance) { randomPokedexNumber = enc.id; break; }
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
        modifiers: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0, evasion: 0 },
        status: null, statusTurns: 0, confusion: 0, toxCount: 0,
        turnsActive: 0, isProtected: false, protectCount: 0, isSeeded: false, flinched: false,
        sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${wId}.png`
    };
    currentEnemy.battleStats.types = wDetails.types;

    if (!activeFighter.evs) activeFighter.evs = { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };
    
    activeFighter.battleStats = calcStats(pDetails.baseStats, activeFighter.level || 1, activeFighter.evs);
    activeFighter.battleStats.types = pDetails.types;
    activeFighter.modifiers = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0, evasion: 0 };
    activeFighter.status = null; activeFighter.statusTurns = 0; activeFighter.confusion = 0; activeFighter.toxCount = 0;
    activeFighter.turnsActive = 0; activeFighter.isProtected = false; activeFighter.protectCount = 0; activeFighter.isSeeded = false; activeFighter.flinched = false;
    activeFighter.transformedImage = null;

    currentEnemy.moves = await getMovesForLevel(wId, wLevel);
    currentEnemy.battleMoves = JSON.parse(JSON.stringify(currentEnemy.moves));

    if (!activeFighter.moves || activeFighter.moves.length === 0) {
        activeFighter.moves = await getMovesForLevel(activeFighter.pokedexNumber, activeFighter.level || 1);
        db.collection('users').doc(state.currentUser).update({ collection: state.currentUserData.collection });
    }
    activeFighter.battleMoves = JSON.parse(JSON.stringify(activeFighter.moves));
    
    updateBattleUI();
    renderMovesUI();
    toggleMoves(false);

    let eName = state.currentLang === 'en' ? currentEnemy.nameEn : currentEnemy.nameFr;
    logMessage(state.currentLang === 'en' ? `A wild <b>${eName}</b> appears! (Lvl ${currentEnemy.level})` : `Un <b>${eName}</b> sauvage apparaît ! (Niv. ${currentEnemy.level})`);
}

export function fleeBattle(forced = false) {
    if(isAnimating && !forced) return;
    if(!forced) logMessage(state.currentLang === 'en' ? "You fled... 🏃" : "Vous prenez la fuite... 🏃");
    toggleMoves(true);
    setTimeout(() => { if(onBattleEndCallback) onBattleEndCallback(); }, forced ? 2000 : 1500);
}

function renderMovesUI() {
    const container = document.getElementById('moves-container');
    container.innerHTML = "";
    let movesList = activeFighter.battleMoves || activeFighter.moves;

    movesList.forEach(move => {
        const btn = document.createElement('button');
        btn.className = `move-btn type-${move.type}`;
        const moveName = state.currentLang === 'en' ? move.nameEn : move.nameFr;
        
        let displayPower = (move.damageClass === "status" || move.nameEn === "transform" || USELESS_MOVES.includes(move.nameEn) || FORCE_FLEE_MOVES.includes(move.nameEn) || STAT_CLEAR_MOVES.includes(move.nameEn) || OHKO_MOVES.includes(move.nameEn) || PROTECT_MOVES_LIST.includes(move.nameEn) || SEED_MOVES_LIST.includes(move.nameEn) || WEATHER_MOVES_DICT[move.nameEn] || ACCURACY_DROPS.includes(move.nameEn) || EVASION_UPS.includes(move.nameEn)) ? "-" : move.power;
        if(FIXED_DAMAGE_MOVES[move.nameEn]) displayPower = "FIX";

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

function updateWeatherUI() {
    let weatherBanner = document.getElementById('weather-banner');
    const logBox = document.getElementById('battle-log');
    
    if (!weatherBanner && logBox) {
        weatherBanner = document.createElement('div');
        weatherBanner.id = 'weather-banner';
        weatherBanner.style.cssText = "text-align:center; font-weight:bold; padding:5px; margin-bottom:5px; border-radius:5px; transition: 0.3s;";
        logBox.parentNode.insertBefore(weatherBanner, logBox);
    }
    
    if (weatherBanner) {
        if (currentWeather && currentWeather !== 'none') {
            weatherBanner.style.display = 'block';
            if (currentWeather === 'sun') { weatherBanner.textContent = "☀️ Météo : Soleil Intense"; weatherBanner.style.background = "#f1c40f"; weatherBanner.style.color = "#000"; }
            if (currentWeather === 'rain') { weatherBanner.textContent = "🌧️ Météo : Pluie Battante"; weatherBanner.style.background = "#3498db"; weatherBanner.style.color = "#fff"; }
            if (currentWeather === 'sandstorm') { weatherBanner.textContent = "🌪️ Météo : Tempête de Sable"; weatherBanner.style.background = "#e67e22"; weatherBanner.style.color = "#fff"; }
            if (currentWeather === 'hail') { weatherBanner.textContent = "❄️ Météo : Grêle"; weatherBanner.style.background = "#ecf0f1"; weatherBanner.style.color = "#000"; }
        } else {
            weatherBanner.style.display = 'none';
        }
    }
}

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
    
    if (entity.status) {
        let statusBadge = document.createElement('span');
        statusBadge.style.cssText = `background:${STATUS_COLORS[entity.status]}; color:#fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;`;
        statusBadge.textContent = entity.status;
        container.appendChild(statusBadge);
    }
    if (entity.confusion > 0) {
        let confBadge = document.createElement('span');
        confBadge.style.cssText = `background:#e67e22; color:#fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold;`;
        confBadge.textContent = "CNF";
        container.appendChild(confBadge);
    }
    if (entity.isSeeded) {
        let seedBadge = document.createElement('span');
        seedBadge.style.cssText = `background:#2ecc71; color:#fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; margin-left:4px;`;
        seedBadge.textContent = "GRAINE";
        container.appendChild(seedBadge);
    }
    for (let stat in entity.modifiers) {
        let stage = entity.modifiers[stat];
        if (stage !== 0) {
            let badge = document.createElement('span');
            badge.className = `mod-badge ${stage > 0 ? 'mod-up' : 'mod-down'}`;
            badge.textContent = `${EXTENDED_STAT_NAMES[stat]} ${stage > 0 ? '+' : ''}${stage}`;
            container.appendChild(badge);
        }
    }
}

function updateBattleUI() {
    updateWeatherUI();

    const enemyNameEl = document.getElementById('enemy-name');
    enemyNameEl.setAttribute('data-en', currentEnemy.nameEn);
    enemyNameEl.setAttribute('data-fr', currentEnemy.nameFr);
    enemyNameEl.textContent = state.currentLang === 'en' ? currentEnemy.nameEn : currentEnemy.nameFr;
    
    document.getElementById('enemy-lvl').textContent = `Niv. ${currentEnemy.level}`;
    document.getElementById('enemy-hp-text').textContent = `${Math.max(0, currentEnemy.battleStats.hp)} / ${currentEnemy.battleStats.maxHp}`;
    document.getElementById('enemy-hp-fill').style.width = `${(Math.max(0, currentEnemy.battleStats.hp) / currentEnemy.battleStats.maxHp) * 100}%`;
    document.getElementById('enemy-sprite').src = currentEnemy.transformedImage || currentEnemy.sprite;
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
    document.getElementById('player-sprite').src = activeFighter.transformedImage || getCardImageUrl(activeFighter);
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

function applyStatus(target, statusObj, targetName) {
    if (statusObj.status === 'CNF') {
        if (target.confusion === 0) {
            target.confusion = Math.floor(Math.random() * 4) + 2;
            logMessage(`<span style="color:#e67e22">${state.currentLang === 'en' ? `${targetName} became confused!` : `${targetName} devient confus !`}</span>`);
        }
    } else {
        if (!target.status) {
            target.status = statusObj.status; target.toxCount = 0;
            if (statusObj.status === 'SLP') target.statusTurns = Math.floor(Math.random() * 3) + 1;
            let msgs = {
                "BRN": { en: "was burned!", fr: "est brûlé !" },
                "PSN": { en: "was poisoned!", fr: "est empoisonné !" },
                "TOX": { en: "was badly poisoned!", fr: "est gravement empoisonné !" },
                "PAR": { en: "is paralyzed!", fr: "est paralysé !" },
                "FRZ": { en: "was frozen solid!", fr: "est gelé !" },
                "SLP": { en: "fell asleep!", fr: "s'endort !" }
            };
            logMessage(`<span style="color:${STATUS_COLORS[statusObj.status]}">${targetName} ${state.currentLang === 'en' ? msgs[statusObj.status].en : msgs[statusObj.status].fr}</span>`);
        }
    }
}

async function preMoveCheck(entity, isPlayer) {
    let name = isPlayer ? (state.currentLang === 'en' ? entity.data.en : entity.data.fr) : (state.currentLang === 'en' ? entity.nameEn : entity.nameFr);
    
    if (entity.status === 'FRZ') {
        if (Math.random() < 0.2) {
            entity.status = null;
            logMessage(`<span style="color:#3498db">${name} ${state.currentLang === 'en' ? 'thawed out!' : 'est dégelé !'}</span>`);
            updateBattleUI();
        } else {
            logMessage(`<span style="color:#3498db">${name} ${state.currentLang === 'en' ? 'is frozen solid!' : 'est complètement gelé !'}</span>`);
            return false;
        }
    }

    if (entity.status === 'SLP') {
        entity.statusTurns--;
        if (entity.statusTurns <= 0) {
            entity.status = null;
            logMessage(`<span style="color:#2c3e50">${name} ${state.currentLang === 'en' ? 'woke up!' : 'se réveille !'}</span>`);
            updateBattleUI();
        } else {
            logMessage(`<span style="color:#2c3e50">${name} ${state.currentLang === 'en' ? 'is fast asleep.' : 'dort profondément.'}</span>`);
            return false;
        }
    }

    if (entity.status === 'PAR') {
        if (Math.random() < 0.25) {
            logMessage(`<span style="color:#f1c40f">${name} ${state.currentLang === 'en' ? 'is paralyzed! It can\'t move!' : 'est paralysé ! Il ne peut pas attaquer !'}</span>`);
            return false;
        }
    }

    if (entity.confusion > 0) {
        entity.confusion--;
        if (entity.confusion === 0) {
            logMessage(`<span style="color:#e67e22">${name} ${state.currentLang === 'en' ? 'snapped out of confusion!' : 'n\'est plus confus !'}</span>`);
        } else {
            logMessage(`<span style="color:#e67e22">${name} ${state.currentLang === 'en' ? 'is confused!' : 'est confus !'}</span>`);
            if (Math.random() < 0.33) {
                playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
                await new Promise(r => setTimeout(r, 400));
                let dmg = Math.max(1, Math.floor(entity.battleStats.maxHp / 8)); 
                entity.battleStats.hp -= dmg;
                logMessage(`<span style="color:#e74c3c">${state.currentLang === 'en' ? 'It hurt itself in its confusion!' : 'Il se blesse dans sa confusion !'}</span>`);
                playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-damage');
                updateBattleUI();
                await new Promise(r => setTimeout(r, 600));
                return false;
            }
        }
    }
    return true;
}

async function applyEndTurnStatus(entity, opponent, isPlayer) {
    if (entity.battleStats.hp <= 0) return;
    let name = isPlayer ? (state.currentLang === 'en' ? entity.data.en : entity.data.fr) : (state.currentLang === 'en' ? entity.nameEn : entity.nameFr);
    
    if (entity.isSeeded && entity.battleStats.hp > 0) {
        let drain = Math.max(1, Math.floor(entity.battleStats.maxHp / 8));
        entity.battleStats.hp -= drain;
        opponent.battleStats.hp = Math.min(opponent.battleStats.maxHp, opponent.battleStats.hp + drain);
        logMessage(`<span style="color:#2ecc71">Vampigraine draine l'énergie de ${name} !</span>`);
        updateBattleUI();
        await new Promise(r => setTimeout(r, 600));
    }

    if (entity.status === 'BRN') {
        let dmg = Math.max(1, Math.floor(entity.battleStats.maxHp / 16));
        entity.battleStats.hp -= dmg;
        logMessage(`<span style="color:#e67e22">${name} ${state.currentLang === 'en' ? 'is hurt by its burn!' : 'souffre de sa brûlure !'}</span>`);
        updateBattleUI();
        await new Promise(r => setTimeout(r, 600));
    } else if (entity.status === 'PSN') {
        let dmg = Math.max(1, Math.floor(entity.battleStats.maxHp / 8));
        entity.battleStats.hp -= dmg;
        logMessage(`<span style="color:#9b59b6">${name} ${state.currentLang === 'en' ? 'is hurt by poison!' : 'souffre du poison !'}</span>`);
        updateBattleUI();
        await new Promise(r => setTimeout(r, 600));
    } else if (entity.status === 'TOX') {
        entity.toxCount++;
        let dmg = Math.max(1, Math.floor((entity.battleStats.maxHp * entity.toxCount) / 16));
        entity.battleStats.hp -= dmg;
        logMessage(`<span style="color:#8e44ad">${name} ${state.currentLang === 'en' ? 'is hurt by toxic poison!' : 'souffre du poison grave !'}</span>`);
        updateBattleUI();
        await new Promise(r => setTimeout(r, 600));
    }

    entity.turnsActive = (entity.turnsActive || 0) + 1;
}

async function applyWeatherDamage(entity, weather, isPlayer) {
    let types = entity.battleStats.types || [];
    let name = isPlayer ? entity.data.fr : entity.nameFr;
    if (weather === 'sandstorm' && !types.includes('rock') && !types.includes('ground') && !types.includes('steel')) {
        entity.battleStats.hp -= Math.max(1, Math.floor(entity.battleStats.maxHp / 16));
        logMessage(`<span style="color:#e67e22">${name} subit la tempête de sable !</span>`);
    }
    if (weather === 'hail' && !types.includes('ice')) {
        entity.battleStats.hp -= Math.max(1, Math.floor(entity.battleStats.maxHp / 16));
        logMessage(`<span style="color:#bdc3c7">${name} subit la grêle !</span>`);
    }
}

async function executeMove(attacker, defender, move, isPlayer) {
    if(attacker.battleStats.hp <= 0 || defender.battleStats.hp <= 0) return { flinched: false };

    let canAttack = await preMoveCheck(attacker, isPlayer);
    if(!canAttack) return { flinched: false };

    if (attacker.flinched) {
        logMessage(`<span style="color:#f39c12">${state.currentLang === 'en' ? 'It flinched and couldn\'t move!' : 'La peur l\'empêche d\'attaquer !'}</span>`);
        await new Promise(r => setTimeout(r, 800));
        return { flinched: false };
    }

    let aName = isPlayer ? (state.currentLang === 'en' ? attacker.data.en : attacker.data.fr) : (state.currentLang === 'en' ? attacker.nameEn : attacker.nameFr);
    if (isPlayer && attacker.mega) aName = formatMegaName(aName, attacker.megaForm);
    let defName = isPlayer ? (state.currentLang === 'en' ? defender.nameEn : defender.nameFr) : (state.currentLang === 'en' ? defender.data.en : defender.data.fr);
    let mName = state.currentLang === 'en' ? move.nameEn : move.nameFr;
    let colorClass = isPlayer ? "var(--accent)" : "var(--danger)";
    
    logMessage(`<b>${aName}</b> ${state.currentLang === 'en'?'uses':'utilise'} <b style="color:${colorClass};">${mName}</b> !`);

    // MÉCANIQUE : MÉTÉO
    if (WEATHER_MOVES_DICT[move.nameEn]) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        currentWeather = WEATHER_MOVES_DICT[move.nameEn].weather;
        weatherTurns = 5;
        logMessage(`<span style="color:#f39c12"><b>${WEATHER_MOVES_DICT[move.nameEn].msg}</b></span>`);
        updateBattleUI();
        await new Promise(r => setTimeout(r, 800));
        return { flinched: false };
    }

    // MÉCANIQUE : PRÉCISION / ESQUIVE (Jet de sable, Brouillard, Reflet)
    if (ACCURACY_DROPS.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        defender.modifiers.accuracy = Math.max(-6, (defender.modifiers.accuracy || 0) - 1);
        logMessage(`<span style="color:#e74c3c">La précision de ${defName} diminue !</span>`);
        updateBattleUI();
        await new Promise(r => setTimeout(r, 800));
        return { flinched: false };
    }
    if (EVASION_UPS.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        attacker.modifiers.evasion = Math.min(6, (attacker.modifiers.evasion || 0) + 1);
        logMessage(`<span style="color:#3498db">L'esquive de ${aName} augmente !</span>`);
        updateBattleUI();
        await new Promise(r => setTimeout(r, 800));
        return { flinched: false };
    }

    // MÉCANIQUE : CALCUL DE L'ESQUIVE GLOBALE
    let isStatusOnSelf = move.damageClass === "status" && (EVASION_UPS.includes(move.nameEn) || HEAL_MOVES.includes(move.nameEn) || PROTECT_MOVES_LIST.includes(move.nameEn));
    if (!isStatusOnSelf && move.nameEn !== "transform") {
        let accStage = Math.max(-6, Math.min(6, (attacker.modifiers.accuracy || 0) - (defender.modifiers.evasion || 0)));
        let accMult = accStage >= 0 ? (3 + accStage) / 3 : 3 / (3 - accStage);
        let moveAcc = move.accuracy || 100;
        
        if (Math.random() * 100 > moveAcc * accMult) {
            logMessage(`<b>L'attaque a raté !</b>`);
            await new Promise(r => setTimeout(r, 600));
            return { flinched: false };
        }
    }

    // MÉCANIQUE : MORPHING (Transform)
    if (move.nameEn === "transform") {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        attacker.battleStats.types = [...defender.battleStats.types];
        attacker.battleStats.atk = defender.battleStats.atk;
        attacker.battleStats.def = defender.battleStats.def;
        attacker.battleStats.spatk = defender.battleStats.spatk;
        attacker.battleStats.spdef = defender.battleStats.spdef;
        attacker.battleStats.speed = defender.battleStats.speed;
        attacker.modifiers = JSON.parse(JSON.stringify(defender.modifiers || {}));
        attacker.battleMoves = JSON.parse(JSON.stringify(defender.battleMoves || defender.moves));
        attacker.transformedImage = isPlayer ? (defender.transformedImage || defender.sprite) : (defender.transformedImage || getCardImageUrl(defender));
        logMessage(`<span style="color:#9b59b6">${aName} se transforme en ${defName} !</span>`);
        updateBattleUI();
        if (isPlayer) renderMovesUI(); 
        await new Promise(r => setTimeout(r, 800));
        return { flinched: false };
    }

    // MÉCANIQUE : BLUFF (Fake Out)
    if (move.nameEn === "fake-out") {
        if ((attacker.turnsActive || 0) > 0) { logMessage(`Mais cela échoue !`); return { flinched: false }; }
    }

    // MÉCANIQUE : ABRI / DÉTECTION (Protect)
    if (PROTECT_MOVES_LIST.includes(move.nameEn)) {
        let chance = Math.pow(0.5, attacker.protectCount || 0);
        if (Math.random() < chance) {
            attacker.isProtected = true; attacker.protectCount = (attacker.protectCount || 0) + 1;
            logMessage(`<span style="color:#2ecc71">${aName} se protège !</span>`);
        } else {
            attacker.protectCount = 0; logMessage(`Mais cela échoue !`);
        }
        await new Promise(r => setTimeout(r, 600)); return { flinched: false };
    } else {
        attacker.protectCount = 0;
    }

    if (defender.isProtected) {
        logMessage(`<span style="color:#bdc3c7">${defName} s'est protégé contre l'attaque !</span>`);
        await new Promise(r => setTimeout(r, 600)); return { flinched: false };
    }

    // MÉCANIQUE : VAMPIGRAINE
    if (SEED_MOVES_LIST.includes(move.nameEn)) {
        if (defender.battleStats.types.includes('grass')) logMessage(`Ça n'affecte pas les Pokémon Plante !`);
        else if (defender.isSeeded) logMessage(`${defName} est déjà infecté !`);
        else { defender.isSeeded = true; logMessage(`<span style="color:#2ecc71">${defName} est infecté par Vampigraine !</span>`); }
        await new Promise(r => setTimeout(r, 600)); return { flinched: false };
    }
    
    if (FORCE_FLEE_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        logMessage(state.currentLang === 'en' ? `The wild Pokémon fled!` : `Le combat prend fin subitement !`);
        return { forceFlee: true };
    }

    if (STAT_CLEAR_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        for(let s in attacker.modifiers) attacker.modifiers[s] = 0;
        for(let s in defender.modifiers) defender.modifiers[s] = 0;
        logMessage(`<span style="color:#3498db">Tous les changements de stats sont annulés !</span>`);
        updateBattleUI();
        await new Promise(r => setTimeout(r, 800)); return { flinched: false };
    }

    if (OHKO_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        if (Math.random() < 0.30) {
            defender.battleStats.hp = 0;
            logMessage(`<span style="color:#f39c12">K.O. en un coup !</span>`);
            playAnimation(isPlayer ? 'enemy-sprite' : 'player-sprite', 'anim-damage');
            updateBattleUI(); await new Promise(r => setTimeout(r, 1000));
        } else logMessage(`Mais l'attaque a raté...`);
        return { flinched: false };
    }

    if (USELESS_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        logMessage(`Mais il ne se passe rien...`);
        await new Promise(r => setTimeout(r, 800)); return { flinched: false };
    }

    if (HEAL_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        let healAmount = Math.floor(attacker.battleStats.maxHp / 2);
        attacker.battleStats.hp = Math.min(attacker.battleStats.maxHp, attacker.battleStats.hp + healAmount);
        logMessage(`<span style="color:#2ecc71">${aName} regagne des PV !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 800)); return { flinched: false };
    }

    if (STATUS_CONDITIONS[move.nameEn]) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        let statObj = STATUS_CONDITIONS[move.nameEn];
        
        if (Math.random() * 100 <= statObj.chance) {
            let targetEntity = (statObj.status === 'CNF' && move.nameEn === 'swagger') ? defender : defender; 
            applyStatus(targetEntity, statObj, defName);
            if(statObj.stat) {
                targetEntity.modifiers[statObj.stat] = Math.max(-6, Math.min(6, targetEntity.modifiers[statObj.stat] + statObj.stage));
                if (statObj.stage > 0) logMessage(`<span style="color:#3498db">${EXTENDED_STAT_NAMES[statObj.stat]} de ${defName} augmente !</span>`);
                else logMessage(`<span style="color:#e74c3c">${EXTENDED_STAT_NAMES[statObj.stat]} de ${defName} diminue !</span>`);
            }
        } else logMessage(`Mais l'attaque a raté...`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 800)); return { flinched: false };
    }

    if (move.damageClass === "status" || STATUS_MOVES[move.nameEn]) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        const statusData = STATUS_MOVES[move.nameEn];
        if (statusData) {
            let targetEntity = statusData.target === "enemy" ? defender : attacker;
            let targetName = statusData.target === "enemy" ? defName : aName;
            for (let effect of statusData.effects) {
                targetEntity.modifiers[effect.stat] = Math.max(-6, Math.min(6, targetEntity.modifiers[effect.stat] + effect.stage));
                let statName = EXTENDED_STAT_NAMES[effect.stat];
                if (effect.stage > 0) logMessage(`<span style="color:#3498db">${statName} de ${targetName} augmente !</span>`);
                else logMessage(`<span style="color:#e74c3c">${statName} de ${targetName} diminue !</span>`);
            }
        }
        updateBattleUI(); await new Promise(r => setTimeout(r, 800)); return { flinched: false }; 
    }

    let hitCount = 1;
    if (MULTI_HIT_2_5.includes(move.nameEn)) {
        const rng = Math.random();
        if (rng < 0.35) hitCount = 2; else if (rng < 0.7) hitCount = 3; else if (rng < 0.85) hitCount = 4; else hitCount = 5;
    } else if (MULTI_HIT_2.includes(move.nameEn)) { hitCount = 2; }

    let totalDamage = 0;
    for (let i = 0; i < hitCount; i++) {
        if (defender.battleStats.hp <= 0) break;

        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 400)); 

        let damage = 0; let isCrit = false; let mult = 1;

        if (FIXED_DAMAGE_MOVES[move.nameEn] !== undefined) {
            let val = FIXED_DAMAGE_MOVES[move.nameEn];
            damage = val === "level" ? (attacker.level || 1) : val;
            mult = getEffectiveness(move.type, defender.battleStats.types);
            if (mult === 0) damage = 0; 
        } else {
            let critChance = HIGH_CRIT_MOVES.includes(move.nameEn) ? 0.125 : 0.0625;
            isCrit = Math.random() < critChance; 
            let level = attacker.level || 1;
            let A = move.damageClass === 'special' ? getEffectiveStat(attacker, 'spatk') : getEffectiveStat(attacker, 'atk');
            let D = move.damageClass === 'special' ? getEffectiveStat(defender, 'spdef') : getEffectiveStat(defender, 'def');
            
            if (attacker.status === 'BRN' && move.damageClass === 'physical') A = Math.floor(A / 2);
            if (KAMIKAZE_MOVES.includes(move.nameEn)) A *= 1.5;

            // BONUS/MALUS DE MÉTÉO SUR LES DÉGÂTS
            let weatherMult = 1;
            if (currentWeather === 'sun') { if (move.type === 'fire') weatherMult = 1.5; if (move.type === 'water') weatherMult = 0.5; }
            if (currentWeather === 'rain') { if (move.type === 'water') weatherMult = 1.5; if (move.type === 'fire') weatherMult = 0.5; }

            let baseDmg = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * move.power * A / D) / 50) + 2;
            let stab = attacker.battleStats.types.includes(move.type) ? 1.5 : 1;
            mult = getEffectiveness(move.type, defender.battleStats.types);
            let random = (Math.random() * (1 - 0.85) + 0.85);
            let critMult = isCrit ? 1.5 : 1;

            damage = Math.floor(baseDmg * stab * mult * weatherMult * random * critMult);
            if (mult === 0) damage = 0; else damage = Math.max(1, damage);
        }

        defender.battleStats.hp -= damage;
        totalDamage += damage;
        playAnimation(isPlayer ? 'enemy-sprite' : 'player-sprite', 'anim-damage');

        if (damage > 0 && isCrit && hitCount === 1) logMessage(`<span style="color:#f39c12">Coup critique !</span>`);
        
        if (i === hitCount - 1) { 
            if (mult > 1) logMessage(`C'est super efficace !`);
            else if (mult > 0 && mult < 1) logMessage(`Ce n'est pas très efficace.`);
            else if (mult === 0 && move.power > 0) logMessage(`Ça n'a aucun effet...`);
        }
        updateBattleUI();
        await new Promise(r => setTimeout(r, 400));
    }

    if (hitCount > 1 && totalDamage > 0) logMessage(`Touché ${hitCount} fois !`);
    if (totalDamage > 0) logMessage(`(${totalDamage} dégâts)`);

    if (KAMIKAZE_MOVES.includes(move.nameEn)) {
        attacker.battleStats.hp = 0; logMessage(`<span style="color:#e74c3c">${aName} se sacrifie !</span>`); updateBattleUI();
    }

    if (move.nameEn === "fake-out" && defender.battleStats.hp > 0 && totalDamage > 0) defender.flinched = true;

    if (totalDamage > 0 && defender.battleStats.hp > 0) {
        if (DRAIN_MOVES.includes(move.nameEn)) {
            let drainHeal = Math.max(1, Math.floor(totalDamage / 2));
            attacker.battleStats.hp = Math.min(attacker.battleStats.maxHp, attacker.battleStats.hp + drainHeal);
            logMessage(`<span style="color:#2ecc71">${defName} voit son énergie aspirée !</span>`);
        }
        
        if (RECOIL_MOVES.includes(move.nameEn)) {
            let recoilDmg = Math.max(1, Math.floor(totalDamage / 3));
            attacker.battleStats.hp -= recoilDmg;
            logMessage(`<span style="color:#e74c3c">${aName} est blessé par le contrecoup !</span>`);
        }

        const secEffect = SECONDARY_EFFECTS[move.nameEn];
        if (secEffect && Math.random() <= secEffect.chance) {
            let targetEntity = secEffect.target === "enemy" ? defender : attacker;
            let targetName = secEffect.target === "enemy" ? defName : aName;
            for (let effect of secEffect.effects) {
                targetEntity.modifiers[effect.stat] = Math.max(-6, Math.min(6, targetEntity.modifiers[effect.stat] + effect.stage));
                let statName = EXTENDED_STAT_NAMES[effect.stat];
                if (effect.stage > 0) logMessage(`<span style="color:#3498db">${statName} de ${targetName} augmente !</span>`);
                else logMessage(`<span style="color:#e74c3c">${statName} de ${targetName} diminue !</span>`);
            }
        }

        const secStatus = SECONDARY_STATUS[move.nameEn];
        if (secStatus && Math.random() * 100 <= secStatus.chance) applyStatus(defender, secStatus, defName);
    }

    updateBattleUI();
    let flinched = false;
    if (FLINCH_MOVES.includes(move.nameEn) && totalDamage > 0 && Math.random() < 0.3) defender.flinched = true;

    await new Promise(r => setTimeout(r, 600));
    return { flinched, forceFlee: false };
}

export async function processTurn(playerMove) {
    if (isAnimating || !currentEnemy || currentEnemy.battleStats.hp <= 0 || activeFighter.battleStats.hp <= 0) return;
    isAnimating = true;
    toggleMoves(true);

    activeFighter.isProtected = false; currentEnemy.isProtected = false;
    activeFighter.flinched = false; currentEnemy.flinched = false;

    let pPriority = PRIORITY_MOVES.includes(playerMove.nameEn) ? 1 : 0;
    if (playerMove.nameEn === "fake-out") pPriority = 3;
    if (PROTECT_MOVES_LIST.includes(playerMove.nameEn)) pPriority = 4;

    let eMoves = currentEnemy.battleMoves || currentEnemy.moves;
    let bestEnemyMove = eMoves[0];
    let maxExpectedDamage = -1;
    
    eMoves.forEach(m => {
        let expected = 0;
        if (USELESS_MOVES.includes(m.nameEn) || FORCE_FLEE_MOVES.includes(m.nameEn) || STAT_CLEAR_MOVES.includes(m.nameEn)) {
            expected = -1;
        } else if (HEAL_MOVES.includes(m.nameEn)) {
            if (currentEnemy.battleStats.hp < currentEnemy.battleStats.maxHp / 2) expected = 1000;
            else expected = -1;
        } else if (m.damageClass === "status" || STATUS_CONDITIONS[m.nameEn] || WEATHER_MOVES_DICT[m.nameEn] || ACCURACY_DROPS.includes(m.nameEn)) {
            if (Math.random() < 0.2 && maxExpectedDamage < 10) expected = 10;
        } else if (m.nameEn === "transform") {
            expected = 20; 
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
    if (bestEnemyMove.nameEn === "fake-out") ePriority = 3;
    if (PROTECT_MOVES_LIST.includes(bestEnemyMove.nameEn)) ePriority = 4;
    
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
        if (pResult && pResult.forceFlee) { fleeBattle(true); return; }
        if (currentEnemy.battleStats.hp > 0 && activeFighter.battleStats.hp > 0) await executeMove(currentEnemy, activeFighter, bestEnemyMove, false);
    } else {
        let eResult = await executeMove(currentEnemy, activeFighter, bestEnemyMove, false);
        if (eResult && eResult.forceFlee) { fleeBattle(true); return; }
        if (activeFighter.battleStats.hp > 0 && currentEnemy.battleStats.hp > 0) await executeMove(activeFighter, currentEnemy, playerMove, true);
    }

    // ÉVALUATION DES DÉGÂTS DE FIN DE TOUR (Statuts + Météo)
    if (activeFighter.battleStats.hp > 0) await applyEndTurnStatus(activeFighter, currentEnemy, true);
    if (currentEnemy.battleStats.hp > 0) await applyEndTurnStatus(currentEnemy, activeFighter, false);

    if (currentWeather !== 'none') {
        weatherTurns--;
        if (weatherTurns <= 0) {
            logMessage(`<b>La météo redevient normale.</b>`);
            currentWeather = 'none';
        } else {
            if (activeFighter.battleStats.hp > 0) await applyWeatherDamage(activeFighter, currentWeather, true);
            if (currentEnemy.battleStats.hp > 0) await applyWeatherDamage(currentEnemy, currentWeather, false);
        }
        updateBattleUI();
        await new Promise(r => setTimeout(r, 600));
    }

    if (currentEnemy.battleStats.hp <= 0) {
        await winBattle();
    } else if (activeFighter.battleStats.hp <= 0) {
        let pName = state.currentLang === 'en' ? activeFighter.data.en : activeFighter.data.fr;
        if (activeFighter.mega) pName = formatMegaName(pName, activeFighter.megaForm);
        let msgFaint = state.currentLang === 'en' ? `<span class="text-danger">${pName} fainted! You flee...</span>` : `<span class="text-danger">${pName} est K.O. ! Vous fuyez en urgence...</span>`;
        logMessage(msgFaint);
        setTimeout(() => { if (onBattleEndCallback) onBattleEndCallback(); }, 2500);
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
        let displayPower = (newMove.damageClass === "status" || USELESS_MOVES.includes(newMove.nameEn) || FORCE_FLEE_MOVES.includes(newMove.nameEn) || STAT_CLEAR_MOVES.includes(newMove.nameEn) || OHKO_MOVES.includes(newMove.nameEn)) ? "-" : newMove.power;
        if(FIXED_DAMAGE_MOVES[newMove.nameEn]) displayPower = "FIX";
        
        let promptText = state.currentLang === 'en' 
            ? `<b>${pName}</b> wants to learn <b class="text-accent">${mName}</b> (POW ${displayPower}).<br>But it already knows 4 moves! Which move should be forgotten?` 
            : `<b>${pName}</b> veut apprendre <b class="text-accent">${mName}</b> (POW ${displayPower}).<br>Mais il connaît déjà 4 capacités ! Laquelle oublier ?`;
        
        text.innerHTML = promptText;
        list.innerHTML = '';
        
        activeFighter.moves.forEach((m, index) => {
            const btn = document.createElement('button');
            btn.className = `move-btn type-${m.type}`;
            let currentMName = state.currentLang === 'en' ? m.nameEn : m.nameFr;
            let mPow = (m.damageClass === "status" || USELESS_MOVES.includes(m.nameEn) || FORCE_FLEE_MOVES.includes(m.nameEn) || STAT_CLEAR_MOVES.includes(m.nameEn) || OHKO_MOVES.includes(m.nameEn)) ? "-" : m.power;
            if(FIXED_DAMAGE_MOVES[m.nameEn]) mPow = "FIX";
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
        
        function closeModal() { modal.classList.add('hidden'); resolve(); }
        modal.classList.remove('hidden'); applyTranslation();
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
    
    if (currentLvl >= maxLvl) { currentLvl = maxLvl; currentXp = 0; }
    
    activeFighter.level = currentLvl;
    activeFighter.xp = currentXp;
    
    if (leveledUp) {
        logMessage(state.currentLang === 'en' ? `<span class="text-accent font-bold">🎉 LEVEL UP! (Level ${currentLvl})</span>` : `<span class="text-accent font-bold">🎉 NIVEAU SUPÉRIEUR ! (Niveau ${currentLvl})</span>`);
        await handleLevelUpMoves(oldLvl, currentLvl);
        if (currentLvl === maxLvl) logMessage(state.currentLang === 'en' ? `<span class="text-danger">Max Rank reached! Merge duplicates in Collection to go higher.</span>` : `<span class="text-danger">Rang Max atteint ! Fusionnez des doublons dans la collection pour aller plus haut.</span>`);
    }
    
    updateBattleUI();
    renderMovesUI(); 
    
    try { await db.collection('users').doc(state.currentUser).update({ collection: state.currentUserData.collection }); } catch(e) {}
    
    setTimeout(() => { if(onBattleEndCallback) onBattleEndCallback(); }, 4000);
}