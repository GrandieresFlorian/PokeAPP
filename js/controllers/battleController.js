import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { getPokemonPow, getPokemonDetails, getCardImageUrl, getEffectiveness, formatMegaName, getMovesForLevel } from '../utils.js';
import { 
    USELESS_MOVES, PRIORITY_MOVES, HEAL_MOVES, DRAIN_MOVES, RECOIL_MOVES, MULTI_HIT_2_5, MULTI_HIT_2, 
    FLINCH_MOVES, SECONDARY_EFFECTS, STATUS_MOVES, STAT_NAMES, 
    OHKO_MOVES, KAMIKAZE_MOVES, FORCE_FLEE_MOVES, HIGH_CRIT_MOVES, STAT_CLEAR_MOVES, FIXED_DAMAGE_MOVES,
    STATUS_CONDITIONS, SECONDARY_STATUS
} from '../data/campagneData.js';

let pvpState = {
    playerTeam: [], enemyTeam: [],
    playerActiveIdx: 0, enemyActiveIdx: 0,
    mode: 'ranked', reqId: null, challengerId: null,
    isAnimating: false, isSwitching: false
};

const STATUS_COLORS = { "BRN": "#e67e22", "PSN": "#9b59b6", "TOX": "#8e44ad", "PAR": "#f1c40f", "FRZ": "#3498db", "SLP": "#2c3e50" };

// ---------- 1. GESTION DES DÉFIS ----------

export function proposerCombat(friendId) {
    if (!state.currentUser) return;
    document.getElementById('pvp-challenge-modal').classList.remove('hidden');

    document.getElementById('btn-pvp-ranked').onclick = () => sendChallenge(friendId, 'ranked');
    document.getElementById('btn-pvp-friendly').onclick = () => openFriendlyTeamSelector(friendId);
    document.getElementById('btn-cancel-challenge').onclick = () => document.getElementById('pvp-challenge-modal').classList.add('hidden');
}

async function sendChallenge(friendId, mode, team = null) {
    document.getElementById('pvp-challenge-modal').classList.add('hidden');
    document.getElementById('pvp-team-selection').classList.add('hidden');
    document.getElementById('pvp-menus').classList.remove('hidden');

    const today = new Date().toDateString();
    if (state.currentUserData.lastBattleDate !== today) {
        state.currentUserData.battlesProposedToday = 0;
        state.currentUserData.lastBattleDate = today;
    }
    
    if (state.currentUserData.battlesProposedToday >= 3) {
        return alert(state.currentLang === 'en' ? "You have reached the limit of 3 challenges per day." : "Vous avez atteint la limite de 3 défis par jour.");
    }

    try {
        const friendRef = db.collection('users').doc(friendId);
        const friendDoc = await friendRef.get();
        if (!friendDoc.exists) return;

        let requests = friendDoc.data().battleRequests || [];
        if (requests.some(req => req.from === state.currentUser)) return alert(state.currentLang === 'en' ? "Challenge already sent!" : "Défi déjà envoyé !");

        let myCol = (state.currentUserData.collection || []).filter(c => !c.isBaie);
        let theirCol = (friendDoc.data().collection || []).filter(c => !c.isBaie);

        if (myCol.length < 4 || theirCol.length < 4) {
            return alert(state.currentLang === 'en' ? "Both players must have at least 4 Pokémon!" : "Les deux joueurs doivent avoir au moins 4 Pokémon !");
        }

        requests.push({ id: Date.now().toString(), from: state.currentUser, type: mode, team: team, timestamp: Date.now() });
        await friendRef.update({ battleRequests: requests });
        
        state.currentUserData.battlesProposedToday++;
        await db.collection('users').doc(state.currentUser).update({
            battlesProposedToday: state.currentUserData.battlesProposedToday,
            lastBattleDate: state.currentUserData.lastBattleDate
        });
        alert(state.currentLang === 'en' ? `Challenge sent to ${friendId}!` : `Défi envoyé à ${friendId} !`);
    } catch (e) { console.error(e); }
}

export function renderBattleUI() {
    const requestsList = document.getElementById('combat-requests-list');
    const historyList = document.getElementById('combat-history-list');
    if (!requestsList || !historyList) return;

    requestsList.innerHTML = ""; historyList.innerHTML = "";

    const requests = state.currentUserData.battleRequests || [];
    if (requests.length === 0) {
        requestsList.innerHTML = `<li class="friend-item" style="color: #777;">${state.currentLang === 'en' ? 'No pending challenges.' : 'Aucun défi en attente.'}</li>`;
    } else {
        requests.forEach(req => {
            const li = document.createElement('li');
            li.className = "friend-item";
            li.innerHTML = `<span>${req.from} <b style="color:${req.type==='ranked'?'#f39c12':'#3498db'}">(${req.type === 'ranked' ? 'Classé' : 'Amical'})</b></span>
                <div><button class="btn-small-action btn-accept">✔️</button><button class="btn-small-action btn-reject">❌</button></div>`;
            li.querySelector('.btn-accept').addEventListener('click', () => accepterCombat(req));
            li.querySelector('.btn-reject').addEventListener('click', async () => {
                let r = state.currentUserData.battleRequests.filter(x => x.id !== req.id);
                await db.collection('users').doc(state.currentUser).update({ battleRequests: r });
            });
            requestsList.appendChild(li);
        });
    }

    const history = state.currentUserData.battleHistory || [];
    if (history.length === 0) {
        historyList.innerHTML = `<li class="friend-item" style="color: #777;">${state.currentLang === 'en' ? 'No battle history.' : 'Aucun historique.'}</li>`;
    } else {
        history.slice().reverse().forEach(bat => {
            const li = document.createElement('li');
            li.className = "friend-item";
            let resTxt = bat.winner === state.currentUser ? (state.currentLang === 'en' ? 'Victory 🏆' : 'Victoire 🏆') : (state.currentLang === 'en' ? 'Defeat 💀' : 'Défaite 💀');
            let color = bat.winner === state.currentUser ? '#2ecc71' : '#e74c3c';
            li.innerHTML = `<div style="display:flex; flex-direction:column; gap:5px; width:100%;">
                    <div style="display:flex; justify-content:space-between;">
                        <span><b>${bat.player1}</b> vs <b>${bat.player2}</b> <span style="font-size:0.7rem;">(${bat.mode})</span></span>
                        <span style="color:${color}; font-weight:bold;">${resTxt}</span>
                    </div>
                    <span style="font-size:0.8rem; color:#aaa;">${new Date(bat.timestamp).toLocaleString()}</span>
                </div>`;
            historyList.appendChild(li);
        });
    }
}

// ---------- 2. LOGIQUE D'ÉQUILIBRAGE (RANKED) & SÉLECTION (FRIENDLY) ----------

async function accepterCombat(req) {
    if (!state.currentUser) return;
    try {
        const challengerDoc = await db.collection('users').doc(req.from).get();
        if (!challengerDoc.exists) return;
        
        let myCol = (state.currentUserData.collection || []).filter(c => !c.isBaie);
        let theirCol = (challengerDoc.data().collection || []).filter(c => !c.isBaie);

        if (myCol.length < 4 || theirCol.length < 4) return alert("Les deux joueurs doivent avoir au moins 4 Pokémon !");

        if (req.type === 'ranked') {
            // Algorithme d'équilibrage à 50 POW près
            let best1 = myCol.slice(0,4), best2 = theirCol.slice(0,4), minDiff = Infinity;
            for(let i=0; i<300; i++) {
                let t1 = [...myCol].sort(() => 0.5 - Math.random()).slice(0,4);
                let t2 = [...theirCol].sort(() => 0.5 - Math.random()).slice(0,4);
                
                let pow1 = 0; for(let c of t1) pow1 += await getPokemonPow(c) * (c.level||1);
                let pow2 = 0; for(let c of t2) pow2 += await getPokemonPow(c) * (c.level||1);
                
                let diff = Math.abs(pow1 - pow2);
                if(diff <= 50) { best1 = t1; best2 = t2; break; }
                if(diff < minDiff) { minDiff = diff; best1 = t1; best2 = t2; }
            }
            startPvPBattle(req, best1, best2);
        } else {
            openAcceptFriendlyTeamSelector(req, theirCol, req.team);
        }
    } catch (e) { console.error(e); }
}

function openFriendlyTeamSelector(friendId) {
    document.getElementById('pvp-challenge-modal').classList.add('hidden');
    document.getElementById('pvp-menus').classList.add('hidden');
    document.getElementById('pvp-team-selection').classList.remove('hidden');
    
    document.getElementById('pvp-selection-title').textContent = "Sélectionnez 4 Pokémon pour le combat";
    document.getElementById('pvp-selection-counter').classList.remove('hidden');
    
    let selected = [];
    renderTeamSelectionGrid(state.currentUserData.collection, selected, () => {
        let btn = document.getElementById('btn-confirm-pvp-team');
        if(selected.length === 4) {
            btn.classList.remove('hidden');
            btn.onclick = () => sendChallenge(friendId, 'friendly', selected);
        } else btn.classList.add('hidden');
    });

    document.getElementById('btn-cancel-pvp-team').onclick = () => {
        document.getElementById('pvp-team-selection').classList.add('hidden');
        document.getElementById('pvp-menus').classList.remove('hidden');
    };
}

function openAcceptFriendlyTeamSelector(req, enemyFullCol, enemyTeam) {
    document.getElementById('pvp-menus').classList.add('hidden');
    document.getElementById('pvp-team-selection').classList.remove('hidden');
    document.getElementById('pvp-selection-title').textContent = "Défendez-vous ! Choisissez 4 Pokémon";
    document.getElementById('pvp-selection-counter').classList.remove('hidden');
    
    let selected = [];
    renderTeamSelectionGrid(state.currentUserData.collection, selected, () => {
        let btn = document.getElementById('btn-confirm-pvp-team');
        if(selected.length === 4) {
            btn.classList.remove('hidden');
            btn.onclick = () => startPvPBattle(req, selected, enemyTeam);
        } else btn.classList.add('hidden');
    });

    document.getElementById('btn-cancel-pvp-team').onclick = () => {
        document.getElementById('pvp-team-selection').classList.add('hidden');
        document.getElementById('pvp-menus').classList.remove('hidden');
    };
}

function renderTeamSelectionGrid(collection, selectedArray, onSelectCallback) {
    const grid = document.getElementById('pvp-selection-grid');
    grid.innerHTML = "";
    let valid = (collection||[]).filter(c => !c.isBaie).sort((a,b) => b.pokedexNumber - a.pokedexNumber);
    
    valid.forEach(carte => {
        let dataCarte = carte.data || state.pokemonDataList[carte.pokedexNumber - 1] || {};
        const div = document.createElement('div');
        div.className = `mini-card ${selectedArray.includes(carte) ? 'selected' : ''}`;
        div.style.backgroundImage = `url('${getCardImageUrl(carte)}')`;
        const rarete = carte.mega ? "MG" : (dataCarte.rarity || "C");
        div.style.backgroundColor = CONSTS.couleursRarete[rarete] || "#333";
        if (carte.shiny || (carte.mega && carte.shiny)) div.innerHTML += '<div class="mini-card-holo"></div>';
        
        let lvlBadge = document.createElement('div');
        lvlBadge.textContent = `Niv. ${carte.level || 1}`;
        lvlBadge.style.cssText = "position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); color:white; font-size:0.7rem; font-weight:bold;";
        div.appendChild(lvlBadge);

        if(selectedArray.includes(carte)) div.style.border = "3px solid #2ecc71";

        div.onclick = () => {
            if(selectedArray.includes(carte)) selectedArray.splice(selectedArray.indexOf(carte), 1);
            else if(selectedArray.length < 4) selectedArray.push(carte);
            document.getElementById('pvp-team-count').textContent = selectedArray.length;
            renderTeamSelectionGrid(collection, selectedArray, onSelectCallback);
        };
        grid.appendChild(div);
    });
    onSelectCallback();
}

// ---------- 3. LE MOTEUR DE COMBAT (BATTLE ENGINE) ----------

function calcStats(baseStats, level, evs = { hp:0, atk:0, def:0, spatk:0, spdef:0, speed:0 }) {
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
    let finalStat = Math.floor(base * multiplier);
    if (statName === 'speed' && entity.status === 'PAR') finalStat = Math.floor(finalStat / 2);
    return finalStat;
}

async function initPvPPokemon(pkmn) {
    const details = await getPokemonDetails(pkmn);
    pkmn.battleStats = calcStats(details.baseStats, pkmn.level || 1, pkmn.evs || {hp:0,atk:0,def:0,spatk:0,spdef:0,speed:0});
    pkmn.battleStats.types = details.types;
    pkmn.modifiers = {atk:0, def:0, spatk:0, spdef:0, speed:0};
    pkmn.status = null; pkmn.statusTurns = 0; pkmn.confusion = 0; pkmn.toxCount = 0;
    pkmn.maxHp = pkmn.battleStats.maxHp;
    pkmn.currentHp = pkmn.battleStats.hp;
    pkmn.moves = await getMovesForLevel(pkmn.pokedexNumber, pkmn.level || 1);
    if (!pkmn.data) pkmn.data = state.pokemonDataList[pkmn.pokedexNumber - 1];
    return pkmn;
}

async function startPvPBattle(req, myTeamRaw, enemyTeamRaw) {
    document.getElementById('pvp-team-selection').classList.add('hidden');
    document.getElementById('pvp-menus').classList.add('hidden');
    document.getElementById('pvp-battle-arena').classList.remove('hidden');

    pvpState.mode = req.type;
    pvpState.reqId = req.id;
    pvpState.challengerId = req.from;
    pvpState.playerActiveIdx = 0;
    pvpState.enemyActiveIdx = 0;
    pvpState.isAnimating = false;
    pvpState.isSwitching = false;

    pvpState.playerTeam = await Promise.all(myTeamRaw.map(p => initPvPPokemon(JSON.parse(JSON.stringify(p)))));
    pvpState.enemyTeam = await Promise.all(enemyTeamRaw.map(p => initPvPPokemon(JSON.parse(JSON.stringify(p)))));

    document.getElementById('pvp-battle-log').innerHTML = `<span style="color:#f39c12; font-weight:bold;">Le combat ${req.type === 'ranked' ? 'Classé' : 'Amical'} contre ${req.from} commence !</span>`;
    
    document.getElementById('btn-pvp-switch').onclick = () => openPvPSwitchMenu();
    document.getElementById('btn-cancel-switch').onclick = () => {
        if(pvpState.playerTeam[pvpState.playerActiveIdx].currentHp > 0) {
            document.getElementById('pvp-team-selection').classList.add('hidden');
            document.getElementById('pvp-moves-container').classList.remove('hidden');
        }
    };

    updatePvPBattleUI();
    togglePvPMoves(false);
}

function updatePvPBattleUI() {
    let pActive = pvpState.playerTeam[pvpState.playerActiveIdx];
    let eActive = pvpState.enemyTeam[pvpState.enemyActiveIdx];

    // Enemy UI
    document.getElementById('pvp-enemy-name').textContent = state.currentLang === 'en' ? (eActive.data.en||"Unknown") : (eActive.data.fr||"Inconnu");
    document.getElementById('pvp-enemy-lvl').textContent = `Niv. ${eActive.level || 1}`;
    document.getElementById('pvp-enemy-hp-text').textContent = `${Math.max(0, eActive.currentHp)} / ${eActive.maxHp}`;
    document.getElementById('pvp-enemy-hp-fill').style.width = `${(Math.max(0, eActive.currentHp) / eActive.maxHp) * 100}%`;
    document.getElementById('pvp-enemy-sprite').src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${eActive.pokedexNumber}.png`;
    updateBarColor('pvp-enemy-hp-fill', eActive.currentHp, eActive.maxHp);
    renderModifiersUI(eActive, 'pvp-enemy-modifiers');

    // Player UI
    document.getElementById('pvp-player-name').textContent = state.currentLang === 'en' ? (pActive.data.en||"Unknown") : (pActive.data.fr||"Inconnu");
    document.getElementById('pvp-player-lvl').textContent = `Niv. ${pActive.level || 1}`;
    document.getElementById('pvp-player-hp-text').textContent = `${Math.max(0, pActive.currentHp)} / ${pActive.maxHp}`;
    document.getElementById('pvp-player-hp-fill').style.width = `${(Math.max(0, pActive.currentHp) / pActive.maxHp) * 100}%`;
    document.getElementById('pvp-player-sprite').src = getCardImageUrl(pActive);
    updateBarColor('pvp-player-hp-fill', pActive.currentHp, pActive.maxHp);
    renderModifiersUI(pActive, 'pvp-player-modifiers');

    // Team Balls
    document.getElementById('pvp-enemy-team-ui').innerHTML = pvpState.enemyTeam.map((p, i) => `<div class="ball ${p.currentHp <= 0 ? 'fainted' : (i === pvpState.enemyActiveIdx ? 'active' : 'alive')}"></div>`).join('');
    document.getElementById('pvp-player-team-ui').innerHTML = pvpState.playerTeam.map((p, i) => `<div class="ball ${p.currentHp <= 0 ? 'fainted' : (i === pvpState.playerActiveIdx ? 'active' : 'alive')}"></div>`).join('');

    renderPvPMovesUI(pActive);
}

function renderPvPMovesUI(activePokemon) {
    const container = document.getElementById('pvp-moves-container');
    container.innerHTML = "";
    activePokemon.moves.forEach(move => {
        const btn = document.createElement('button');
        btn.className = `move-btn type-${move.type}`;
        let mName = state.currentLang === 'en' ? move.nameEn : move.nameFr;
        let displayPower = (move.damageClass === "status" || USELESS_MOVES.includes(move.nameEn) || FORCE_FLEE_MOVES.includes(move.nameEn) || STAT_CLEAR_MOVES.includes(move.nameEn) || OHKO_MOVES.includes(move.nameEn)) ? "-" : move.power;
        if(FIXED_DAMAGE_MOVES[move.nameEn]) displayPower = "FIX";

        btn.innerHTML = `<span class="move-name">${mName}</span><span style="font-size:0.7rem; font-weight:normal;">POW ${displayPower}</span>`;
        btn.onclick = () => processPvPTurn({ type: 'move', move: move });
        container.appendChild(btn);
    });
}

function togglePvPMoves(disabled) {
    document.querySelectorAll('#pvp-moves-container .move-btn').forEach(b => b.disabled = disabled);
    document.getElementById('btn-pvp-switch').disabled = disabled;
}

function logMessage(msg) {
    const log = document.getElementById('pvp-battle-log');
    log.innerHTML += `\n> ${msg}`;
    log.scrollTop = log.scrollHeight;
}

function updateBarColor(id, hp, maxHp) {
    const el = document.getElementById(id);
    const ratio = hp / maxHp;
    if (ratio > 0.5) el.style.backgroundColor = "#2ecc71";
    else if (ratio > 0.2) el.style.backgroundColor = "#f39c12";
    else el.style.backgroundColor = "#e74c3c";
}

function playAnimation(id, animClass) {
    const el = document.getElementById(id).parentElement;
    el.classList.add(animClass);
    setTimeout(() => el.classList.remove(animClass), 500);
}

function renderModifiersUI(entity, containerId) {
    let container = document.getElementById(containerId);
    container.innerHTML = "";
    if (entity.status) {
        let badge = document.createElement('span');
        badge.style.cssText = `background:${STATUS_COLORS[entity.status]}; color:#fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; margin-right:4px;`;
        badge.textContent = entity.status;
        container.appendChild(badge);
    }
    if (entity.confusion > 0) {
        let badge = document.createElement('span');
        badge.style.cssText = `background:#e67e22; color:#fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: bold; margin-right:4px;`;
        badge.textContent = "CNF";
        container.appendChild(badge);
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

// Menu Switch en plein combat
function openPvPSwitchMenu(forceSwitch = false) {
    document.getElementById('pvp-moves-container').classList.add('hidden');
    document.getElementById('pvp-team-selection').classList.remove('hidden');
    document.getElementById('pvp-selection-title').textContent = "Qui voulez-vous envoyer ?";
    document.getElementById('pvp-selection-counter').classList.add('hidden');
    document.getElementById('btn-confirm-pvp-team').classList.add('hidden');
    
    let btnCancel = document.getElementById('btn-cancel-pvp-team');
    btnCancel.textContent = "Retour";
    if(forceSwitch) btnCancel.classList.add('hidden');
    else btnCancel.classList.remove('hidden');

    const grid = document.getElementById('pvp-selection-grid');
    grid.innerHTML = "";
    
    pvpState.playerTeam.forEach((carte, index) => {
        const div = document.createElement('div');
        div.className = `mini-card`;
        div.style.backgroundImage = `url('${getCardImageUrl(carte)}')`;
        if (carte.shiny || (carte.mega && carte.shiny)) div.innerHTML += '<div class="mini-card-holo"></div>';
        
        let hpBar = document.createElement('div');
        hpBar.style.cssText = `position:absolute; bottom:0; left:0; right:0; height:10px; background:#333; border-top:1px solid #000;`;
        let fill = document.createElement('div');
        let ratio = carte.currentHp / carte.maxHp;
        fill.style.cssText = `height:100%; width:${ratio*100}%; background:${ratio > 0.5 ? '#2ecc71' : (ratio > 0.2 ? '#f39c12' : '#e74c3c')};`;
        hpBar.appendChild(fill);
        div.appendChild(hpBar);

        if(carte.currentHp <= 0 || index === pvpState.playerActiveIdx) {
            div.style.filter = "grayscale(1) brightness(0.5)";
            div.style.cursor = "not-allowed";
        } else {
            div.onclick = () => {
                document.getElementById('pvp-team-selection').classList.add('hidden');
                document.getElementById('pvp-moves-container').classList.remove('hidden');
                processPvPTurn({ type: 'switch', index: index });
            };
        }
        grid.appendChild(div);
    });
}

// Logique Status et Dégâts 
async function preMoveCheck(entity, isPlayer) {
    let name = isPlayer ? (state.currentLang === 'en' ? entity.data.en : entity.data.fr) : (state.currentLang === 'en' ? entity.nameEn : entity.nameFr);
    if (entity.status === 'FRZ') {
        if (Math.random() < 0.2) { entity.status = null; logMessage(`<span style="color:#3498db">${name} est dégelé !</span>`); } 
        else { logMessage(`<span style="color:#3498db">${name} est complètement gelé !</span>`); return false; }
    }
    if (entity.status === 'SLP') {
        entity.statusTurns--;
        if (entity.statusTurns <= 0) { entity.status = null; logMessage(`<span style="color:#2c3e50">${name} se réveille !</span>`); } 
        else { logMessage(`<span style="color:#2c3e50">${name} dort profondément.</span>`); return false; }
    }
    if (entity.status === 'PAR') {
        if (Math.random() < 0.25) { logMessage(`<span style="color:#f1c40f">${name} est paralysé ! Il ne peut pas attaquer !</span>`); return false; }
    }
    if (entity.confusion > 0) {
        entity.confusion--;
        if (entity.confusion === 0) logMessage(`<span style="color:#e67e22">${name} n'est plus confus !</span>`);
        else {
            logMessage(`<span style="color:#e67e22">${name} est confus !</span>`);
            if (Math.random() < 0.33) {
                playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 400));
                entity.currentHp -= Math.max(1, Math.floor(entity.maxHp / 8));
                logMessage(`<span style="color:#e74c3c">Il se blesse dans sa confusion !</span>`);
                playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-damage'); updatePvPBattleUI(); await new Promise(r => setTimeout(r, 600));
                return false;
            }
        }
    }
    return true;
}

function applyStatus(target, statusObj, targetName) {
    if (statusObj.status === 'CNF') {
        if (target.confusion === 0) { target.confusion = Math.floor(Math.random() * 4) + 2; logMessage(`<span style="color:#e67e22">${targetName} devient confus !</span>`); }
    } else {
        if (!target.status) {
            target.status = statusObj.status; target.toxCount = 0;
            if (statusObj.status === 'SLP') target.statusTurns = Math.floor(Math.random() * 3) + 1;
            let msgs = { "BRN":"est brûlé !", "PSN":"est empoisonné !", "TOX":"est gravement empoisonné !", "PAR":"est paralysé !", "FRZ":"est gelé !", "SLP":"s'endort !" };
            logMessage(`<span style="color:${STATUS_COLORS[statusObj.status]}">${targetName} ${msgs[statusObj.status]}</span>`);
        }
    }
}

async function applyEndTurnStatus(entity, isPlayer) {
    if (entity.currentHp <= 0) return;
    let name = isPlayer ? (entity.data.fr) : (entity.nameFr);
    if (entity.status === 'BRN') {
        entity.currentHp -= Math.max(1, Math.floor(entity.maxHp / 16)); logMessage(`<span style="color:#e67e22">${name} souffre de sa brûlure !</span>`);
    } else if (entity.status === 'PSN') {
        entity.currentHp -= Math.max(1, Math.floor(entity.maxHp / 8)); logMessage(`<span style="color:#9b59b6">${name} souffre du poison !</span>`);
    } else if (entity.status === 'TOX') {
        entity.toxCount++; entity.currentHp -= Math.max(1, Math.floor((entity.maxHp * entity.toxCount) / 16)); logMessage(`<span style="color:#8e44ad">${name} souffre du poison grave !</span>`);
    }
    updatePvPBattleUI(); await new Promise(r => setTimeout(r, 600));
}

// Fonction exécutive des dégâts
async function executePvPMove(attacker, defender, move, isPlayer) {
    if(attacker.currentHp <= 0 || defender.currentHp <= 0) return { flinched: false };
    let canAttack = await preMoveCheck(attacker, isPlayer);
    if(!canAttack) return { flinched: false };

    let aName = isPlayer ? attacker.data.fr : defender.data.fr; // simplified
    let defName = isPlayer ? defender.data.fr : attacker.data.fr;
    
    logMessage(`<b>${aName}</b> utilise <b style="color:${isPlayer?'var(--accent)':'var(--danger)'};">${move.nameFr}</b> !`);
    
    // Switch Forcé
    if (FORCE_FLEE_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r => setTimeout(r, 600));
        let targetTeam = isPlayer ? pvpState.enemyTeam : pvpState.playerTeam;
        let activeI = isPlayer ? pvpState.enemyActiveIdx : pvpState.playerActiveIdx;
        let aliveIndices = targetTeam.map((p, i) => (p.currentHp > 0 && i !== activeI) ? i : -1).filter(i => i !== -1);
        if (aliveIndices.length > 0) {
            let rndIdx = aliveIndices[Math.floor(Math.random() * aliveIndices.length)];
            if (isPlayer) pvpState.enemyActiveIdx = rndIdx; else pvpState.playerActiveIdx = rndIdx;
            logMessage(`${defName} est forcé de quitter le terrain !`);
        } else logMessage(`Mais cela n'a aucun effet !`);
        updatePvPBattleUI(); return { flinched: false };
    }

    if (STAT_CLEAR_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r=>setTimeout(r,600));
        for(let s in attacker.modifiers) attacker.modifiers[s] = 0; for(let s in defender.modifiers) defender.modifiers[s] = 0;
        logMessage(`<span style="color:#3498db">Tous les changements de stats sont annulés !</span>`);
        updatePvPBattleUI(); await new Promise(r=>setTimeout(r,800)); return { flinched: false };
    }

    if (OHKO_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r=>setTimeout(r,600));
        if (Math.random() < 0.30) {
            defender.currentHp = 0; logMessage(`<span style="color:#f39c12">K.O. en un coup !</span>`);
            playAnimation(isPlayer ? 'enemy-sprite' : 'player-sprite', 'anim-damage'); updatePvPBattleUI(); await new Promise(r=>setTimeout(r,1000));
        } else logMessage(`Mais l'attaque a raté...`);
        return { flinched: false };
    }

    if (USELESS_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r=>setTimeout(r,600));
        logMessage(`Mais il ne se passe rien...`); await new Promise(r=>setTimeout(r,800)); return { flinched: false };
    }

    if (HEAL_MOVES.includes(move.nameEn)) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r=>setTimeout(r,600));
        attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + Math.floor(attacker.maxHp / 2));
        logMessage(`<span style="color:#2ecc71">${aName} regagne des PV !</span>`); updatePvPBattleUI(); await new Promise(r=>setTimeout(r,800)); return { flinched: false };
    }

    if (STATUS_CONDITIONS[move.nameEn]) {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r=>setTimeout(r,600));
        let statObj = STATUS_CONDITIONS[move.nameEn];
        if (Math.random() * 100 <= statObj.chance) {
            let targetEntity = (statObj.status === 'CNF' && move.nameEn === 'swagger') ? defender : defender; 
            applyStatus(targetEntity, statObj, defName);
            if(statObj.stat) {
                targetEntity.modifiers[statObj.stat] = Math.max(-6, Math.min(6, targetEntity.modifiers[statObj.stat] + statObj.stage));
                if (statObj.stage > 0) logMessage(`<span style="color:#3498db">${STAT_NAMES.fr[statObj.stat]} de ${defName} augmente !</span>`);
            }
        } else logMessage(`Mais l'attaque a raté...`);
        updatePvPBattleUI(); await new Promise(r=>setTimeout(r,800)); return { flinched: false };
    }

    if (move.damageClass === "status") {
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r=>setTimeout(r,600));
        const statusData = STATUS_MOVES[move.nameEn];
        if (statusData) {
            let targetEntity = statusData.target === "enemy" ? defender : attacker;
            let targetName = statusData.target === "enemy" ? defName : aName;
            for (let effect of statusData.effects) {
                targetEntity.modifiers[effect.stat] = Math.max(-6, Math.min(6, targetEntity.modifiers[effect.stat] + effect.stage));
                if (effect.stage > 0) logMessage(`<span style="color:#3498db">${STAT_NAMES.fr[effect.stat]} de ${targetName} augmente !</span>`);
                else logMessage(`<span style="color:#e74c3c">${STAT_NAMES.fr[effect.stat]} de ${targetName} diminue !</span>`);
            }
        }
        updatePvPBattleUI(); await new Promise(r=>setTimeout(r,800)); return { flinched: false }; 
    }

    let hitCount = 1;
    if (MULTI_HIT_2_5.includes(move.nameEn)) hitCount = (Math.random() < 0.35) ? 2 : (Math.random() < 0.7 ? 3 : (Math.random() < 0.85 ? 4 : 5));
    else if (MULTI_HIT_2.includes(move.nameEn)) hitCount = 2;

    let totalDamage = 0;
    for (let i = 0; i < hitCount; i++) {
        if (defender.currentHp <= 0) break;
        playAnimation(isPlayer ? 'player-sprite' : 'enemy-sprite', 'anim-attack'); await new Promise(r=>setTimeout(r,400)); 

        let damage = 0; let isCrit = false; let mult = 1;
        if (FIXED_DAMAGE_MOVES[move.nameEn] !== undefined) {
            let val = FIXED_DAMAGE_MOVES[move.nameEn];
            damage = val === "level" ? (attacker.level || 1) : val;
            mult = getEffectiveness(move.type, defender.battleStats.types); if (mult === 0) damage = 0; 
        } else {
            isCrit = Math.random() < (HIGH_CRIT_MOVES.includes(move.nameEn) ? 0.125 : 0.0625); 
            let A = move.damageClass === 'special' ? getEffectiveStat(attacker, 'spatk') : getEffectiveStat(attacker, 'atk');
            let D = move.damageClass === 'special' ? getEffectiveStat(defender, 'spdef') : getEffectiveStat(defender, 'def');
            if (attacker.status === 'BRN' && move.damageClass === 'physical') A = Math.floor(A / 2);
            if (KAMIKAZE_MOVES.includes(move.nameEn)) A *= 1.5;

            let baseDmg = Math.floor(Math.floor(Math.floor(2 * (attacker.level||1) / 5 + 2) * move.power * A / D) / 50) + 2;
            let stab = attacker.battleStats.types.includes(move.type) ? 1.5 : 1;
            mult = getEffectiveness(move.type, defender.battleStats.types);
            damage = Math.floor(baseDmg * stab * mult * (Math.random() * (1 - 0.85) + 0.85) * (isCrit ? 1.5 : 1));
            if (mult === 0) damage = 0; else damage = Math.max(1, damage);
        }

        defender.currentHp -= damage; totalDamage += damage;
        playAnimation(isPlayer ? 'enemy-sprite' : 'player-sprite', 'anim-damage');
        if (damage > 0 && isCrit && hitCount === 1) logMessage(`<span style="color:#f39c12">Coup critique !</span>`);
        if (i === hitCount - 1) { 
            if (mult > 1) logMessage(`C'est super efficace !`); else if (mult > 0 && mult < 1) logMessage(`Ce n'est pas très efficace.`); else if (mult === 0) logMessage(`Ça n'a aucun effet...`);
        }
        updatePvPBattleUI(); await new Promise(r=>setTimeout(r,400));
    }

    if (hitCount > 1 && totalDamage > 0) logMessage(`Touché ${hitCount} fois !`);
    if (totalDamage > 0) logMessage(`(${totalDamage} dégâts)`);

    if (KAMIKAZE_MOVES.includes(move.nameEn)) {
        attacker.currentHp = 0; logMessage(`<span style="color:#e74c3c">${aName} se sacrifie !</span>`); updatePvPBattleUI();
    }

    if (totalDamage > 0 && defender.currentHp > 0) {
        if (DRAIN_MOVES.includes(move.nameEn)) {
            attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + Math.max(1, Math.floor(totalDamage / 2)));
            logMessage(`<span style="color:#2ecc71">${defName} voit son énergie aspirée !</span>`);
        }
        if (RECOIL_MOVES.includes(move.nameEn)) {
            attacker.currentHp -= Math.max(1, Math.floor(totalDamage / 3));
            logMessage(`<span style="color:#e74c3c">${aName} est blessé par le contrecoup !</span>`);
        }
        const secEffect = SECONDARY_EFFECTS[move.nameEn];
        if (secEffect && Math.random() <= secEffect.chance) {
            let tEnt = secEffect.target === "enemy" ? defender : attacker;
            for (let effect of secEffect.effects) {
                tEnt.modifiers[effect.stat] = Math.max(-6, Math.min(6, tEnt.modifiers[effect.stat] + effect.stage));
                if (effect.stage > 0) logMessage(`<span style="color:#3498db">${STAT_NAMES.fr[effect.stat]} de ${secEffect.target==="enemy"?defName:aName} augmente !</span>`);
                else logMessage(`<span style="color:#e74c3c">${STAT_NAMES.fr[effect.stat]} de ${secEffect.target==="enemy"?defName:aName} diminue !</span>`);
            }
        }
        const secStatus = SECONDARY_STATUS[move.nameEn];
        if (secStatus && Math.random() * 100 <= secStatus.chance) applyStatus(defender, secStatus, defName);
    }
    updatePvPBattleUI();
    let flinched = (FLINCH_MOVES.includes(move.nameEn) && totalDamage > 0 && Math.random() < 0.3);
    await new Promise(r=>setTimeout(r,600)); return { flinched, forceFlee: false };
}

async function processPvPTurn(playerAction) {
    if(pvpState.isAnimating) return;
    pvpState.isAnimating = true;
    togglePvPMoves(true);

    let pActive = pvpState.playerTeam[pvpState.playerActiveIdx];
    let eActive = pvpState.enemyTeam[pvpState.enemyActiveIdx];

    // Joueur Switch
    if (playerAction.type === 'switch') {
        logMessage(`<span style="color:#3498db">Vous retirez ${pActive.data.fr} et envoyez ${pvpState.playerTeam[playerAction.index].data.fr} !</span>`);
        pvpState.playerActiveIdx = playerAction.index;
        pActive = pvpState.playerTeam[pvpState.playerActiveIdx];
        updatePvPBattleUI(); await new Promise(r=>setTimeout(r,1000));
        
        let eMove = eActive.moves[Math.floor(Math.random() * eActive.moves.length)];
        await executePvPMove(eActive, pActive, eMove, false);
        await endTurnRoutines(pActive, eActive);
        return;
    }

    let pMove = playerAction.move;
    let eMove = eActive.moves[Math.floor(Math.random() * eActive.moves.length)];

    let pPriority = PRIORITY_MOVES.includes(pMove.nameEn) ? 1 : 0;
    let ePriority = PRIORITY_MOVES.includes(eMove.nameEn) ? 1 : 0;
    let pSpeed = getEffectiveStat(pActive, 'speed');
    let eSpeed = getEffectiveStat(eActive, 'speed');
    
    let playerGoesFirst = pPriority > ePriority || (pPriority === ePriority && pSpeed >= eSpeed);
    if (pSpeed === eSpeed && pPriority === ePriority) playerGoesFirst = Math.random() > 0.5;

    if (playerGoesFirst) {
        let pResult = await executePvPMove(pActive, eActive, pMove, true);
        if (eActive.currentHp > 0 && pActive.currentHp > 0) {
            if(pResult.flinched) { logMessage(`<span style="color:#f39c12">L'adversaire a peur et passe son tour !</span>`); await new Promise(r=>setTimeout(r,800)); }
            else await executePvPMove(eActive, pActive, eMove, false);
        }
    } else {
        let eResult = await executePvPMove(eActive, pActive, eMove, false);
        if (pActive.currentHp > 0 && eActive.currentHp > 0) {
            if(eResult.flinched) { logMessage(`<span style="color:#f39c12">Vous avez peur et passez votre tour !</span>`); await new Promise(r=>setTimeout(r,800)); }
            else await executePvPMove(pActive, eActive, pMove, true);
        }
    }
    await endTurnRoutines(pActive, eActive);
}

async function endTurnRoutines(pActive, eActive) {
    if(pActive.currentHp > 0) await applyEndTurnStatus(pActive, true);
    if(eActive.currentHp > 0) await applyEndTurnStatus(eActive, false);
    updatePvPBattleUI();

    if (eActive.currentHp <= 0) {
        logMessage(`<span style="color:#2ecc71">Le ${eActive.data.fr} ennemi est K.O. !</span>`);
        let nextIdx = pvpState.enemyTeam.findIndex(p => p.currentHp > 0);
        if(nextIdx !== -1) {
            pvpState.enemyActiveIdx = nextIdx;
            logMessage(`L'adversaire envoie ${pvpState.enemyTeam[nextIdx].data.fr} !`);
            updatePvPBattleUI(); togglePvPMoves(false);
        } else await winPvPBattle(true);
    } else if (pActive.currentHp <= 0) {
        logMessage(`<span style="color:#e74c3c">Votre ${pActive.data.fr} est K.O. !</span>`);
        if(pvpState.playerTeam.some(p => p.currentHp > 0)) openPvPSwitchMenu(true); 
        else await winPvPBattle(false);
    } else togglePvPMoves(false);
    pvpState.isAnimating = false;
}

async function winPvPBattle(isWin) {
    logMessage(`<b style="color:${isWin?'#2ecc71':'#e74c3c'}">${isWin ? "Vous avez gagné le combat !" : "Vous avez perdu le combat..."}</b>`);
    
    let record = { player1: pvpState.challengerId, player2: state.currentUser, winner: isWin ? state.currentUser : pvpState.challengerId, mode: pvpState.mode, timestamp: Date.now() };

    try {
        let myReq = (state.currentUserData.battleRequests || []).filter(r => r.id !== pvpState.reqId);
        let myHist = state.currentUserData.battleHistory || [];
        myHist.push(record); if(myHist.length > 20) myHist.shift();

        let myUpdates = { battleRequests: myReq, battleHistory: myHist };
        if(isWin && pvpState.mode === 'ranked') {
            myUpdates.specialBoostersLeft = (state.currentUserData.specialBoostersLeft || 0) + 1;
            logMessage(`<span style="color:#f1c40f">🎁 Vous remportez un Booster Spécial !</span>`);
        }
        await db.collection('users').doc(state.currentUser).update(myUpdates);

        const oppDoc = await db.collection('users').doc(pvpState.challengerId).get();
        if(oppDoc.exists) {
            let oppHist = oppDoc.data().battleHistory || [];
            oppHist.push(record); if(oppHist.length > 20) oppHist.shift();
            let oppUpdates = { battleHistory: oppHist };
            if(!isWin && pvpState.mode === 'ranked') oppUpdates.specialBoostersLeft = (oppDoc.data().specialBoostersLeft || 0) + 1;
            await db.collection('users').doc(pvpState.challengerId).update(oppUpdates);
        }
    } catch(e) { console.error(e); }

    setTimeout(() => {
        document.getElementById('pvp-battle-arena').classList.add('hidden');
        document.getElementById('pvp-menus').classList.remove('hidden');
        renderBattleUI();
    }, 4500);
}