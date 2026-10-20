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

let activeFighter = null;
let currentEnemy = null;
let isAnimating = false;
let onBattleEndCallback = null;

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
    
    // Impact de la Paralysie sur la Vitesse
    if (statName === 'speed' && entity.status === 'PAR') finalStat = Math.floor(finalStat / 2);
    return finalStat;
}

export async function startBattle(zone, fighter, onEnd) {
    activeFighter = fighter;
    onBattleEndCallback = onEnd;
    isAnimating = false;

    document.getElementById('enemy-name').textContent = "Recherche...";
    document.getElementById('enemy-sprite').src = "";
    let msgStart = state.currentLang === 'en' ? `You walk into ${zone.name}...` : `Vous marchez dans la zone : ${zone.name}...`;
    document.getElementById('battle-log').innerHTML = msgStart;
    document.getElementById('moves-container').innerHTML = `<p style="color:#aaa; text-align:center; grid-column: span 2; margin-top:20px;">Chargement des capacités...</p>`;

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
        status: null, statusTurns: 0, confusion: 0, toxCount: 0,
        sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${wId}.png`
    };
    currentEnemy.battleStats.types = wDetails.types;

    if (!activeFighter.evs) activeFighter.evs = { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };
    
    activeFighter.battleStats = calcStats(pDetails.baseStats, activeFighter.level || 1, activeFighter.evs);
    activeFighter.battleStats.types = pDetails.types;
    activeFighter.modifiers = { atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };
    activeFighter.status = null; activeFighter.statusTurns = 0; activeFighter.confusion = 0; activeFighter.toxCount = 0;

    currentEnemy.moves = await getMovesForLevel(wId, wLevel);
    if (!activeFighter.moves || activeFighter.moves.length === 0) {
        activeFighter.moves = await getMovesForLevel(activeFighter.pokedexNumber, activeFighter.level || 1);
        db.collection('users').doc(state.currentUser).update({ collection: state.currentUserData.collection });
    }
    
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
    setTimeout(() => {
        if(onBattleEndCallback) onBattleEndCallback();
    }, forced ? 2000 : 1500);
}

function renderMovesUI() {
    const container = document.getElementById('moves-container');
    container.innerHTML = "";
    
    activeFighter.moves.forEach(move => {
        const btn = document.createElement('button');
        btn.className = `move-btn type-${move.type}`;
        const moveName = state.currentLang === 'en' ? move.nameEn : move.nameFr;
        
        let displayPower = (move.damageClass === "status" || USELESS_MOVES.includes(move.nameEn) || FORCE_FLEE_MOVES.includes(move.nameEn) || STAT_CLEAR_MOVES.includes(move.nameEn) || OHKO_MOVES.includes(move.nameEn)) ? "-" : move.power;
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

// Fonction pour appliquer un statut (Principal ou Secondaire)
function applyStatus(target, statusObj, targetName) {
    if (statusObj.status === 'CNF') {
        if (target.confusion === 0) {
            target.confusion = Math.floor(Math.random() * 4) + 2;
            logMessage(`<span style="color:#e67e22">${state.currentLang === 'en' ? `${targetName} became confused!` : `${targetName} devient confus !`}</span>`);
        }
    } else {
        if (!target.status) {
            target.status = statusObj.status;
            target.toxCount = 0;
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

// Vérifications avant l'attaque (Sommeil, Paralysie, Confusion, Gel)
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

// Dégâts de fin de tour (Brûlure, Poison)
async function applyEndTurnStatus(entity, isPlayer) {
    if (entity.battleStats.hp <= 0) return;
    let name = isPlayer ? (state.currentLang === 'en' ? entity.data.en : entity.data.fr) : (state.currentLang === 'en' ? entity.nameEn : entity.nameFr);
    
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
}

async function executeMove(attacker, defender, move, isPlayer) {
    if(attacker.battleStats.hp <= 0 || defender.battleStats.hp <= 0) return { flinched: false };

    let canAttack = await preMoveCheck(attacker, isPlayer);
    if(!canAttack) return { flinched: false };

    let aName = isPlayer ? (state.currentLang === 'en' ? attacker.data.en : attacker.data.fr) : (state.currentLang === 'en' ? attacker.nameEn : attacker.nameFr);
    if (isPlayer && attacker.mega) aName = formatMegaName(aName, attacker.megaForm);
    let defName = isPlayer ? (state.currentLang === 'en' ? defender.nameEn : defender.nameFr) : (state.currentLang === 'en' ? defender.data.en : defender.data.fr);
    let mName = state.currentLang === 'en' ? move.nameEn : move.nameFr;
    let colorClass = isPlayer ? "var(--accent)" : "var(--danger)";
    
    logMessage(`<b>${aName}</b> ${state.currentLang === 'en'?'uses':'utilise'} <b style="color:${colorClass};">${mName}</b> !`);
    
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
        logMessage(`<span style="color:#3498db">${state.currentLang === 'en' ? `All stat changes were eliminated!` : `Tous les changements de stats sont annulés !`}</span>`);
        updateBattleUI();
        await new Promise(r => setTimeout(r, 800));
        return { flinched: false };
    }

    if (OHKO_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        if (Math.random() < 0.30) {
            defender.battleStats.hp = 0;
            logMessage(`<span style="color:#f39c12">${state.currentLang === 'en' ? "It's a One-Hit KO!" : "K.O. en un coup !"}</span>`);
            playAnimation(isPlayer ? 'enemy-sprite' : 'player-sprite', 'anim-damage');
            updateBattleUI();
            await new Promise(r => setTimeout(r, 1000));
        } else {
            logMessage(state.currentLang === 'en' ? `But it failed...` : `Mais l'attaque a raté...`);
        }
        return { flinched: false };
    }

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

    if (STATUS_CONDITIONS[move.nameEn]) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');
        await new Promise(r => setTimeout(r, 600));
        let statObj = STATUS_CONDITIONS[move.nameEn];
        
        if (Math.random() * 100 <= statObj.chance) {
            let targetEntity = (statObj.status === 'CNF' && move.nameEn === 'swagger') ? defender : defender; 
            applyStatus(targetEntity, statObj, defName);
            
            if(statObj.stat) {
                targetEntity.modifiers[statObj.stat] = Math.max(-6, Math.min(6, targetEntity.modifiers[statObj.stat] + statObj.stage));
                let statName = state.currentLang === 'en' ? STAT_NAMES.en[statObj.stat] : STAT_NAMES.fr[statObj.stat];
                if (statObj.stage > 0) logMessage(`<span style="color:#3498db">${state.currentLang === 'en' ? `${defName}'s${statName} rose!` : `${statName} de${defName} augmente !`}</span>`);
            }
        } else {
            logMessage(state.currentLang === 'en' ? `But it failed...` : `Mais l'attaque a raté...`);
        }
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
        }
        updateBattleUI();
        await new Promise(r => setTimeout(r, 800));
        return { flinched: false }; 
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

        let damage = 0;
        let isCrit = false;
        let mult = 1;

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
            
            // Impact de la Brûlure sur les dégâts physiques
            if (attacker.status === 'BRN' && move.damageClass === 'physical') A = Math.floor(A / 2);
            if (KAMIKAZE_MOVES.includes(move.nameEn)) A *= 1.5;

            let baseDmg = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * move.power * A / D) / 50) + 2;
            let stab = attacker.battleStats.types.includes(move.type) ? 1.5 : 1;
            mult = getEffectiveness(move.type, defender.battleStats.types);
            let random = (Math.random() * (1 - 0.85) + 0.85);
            let critMult = isCrit ? 1.5 : 1;

            damage = Math.floor(baseDmg * stab * mult * random * critMult);
            if (mult === 0) damage = 0; else damage = Math.max(1, damage);
        }

        defender.battleStats.hp -= damage;
        totalDamage += damage;
        playAnimation(isPlayer ? 'enemy-sprite' : 'player-sprite', 'anim-damage');

        if (damage > 0 && isCrit && hitCount === 1) logMessage(state.currentLang === 'en' ? `<span style="color:#f39c12">A critical hit!</span>` : `<span style="color:#f39c12">Coup critique !</span>`);
        
        if (i === hitCount - 1) { 
            if (mult > 1) logMessage(state.currentLang === 'en' ? `It's super effective!` : `C'est super efficace !`);
            else if (mult > 0 && mult < 1) logMessage(state.currentLang === 'en' ? `It's not very effective.` : `Ce n'est pas très efficace.`);
            else if (mult === 0) logMessage(state.currentLang === 'en' ? `It has no effect...` : `Ça n'a aucun effet...`);
        }
        updateBattleUI();
        await new Promise(r => setTimeout(r, 400));
    }

    if (hitCount > 1 && totalDamage > 0) logMessage(state.currentLang === 'en' ? `Hit ${hitCount} times!` : `Touché ${hitCount} fois !`);
    if (totalDamage > 0) logMessage(`(${totalDamage} ${state.currentLang === 'en' ? 'dmg' : 'dégâts'})`);

    if (KAMIKAZE_MOVES.includes(move.nameEn)) {
        attacker.battleStats.hp = 0;
        logMessage(`<span style="color:#e74c3c">${aName} ${state.currentLang === 'en' ? 'sacrificed itself!' : 'se sacrifie !'}</span>`);
        updateBattleUI();
    }

    if (totalDamage > 0 && defender.battleStats.hp > 0) {
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

        // Effets secondaires (Stats)
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

        // Effets secondaires (Statuts type Gel, Brûlure via Lance-Flammes...)
        const secStatus = SECONDARY_STATUS[move.nameEn];
        if (secStatus && Math.random() * 100 <= secStatus.chance) {
            applyStatus(defender, secStatus, defName);
        }
    }

    updateBattleUI();
    
    let flinched = false;
    if (FLINCH_MOVES.includes(move.nameEn) && totalDamage > 0 && Math.random() < 0.3) {
        flinched = true;
    }

    await new Promise(r => setTimeout(r, 600));
    return { flinched, forceFlee: false };
}

export async function processTurn(playerMove) {
    if (isAnimating || !currentEnemy || currentEnemy.battleStats.hp <= 0 || activeFighter.battleStats.hp <= 0) return;
    isAnimating = true;
    toggleMoves(true);

    let pPriority = PRIORITY_MOVES.includes(playerMove.nameEn) ? 1 : 0;
    let bestEnemyMove = currentEnemy.moves[0];
    let maxExpectedDamage = -1;
    
    currentEnemy.moves.forEach(m => {
        let expected = 0;
        if (USELESS_MOVES.includes(m.nameEn) || FORCE_FLEE_MOVES.includes(m.nameEn) || STAT_CLEAR_MOVES.includes(m.nameEn)) {
            expected = -1;
        } else if (HEAL_MOVES.includes(m.nameEn)) {
            if (currentEnemy.battleStats.hp < currentEnemy.battleStats.maxHp / 2) expected = 1000;
            else expected = -1;
        } else if (m.damageClass === "status" || STATUS_CONDITIONS[m.nameEn]) {
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
        if (pResult && pResult.forceFlee) { fleeBattle(true); return; }

        if (currentEnemy.battleStats.hp > 0 && activeFighter.battleStats.hp > 0) {
            if (pResult.flinched) {
                let eName = state.currentLang === 'en' ? currentEnemy.nameEn : currentEnemy.nameFr;
                logMessage(`<span style="color:#f39c12">${state.currentLang === 'en' ? `${eName} flinched and couldn't move!` : `${eName} a la trouille, il passe son tour !`}</span>`);
                await new Promise(r => setTimeout(r, 1000));
            } else {
                let eResult = await executeMove(currentEnemy, activeFighter, bestEnemyMove, false);
                if (eResult && eResult.forceFlee) { fleeBattle(true); return; }
            }
        }
    } else {
        let eResult = await executeMove(currentEnemy, activeFighter, bestEnemyMove, false);
        if (eResult && eResult.forceFlee) { fleeBattle(true); return; }

        if (activeFighter.battleStats.hp > 0 && currentEnemy.battleStats.hp > 0) {
            if (eResult.flinched) {
                let pName = state.currentLang === 'en' ? activeFighter.data.en : activeFighter.data.fr;
                if (activeFighter.mega) pName = formatMegaName(pName, activeFighter.megaForm);
                logMessage(`<span style="color:#f39c12">${state.currentLang === 'en' ? `${pName} flinched and couldn't move!` : `${pName} a la trouille, il passe son tour !`}</span>`);
                await new Promise(r => setTimeout(r, 1000));
            } else {
                let pResult = await executeMove(activeFighter, currentEnemy, playerMove, true);
                if (pResult && pResult.forceFlee) { fleeBattle(true); return; }
            }
        }
    }

    // Gestion des altérations de fin de tour (Brûlure, Poison)
    if (activeFighter.battleStats.hp > 0) await applyEndTurnStatus(activeFighter, true);
    if (currentEnemy.battleStats.hp > 0) await applyEndTurnStatus(currentEnemy, false);

    if (currentEnemy.battleStats.hp <= 0) {
        await winBattle();
    } else if (activeFighter.battleStats.hp <= 0) {
        let pName = state.currentLang === 'en' ? activeFighter.data.en : activeFighter.data.fr;
        if (activeFighter.mega) pName = formatMegaName(pName, activeFighter.megaForm);
        let msgFaint = state.currentLang === 'en' ? `<span class="text-danger">${pName} fainted! You flee...</span>` : `<span class="text-danger">${pName} est K.O. ! Vous fuyez en urgence...</span>`;
        logMessage(msgFaint);
        setTimeout(() => {
            if (onBattleEndCallback) onBattleEndCallback();
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
        if(onBattleEndCallback) onBattleEndCallback();
    }, 4000);
}