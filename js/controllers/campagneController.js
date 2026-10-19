import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { getCardImageUrl, getPokemonDetails, getEffectiveness, formatMegaName, getMovesForLevel, getMoveDetails, TYPE_TRANSLATIONS } from '../utils.js';
import { allerASection, applyTranslation } from './navController.js';

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

async function startBattle(zone) {
    document.getElementById('campagne-select-zone').classList.add('hidden');
    document.getElementById('campagne-battle-arena').classList.remove('hidden');
    
    document.getElementById('enemy-name').textContent = "Recherche...";
    document.getElementById('enemy-sprite').src = "";
    let msgStart = state.currentLang === 'en' ? `You walk into ${zone.name}...` : `Vous marchez dans la zone : ${zone.name}...`;
    document.getElementById('battle-log').innerHTML = msgStart;
    
    document.getElementById('moves-container').innerHTML = `<p style="color:#aaa; text-align:center; grid-column: span 2; margin-top:20px;">Chargement des capacités...</p>`;
    document.getElementById('btn-battle-flee').disabled = true;

    const gen1Pokemon = state.pokemonDataList.slice(0, 151);
    const randIndex = Math.floor(Math.random() * gen1Pokemon.length);
    const wData = gen1Pokemon[randIndex];
    const wId = randIndex + 1;
    
    const wLevel = Math.floor(Math.random() * (zone.maxLvl - zone.minLvl + 1)) + zone.minLvl;
    
    const wDetails = await getPokemonDetails({ pokedexNumber: wId, mega: false });
    const pDetails = await getPokemonDetails(activeFighter);

    const calcHP = (pow, lvl) => Math.floor(pow / 3) + (lvl * 5) + 10;
    const calcAtk = (pow, lvl) => Math.floor(pow / 5) + (lvl * 2) + 5;

    currentEnemy = {
        nameEn: wData.en,
        nameFr: wData.fr,
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

    currentEnemy.moves = await getMovesForLevel(wId, wLevel);
    
    // MÉMOIRE DES ATTAQUES DU JOUEUR : S'il n'en a pas, on lui attribue les siennes pour son niveau
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
    document.getElementById('enemy-hp-text').textContent = `${Math.max(0, currentEnemy.hp)} / ${currentEnemy.maxHp}`;
    document.getElementById('enemy-hp-fill').style.width = `${(Math.max(0, currentEnemy.hp) / currentEnemy.maxHp) * 100}%`;
    document.getElementById('enemy-sprite').src = currentEnemy.sprite;
    updateBarColor('enemy-hp-fill', currentEnemy.hp, currentEnemy.maxHp);

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

async function processTurn(playerMove) {
    if (isAnimating || !currentEnemy || currentEnemy.hp <= 0 || activeFighter.battleStats.hp <= 0) return;
    isAnimating = true;
    toggleMoves(true);

    let pName = state.currentLang === 'en' ? activeFighter.data.en : activeFighter.data.fr;
    if (activeFighter.mega) pName = formatMegaName(pName, activeFighter.megaForm);
    let moveName = state.currentLang === 'en' ? playerMove.nameEn : playerMove.nameFr;
    
    let msgUse = state.currentLang === 'en' ? `<b>${pName}</b> uses <b style="color:var(--accent);">${moveName}</b>!` : `<b>${pName}</b> utilise <b style="color:var(--accent);">${moveName}</b> !`;
    logMessage(msgUse);
    playAnimation('player-sprite', 'anim-attack');

    await new Promise(r => setTimeout(r, 600));

    let mult = getEffectiveness(playerMove.type, currentEnemy.types);
    let damage = Math.floor(activeFighter.battleStats.atk * (playerMove.power / 40) * mult * (Math.random() * 0.2 + 0.9));
    damage = Math.max(1, damage); 
    
    currentEnemy.hp -= damage;
    playAnimation('enemy-sprite', 'anim-damage');
    
    if (mult > 1) logMessage(state.currentLang === 'en' ? `It's super effective! (${damage} dmg)` : `C'est super efficace ! (${damage} dégâts)`);
    else if (mult < 1) logMessage(state.currentLang === 'en' ? `It's not very effective. (${damage} dmg)` : `Ce n'est pas très efficace. (${damage} dégâts)`);
    else logMessage(`(${damage} ${state.currentLang === 'en' ? 'dmg' : 'dégâts'})`);

    updateBattleUI();

    if (currentEnemy.hp <= 0) {
        await winBattle();
        isAnimating = false;
        return;
    }

    await new Promise(r => setTimeout(r, 1000));

    let bestEnemyMove = currentEnemy.moves[0];
    let maxExpectedDamage = -1;
    currentEnemy.moves.forEach(m => {
        let mMult = getEffectiveness(m.type, activeFighter.battleStats.types);
        let expected = (m.power / 40) * mMult;
        if (expected > maxExpectedDamage) {
            maxExpectedDamage = expected;
            bestEnemyMove = m;
        }
    });

    let eMoveName = state.currentLang === 'en' ? bestEnemyMove.nameEn : bestEnemyMove.nameFr;
    let eName = state.currentLang === 'en' ? currentEnemy.nameEn : currentEnemy.nameFr;
    
    let msgEUse = state.currentLang === 'en' ? `Wild <b>${eName}</b> uses <b style="color:var(--danger);">${eMoveName}</b>!` : `<b>${eName}</b> sauvage utilise <b style="color:var(--danger);">${eMoveName}</b> !`;
    logMessage(msgEUse);
    playAnimation('enemy-sprite', 'anim-attack');

    await new Promise(r => setTimeout(r, 600));

    let eMult = getEffectiveness(bestEnemyMove.type, activeFighter.battleStats.types);
    let eDamage = Math.floor(currentEnemy.atk * (bestEnemyMove.power / 40) * eMult * (Math.random() * 0.2 + 0.9));
    eDamage = Math.max(1, eDamage);
    
    activeFighter.battleStats.hp -= eDamage;
    playAnimation('player-sprite', 'anim-damage');
    
    if (eMult > 1) logMessage(state.currentLang === 'en' ? `It's super effective! (${eDamage} dmg taken)` : `C'est super efficace ! (${eDamage} dégâts reçus)`);
    else if (eMult < 1) logMessage(state.currentLang === 'en' ? `It's not very effective. (${eDamage} dmg taken)` : `Ce n'est pas très efficace. (${eDamage} dégâts reçus)`);
    else logMessage(`(${eDamage} ${state.currentLang === 'en' ? 'dmg taken' : 'dégâts reçus'})`);

    updateBattleUI();

    if (activeFighter.battleStats.hp <= 0) {
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

// LA FENÊTRE DE CHOIX D'ATTAQUE (Apprentissage)
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
        applyTranslation(); // On traduit la fenêtre dynamique !
    });
}

// Gestion de la montée de niveau et de l'apprentissage des nouvelles capacités
async function handleLevelUpMoves(oldLvl, newLvl) {
    const details = await getPokemonDetails(activeFighter);
    // On récupère toutes les attaques débloquées entre l'ancien et le nouveau niveau
    let newMovesInfo = details.allMoves.filter(m => m.level > oldLvl && m.level <= newLvl);
    newMovesInfo.sort((a,b) => a.level - b.level);
    
    for (let mInfo of newMovesInfo) {
        const moveData = await getMoveDetails(mInfo.url);
        // Si on connait déjà cette attaque, on passe
        if (activeFighter.moves.some(m => m.nameEn === moveData.nameEn)) continue;
        
        if (activeFighter.moves.length < 4) {
            activeFighter.moves.push(moveData);
            let moveName = state.currentLang === 'en' ? moveData.nameEn : moveData.nameFr;
            let pName = state.currentLang === 'en' ? activeFighter.data.en : activeFighter.data.fr;
            let msg = state.currentLang === 'en' ? `✨ ${pName} learned ${moveName}!` : `✨ ${pName} a appris ${moveName} !`;
            logMessage(msg);
        } else {
            // S'il connait déjà 4 attaques, on lance la fenêtre modale
            await promptLearnMove(moveData);
        }
    }
}

async function winBattle() {
    let eName = state.currentLang === 'en' ? currentEnemy.nameEn : currentEnemy.nameFr;
    logMessage(`<b style="color:#2ecc71;">${eName} ${state.currentLang === 'en' ? 'defeated!' : 'sauvage est vaincu !'}</b>`);
    
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
        
        // C'est ICI qu'on check les nouvelles attaques !
        await handleLevelUpMoves(oldLvl, currentLvl);
        
        if (currentLvl === maxLvl) {
            logMessage(state.currentLang === 'en' ? `<span class="text-danger">Max Rank reached! Merge duplicates in Collection to go higher.</span>` : `<span class="text-danger">Rang Max atteint ! Fusionnez des doublons dans la collection pour aller plus haut.</span>`);
        }
    }
    
    updateBattleUI();
    renderMovesUI(); // Mets à jour le panel des 4 attaques au cas où
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