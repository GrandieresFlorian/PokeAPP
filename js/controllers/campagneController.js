import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { getCardImageUrl, getPokemonDetails, getEffectiveness, formatMegaName, getMovesForLevel, getMoveDetails, TYPE_TRANSLATIONS } from '../utils.js';
import { allerASection, applyTranslation } from './navController.js';

// VRAIE CARTE DE KANTO AVEC LES TABLES D'APPARITION OFFICIELLES (Numéros du Pokédex)
const ZONES = [
    { id: "route1", name: "Route 1", minLvl: 2, maxLvl: 5, encounters: [16, 19] }, // Roucool, Rattata
    { id: "route2", name: "Route 2", minLvl: 3, maxLvl: 6, encounters: [10, 13, 16, 19, 29, 32] }, // Chenipan, Aspicot, Nidoran...
    { id: "foretjade", name: "Forêt de Jade", minLvl: 4, maxLvl: 8, encounters: [10, 11, 13, 14, 25] }, // + Pikachu
    { id: "route3", name: "Route 3", minLvl: 6, maxLvl: 10, encounters: [16, 19, 21, 27, 39, 56] }, // Piafabec, Sabelette, Rondoudou, Férosinge
    { id: "montselenite", name: "Mont Sélénite", minLvl: 8, maxLvl: 12, encounters: [27, 35, 41, 46, 74] }, // Mélofée, Nosferapti, Paras, Racaillou
    { id: "route4", name: "Route 4", minLvl: 10, maxLvl: 14, encounters: [19, 21, 23, 27, 56] }, // Abo
    { id: "route24", name: "Routes 24 & 25", minLvl: 10, maxLvl: 15, encounters: [10, 11, 13, 14, 16, 43, 63, 69] }, // Mystherbe, Abra, Chétiflor
    { id: "route5", name: "Routes 5 & 6", minLvl: 13, maxLvl: 17, encounters: [16, 43, 52, 56, 69] }, // + Miaouss
    { id: "cavetaupiqueur", name: "Cave Taupiqueur", minLvl: 15, maxLvl: 22, encounters: [50, 51] }, // Taupiqueur, Triopikeur
    { id: "route9", name: "Routes 9 & 10", minLvl: 14, maxLvl: 19, encounters: [19, 21, 23, 27, 66, 81, 100] }, // Machoc, Magnéti, Voltorbe
    { id: "grottesombre", name: "Grotte Sombre", minLvl: 16, maxLvl: 22, encounters: [41, 66, 74, 95] }, // + Onix
    { id: "lavanville", name: "Tour Pokémon", minLvl: 20, maxLvl: 26, encounters: [92, 93, 104] }, // Fantominus, Spectrum, Osselait
    { id: "route12", name: "Routes 12 à 15", minLvl: 22, maxLvl: 28, encounters: [16, 17, 43, 44, 48, 69, 70, 132] }, // Mimitoss, Métamorph
    { id: "pistecyclable", name: "Piste Cyclable", minLvl: 24, maxLvl: 30, encounters: [20, 22, 84, 88, 89, 109] }, // Doduo, Tadmorv, Smogo
    { id: "parcsafari", name: "Parc Safari", minLvl: 25, maxLvl: 35, encounters: [30, 33, 47, 48, 84, 102, 105, 111, 113, 114, 115, 123, 127, 128] }, // Leveinard, Insécateur, Scarabrute, Tauros...
    { id: "ilesecume", name: "Îles Écume", minLvl: 28, maxLvl: 36, encounters: [41, 42, 54, 55, 79, 80, 86, 87, 90, 98, 116, 124] }, // Otaria, Lippoutou, Krabby...
    { id: "manoir", name: "Manoir Pokémon", minLvl: 30, maxLvl: 38, encounters: [37, 58, 77, 88, 89, 109, 110, 126, 132] }, // Goupix, Caninos, Ponyta, Magmar
    { id: "centrale", name: "Centrale", minLvl: 32, maxLvl: 40, encounters: [25, 26, 81, 82, 88, 89, 100, 101, 125] }, // Élektek
    { id: "route21", name: "Chenal 21 (Surf)", minLvl: 25, maxLvl: 35, encounters: [72, 73, 114] }, // Tentacool, Tentacruel, Saquedeneu
    { id: "routevictoire", name: "Route Victoire", minLvl: 40, maxLvl: 50, encounters: [41, 42, 49, 66, 67, 74, 75, 95, 105] }, // Gravalanch, Machopeur, Nosferalto
    { id: "caverneazure", name: "Caverne Azurée", minLvl: 55, maxLvl: 65, encounters: [24, 26, 28, 40, 42, 47, 49, 64, 70, 85, 97, 105, 108, 112, 113, 114, 132] } // Kadabra, Rhinocorne, Excelangue...
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
    
    document.getElementById('btn-battle-flee').addEventListener('click', () => {
        if(isAnimating) return;
        logMessage(state.currentLang === 'en' ? "You fled... 🏃" : "Vous prenez la fuite... 🏃");
        toggleMoves(true);
        setTimeout(() => {
            document.getElementById('campagne-battle-arena').classList.add('hidden');
            document.getElementById('campagne-select-zone').classList.remove('hidden');
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

    Object.values(uniqueCardsMap).forEach(carte => {
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
    
    ZONES.forEach(z => {
        const div = document.createElement('div');
        div.className = "zone-card";
        div.innerHTML = `
            <h4>${z.name}</h4>
            <p><span class="translatable" data-fr="Niveau des Pokémon :" data-en="Pokémon Levels :">Niveau des Pokémon :</span> <span class="text-accent">${z.minLvl} - ${z.maxLvl}</span></p>
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

async function startBattle(zone) {
    document.getElementById('campagne-select-zone').classList.add('hidden');
    document.getElementById('campagne-battle-arena').classList.remove('hidden');
    
    document.getElementById('enemy-name').textContent = "Recherche...";
    document.getElementById('enemy-sprite').src = "";
    let msgStart = state.currentLang === 'en' ? `You walk into ${zone.name}...` : `Vous marchez dans la zone : ${zone.name}...`;
    document.getElementById('battle-log').innerHTML = msgStart;
    
    document.getElementById('moves-container').innerHTML = `<p style="color:#aaa; text-align:center; grid-column: span 2; margin-top:20px;">Chargement des capacités...</p>`;
    document.getElementById('btn-battle-flee').disabled = true;

    // NOUVEAU : Tirage aléatoire basé sur les apparitions exactes de la zone séléctionnée !
    const possibleEncounters = zone.encounters;
    const randomPokedexNumber = possibleEncounters[Math.floor(Math.random() * possibleEncounters.length)];
    const wData = state.pokemonDataList[randomPokedexNumber - 1]; // -1 car le tableau javascript commence à 0
    const wId = randomPokedexNumber;
    
    const wLevel = Math.floor(Math.random() * (zone.maxLvl - zone.minLvl + 1)) + zone.minLvl;
    
    const wDetails = await getPokemonDetails({ pokedexNumber: wId, mega: false });
    const pDetails = await getPokemonDetails(activeFighter);

    currentEnemy = {
        nameEn: wData.en,
        nameFr: wData.fr,
        level: wLevel,
        baseStats: wDetails.baseStats, 
        battleStats: calcStats(wDetails.baseStats, wLevel),
        sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${wId}.png`
    };
    currentEnemy.battleStats.types = wDetails.types;

    if (!activeFighter.evs) activeFighter.evs = { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 };
    
    activeFighter.battleStats = calcStats(pDetails.baseStats, activeFighter.level || 1, activeFighter.evs);
    activeFighter.battleStats.types = pDetails.types;

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
        
        btn.innerHTML = `<span class="move-name" data-en="${move.nameEn}" data-fr="${move.nameFr}">${moveName}</span><span style="font-size:0.7rem; opacity:0.8; font-weight:normal;">POW ${move.power}</span>`;
        btn.onclick = () => processTurn(move);
        container.appendChild(btn);
    });
}

function toggleMoves(disabled) {
    const btns = document.querySelectorAll('.move-btn');
    btns.forEach(b => b.disabled = disabled);
    document.getElementById('btn-battle-flee').disabled = disabled;
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
    if(attacker.battleStats.hp <= 0 || defender.battleStats.hp <= 0) return;

    let aName = isPlayer ? (state.currentLang === 'en' ? attacker.data.en : attacker.data.fr) : (state.currentLang === 'en' ? attacker.nameEn : attacker.nameFr);
    if (isPlayer && attacker.mega) aName = formatMegaName(aName, attacker.megaForm);
    
    let mName = state.currentLang === 'en' ? move.nameEn : move.nameFr;
    let colorClass = isPlayer ? "var(--accent)" : "var(--danger)";
    
    logMessage(`<b>${aName}</b> ${state.currentLang === 'en'?'uses':'utilise'} <b style="color:${colorClass};">${mName}</b> !`);
    playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack');

    await new Promise(r => setTimeout(r, 600));

    let isCrit = Math.random() < 0.0625; 
    let level = attacker.level || 1;
    
    let A = move.damageClass === 'special' ? attacker.battleStats.spatk : attacker.battleStats.atk;
    let D = move.damageClass === 'special' ? defender.battleStats.spdef : defender.battleStats.def;
    
    let baseDmg = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * move.power * A / D) / 50) + 2;
    
    let stab = attacker.battleStats.types.includes(move.type) ? 1.5 : 1;
    let mult = getEffectiveness(move.type, defender.battleStats.types);
    let random = (Math.random() * (1 - 0.85) + 0.85);
    let critMult = isCrit ? 1.5 : 1;

    let damage = Math.floor(baseDmg * stab * mult * random * critMult);
    if (mult === 0) damage = 0; 
    else damage = Math.max(1, damage);

    defender.battleStats.hp -= damage;
    playAnimation(isPlayer ? 'enemy-sprite' : 'player-sprite', 'anim-damage');

    if (damage > 0 && isCrit) logMessage(state.currentLang === 'en' ? `<span style="color:#f39c12">A critical hit!</span>` : `<span style="color:#f39c12">Coup critique !</span>`);
    
    if (mult > 1) logMessage(state.currentLang === 'en' ? `It's super effective! (${damage} dmg)` : `C'est super efficace ! (${damage} dégâts)`);
    else if (mult > 0 && mult < 1) logMessage(state.currentLang === 'en' ? `It's not very effective. (${damage} dmg)` : `Ce n'est pas très efficace. (${damage} dégâts)`);
    else if (mult === 0) logMessage(state.currentLang === 'en' ? `It has no effect...` : `Ça n'a aucun effet...`);
    else logMessage(`(${damage} ${state.currentLang === 'en' ? 'dmg' : 'dégâts'})`);

    updateBattleUI();
    await new Promise(r => setTimeout(r, 1000));
}

async function processTurn(playerMove) {
    if (isAnimating || !currentEnemy || currentEnemy.battleStats.hp <= 0 || activeFighter.battleStats.hp <= 0) return;
    isAnimating = true;
    toggleMoves(true);

    let playerSpeed = activeFighter.battleStats.speed;
    let enemySpeed = currentEnemy.battleStats.speed;
    
    let playerGoesFirst = playerSpeed >= enemySpeed;
    if(playerSpeed === enemySpeed) playerGoesFirst = Math.random() > 0.5;

    let bestEnemyMove = currentEnemy.moves[0];
    let maxExpectedDamage = -1;
    currentEnemy.moves.forEach(m => {
        let mMult = getEffectiveness(m.type, activeFighter.battleStats.types);
        let stab = currentEnemy.battleStats.types.includes(m.type) ? 1.5 : 1;
        let A = m.damageClass === 'special' ? currentEnemy.battleStats.spatk : currentEnemy.battleStats.atk;
        let D = m.damageClass === 'special' ? activeFighter.battleStats.spdef : activeFighter.battleStats.def;
        let expected = m.power * mMult * stab * (A / D);
        if (expected > maxExpectedDamage) {
            maxExpectedDamage = expected;
            bestEnemyMove = m;
        }
    });

    if (playerGoesFirst) {
        await executeMove(activeFighter, currentEnemy, playerMove, true);
        if (currentEnemy.battleStats.hp > 0) {
            await executeMove(currentEnemy, activeFighter, bestEnemyMove, false);
        }
    } else {
        await executeMove(currentEnemy, activeFighter, bestEnemyMove, false);
        if (activeFighter.battleStats.hp > 0) {
            await executeMove(activeFighter, currentEnemy, playerMove, true);
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
        
        let promptText = state.currentLang === 'en' 
            ? `<b>${pName}</b> wants to learn <b class="text-accent">${mName}</b> (POW ${newMove.power}).<br>But it already knows 4 moves! Which move should be forgotten?` 
            : `<b>${pName}</b> veut apprendre <b class="text-accent">${mName}</b> (POW ${newMove.power}).<br>Mais il connaît déjà 4 capacités ! Laquelle oublier ?`;
        
        text.innerHTML = promptText;
        list.innerHTML = '';
        
        activeFighter.moves.forEach((m, index) => {
            const btn = document.createElement('button');
            btn.className = `move-btn type-${m.type}`;
            let currentMName = state.currentLang === 'en' ? m.nameEn : m.nameFr;
            btn.innerHTML = `<span class="move-name" data-en="${m.nameEn}" data-fr="${m.nameFr}">${currentMName}</span><span style="font-size:0.7rem; font-weight:normal;">POW ${m.power}</span>`;
            
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
    }, 4000);
}