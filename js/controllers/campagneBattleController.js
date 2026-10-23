import { db } from '../firebase-config.js';
import { state } from '../state.js';
import { getCardImageUrl, getPokemonDetails, formatMegaName, getMovesForLevel, getMoveDetails, TOUTES_LES_BAIES } from '../utils.js';
import { applyTranslation } from './navController.js';
import { 
    USELESS_MOVES, PRIORITY_MOVES, HEAL_MOVES, DRAIN_MOVES, RECOIL_MOVES, MULTI_HIT_2_5, MULTI_HIT_2, 
    FLINCH_MOVES, SECONDARY_EFFECTS, ROLLOUT_MOVES, STATUS_MOVES, STAT_NAMES, 
    OHKO_MOVES, KAMIKAZE_MOVES, FORCE_FLEE_MOVES, STAT_CLEAR_MOVES, FIXED_DAMAGE_MOVES,
    STATUS_CONDITIONS, SECONDARY_STATUS, ABILITIES_DB, POWDER_MOVES,
    TAUNT_MOVES, REST_MOVES, PAIN_SPLIT_MOVES, PERISH_SONG_MOVES, DESTINY_BOND_MOVES,
    COUNTER_MOVES, MIRROR_COAT_MOVES, BIDE_MOVES, ENCORE_MOVES, DISABLE_MOVES, WISH_MOVES
} from '../data/campagneData.js';
import { calcStats, getEffectiveStat, checkMoveHit, calculateDamage } from '../battleEngine.js';

let skillsDB = {};
fetch('skill.json').then(r => r.json()).then(d => skillsDB = d).catch(() => console.log("skill.json introuvable"));

// --- NOUVELLES MÉCANIQUES ---
const PROTECT_MOVES_LIST = ["protect", "detect"];
const SEED_MOVES_LIST = ["leech-seed"];
const ACCURACY_DROPS = ["smokescreen", "sand-attack", "flash", "kinesis", "mud-slap"];
const EVASION_UPS = ["double-team", "minimize"];
const TWO_TURN_INVUL_MOVES = ["fly", "dig", "dive", "bounce", "phantom-force"];
const TWO_TURN_CHARGE_MOVES = ["solar-beam", "sky-attack", "razor-wind", "skull-bash"];
const DELAYED_MOVES = ["future-sight", "doom-desire"];
const HAZARD_MOVES = ["stealth-rock", "spikes", "toxic-spikes", "sticky-web"];
const HAZARD_CLEAR_MOVES = ["defog", "rapid-spin"];
const SCREENS = ["reflect", "light-screen", "aurora-veil"];
const WINDS = ["tailwind", "trick-room"];
const TERRAINS = ["electric-terrain", "grassy-terrain", "misty-terrain", "psychic-terrain"];
const TRAP_MOVES = ["mean-look", "spider-web", "block"];
const BIND_MOVES = ["fire-spin", "whirlpool", "wrap", "clamp", "sand-tomb"];

const WEATHER_MOVES_DICT = {
    "sunny-day": { weather: "sun", msg: "Le soleil brille intensément ☀️ !" },
    "rain-dance": { weather: "rain", msg: "Il commence à pleuvoir 🌧️ !" },
    "sandstorm": { weather: "sandstorm", msg: "Une tempête de sable se lève 🌪️ !" },
    "hail": { weather: "hail", msg: "Il commence à grêler ❄️ !" }
};

const EXTENDED_STAT_NAMES = { ...STAT_NAMES.fr, accuracy: "Précision", evasion: "Esquive" };
let activeFighter = null;
let currentEnemy = null;
let currentZone = null;
let isAnimating = false;
let onBattleEndCallback = null;

// États globaux du combat PvE
let globalState = { weather: 'none', weatherTurns: 0, trickRoom: 0, terrain: 'none', terrainTurns: 0, delayedAttacks: [] };
let p1State = { hazards: { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false }, screens: { reflect: 0, lightScreen: 0, auroraVeil: 0, tailwind: 0 } };
let p2State = { hazards: { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false }, screens: { reflect: 0, lightScreen: 0, auroraVeil: 0, tailwind: 0 } };

const STATUS_COLORS = { "BRN": "#e67e22", "PSN": "#9b59b6", "TOX": "#8e44ad", "PAR": "#f1c40f", "FRZ": "#3498db", "SLP": "#2c3e50" };

export async function startBattle(zone, fighter, onEnd) {
    activeFighter = fighter;
    currentZone = zone;
    onBattleEndCallback = onEnd;
    isAnimating = false;
    
    globalState = { weather: 'none', weatherTurns: 0, trickRoom: 0, terrain: 'none', terrainTurns: 0, delayedAttacks: [] };
    p1State = { hazards: { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false }, screens: { reflect: 0, lightScreen: 0, auroraVeil: 0, tailwind: 0 } };
    p2State = { hazards: { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false }, screens: { reflect: 0, lightScreen: 0, auroraVeil: 0, tailwind: 0 } };

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
        nameEn: wData.en, nameFr: wData.fr, data: wData, level: wLevel,
        baseStats: wDetails.baseStats, battleStats: calcStats(wDetails.baseStats, wLevel),
        modifiers: { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0, evasion: 0 },
        status: null, statusTurns: 0, confusion: 0, toxCount: 0, rolloutCount: 0,
        turnsActive: 0, isProtected: false, protectCount: 0, isSeeded: false, flinched: false,
        chargingMove: null, invulnerable: false, trapped: false, bound: {name: null, turns: 0},
        sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${wId}.png`,
        talent: wData.abilities ? wData.abilities[Math.floor(Math.random() * wData.abilities.length)] : null,
        types: wDetails.types
    };

    if (!activeFighter.evs) activeFighter.evs = { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };
    activeFighter.battleStats = calcStats(pDetails.baseStats, activeFighter.level || 1, activeFighter.evs);
    activeFighter.modifiers = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0, accuracy: 0, evasion: 0 };
    activeFighter.status = null; activeFighter.statusTurns = 0; activeFighter.confusion = 0; activeFighter.toxCount = 0; activeFighter.rolloutCount = 0;
    activeFighter.turnsActive = 0; activeFighter.isProtected = false; activeFighter.protectCount = 0; activeFighter.isSeeded = false; activeFighter.flinched = false;
    activeFighter.chargingMove = null; activeFighter.invulnerable = false; activeFighter.trapped = false; activeFighter.bound = {name: null, turns: 0};
    activeFighter.transformedImage = null; activeFighter.types = pDetails.types;

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

    applyHazards(activeFighter, p1State);
    applyHazards(currentEnemy, p2State);
}

function applyHazards(entity, teamState) {
    let name = entity.data.fr;
    let types = entity.types || [];
    if (teamState.hazards.stealthRock) {
        let mult = getEffectiveness('rock', types);
        entity.battleStats.hp -= Math.max(1, Math.floor(entity.battleStats.maxHp * (0.125 * mult)));
        logMessage(`<span style="color:#e67e22">Les rochers pointus blessent ${name} !</span>`);
    }
    if (teamState.hazards.spikes > 0 && !types.includes('flying')) {
        let fraction = teamState.hazards.spikes === 1 ? 8 : (teamState.hazards.spikes === 2 ? 6 : 4);
        entity.battleStats.hp -= Math.max(1, Math.floor(entity.battleStats.maxHp / fraction));
        logMessage(`<span style="color:#7f8c8d">${name} se blesse sur les Picots !</span>`);
    }
    if (teamState.hazards.toxicSpikes > 0 && !types.includes('flying') && !types.includes('steel')) {
        if (types.includes('poison')) {
            teamState.hazards.toxicSpikes = 0;
            logMessage(`<span style="color:#9b59b6">${name} dissipe les Pics Toxik en entrant !</span>`);
        } else if (!entity.status) {
            entity.status = teamState.hazards.toxicSpikes === 1 ? 'PSN' : 'TOX';
            logMessage(`<span style="color:#8e44ad">${name} est empoisonné par les Pics Toxik !</span>`);
        }
    }
    if (teamState.hazards.stickyWeb && !types.includes('flying')) {
        entity.modifiers.speed = Math.max(-6, (entity.modifiers.speed || 0) - 1);
        logMessage(`<span style="color:#f1c40f">${name} est ralenti par la Toile Gluante !</span>`);
    }
}

export function fleeBattle(forced = false) {
    if(isAnimating && !forced) return;
    if(!forced) {
        if (activeFighter.trapped || activeFighter.bound.turns > 0) {
            logMessage(`<b>${activeFighter.data.fr}</b> est pris au piège et ne peut pas fuir !`);
            return;
        }
        logMessage(state.currentLang === 'en' ? "You fled... 🏃" : "Vous prenez la fuite... 🏃");
    }
    toggleMoves(true);
    setTimeout(() => { if(onBattleEndCallback) onBattleEndCallback(); }, forced ? 2000 : 1500);
}

function renderMovesUI() {
    const container = document.getElementById('moves-container');
    container.innerHTML = "";

    if (activeFighter.chargingMove) {
        container.innerHTML = `<button class="move-btn type-normal" disabled style="grid-column: span 2;">En attente d'attaque...</button>`;
        return;
    }

    // Fonction utilitaire pour générer le Tooltip
    const getTooltipHTML = (moveNameEn, moveNameFr, powerDisplay) => {
        let sData = skillsDB[moveNameEn] || {};
        let accStr = sData.accuracy ? sData.accuracy + "%" : "100%"; // Tirets ou 100% si immanquable
        let descStr = sData.desc || "Description inconnue.";
        return `
            <div class="move-tooltip">
                <strong style="color:#f1c40f;">${moveNameFr}</strong><br>
                <span style="font-size:0.7rem; color:#aaa;">Puis: ${powerDisplay} | Préc: ${accStr}</span><br>
                <div style="margin-top:5px; font-style:italic; line-height:1.2;">${descStr}</div>
            </div>`;
    };

    // -- FORCER ROULADE --
    if (activeFighter.rolloutCount > 0) {
        let rMove = activeFighter.moves.find(m => ROLLOUT_MOVES.includes(m.nameEn));
        if (rMove) {
            const btn = document.createElement('button');
            btn.className = `move-btn type-${rMove.type}`;
            let tooltipHTML = getTooltipHTML(rMove.nameEn, rMove.nameFr, rMove.power);
            btn.innerHTML = `<span class="move-name">${rMove.nameFr}</span><span style="font-size:0.7rem; font-weight:normal;">TOUR ${activeFighter.rolloutCount + 1}/5</span>${tooltipHTML}`;
            btn.style.gridColumn = "span 2";
            btn.onclick = () => processTurn(rMove);
            container.appendChild(btn);
            return;
        } else {
            activeFighter.rolloutCount = 0;
        }
    }

    let movesList = activeFighter.battleMoves || activeFighter.moves;
    movesList.forEach(move => {
        const btn = document.createElement('button');
        btn.className = `move-btn type-${move.type}`;
        const moveName = state.currentLang === 'en' ? move.nameEn : move.nameFr;
        let displayPower = (move.damageClass === "status" || move.nameEn === "transform" || USELESS_MOVES.includes(move.nameEn) || FORCE_FLEE_MOVES.includes(move.nameEn) || STAT_CLEAR_MOVES.includes(move.nameEn) || OHKO_MOVES.includes(move.nameEn) || PROTECT_MOVES_LIST.includes(move.nameEn) || SEED_MOVES_LIST.includes(move.nameEn) || WEATHER_MOVES_DICT[move.nameEn] || ACCURACY_DROPS.includes(move.nameEn) || EVASION_UPS.includes(move.nameEn) || HAZARD_MOVES.includes(move.nameEn) || HAZARD_CLEAR_MOVES.includes(move.nameEn) || SCREENS.includes(move.nameEn) || WINDS.includes(move.nameEn) || TERRAINS.includes(move.nameEn) || TRAP_MOVES.includes(move.nameEn)) ? "-" : move.power;
        if(FIXED_DAMAGE_MOVES[move.nameEn]) displayPower = "FIX";

        let tooltipHTML = getTooltipHTML(move.nameEn, moveName, displayPower);
        
        btn.innerHTML = `<span class="move-name" data-en="${move.nameEn}" data-fr="${move.nameFr}">${moveName}</span><span style="font-size:0.7rem; opacity:0.8; font-weight:normal;">POW ${displayPower}</span>${tooltipHTML}`;
        
        // --- BLOCAGES UI ---
        if (activeFighter.taunted && move.damageClass === 'status') {
            btn.disabled = true;
            btn.style.opacity = "0.4";
            btn.title = "Interdit sous l'effet de Provoc !";
        } else if (activeFighter.disabledMove && activeFighter.disabledMove.turns > 0 && activeFighter.disabledMove.name === move.nameEn) {
            btn.disabled = true;
            btn.style.opacity = "0.4";
            btn.title = "Capacité entravée !";
        } else {
            btn.onclick = () => processTurn(move);
        }
        
        container.appendChild(btn);
    });
}

function toggleMoves(disabled) {
    const btns = document.querySelectorAll('.move-btn');
    btns.forEach(b => b.disabled = disabled);
    document.getElementById('btn-battle-flee').disabled = disabled;
}

function updateGlobalFieldsUI() {
    let globalBanner = document.getElementById('global-banner');
    const logBox = document.getElementById('battle-log');
    
    if (!globalBanner && logBox) {
        globalBanner = document.createElement('div');
        globalBanner.id = 'global-banner';
        globalBanner.style.cssText = "text-align:center; font-weight:bold; padding:5px; margin-bottom:5px; border-radius:5px; transition: 0.3s; font-size:0.8rem;";
        logBox.parentNode.insertBefore(globalBanner, logBox);
    }
    
    if (globalBanner) {
        let texts = [];
        if (globalState.weather !== 'none') {
            if (globalState.weather === 'sun') texts.push("☀️ Soleil");
            if (globalState.weather === 'rain') texts.push("🌧️ Pluie");
            if (globalState.weather === 'sandstorm') texts.push("🌪️ Sable");
            if (globalState.weather === 'hail') texts.push("❄️ Grêle");
        }
        if (globalState.terrain !== 'none') texts.push(`🌍 Terrain ${globalState.terrain}`);
        if (globalState.trickRoom > 0) texts.push("🌀 Distorsion active");
        
        if (texts.length > 0) {
            globalBanner.style.display = 'block';
            globalBanner.style.background = "#34495e";
            globalBanner.style.color = "#ecf0f1";
            globalBanner.textContent = texts.join(' | ');
        } else {
            globalBanner.style.display = 'none';
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
    if (entity.bound && entity.bound.turns > 0) {
        let bindBadge = document.createElement('span');
        bindBadge.style.cssText = `background:#c0392b; color:#fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; margin-left:4px;`;
        bindBadge.textContent = "PIÉGÉ";
        container.appendChild(bindBadge);
    }
    for (let stat in entity.modifiers) {
        let stage = entity.modifiers[stat];
        if (stage !== 0) {
            let badge = document.createElement('span');
            badge.className = `mod-badge ${stage > 0 ? 'mod-up' : 'mod-down'}`;
            let statName = EXTENDED_STAT_NAMES[stat] || stat;
            badge.textContent = `${statName} ${stage > 0 ? '+' : ''}${stage}`;
            container.appendChild(badge);
        }
    }
}

function updateBattleUI() {
    updateGlobalFieldsUI();

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
    document.getElementById('enemy-sprite').style.opacity = currentEnemy.invulnerable ? "0.3" : "1";

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
    document.getElementById('player-sprite').style.opacity = activeFighter.invulnerable ? "0.3" : "1";
    
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
    let types = target.types || [];

    // IMMUNITÉS LIÉES AUX TYPES (Acier, Poison, Feu, Electrik, Glace)
    if ((statusObj.status === 'PSN' || statusObj.status === 'TOX') && (types.includes('poison') || types.includes('steel'))) return;
    if (statusObj.status === 'BRN' && types.includes('fire')) return;
    if (statusObj.status === 'PAR' && types.includes('electric')) return;
    if (statusObj.status === 'FRZ' && types.includes('ice')) return;

    if (statusObj.status === 'CNF') {
        if (target.confusion === 0) {
            target.confusion = Math.floor(Math.random() * 4) + 2;
            logMessage(`<span style="color:#e67e22">${targetName} devient confus !</span>`);
        }
    } else {
        if (!target.status) {
            target.status = statusObj.status; target.toxCount = 0;
            if (statusObj.status === 'SLP') target.statusTurns = Math.floor(Math.random() * 3) + 1;
            let msgs = { "BRN": "est brûlé !", "PSN": "est empoisonné !", "TOX": "est gravement empoisonné !", "PAR": "est paralysé !", "FRZ": "est gelé !", "SLP": "s'endort !" };
            logMessage(`<span style="color:${STATUS_COLORS[statusObj.status]}">${targetName} ${msgs[statusObj.status]}</span>`);
        }
    }
}
async function preMoveCheck(entity, isPlayer) {
    let name = isPlayer ? entity.data.fr : entity.nameFr;
    
    if (entity.status === 'FRZ') {
        if (Math.random() < 0.2) {
            entity.status = null; logMessage(`<span style="color:#3498db">${name} est dégelé !</span>`); updateBattleUI();
        } else {
            logMessage(`<span style="color:#3498db">${name} est complètement gelé !</span>`); return false;
        }
    }
    if (entity.status === 'SLP') {
        entity.statusTurns--;
        if (entity.statusTurns <= 0) {
            entity.status = null; logMessage(`<span style="color:#2c3e50">${name} se réveille !</span>`); updateBattleUI();
        } else {
            logMessage(`<span style="color:#2c3e50">${name} dort profondément.</span>`); return false;
        }
    }
    if (entity.status === 'PAR') {
        if (Math.random() < 0.25) {
            logMessage(`<span style="color:#f1c40f">${name} est paralysé ! Il ne peut pas attaquer !</span>`); return false;
        }
    }
    if (entity.confusion > 0) {
        entity.confusion--;
        if (entity.confusion === 0) {
            logMessage(`<span style="color:#e67e22">${name} n'est plus confus !</span>`);
        } else {
            logMessage(`<span style="color:#e67e22">${name} est confus !</span>`);
            if (Math.random() < 0.33) {
                playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
                await new Promise(r => setTimeout(r, 400));
                let dmg = Math.max(1, Math.floor(entity.battleStats.maxHp / 8)); 
                entity.battleStats.hp -= dmg;
                logMessage(`<span style="color:#e74c3c">Il se blesse dans sa confusion !</span>`);
                playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-damage');
                updateBattleUI(); await new Promise(r => setTimeout(r, 600)); return false;
            }
        }
    }
    return true;
}

async function applyEndTurnEffects(entity, opponent, isPlayer) {
    if (entity.battleStats.hp <= 0) return;
    let name = isPlayer ? entity.data.fr : entity.nameFr;
    
    if (entity.isSeeded && entity.battleStats.hp > 0) {
        let drain = Math.max(1, Math.floor(entity.battleStats.maxHp / 8));
        entity.battleStats.hp -= drain;
        opponent.battleStats.hp = Math.min(opponent.battleStats.maxHp, opponent.battleStats.hp + drain);
        logMessage(`<span style="color:#2ecc71">Vampigraine draine l'énergie de ${name} !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 600));
    }

    if (entity.bound && entity.bound.turns > 0) {
        let bindDmg = Math.max(1, Math.floor(entity.battleStats.maxHp / 8));
        entity.battleStats.hp -= bindDmg;
        entity.bound.turns--;
        logMessage(`<span style="color:#e74c3c">${name} souffre de l'étreinte de ${entity.bound.name} !</span>`);
        if (entity.bound.turns === 0) {
            entity.trapped = false;
            logMessage(`<b>${name} est libéré de ${entity.bound.name} !</b>`);
        }
        updateBattleUI(); await new Promise(r => setTimeout(r, 600));
    }

    // REQUIEM
    if (entity.perishCount > 0) {
        entity.perishCount--;
        if (entity.perishCount === 0) {
            entity.battleStats.hp = 0; 
            logMessage(`<b style="color:#34495e">Le compte à rebours de Requiem tombe à zéro pour ${name} !</b>`);
        } else {
            logMessage(`<span style="color:#7f8c8d">Le compte à rebours de Requiem de ${name} est à ${entity.perishCount}.</span>`);
        }
    }

    // DIMINUTION PROVOC & ENTRAVE
    if (entity.taunted && entity.taunted > 0) {
        entity.taunted--;
        if (entity.taunted === 0) logMessage(`<b>${name} n'est plus provoqué.</b>`);
    }
    if (entity.disabledMove && entity.disabledMove.turns > 0) {
        entity.disabledMove.turns--;
        if (entity.disabledMove.turns === 0) {
            logMessage(`<b>${name} n'est plus entravé !</b>`);
            entity.disabledMove = null;
        }
    }

    // RÉINITIALISATION LIEN DU DESTIN
    entity.destinyBond = false;

    if (entity.status === 'BRN') {
        entity.battleStats.hp -= Math.max(1, Math.floor(entity.battleStats.maxHp / 16));
        logMessage(`<span style="color:#e67e22">${name} souffre de sa brûlure !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 600));
    } else if (entity.status === 'PSN') {
        entity.battleStats.hp -= Math.max(1, Math.floor(entity.battleStats.maxHp / 8));
        logMessage(`<span style="color:#9b59b6">${name} souffre du poison !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 600));
    } else if (entity.status === 'TOX') {
        entity.toxCount++;
        entity.battleStats.hp -= Math.max(1, Math.floor((entity.battleStats.maxHp * entity.toxCount) / 16));
        logMessage(`<span style="color:#8e44ad">${name} souffre du poison grave !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 600));
    }

    entity.turnsActive = (entity.turnsActive || 0) + 1;
}

async function executeMove(attacker, defender, rawMove, isPlayer) {
    if(attacker.battleStats.hp <= 0 || defender.battleStats.hp <= 0) return { forceFlee: false };

    let canAttack = await preMoveCheck(attacker, isPlayer);
    if(!canAttack) return { forceFlee: false };

    if (attacker.flinched) {
        logMessage(`<span style="color:#f39c12">La peur l'empêche d'attaquer !</span>`);
        await new Promise(r => setTimeout(r, 800)); return { forceFlee: false };
    }

    let aName = isPlayer ? attacker.data.fr : attacker.nameFr;
    let defName = isPlayer ? defender.nameFr : defender.data.fr;
    let move = rawMove;

    // GESTION DES ATTAQUES À CHARGE / INVULNÉRABILITÉ
    if (attacker.chargingMove) {
        move = attacker.chargingMove;
        attacker.chargingMove = null;
        attacker.invulnerable = false;
        updateBattleUI();
    } else if (TWO_TURN_INVUL_MOVES.includes(move.nameEn)) {
        attacker.chargingMove = move; attacker.invulnerable = true;
        logMessage(`<b>${aName}</b> s'envole / disparaît / plonge !`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
    } else if (TWO_TURN_CHARGE_MOVES.includes(move.nameEn)) {
        if (move.nameEn === "solar-beam" && globalState.weather === "sun") { /* Lance Soleil attaque direct sous le soleil */ }
        else {
            attacker.chargingMove = move;
            logMessage(`<b>${aName}</b> se concentre / absorbe la lumière !`);
            await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
        }
    } else if (DELAYED_MOVES.includes(move.nameEn)) {
        globalState.delayedAttacks.push({ move: move, timer: 2, target: isPlayer ? 'p2' : 'p1' });
        logMessage(`<b>${aName}</b> a prévu une attaque dans le futur !`);
        await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
    }

    let colorClass = isPlayer ? "var(--accent)" : "var(--danger)";
    logMessage(`<b>${aName}</b> utilise <b style="color:${colorClass};">${move.nameFr}</b> !`);
    
    // --- MÉMORISATION POUR ENTRAVE ---
    attacker.lastUsedMove = move;

    if (defender.invulnerable) {
        logMessage(`Mais <b>${defName}</b> est introuvable ! L'attaque échoue.`);
        await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
    }

    if (POWDER_MOVES.includes(move.nameEn)) {
        let defTypes = defender.types || [];
        if (defTypes.includes('grass')) {
            logMessage(`Ça n'affecte pas les Pokémon Plante !`);
            await new Promise(r => setTimeout(r, 600)); 
            return { forceFlee: false };
        }
    }

    // TERRAINS / MÉTÉO / VENTS / ÉCRANS
    let myTeamState = isPlayer ? p1State : p2State;
    let opTeamState = isPlayer ? p2State : p1State;

    if (WEATHER_MOVES_DICT[move.nameEn]) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        globalState.weather = WEATHER_MOVES_DICT[move.nameEn].weather; globalState.weatherTurns = 5;
        logMessage(`<span style="color:#f39c12"><b>${WEATHER_MOVES_DICT[move.nameEn].msg}</b></span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 800)); return { forceFlee: false };
    }
    if (TERRAINS.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        globalState.terrain = move.nameEn; globalState.terrainTurns = 5;
        logMessage(`<span style="color:#f39c12"><b>Un ${move.nameFr} recouvre le champ de bataille !</b></span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 800)); return { forceFlee: false };
    }
    if (SCREENS.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        if (move.nameEn === "reflect") myTeamState.screens.reflect = 5;
        if (move.nameEn === "light-screen") myTeamState.screens.lightScreen = 5;
        if (move.nameEn === "aurora-veil" && globalState.weather === "hail") myTeamState.screens.auroraVeil = 5;
        logMessage(`<span style="color:#3498db">Un mur défensif protège l'équipe de ${aName} !</span>`);
        return { forceFlee: false };
    }
    if (WINDS.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        if (move.nameEn === "tailwind") { myTeamState.screens.tailwind = 4; logMessage(`Le vent souffle en faveur de ${aName} !`); }
        if (move.nameEn === "trick-room") { globalState.trickRoom = 5; logMessage(`<b>L'ordre des vitesses est inversé (Distorsion) !</b>`); }
        updateBattleUI(); return { forceFlee: false };
    }
    
    // PIÈGES D'ENTRÉE
    if (HAZARD_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        if (move.nameEn === "stealth-rock" && !opTeamState.hazards.stealthRock) { opTeamState.hazards.stealthRock = true; logMessage(`<span style="color:#e67e22">Des pierres pointues lévitent autour de l'équipe adverse !</span>`); }
        else if (move.nameEn === "spikes" && opTeamState.hazards.spikes < 3) { opTeamState.hazards.spikes++; logMessage(`<span style="color:#7f8c8d">Des Picots sont répandus sur le terrain adverse !</span>`); }
        else if (move.nameEn === "toxic-spikes" && opTeamState.hazards.toxicSpikes < 2) { opTeamState.hazards.toxicSpikes++; logMessage(`<span style="color:#8e44ad">Des Pics Toxik sont répandus sur le terrain adverse !</span>`); }
        else if (move.nameEn === "sticky-web" && !opTeamState.hazards.stickyWeb) { opTeamState.hazards.stickyWeb = true; logMessage(`<span style="color:#f1c40f">Une Toile Gluante tisse le terrain adverse !</span>`); }
        else { logMessage(`Mais cela échoue...`); }
        return { forceFlee: false };
    }

    if (HAZARD_CLEAR_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        myTeamState.hazards = { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false };
        logMessage(`<span style="color:#3498db">Les pièges sur le terrain sont balayés !</span>`);
        if (move.nameEn === "defog") {
            opTeamState.hazards = { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false };
            defender.modifiers.evasion = Math.max(-6, (defender.modifiers.evasion || 0) - 1);
        }
        return { forceFlee: false };
    }

    // PRÉCISION / ESQUIVE
    if (ACCURACY_DROPS.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        defender.modifiers.accuracy = Math.max(-6, (defender.modifiers.accuracy || 0) - 1);
        logMessage(`<span style="color:#e74c3c">La précision de ${defName} diminue !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 800)); return { forceFlee: false };
    }
    if (EVASION_UPS.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        attacker.modifiers.evasion = Math.min(6, (attacker.modifiers.evasion || 0) + 1);
        logMessage(`<span style="color:#3498db">L'esquive de ${aName} augmente !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 800)); return { forceFlee: false };
    }

    // --- CHECK ESQUIVE / PRÉCISION GLOBAL ---
    let isStatusOnSelf = move.damageClass === "status" && (EVASION_UPS.includes(move.nameEn) || HEAL_MOVES.includes(move.nameEn) || PROTECT_MOVES_LIST.includes(move.nameEn) || WISH_MOVES.includes(move.nameEn));
    if (!isStatusOnSelf && move.nameEn !== "transform") {
        if (!checkMoveHit(move, attacker.modifiers, defender.modifiers)) {
            logMessage(`<b>L'attaque a raté !</b>`);
            if (ROLLOUT_MOVES.includes(move.nameEn)) attacker.rolloutCount = 0; // BRISE LA CHAÎNE
            await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
        }
    }

    // PROTECT / ABRI
    if (PROTECT_MOVES_LIST.includes(move.nameEn)) {
        let chance = Math.pow(0.5, attacker.protectCount || 0);
        if (Math.random() < chance) {
            attacker.isProtected = true; attacker.protectCount = (attacker.protectCount || 0) + 1;
            logMessage(`<span style="color:#2ecc71">${aName} se protège !</span>`);
        } else {
            attacker.protectCount = 0; logMessage(`Mais cela échoue !`);
        }
        await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
    } else {
        attacker.protectCount = 0;
    }

    if (defender.isProtected) {
        logMessage(`<span style="color:#bdc3c7">${defName} s'est protégé contre l'attaque !</span>`);
        if (ROLLOUT_MOVES.includes(move.nameEn)) attacker.rolloutCount = 0; // BRISE LA CHAÎNE
        await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
    }

    // TRAPPING & Siphons
    if (TRAP_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        defender.trapped = true;
        logMessage(`<b>${defName} ne peut plus s'enfuir !</b>`);
        return { forceFlee: false };
    }
    if (BIND_MOVES.includes(move.nameEn)) {
        defender.trapped = true;
        defender.bound = { name: move.nameFr, turns: Math.floor(Math.random() * 2) + 4 };
        logMessage(`<span style="color:#e74c3c"><b>${defName} est piégé par ${move.nameFr} !</b></span>`);
    }

    // FAKE OUT
    if (move.nameEn === "fake-out") {
        if ((attacker.turnsActive || 0) > 0) { logMessage(`Mais cela échoue !`); return { forceFlee: false }; }
    }

    // TRANSFORM
    if (move.nameEn === "transform") {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        attacker.types = [...(defender.types || [])];
        attacker.battleStats.atk = defender.battleStats.atk; attacker.battleStats.def = defender.battleStats.def;
        attacker.battleStats.spatk = defender.battleStats.spatk; attacker.battleStats.spdef = defender.battleStats.spdef;
        attacker.battleStats.speed = defender.battleStats.speed;
        attacker.modifiers = JSON.parse(JSON.stringify(defender.modifiers || {}));
        attacker.battleMoves = JSON.parse(JSON.stringify(defender.battleMoves || defender.moves));
        attacker.transformedImage = isPlayer ? (defender.transformedImage || defender.sprite) : (defender.transformedImage || getCardImageUrl(defender));
        logMessage(`<span style="color:#9b59b6">${aName} se transforme en ${defName} !</span>`);
        updateBattleUI(); if (isPlayer) renderMovesUI(); 
        await new Promise(r => setTimeout(r, 800)); return { forceFlee: false };
    }

    // LEECH SEED
    if (SEED_MOVES_LIST.includes(move.nameEn)) {
        let defTypes = defender.types || [];
        if (defTypes.includes('grass')) logMessage(`Ça n'affecte pas les Pokémon Plante !`);
        else if (defender.isSeeded) logMessage(`${defName} est déjà infecté !`);
        else { defender.isSeeded = true; logMessage(`<span style="color:#2ecc71">${defName} est infecté par Vampigraine !</span>`); }
        await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
    }
    
    // FORCE FLEE
    if (FORCE_FLEE_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        logMessage(`Le combat prend fin subitement !`);
        return { forceFlee: true };
    }

    // STAT CLEAR
    if (STAT_CLEAR_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        for(let s in attacker.modifiers) attacker.modifiers[s] = 0;
        for(let s in defender.modifiers) defender.modifiers[s] = 0;
        logMessage(`<span style="color:#3498db">Tous les changements de stats sont annulés !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 800)); return { forceFlee: false };
    }

    // OHKO
    if (OHKO_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        if (Math.random() < 0.30) {
            defender.battleStats.hp = 0;
            logMessage(`<span style="color:#f39c12">K.O. en un coup !</span>`);
            playAnimation(isPlayer ? 'enemy-sprite' : 'player-sprite', 'anim-damage');
            updateBattleUI(); await new Promise(r => setTimeout(r, 1000));
        } else logMessage(`Mais l'attaque a raté...`);
        return { forceFlee: false };
    }

    // USELESS
    if (USELESS_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        logMessage(`Mais il ne se passe rien...`);
        await new Promise(r => setTimeout(r, 800)); return { forceFlee: false };
    }

    // HEAL
    if (HEAL_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        let healAmount = Math.floor(attacker.battleStats.maxHp / 2);
        attacker.battleStats.hp = Math.min(attacker.battleStats.maxHp, attacker.battleStats.hp + healAmount);
        logMessage(`<span style="color:#2ecc71">${aName} regagne des PV !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 800)); return { forceFlee: false };
    }

    // STATUS CONDITIONS
    if (STATUS_CONDITIONS[move.nameEn]) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
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
        updateBattleUI(); await new Promise(r => setTimeout(r, 800)); return { forceFlee: false };
    }

    // MANIPULATION MENTALE & CONTRES & K.O. SPÉCIAUX
    if (TAUNT_MOVES.includes(move.nameEn)) {
        defender.taunted = 3; 
        logMessage(`<span style="color:#e74c3c">${defName} est provoqué ! Il ne peut utiliser que des attaques offensives !</span>`);
        return { forceFlee: false };
    }
    if (ENCORE_MOVES.includes(move.nameEn)) {
        logMessage(`<span style="color:#9b59b6">${defName} est forcé de répéter son attaque !</span>`);
        return { forceFlee: false };
    }
    if (DISABLE_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        if (defender.lastUsedMove && (!defender.disabledMove || defender.disabledMove.turns === 0)) {
            defender.disabledMove = { name: defender.lastUsedMove.nameEn, turns: 4 };
            logMessage(`<span style="color:#9b59b6">La capacité ${defender.lastUsedMove.nameFr} de ${defName} a été entravée !</span>`);
        } else {
            logMessage(`Mais cela échoue !`);
        }
        updateBattleUI(); await new Promise(r => setTimeout(r, 800)); return { forceFlee: false };
    }
    if (COUNTER_MOVES.includes(move.nameEn)) {
        logMessage(`<b>${aName}</b> se prépare à riposter (Riposte) !`);
        return { forceFlee: false };
    }
    if (MIRROR_COAT_MOVES.includes(move.nameEn)) {
        logMessage(`<b>${aName}</b> se couvre d'un voile miroir !`);
        return { forceFlee: false };
    }
    if (BIDE_MOVES.includes(move.nameEn)) {
        logMessage(`<b>${aName}</b> encaisse les coups pour accumuler de l'énergie !`);
        return { forceFlee: false };
    }
    if (REST_MOVES.includes(move.nameEn)) {
        attacker.battleStats.hp = attacker.battleStats.maxHp; 
        attacker.status = 'SLP';
        attacker.statusTurns = 2;
        logMessage(`<span style="color:#2ecc71">${aName} s'endort pour restaurer ses PV !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
    }
    if (PAIN_SPLIT_MOVES.includes(move.nameEn)) {
        let avgHp = Math.floor((attacker.battleStats.hp + defender.battleStats.hp) / 2); 
        attacker.battleStats.hp = Math.min(attacker.battleStats.maxHp, avgHp);
        defender.battleStats.hp = Math.min(defender.battleStats.maxHp, avgHp);
        logMessage(`<span style="color:#9b59b6">Les PV des deux Pokémon sont mis en commun et divisés !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
    }
    if (PERISH_SONG_MOVES.includes(move.nameEn)) {
        if (!attacker.perishCount) attacker.perishCount = 4;
        if (!defender.perishCount) defender.perishCount = 4;
        logMessage(`<span style="color:#34495e">Tous les Pokémon entendent le Requiem... K.O. dans 3 tours !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
    }
    if (DESTINY_BOND_MOVES.includes(move.nameEn)) {
        attacker.destinyBond = true;
        logMessage(`<span style="color:#8e44ad">${aName} lie son destin à son adversaire !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
    }
    if (WISH_MOVES.includes(move.nameEn)) {
        myTeamState.wish = { timer: 2, amount: Math.floor(attacker.battleStats.maxHp / 2) };
        logMessage(`<span style="color:#2ecc71">${aName} fait un Vœu !</span>`);
        updateBattleUI(); await new Promise(r => setTimeout(r, 600)); return { forceFlee: false };
    }

    if (move.damageClass === "status" || STATUS_MOVES[move.nameEn]) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        const statusData = STATUS_MOVES[move.nameEn];
        if (statusData) {
            let targetEntity = statusData.target === "enemy" ? defender : attacker;
            let targetName = statusData.target === "enemy" ? defName : aName;
            for (let effect of statusData.effects) {
                targetEntity.modifiers[effect.stat] = Math.max(-6, Math.min(6, (targetEntity.modifiers[effect.stat]||0) + effect.stage));
                let statName = EXTENDED_STAT_NAMES[effect.stat];
                if (effect.stage > 0) logMessage(`<span style="color:#3498db">${statName} de ${targetName} augmente !</span>`);
                else logMessage(`<span style="color:#e74c3c">${statName} de ${targetName} diminue !</span>`);
            }
        }
        updateBattleUI(); await new Promise(r => setTimeout(r, 800)); return { forceFlee: false }; 
    }

    let hitCount = 1;
    if (MULTI_HIT_2_5.includes(move.nameEn)) hitCount = (Math.random() < 0.35) ? 2 : (Math.random() < 0.7 ? 3 : (Math.random() < 0.85 ? 4 : 5));
    else if (MULTI_HIT_2.includes(move.nameEn)) hitCount = 2;

    let totalDamage = 0;
    for (let i = 0; i < hitCount; i++) {
        if (defender.battleStats.hp <= 0) break;

        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 400)); 

        if (defender.battleStats.hp <= 0 && defender.destinyBond) {
            attacker.battleStats.hp = 0;
            logMessage(`<span style="color:#8e44ad">${defName} emporte ${aName} avec lui à cause du Lien du Destin !</span>`);
        }

        let dmgInfo = calculateDamage(attacker, defender, move, globalState.weather);
        let damage = dmgInfo.damage;
        let isCrit = dmgInfo.isCrit;
        let mult = dmgInfo.mult;

        // APPLICATION DES ÉCRANS (Dégâts divisés par 2)
        if (move.damageClass === 'physical' && opTeamState.screens.reflect > 0) damage = Math.floor(damage / 2);
        if (move.damageClass === 'special' && opTeamState.screens.lightScreen > 0) damage = Math.floor(damage / 2);
        if (opTeamState.screens.auroraVeil > 0) damage = Math.floor(damage / 2);

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

    if (totalDamage > 0 && defender.talent && ABILITIES_DB[defender.talent.en] && move.damageClass === "physical") {
        let abDef = ABILITIES_DB[defender.talent.en];
        if (abDef.type === "on_hit_status" && Math.random() * 100 <= abDef.statusObj.chance) {
            applyStatus(attacker, abDef.statusObj, aName);
            logMessage(`<span style="color:#8e44ad">${abDef.msg}</span>`);
            updateBattleUI();
        } else if (abDef.type === "on_hit_damage") {
            let recoil = Math.max(1, Math.floor(attacker.battleStats.maxHp / (100 / abDef.percent)));
            attacker.battleStats.hp -= recoil;
            logMessage(`<span style="color:#e74c3c">${abDef.msg}</span>`);
            updateBattleUI();
        }
    }

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

    let flinched = false;
    if (ROLLOUT_MOVES.includes(move.nameEn) && totalDamage > 0) {
        attacker.rolloutCount = (attacker.rolloutCount || 0) + 1;
        if (attacker.rolloutCount >= 5) attacker.rolloutCount = 0; 
    }
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
        
        // --- L'IA NE DOIT PAS UTILISER D'ATTAQUE ENTRAVÉE ---
        if (currentEnemy.disabledMove && currentEnemy.disabledMove.turns > 0 && currentEnemy.disabledMove.name === m.nameEn) {
            expected = -1;
        } else if (USELESS_MOVES.includes(m.nameEn) || FORCE_FLEE_MOVES.includes(m.nameEn) || STAT_CLEAR_MOVES.includes(m.nameEn)) {
            expected = -1;
        } else if (HEAL_MOVES.includes(m.nameEn) || WISH_MOVES.includes(m.nameEn)) {
            if (currentEnemy.battleStats.hp < currentEnemy.battleStats.maxHp / 2) expected = 1000;
            else expected = -1;
        } else if (m.damageClass === "status" || STATUS_CONDITIONS[m.nameEn] || WEATHER_MOVES_DICT[m.nameEn] || ACCURACY_DROPS.includes(m.nameEn) || HAZARD_MOVES.includes(m.nameEn) || SCREENS.includes(m.nameEn) || WINDS.includes(m.nameEn) || TERRAINS.includes(m.nameEn) || TRAP_MOVES.includes(m.nameEn)) {
            if (Math.random() < 0.2 && maxExpectedDamage < 10) expected = 10;
        } else if (m.nameEn === "transform") {
            expected = 20; 
        } else {
            let estDmgInfo = calculateDamage(currentEnemy, activeFighter, m, globalState.weather);
            expected = estDmgInfo.damage;
        }
        
        if (expected > maxExpectedDamage) {
            maxExpectedDamage = expected;
            bestEnemyMove = m;
        }
    });

    if (currentEnemy.chargingMove) bestEnemyMove = currentEnemy.chargingMove;
    if (currentEnemy.rolloutCount > 0) {
        let rMove = currentEnemy.moves.find(m => ROLLOUT_MOVES.includes(m.nameEn));
        if (rMove) bestEnemyMove = rMove;
    }

    let ePriority = PRIORITY_MOVES.includes(bestEnemyMove.nameEn) ? 1 : 0;
    if (bestEnemyMove.nameEn === "fake-out") ePriority = 3;
    if (PROTECT_MOVES_LIST.includes(bestEnemyMove.nameEn)) ePriority = 4;
    
    let playerGoesFirst;
    if (pPriority > ePriority) playerGoesFirst = true;
    else if (ePriority > pPriority) playerGoesFirst = false;
    else {
        let playerSpeed = getEffectiveStat(activeFighter, 'speed', globalState.weather) * (p1State.screens.tailwind > 0 ? 2 : 1);
        let enemySpeed = getEffectiveStat(currentEnemy, 'speed', globalState.weather) * (p2State.screens.tailwind > 0 ? 2 : 1);
        
        if (globalState.trickRoom > 0) {
            playerGoesFirst = playerSpeed <= enemySpeed;
        } else {
            playerGoesFirst = playerSpeed >= enemySpeed;
        }
        if (playerSpeed === enemySpeed) playerGoesFirst = Math.random() > 0.5;
    }

    if (playerGoesFirst) {
        let pResult = await executeMove(activeFighter, currentEnemy, playerMove, true);
        if (pResult && pResult.forceFlee) { fleeBattle(true); return; }
        
        if (currentEnemy.battleStats.hp > 0 && activeFighter.battleStats.hp > 0) {
            await new Promise(r => setTimeout(r, 400));
            let eResult = await executeMove(currentEnemy, activeFighter, bestEnemyMove, false);
            if (eResult && eResult.forceFlee) { fleeBattle(true); return; }
        }
    } else {
        let eResult = await executeMove(currentEnemy, activeFighter, bestEnemyMove, false);
        if (eResult && eResult.forceFlee) { fleeBattle(true); return; }
        
        if (activeFighter.battleStats.hp > 0 && currentEnemy.battleStats.hp > 0) {
            await new Promise(r => setTimeout(r, 400));
            let pResult = await executeMove(activeFighter, currentEnemy, playerMove, true);
            if (pResult && pResult.forceFlee) { fleeBattle(true); return; }
        }
    }

    // ÉVALUATION DES ÉVÈNEMENTS DE FIN DE TOUR
    if (activeFighter.battleStats.hp > 0) await applyEndTurnEffects(activeFighter, currentEnemy, true);
    if (currentEnemy.battleStats.hp > 0) await applyEndTurnEffects(currentEnemy, activeFighter, false);

    // Dégâts Météo
    if (globalState.weather !== 'none') {
        globalState.weatherTurns--;
        if (globalState.weatherTurns <= 0) {
            logMessage(`<b>La météo redevient normale.</b>`);
            globalState.weather = 'none';
        } else {
            let pTypes = activeFighter.types || [];
            if (globalState.weather === 'sandstorm' && !pTypes.includes('rock') && !pTypes.includes('ground') && !pTypes.includes('steel')) {
                activeFighter.battleStats.hp -= Math.max(1, Math.floor(activeFighter.battleStats.maxHp / 16));
                logMessage(`<span style="color:#e67e22">${activeFighter.data.fr} subit la tempête de sable !</span>`);
            }
            if (globalState.weather === 'hail' && !pTypes.includes('ice')) {
                activeFighter.battleStats.hp -= Math.max(1, Math.floor(activeFighter.battleStats.maxHp / 16));
                logMessage(`<span style="color:#bdc3c7">${activeFighter.data.fr} subit la grêle !</span>`);
            }
            
            let eTypes = currentEnemy.types || [];
            if (globalState.weather === 'sandstorm' && !eTypes.includes('rock') && !eTypes.includes('ground') && !eTypes.includes('steel')) {
                currentEnemy.battleStats.hp -= Math.max(1, Math.floor(currentEnemy.battleStats.maxHp / 16));
                logMessage(`<span style="color:#e67e22">${currentEnemy.data.fr} subit la tempête de sable !</span>`);
            }
            if (globalState.weather === 'hail' && !eTypes.includes('ice')) {
                currentEnemy.battleStats.hp -= Math.max(1, Math.floor(currentEnemy.battleStats.maxHp / 16));
                logMessage(`<span style="color:#bdc3c7">${currentEnemy.data.fr} subit la grêle !</span>`);
            }
        }
    }

    // Gestion des attaques à retardement (Prescience...)
    for (let i = globalState.delayedAttacks.length - 1; i >= 0; i--) {
        let da = globalState.delayedAttacks[i];
        da.timer--;
        if (da.timer <= 0) {
            let targetEntity = da.target === 'p1' ? activeFighter : currentEnemy;
            if (targetEntity.battleStats.hp > 0) {
                logMessage(`<b>L'attaque ${da.move.nameFr} frappe ${targetEntity.data.fr} depuis le futur !</b>`);
                let dmgInfo = calculateDamage({ level: 50, battleStats: {atk:100, spatk:100}, types:[] }, targetEntity, da.move, globalState.weather);
                targetEntity.battleStats.hp -= dmgInfo.damage;
            }
            globalState.delayedAttacks.splice(i, 1);
        }
    }

    // GESTION DU VŒU (WISH)
    if (p1State.wish && p1State.wish.timer > 0) {
        p1State.wish.timer--;
        if (p1State.wish.timer === 0 && activeFighter.battleStats.hp > 0) {
            activeFighter.battleStats.hp = Math.min(activeFighter.battleStats.maxHp, activeFighter.battleStats.hp + p1State.wish.amount);
            logMessage(`<span style="color:#2ecc71">Le Vœu s'est réalisé ! ${activeFighter.data.fr} regagne des PV.</span>`);
            p1State.wish = null;
        }
    }
    if (p2State.wish && p2State.wish.timer > 0) {
        p2State.wish.timer--;
        if (p2State.wish.timer === 0 && currentEnemy.battleStats.hp > 0) {
            currentEnemy.battleStats.hp = Math.min(currentEnemy.battleStats.maxHp, currentEnemy.battleStats.hp + p2State.wish.amount);
            logMessage(`<span style="color:#2ecc71">Le Vœu s'est réalisé ! ${currentEnemy.data.fr} regagne des PV.</span>`);
            p2State.wish = null;
        }
    }

    // Réduction des timers d'écrans
    ['reflect', 'lightScreen', 'auroraVeil', 'tailwind'].forEach(screen => {
        if (p1State.screens[screen] > 0) p1State.screens[screen]--;
        if (p2State.screens[screen] > 0) p2State.screens[screen]--;
    });
    if (globalState.trickRoom > 0) globalState.trickRoom--;
    if (globalState.terrainTurns > 0) {
        globalState.terrainTurns--;
        if (globalState.terrainTurns === 0) globalState.terrain = 'none';
    }

    updateBattleUI();

    if (currentEnemy.battleStats.hp <= 0) {
        await winBattle();
    } else if (activeFighter.battleStats.hp <= 0) {
        logMessage(`<span class="text-danger">${activeFighter.data.fr} est K.O. ! Vous fuyez en urgence...</span>`);
        setTimeout(() => { if (onBattleEndCallback) onBattleEndCallback(); }, 2500);
    } else {
        toggleMoves(false);
        renderMovesUI(); 
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
            logMessage(`✨ ${pName} a appris ${moveName} !`);
        } else {
            await promptLearnMove(moveData);
        }
    }
}

async function winBattle() {
    logMessage(`<b style="color:#2ecc71;">Le Pokémon sauvage est vaincu !</b>`);

    if (currentZone && currentZone.name === "Grotte Sombre" && (currentEnemy.data.id === 95 || currentEnemy.nameEn.toLowerCase() === "onix")) {
        if (!state.currentUserData.berries) state.currentUserData.berries = [];
        let repoiEntry = state.currentUserData.berries.find(b => b.id === 'repoi');
        
        if (repoiEntry) {
            repoiEntry.quantity = (repoiEntry.quantity || 1) + 1;
        } else {
            const baieDef = TOUTES_LES_BAIES.find(b => b.id === 'repoi');
            if (baieDef) {
                state.currentUserData.berries.push({
                    data: baieDef, id: 'repoi', date: Date.now(), quantity: 1
                });
            }
        }
        logMessage(`<span style="color:#f1c40f;">✨ Incroyable ! Le Onix sauvage a laissé tomber une <b>Baie Repoi</b> !</span>`);
    }
    
    let highestStat = 'hp';
    let highestValue = 0;
    for (const [stat, val] of Object.entries(currentEnemy.baseStats)) {
        if (val > highestValue) { highestValue = val; highestStat = stat; }
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
            logMessage(`<span style="color:#3498db; font-size:0.9rem;">+${evsToAdd} EV en ${statNamesFR[highestStat]} !</span>`);
        }
    }

    let xpGained = currentEnemy.level * 15;
    logMessage(`Vous gagnez <span class="text-accent">${xpGained} XP</span> !`);
    
    let oldLvl = activeFighter.level || 1;
    let currentLvl = activeFighter.level || 1;
    let currentXp = activeFighter.xp || 0;
    let maxLvl = activeFighter.maxLevel || 20;
    
    currentXp += xpGained;
    let xpNeeded = currentLvl * 100;
    let leveledUp = false;
    
    while (currentXp >= xpNeeded && currentLvl < maxLvl) {
        currentXp -= xpNeeded; currentLvl++; leveledUp = true; xpNeeded = currentLvl * 100;
    }
    
    if (currentLvl >= maxLvl) { currentLvl = maxLvl; currentXp = 0; }
    
    activeFighter.level = currentLvl; activeFighter.xp = currentXp;
    
    if (leveledUp) {
        logMessage(`<span class="text-accent font-bold">🎉 NIVEAU SUPÉRIEUR ! (Niveau ${currentLvl})</span>`);
        await handleLevelUpMoves(oldLvl, currentLvl);
    }
    
    updateBattleUI();
    renderMovesUI(); 
    
    try { 
        await db.collection('users').doc(state.currentUser).update({ 
            collection: state.currentUserData.collection,
            berries: state.currentUserData.berries || [] // <--- Sauvegarde des baies ajoutée
        }); 
    } catch(e) {}
    setTimeout(() => { if(onBattleEndCallback) onBattleEndCallback(); }, 4000);
}