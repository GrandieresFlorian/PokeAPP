import { db } from '../firebase-config.js';
import { state } from '../state.js';
import { getCardImageUrl, getPokemonDetails, getEffectiveness, formatMegaName, getMovesForLevel, getMoveDetails } from '../utils.js';
import { applyTranslation } from './navController.js';
import { USELESS_MOVES, PRIORITY_MOVES, HEAL_MOVES, DRAIN_MOVES, RECOIL_MOVES, MULTI_HIT_2_5, MULTI_HIT_2, FLINCH_MOVES, SECONDARY_EFFECTS, STATUS_MOVES, STAT_NAMES } from '../data/campagneData.js';

let activeFighter = null;
let currentEnemy = null;
let isAnimating = false;
let onBattleEndCallback = null;

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
    return Math.floor(base * multiplier);
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

export function fleeBattle() {
    if(isAnimating) return;
    logMessage(state.currentLang === 'en' ? "You fled... 🏃" : "Vous prenez la fuite... 🏃");
    toggleMoves(true);
    setTimeout(() => {
        if(onBattleEndCallback) onBattleEndCallback();
    }, 1500);
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
        if(onBattleEndCallback) onBattleEndCallback();
    }, 4000);
}