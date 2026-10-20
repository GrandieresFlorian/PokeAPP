import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { getPokemonPow, getPokemonDetails, getCardImageUrl, getEffectiveness, getMovesForLevel } from '../utils.js';
import { allerASection } from './navController.js';
import { 
    USELESS_MOVES, PRIORITY_MOVES, HEAL_MOVES, DRAIN_MOVES, RECOIL_MOVES, MULTI_HIT_2_5, MULTI_HIT_2, 
    FLINCH_MOVES, SECONDARY_EFFECTS, STATUS_MOVES, STAT_NAMES, 
    OHKO_MOVES, KAMIKAZE_MOVES, FORCE_FLEE_MOVES, HIGH_CRIT_MOVES, STAT_CLEAR_MOVES, FIXED_DAMAGE_MOVES,
    STATUS_CONDITIONS, SECONDARY_STATUS
} from '../data/campagneData.js';

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

let currentBattleId = null;
let myRole = null; 
let unsubscribeBattle = null;

const STATUS_COLORS = { "BRN": "#e67e22", "PSN": "#9b59b6", "TOX": "#8e44ad", "PAR": "#f1c40f", "FRZ": "#3498db", "SLP": "#2c3e50" };

// =========================================================================
// OUTILS D'AFFICHAGE
// =========================================================================

function logMessage(msg) {
    const logBox = document.getElementById('pvp-battle-log');
    if(!logBox) return;
    logBox.innerHTML += `<br>> ${msg}`;
    logBox.scrollTop = logBox.scrollHeight;
}

function updateBarColor(id, hp, maxHp) {
    const el = document.getElementById(id);
    if (!el) return;
    const ratio = hp / maxHp;
    if (ratio > 0.5) el.style.backgroundColor = "#2ecc71";
    else if (ratio > 0.2) el.style.backgroundColor = "#f39c12";
    else el.style.backgroundColor = "#e74c3c";
}

// =========================================================================
// 1. SALON ET INVITATIONS
// =========================================================================

export function initPvPListener() {
    if(!state.currentUser) return;
    db.collection('users').doc(state.currentUser).onSnapshot(doc => {
        const data = doc.data();
        if(data && data.activeBattle && data.activeBattle !== currentBattleId) {
            joinRealTimeBattle(data.activeBattle);
        }
    });
}

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

    try {
        const friendRef = db.collection('users').doc(friendId);
        const friendDoc = await friendRef.get();
        if (!friendDoc.exists) return;

        let requests = friendDoc.data().battleRequests || [];
        if (requests.some(req => req.from === state.currentUser)) return alert("Défi déjà envoyé !");

        let myCol = (state.currentUserData.collection || []).filter(c => !c.isBaie);
        let theirCol = (friendDoc.data().collection || []).filter(c => !c.isBaie);

        if (myCol.length < 4 || theirCol.length < 4) return alert("Les deux joueurs doivent avoir au moins 4 Pokémon !");

        requests.push({ id: Date.now().toString(), from: state.currentUser, type: mode, team: team, timestamp: Date.now() });
        await friendRef.update({ battleRequests: requests });
        alert(`Défi envoyé à ${friendId} !`);
    } catch (e) { console.error(e); }
}

export function renderBattleUI() {
    const requestsList = document.getElementById('combat-requests-list');
    const historyList = document.getElementById('combat-history-list');
    if (!requestsList || !historyList) return;

    requestsList.innerHTML = ""; historyList.innerHTML = "";

    const requests = state.currentUserData.battleRequests || [];
    if (requests.length === 0) {
        requestsList.innerHTML = `<li class="friend-item" style="color: #777;">Aucun défi en attente.</li>`;
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
        historyList.innerHTML = `<li class="friend-item" style="color: #777;">Aucun historique.</li>`;
    } else {
        history.slice().reverse().forEach(bat => {
            const li = document.createElement('li');
            li.className = "friend-item";
            let color = bat.winner === state.currentUser ? '#2ecc71' : '#e74c3c';
            li.innerHTML = `<div style="display:flex; flex-direction:column; gap:5px; width:100%;">
                    <div style="display:flex; justify-content:space-between;">
                        <span><b>${bat.player1}</b> vs <b>${bat.player2}</b> <span style="font-size:0.7rem;">(${bat.mode})</span></span>
                        <span style="color:${color}; font-weight:bold;">${bat.winner === state.currentUser ? 'Victoire 🏆' : 'Défaite 💀'}</span>
                    </div>
                    <span style="font-size:0.8rem; color:#aaa;">${new Date(bat.timestamp).toLocaleString()}</span>
                </div>`;
            historyList.appendChild(li);
        });
    }
}

async function accepterCombat(req) {
    if (!state.currentUser) return;
    try {
        const challengerDoc = await db.collection('users').doc(req.from).get();
        if (!challengerDoc.exists) return;
        
        let myCol = (state.currentUserData.collection || []).filter(c => !c.isBaie);
        let theirCol = (challengerDoc.data().collection || []).filter(c => !c.isBaie);

        if (req.type === 'ranked') {
            let best1 = theirCol.slice(0,4), best2 = myCol.slice(0,4), minDiff = Infinity;
            for(let i=0; i<300; i++) {
                let t1 = [...theirCol].sort(() => 0.5 - Math.random()).slice(0,4);
                let t2 = [...myCol].sort(() => 0.5 - Math.random()).slice(0,4);
                let pow1 = 0; for(let c of t1) pow1 += await getPokemonPow(c) * (c.level||1);
                let pow2 = 0; for(let c of t2) pow2 += await getPokemonPow(c) * (c.level||1);
                let diff = Math.abs(pow1 - pow2);
                if(diff <= 50) { best1 = t1; best2 = t2; break; }
                if(diff < minDiff) { minDiff = diff; best1 = t1; best2 = t2; }
            }
            createBattleRoom(req, best1, best2);
        } else {
            openAcceptFriendlyTeamSelector(req, myCol, req.team);
        }
    } catch (e) { console.error(e); }
}

async function createBattleRoom(req, team1, team2) {
    const battleRef = db.collection('active_battles').doc();
    await battleRef.set({
        p1: req.from, 
        p2: state.currentUser, 
        team1: await formatTeam(team1), 
        team2: await formatTeam(team2),
        active1: 0, active2: 0,
        action1: null, action2: null,
        weather: 'none', weatherTurns: 0, // Sauvegarde globale de la météo
        log: [`<b style="color:#f39c12;">Le combat ${req.type === 'ranked' ? 'Classé' : 'Amical'} commence !</b>`],
        status: 'playing', mode: req.type, winner: null
    });

    await db.collection('users').doc(req.from).update({ activeBattle: battleRef.id });
    await db.collection('users').doc(state.currentUser).update({ 
        activeBattle: battleRef.id,
        battleRequests: state.currentUserData.battleRequests.filter(r => r.id !== req.id)
    });
}

async function formatTeam(rawTeam) {
    return await Promise.all(rawTeam.map(async pkmn => {
        const d = await getPokemonDetails(pkmn);
        let maxHp = Math.floor(((2 * d.baseStats.hp) * (pkmn.level || 1)) / 100) + (pkmn.level || 1) + 10;
        let baseStatsObj = { 
            atk: Math.floor(((2 * d.baseStats.atk) * (pkmn.level||1)) / 100) + 5,
            def: Math.floor(((2 * d.baseStats.def) * (pkmn.level||1)) / 100) + 5,
            spatk: Math.floor(((2 * d.baseStats.spatk) * (pkmn.level||1)) / 100) + 5,
            spdef: Math.floor(((2 * d.baseStats.spdef) * (pkmn.level||1)) / 100) + 5,
            speed: Math.floor(((2 * d.baseStats.speed) * (pkmn.level||1)) / 100) + 5,
            types: d.types
        };
        let initialMoves = await getMovesForLevel(pkmn.pokedexNumber, pkmn.level || 1);

        return {
            ...pkmn,
            data: pkmn.data || state.pokemonDataList[pkmn.pokedexNumber - 1],
            moves: JSON.parse(JSON.stringify(initialMoves)),
            maxHp: maxHp, currentHp: maxHp,
            stats: JSON.parse(JSON.stringify(baseStatsObj)),
            modifiers: { atk:0, def:0, spatk:0, spdef:0, speed:0, accuracy:0, evasion:0 },
            status: null, statusTurns: 0, confusion: 0, toxCount: 0,
            turnsActive: 0, isProtected: false, protectCount: 0, isSeeded: false, flinched: false,
            types: [...d.types],
            original: {
                types: [...d.types],
                stats: JSON.parse(JSON.stringify(baseStatsObj)),
                moves: JSON.parse(JSON.stringify(initialMoves))
            }
        };
    }));
}

// ---------- SÉLECTION AMICALE ----------

function openFriendlyTeamSelector(friendId) {
    document.getElementById('pvp-challenge-modal').classList.add('hidden');
    allerASection('section-combats');
    document.getElementById('pvp-menus').classList.add('hidden');
    document.getElementById('pvp-team-selection').classList.remove('hidden');
    document.getElementById('pvp-selection-title').textContent = "Sélectionnez 4 Pokémon pour le combat";
    
    let selected = [];
    renderTeamSelectionGrid(selected, () => {
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

function openAcceptFriendlyTeamSelector(req, myCol, enemyTeam) {
    allerASection('section-combats');
    document.getElementById('pvp-menus').classList.add('hidden');
    document.getElementById('pvp-team-selection').classList.remove('hidden');
    document.getElementById('pvp-selection-title').textContent = "Défendez-vous ! Choisissez 4 Pokémon";
    
    let selected = [];
    renderTeamSelectionGrid(selected, () => {
        let btn = document.getElementById('btn-confirm-pvp-team');
        if(selected.length === 4) {
            btn.classList.remove('hidden');
            btn.onclick = () => createBattleRoom(req, enemyTeam, selected);
        } else btn.classList.add('hidden');
    });

    document.getElementById('btn-cancel-pvp-team').onclick = () => {
        document.getElementById('pvp-team-selection').classList.add('hidden');
        document.getElementById('pvp-menus').classList.remove('hidden');
    };
}

function renderTeamSelectionGrid(selectedArray, onSelectCallback) {
    const grid = document.getElementById('pvp-selection-grid');
    grid.innerHTML = "";
    document.getElementById('pvp-selection-counter').classList.remove('hidden');
    let valid = (state.currentUserData.collection||[]).filter(c => !c.isBaie).sort((a,b) => b.pokedexNumber - a.pokedexNumber);
    
    valid.forEach(carte => {
        let d = carte.data || state.pokemonDataList[carte.pokedexNumber - 1];
        const div = document.createElement('div');
        div.className = `mini-card ${selectedArray.includes(carte) ? 'selected' : ''}`;
        div.style.backgroundImage = `url('${getCardImageUrl(carte)}')`;
        div.style.backgroundColor = CONSTS.couleursRarete[carte.mega ? "MG" : (d.rarity || "C")] || "#333";
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
            renderTeamSelectionGrid(selectedArray, onSelectCallback);
        };
        grid.appendChild(div);
    });
    onSelectCallback();
}

// =========================================================================
// 2. MOTEUR SYNCHRONE (EN COMBAT)
// =========================================================================

function joinRealTimeBattle(battleId) {
    currentBattleId = battleId;
    allerASection('section-combats');
    document.getElementById('pvp-team-selection').classList.add('hidden');
    document.getElementById('pvp-menus').classList.add('hidden');
    document.getElementById('pvp-battle-arena').classList.remove('hidden');

    unsubscribeBattle = db.collection('active_battles').doc(battleId).onSnapshot(doc => {
        if (!doc.exists) {
            db.collection('users').doc(state.currentUser).update({
                activeBattle: firebase.firestore.FieldValue.delete()
            });
            document.getElementById('pvp-battle-arena').classList.add('hidden');
            document.getElementById('pvp-menus').classList.remove('hidden');
            if (unsubscribeBattle) { unsubscribeBattle(); unsubscribeBattle = null; }
            currentBattleId = null;
            return;
        }
        const data = doc.data();
        
        myRole = (data.p1 === state.currentUser) ? 'p1' : 'p2';
        renderSynchronousUI(data);

        if (myRole === 'p1' && data.action1 && data.action2 && data.status === 'playing') {
            resolveSynchronousTurn(data, doc.ref);
        }

        if (data.status === 'finished') endRealTimeBattle(data);
    });

    document.getElementById('btn-pvp-switch').onclick = () => openSynchronousSwitchMenu(false);
    document.getElementById('btn-pvp-surrender').onclick = () => surrenderBattle();
}

function updateWeatherUI(weatherStr) {
    let weatherBanner = document.getElementById('pvp-weather-banner');
    const logBox = document.getElementById('pvp-battle-log');
    
    if (!weatherBanner && logBox) {
        weatherBanner = document.createElement('div');
        weatherBanner.id = 'pvp-weather-banner';
        weatherBanner.style.cssText = "text-align:center; font-weight:bold; padding:5px; margin-bottom:5px; border-radius:5px; transition: 0.3s;";
        logBox.parentNode.insertBefore(weatherBanner, logBox);
    }
    
    if (weatherBanner) {
        if (weatherStr && weatherStr !== 'none') {
            weatherBanner.style.display = 'block';
            if (weatherStr === 'sun') { weatherBanner.textContent = "☀️ Météo : Soleil Intense"; weatherBanner.style.background = "#f1c40f"; weatherBanner.style.color = "#000"; }
            if (weatherStr === 'rain') { weatherBanner.textContent = "🌧️ Météo : Pluie Battante"; weatherBanner.style.background = "#3498db"; weatherBanner.style.color = "#fff"; }
            if (weatherStr === 'sandstorm') { weatherBanner.textContent = "🌪️ Météo : Tempête de Sable"; weatherBanner.style.background = "#e67e22"; weatherBanner.style.color = "#fff"; }
            if (weatherStr === 'hail') { weatherBanner.textContent = "❄️ Météo : Grêle"; weatherBanner.style.background = "#ecf0f1"; weatherBanner.style.color = "#000"; }
        } else {
            weatherBanner.style.display = 'none';
        }
    }
}

function renderSynchronousUI(data) {
    updateWeatherUI(data.weather);

    let myTeam = myRole === 'p1' ? data.team1 : data.team2;
    let enemyTeam = myRole === 'p1' ? data.team2 : data.team1;
    let myActiveIdx = myRole === 'p1' ? data.active1 : data.active2;
    let enemyActiveIdx = myRole === 'p1' ? data.active2 : data.active1;
    
    let pActive = myTeam[myActiveIdx];
    let eActive = enemyTeam[enemyActiveIdx];

    document.getElementById('pvp-player-name').textContent = pActive.data.fr;
    document.getElementById('pvp-player-lvl').textContent = `Niv. ${pActive.level || 1}`;
    document.getElementById('pvp-player-hp-text').textContent = `${Math.max(0, pActive.currentHp)} / ${pActive.maxHp}`;
    document.getElementById('pvp-player-hp-fill').style.width = `${(Math.max(0, pActive.currentHp) / pActive.maxHp) * 100}%`;
    document.getElementById('pvp-player-sprite').src = pActive.transformedImage || getCardImageUrl(pActive);
    updateBarColor('pvp-player-hp-fill', pActive.currentHp, pActive.maxHp);
    document.getElementById('pvp-player-team-ui').innerHTML = myTeam.map((p, i) => `<div class="ball ${p.currentHp <= 0 ? 'fainted' : (i === myActiveIdx ? 'active' : 'alive')}"></div>`).join('');

    document.getElementById('pvp-enemy-name').textContent = eActive.data.fr;
    document.getElementById('pvp-enemy-lvl').textContent = `Niv. ${eActive.level || 1}`;
    document.getElementById('pvp-enemy-hp-text').textContent = `${Math.max(0, eActive.currentHp)} / ${eActive.maxHp}`;
    document.getElementById('pvp-enemy-hp-fill').style.width = `${(Math.max(0, eActive.currentHp) / eActive.maxHp) * 100}%`;
    document.getElementById('pvp-enemy-sprite').src = eActive.transformedImage || getCardImageUrl(eActive);
    updateBarColor('pvp-enemy-hp-fill', eActive.currentHp, eActive.maxHp);
    document.getElementById('pvp-enemy-team-ui').innerHTML = enemyTeam.map((p, i) => `<div class="ball ${p.currentHp <= 0 ? 'fainted' : (i === enemyActiveIdx ? 'active' : 'alive')}"></div>`).join('');

    renderModifiersUI(pActive, 'pvp-player-modifiers');
    renderModifiersUI(eActive, 'pvp-enemy-modifiers');

    const logBox = document.getElementById('pvp-battle-log');
    logBox.innerHTML = data.log.slice(-10).join('<br>'); 
    logBox.scrollTop = logBox.scrollHeight;

    if (data.status === 'playing') {
        let myAction = myRole === 'p1' ? data.action1 : data.action2;
        let iAmDead = pActive.currentHp <= 0;
        let enemyIsDead = eActive.currentHp <= 0;

        if (myAction) {
            document.getElementById('pvp-action-wrapper').classList.add('hidden');
            document.getElementById('pvp-waiting-action').classList.remove('hidden');
        } else {
            if (iAmDead) {
                document.getElementById('pvp-action-wrapper').classList.add('hidden');
                document.getElementById('pvp-waiting-action').classList.add('hidden');
                openSynchronousSwitchMenu(true);
            } else if (enemyIsDead) {
                submitAction({ type: 'wait' });
            } else {
                document.getElementById('pvp-waiting-action').classList.add('hidden');
                document.getElementById('pvp-action-wrapper').classList.remove('hidden');
                
                const container = document.getElementById('pvp-moves-container');
                container.innerHTML = "";
                pActive.moves.forEach(move => {
                    const btn = document.createElement('button');
                    btn.className = `move-btn type-${move.type}`;
                    
                    let displayPower = (move.damageClass === "status" || USELESS_MOVES.includes(move.nameEn) || FORCE_FLEE_MOVES.includes(move.nameEn) || STAT_CLEAR_MOVES.includes(move.nameEn) || OHKO_MOVES.includes(move.nameEn) || PROTECT_MOVES_LIST.includes(move.nameEn) || SEED_MOVES_LIST.includes(move.nameEn) || WEATHER_MOVES_DICT[move.nameEn] || move.nameEn === "transform" || ACCURACY_DROPS.includes(move.nameEn) || EVASION_UPS.includes(move.nameEn)) ? "-" : move.power;
                    if(FIXED_DAMAGE_MOVES[move.nameEn]) displayPower = "FIX";

                    btn.innerHTML = `<span class="move-name">${move.nameFr}</span><span style="font-size:0.7rem; font-weight:normal;">POW ${displayPower}</span>`;
                    btn.onclick = () => submitAction({ type: 'move', move: move });
                    container.appendChild(btn);
                });
            }
        }
    } else {
        document.getElementById('pvp-action-wrapper').classList.add('hidden');
        document.getElementById('pvp-waiting-action').classList.remove('hidden');
    }
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

function submitAction(action) {
    if (!currentBattleId || !myRole) return;
    document.getElementById('pvp-action-wrapper').classList.add('hidden');
    document.getElementById('pvp-waiting-action').classList.remove('hidden');
    
    db.collection('active_battles').doc(currentBattleId).update({
        ['action' + (myRole === 'p1' ? '1' : '2')]: action
    });
}

function openSynchronousSwitchMenu(forced = false) {
    document.getElementById('pvp-action-wrapper').classList.add('hidden');
    document.getElementById('pvp-team-selection').classList.remove('hidden');
    document.getElementById('pvp-selection-title').textContent = "Qui voulez-vous envoyer ?";
    document.getElementById('pvp-selection-counter').classList.add('hidden');
    document.getElementById('btn-confirm-pvp-team').classList.add('hidden');
    
    let btnCancel = document.getElementById('btn-cancel-pvp-team');
    btnCancel.textContent = "Retour";
    
    if (forced) {
        btnCancel.classList.add('hidden');
    } else {
        btnCancel.classList.remove('hidden');
        btnCancel.onclick = () => {
            document.getElementById('pvp-team-selection').classList.add('hidden');
            document.getElementById('pvp-action-wrapper').classList.remove('hidden');
        };
    }

    db.collection('active_battles').doc(currentBattleId).get().then(doc => {
        let data = doc.data();
        let myTeam = myRole === 'p1' ? data.team1 : data.team2;
        let myActiveIdx = myRole === 'p1' ? data.active1 : data.active2;
        
        const grid = document.getElementById('pvp-selection-grid');
        grid.innerHTML = "";
        
        myTeam.forEach((carte, index) => {
            const div = document.createElement('div');
            div.className = `mini-card`;
            div.style.backgroundImage = `url('${getCardImageUrl(carte)}')`;
            let hpBar = document.createElement('div');
            hpBar.style.cssText = `position:absolute; bottom:0; left:0; right:0; height:10px; background:#333; border-top:1px solid #000;`;
            let ratio = carte.currentHp / carte.maxHp;
            hpBar.innerHTML = `<div style="height:100%; width:${ratio*100}%; background:${ratio > 0.5 ? '#2ecc71' : '#e74c3c'};"></div>`;
            div.appendChild(hpBar);

            if(carte.currentHp <= 0 || index === myActiveIdx) {
                div.style.filter = "grayscale(1) brightness(0.5)"; div.style.cursor = "not-allowed";
            } else {
                div.onclick = () => {
                    document.getElementById('pvp-team-selection').classList.add('hidden');
                    submitAction({ type: forced ? 'force_switch' : 'switch', index: index });
                };
            }
            grid.appendChild(div);
        });
    });
}

function surrenderBattle() {
    if(confirm("Voulez-vous vraiment abandonner ce combat ?")) {
        db.collection('active_battles').doc(currentBattleId).update({
            status: 'finished',
            winner: myRole === 'p1' ? 'p2' : 'p1', 
            log: firebase.firestore.FieldValue.arrayUnion(`<b style="color:#e74c3c;">Un joueur a abandonné le combat !</b>`)
        });
    }
}

// =========================================================================
// 3. RÉSOLUTION DES DÉGÂTS (Exécuté uniquement par l'Hôte / P1)
// =========================================================================

function getEffectiveStat(entity, statName) {
    let statsObj = entity.battleStats || entity.stats || {};
    let base = statsObj[statName] || 10;
    let stage = entity.modifiers ? (entity.modifiers[statName] || 0) : 0;
    let multiplier = Math.max(2, 2 + stage) / Math.max(2, 2 - stage);
    let finalStat = Math.floor(base * multiplier);
    if (statName === 'speed' && entity.status === 'PAR') finalStat = Math.floor(finalStat / 2);
    return finalStat;
}

function preMoveCheckSync(entity, logs) {
    let name = entity.data.fr;
    if (entity.status === 'FRZ') {
        if (Math.random() < 0.2) { entity.status = null; logs.push(`<span style="color:#3498db">${name} est dégelé !</span>`); } 
        else { logs.push(`<span style="color:#3498db">${name} est complètement gelé !</span>`); return false; }
    }
    if (entity.status === 'SLP') {
        entity.statusTurns--;
        if (entity.statusTurns <= 0) { entity.status = null; logs.push(`<span style="color:#2c3e50">${name} se réveille !</span>`); } 
        else { logs.push(`<span style="color:#2c3e50">${name} dort profondément.</span>`); return false; }
    }
    if (entity.status === 'PAR') {
        if (Math.random() < 0.25) { logs.push(`<span style="color:#f1c40f">${name} est paralysé ! Il ne peut pas attaquer !</span>`); return false; }
    }
    if (entity.confusion > 0) {
        entity.confusion--;
        if (entity.confusion === 0) logs.push(`<span style="color:#e67e22">${name} n'est plus confus !</span>`);
        else {
            logs.push(`<span style="color:#e67e22">${name} est confus !</span>`);
            if (Math.random() < 0.33) {
                let dmg = Math.max(1, Math.floor(entity.maxHp / 8));
                entity.currentHp -= dmg;
                logs.push(`<span style="color:#e74c3c">Il se blesse dans sa confusion !</span>`);
                if(entity.currentHp <= 0) logs.push(`<b style="color:#e74c3c">${name} est K.O. !</b>`);
                return false;
            }
        }
    }
    return true;
}

function applyStatusSync(target, statusObj, targetName, logs) {
    if (statusObj.status === 'CNF') {
        if (target.confusion === 0) { 
            target.confusion = Math.floor(Math.random() * 4) + 2; 
            logs.push(`<span style="color:#e67e22">${targetName} devient confus !</span>`); 
        }
    } else {
        if (!target.status) {
            target.status = statusObj.status; target.toxCount = 0;
            if (statusObj.status === 'SLP') target.statusTurns = Math.floor(Math.random() * 3) + 1;
            let msgs = { "BRN":"est brûlé !", "PSN":"est empoisonné !", "TOX":"est gravement empoisonné !", "PAR":"est paralysé !", "FRZ":"est gelé !", "SLP":"s'endort !" };
            logs.push(`<span style="color:${STATUS_COLORS[statusObj.status]}">${targetName} ${msgs[statusObj.status]}</span>`);
        }
    }
}

function applyEndTurnStatusSync(entity, opponent, logs) {
    if (entity.currentHp <= 0) return;
    let name = entity.data.fr;

    if (entity.isSeeded && entity.currentHp > 0) {
        let drain = Math.max(1, Math.floor(entity.maxHp / 8));
        entity.currentHp -= drain;
        opponent.currentHp = Math.min(opponent.maxHp, opponent.currentHp + drain);
        logs.push(`<span style="color:#2ecc71">Vampigraine draine l'énergie de ${name} !</span>`);
    }

    if (entity.status === 'BRN') {
        entity.currentHp -= Math.max(1, Math.floor(entity.maxHp / 16)); logs.push(`<span style="color:#e67e22">${name} souffre de sa brûlure !</span>`);
    } else if (entity.status === 'PSN') {
        entity.currentHp -= Math.max(1, Math.floor(entity.maxHp / 8)); logs.push(`<span style="color:#9b59b6">${name} souffre du poison !</span>`);
    } else if (entity.status === 'TOX') {
        entity.toxCount++; entity.currentHp -= Math.max(1, Math.floor((entity.maxHp * entity.toxCount) / 16)); logs.push(`<span style="color:#8e44ad">${name} souffre du poison grave !</span>`);
    }

    entity.turnsActive = (entity.turnsActive || 0) + 1;
    if (entity.currentHp <= 0) logs.push(`<b style="color:#e74c3c">${name} est K.O. !</b>`);
}

function applyWeatherDamageSync(entity, weather, logs) {
    if (entity.currentHp <= 0) return;
    let types = entity.types || [];
    let name = entity.data.fr;
    if (weather === 'sandstorm' && !types.includes('rock') && !types.includes('ground') && !types.includes('steel')) {
        entity.currentHp -= Math.max(1, Math.floor(entity.maxHp / 16));
        logs.push(`<span style="color:#e67e22">${name} subit la tempête de sable !</span>`);
    }
    if (weather === 'hail' && !types.includes('ice')) {
        entity.currentHp -= Math.max(1, Math.floor(entity.maxHp / 16));
        logs.push(`<span style="color:#bdc3c7">${name} subit la grêle !</span>`);
    }
    if (entity.currentHp <= 0) logs.push(`<b style="color:#e74c3c">${name} est K.O. !</b>`);
}

function revertTransformation(pkmn) {
    if (pkmn.transformedImage) {
        pkmn.types = [...pkmn.original.types];
        pkmn.stats = JSON.parse(JSON.stringify(pkmn.original.stats));
        pkmn.moves = JSON.parse(JSON.stringify(pkmn.original.moves));
        pkmn.transformedImage = null;
    }
}

async function resolveSynchronousTurn(data, battleRef) {
    let t1 = data.team1; let t2 = data.team2;
    let a1 = data.action1; let a2 = data.action2;
    let active1 = data.active1; let active2 = data.active2;
    let turnLogs = ["<hr>"];

    let p1 = t1[active1]; let p2 = t2[active2];

    let isReplacementTurn = (a1.type === 'force_switch' || a2.type === 'force_switch' || a1.type === 'wait' || a2.type === 'wait');

    if (isReplacementTurn) {
        if (a1.type === 'force_switch') { 
            active1 = a1.index; p1 = t1[active1]; 
            p1.turnsActive = 0; p1.isSeeded = false; 
            turnLogs.push(`Le Joueur 1 envoie <b>${p1.data.fr}</b> !`); 
        }
        if (a2.type === 'force_switch') { 
            active2 = a2.index; p2 = t2[active2]; 
            p2.turnsActive = 0; p2.isSeeded = false; 
            turnLogs.push(`Le Joueur 2 envoie <b>${p2.data.fr}</b> !`); 
        }
    } else {
        if (a1.type === 'switch') { 
            revertTransformation(p1); 
            active1 = a1.index; p1 = t1[active1]; 
            p1.turnsActive = 0; p1.isSeeded = false; 
            for(let s in p1.modifiers) p1.modifiers[s] = 0;
            turnLogs.push(`Joueur 1 envoie <b>${p1.data.fr}</b> !`); 
        }
        if (a2.type === 'switch') { 
            revertTransformation(p2); 
            active2 = a2.index; p2 = t2[active2]; 
            p2.turnsActive = 0; p2.isSeeded = false; 
            for(let s in p2.modifiers) p2.modifiers[s] = 0;
            turnLogs.push(`Joueur 2 envoie <b>${p2.data.fr}</b> !`); 
        }

        p1.isProtected = false; p2.isProtected = false;
        p1.flinched = false; p2.flinched = false;

        let move1 = a1.type === 'move' ? a1.move : null;
        let move2 = a2.type === 'move' ? a2.move : null;

        if (move1 && move2) {
            let p1Speed = getEffectiveStat(p1, 'speed'); let p2Speed = getEffectiveStat(p2, 'speed');
            
            let p1Priority = PRIORITY_MOVES.includes(move1.nameEn) ? 1 : 0;
            if (move1.nameEn === "fake-out") p1Priority = 3;
            if (PROTECT_MOVES_LIST.includes(move1.nameEn)) p1Priority = 4;

            let p2Priority = PRIORITY_MOVES.includes(move2.nameEn) ? 1 : 0;
            if (move2.nameEn === "fake-out") p2Priority = 3;
            if (PROTECT_MOVES_LIST.includes(move2.nameEn)) p2Priority = 4;

            let p1GoesFirst = p1Priority > p2Priority || (p1Priority === p2Priority && p1Speed >= p2Speed);
            if (p1Speed === p2Speed && p1Priority === p2Priority) p1GoesFirst = Math.random() > 0.5;

            if (p1GoesFirst) {
                if(preMoveCheckSync(p1, turnLogs)) evalMove(p1, p2, move1, turnLogs, data);
                if (p2.currentHp > 0 && p1.currentHp > 0) { if(preMoveCheckSync(p2, turnLogs)) evalMove(p2, p1, move2, turnLogs, data); }
            } else {
                if(preMoveCheckSync(p2, turnLogs)) evalMove(p2, p1, move2, turnLogs, data);
                if (p1.currentHp > 0 && p2.currentHp > 0) { if(preMoveCheckSync(p1, turnLogs)) evalMove(p1, p2, move1, turnLogs, data); }
            }
        } 
        else if (move1 && p1.currentHp > 0) { if(preMoveCheckSync(p1, turnLogs)) evalMove(p1, p2, move1, turnLogs, data); }
        else if (move2 && p2.currentHp > 0) { if(preMoveCheckSync(p2, turnLogs)) evalMove(p2, p1, move2, turnLogs, data); }

        applyEndTurnStatusSync(p1, p2, turnLogs);
        applyEndTurnStatusSync(p2, p1, turnLogs);
        
        if (data.weather && data.weather !== 'none') {
            data.weatherTurns--;
            if (data.weatherTurns <= 0) {
                turnLogs.push(`<b>La météo redevient normale.</b>`);
                data.weather = 'none';
            } else {
                if(p1.currentHp > 0) applyWeatherDamageSync(p1, data.weather, turnLogs);
                if(p2.currentHp > 0) applyWeatherDamageSync(p2, data.weather, turnLogs);
            }
        }
    }

    let p1Alive = t1.some(p => p.currentHp > 0);
    let p2Alive = t2.some(p => p.currentHp > 0);
    let status = 'playing';
    let winner = null;

    if (!p1Alive && !p2Alive) { status = 'finished'; winner = 'draw'; turnLogs.push("<b>Match Nul !</b>"); }
    else if (!p1Alive) { status = 'finished'; winner = 'p2'; turnLogs.push(`<b>Le Joueur 2 gagne le combat !</b>`); }
    else if (!p2Alive) { status = 'finished'; winner = 'p1'; turnLogs.push(`<b>Le Joueur 1 gagne le combat !</b>`); }

    await battleRef.update({
        team1: t1, team2: t2,
        active1: active1, active2: active2,
        action1: null, action2: null,
        weather: data.weather, weatherTurns: data.weatherTurns,
        log: data.log.concat(turnLogs),
        status: status, winner: winner
    });
}

function evalMove(atk, def, move, logs, battleData) {
    if (atk.flinched) {
        logs.push(`<span style="color:#f39c12">${atk.data.fr} a la trouille et ne peut pas attaquer !</span>`);
        return;
    }

    logs.push(`<b>${atk.data.fr}</b> utilise <span style="color:#3498db">${move.nameFr}</span> !`);

    // MÉCANIQUE : MÉTÉO
    if (WEATHER_MOVES_DICT[move.nameEn]) {
        let wInfo = WEATHER_MOVES_DICT[move.nameEn];
        battleData.weather = wInfo.weather;
        battleData.weatherTurns = 5;
        logs.push(`<span style="color:#f39c12"><b>${wInfo.msg}</b></span>`);
        return;
    }

    // MÉCANIQUE : PRÉCISION / ESQUIVE
    if (ACCURACY_DROPS.includes(move.nameEn)) {
        def.modifiers.accuracy = Math.max(-6, (def.modifiers.accuracy || 0) - 1);
        logs.push(`<span style="color:#e74c3c">La précision de ${def.data.fr} diminue !</span>`);
        return;
    }
    if (EVASION_UPS.includes(move.nameEn)) {
        atk.modifiers.evasion = Math.min(6, (atk.modifiers.evasion || 0) + 1);
        logs.push(`<span style="color:#3498db">L'esquive de ${atk.data.fr} augmente !</span>`);
        return;
    }

    let isStatusOnSelf = move.damageClass === "status" && (EVASION_UPS.includes(move.nameEn) || HEAL_MOVES.includes(move.nameEn) || PROTECT_MOVES_LIST.includes(move.nameEn));
    if (!isStatusOnSelf && move.nameEn !== "transform") {
        let accStage = Math.max(-6, Math.min(6, (atk.modifiers.accuracy || 0) - (def.modifiers.evasion || 0)));
        let accMult = accStage >= 0 ? (3 + accStage) / 3 : 3 / (3 - accStage);
        let moveAcc = move.accuracy || 100;
        
        if (Math.random() * 100 > moveAcc * accMult) {
            logs.push(`<b>Mais l'attaque a raté !</b>`);
            return;
        }
    }
    
    // MÉCANIQUE : BLUFF
    if (move.nameEn === "fake-out") {
        if ((atk.turnsActive || 0) > 0) { logs.push(`Mais cela échoue !`); return; }
    }

    // MÉCANIQUE : MORPHING
    if (move.nameEn === "transform") {
        atk.types = [...(def.types || [])];
        atk.stats = JSON.parse(JSON.stringify(def.stats));
        atk.modifiers = JSON.parse(JSON.stringify(def.modifiers || {}));
        atk.moves = JSON.parse(JSON.stringify(def.moves));
        atk.transformedImage = def.transformedImage || getCardImageUrl(def);
        logs.push(`<span style="color:#9b59b6">${atk.data.fr} se transforme en ${def.data.fr} !</span>`);
        return;
    }

    // MÉCANIQUE : ABRI
    if (PROTECT_MOVES_LIST.includes(move.nameEn)) {
        let chance = Math.pow(0.5, atk.protectCount || 0);
        if (Math.random() < chance) {
            atk.isProtected = true; atk.protectCount = (atk.protectCount || 0) + 1;
            logs.push(`<span style="color:#2ecc71">${atk.data.fr} se protège !</span>`);
        } else {
            atk.protectCount = 0; logs.push(`Mais cela échoue !`);
        }
        return;
    } else {
        atk.protectCount = 0;
    }

    if (def.isProtected) {
        logs.push(`<span style="color:#bdc3c7">${def.data.fr} s'est protégé contre l'attaque !</span>`);
        return;
    }

    // MÉCANIQUE : VAMPIGRAINE
    if (SEED_MOVES_LIST.includes(move.nameEn)) {
        let defTypes = def.types || (def.battleStats ? def.battleStats.types : []);
        if (defTypes.includes('grass')) { logs.push(`Ça n'affecte pas les Pokémon Plante !`); } 
        else if (def.isSeeded) { logs.push(`${def.data.fr} est déjà infecté !`); } 
        else { def.isSeeded = true; logs.push(`<span style="color:#2ecc71">${def.data.fr} est infecté par Vampigraine !</span>`); }
        return;
    }

    if (USELESS_MOVES.includes(move.nameEn)) { logs.push(`Mais il ne se passe rien...`); return; }
    if (HEAL_MOVES.includes(move.nameEn)) {
        atk.currentHp = Math.min(atk.maxHp, atk.currentHp + Math.floor(atk.maxHp / 2));
        logs.push(`<span style="color:#2ecc71">${atk.data.fr} regagne des PV !</span>`); return;
    }
    if (OHKO_MOVES.includes(move.nameEn)) {
        if (Math.random() < 0.30) { def.currentHp = 0; logs.push(`<span style="color:#f39c12">K.O. en un coup !</span>`); } 
        else logs.push(`Mais l'attaque a raté...`);
        return;
    }
    if (STAT_CLEAR_MOVES.includes(move.nameEn)) {
        for(let s in atk.modifiers) atk.modifiers[s] = 0; for(let s in def.modifiers) def.modifiers[s] = 0;
        logs.push(`<span style="color:#3498db">Tous les changements de stats sont annulés !</span>`); return;
    }

    if (STATUS_CONDITIONS[move.nameEn]) {
        let statObj = STATUS_CONDITIONS[move.nameEn];
        if (Math.random() * 100 <= statObj.chance) {
            let targetEntity = (statObj.status === 'CNF' && move.nameEn === 'swagger') ? def : def; 
            applyStatusSync(targetEntity, statObj, def.data.fr, logs);
            if(statObj.stat) {
                targetEntity.modifiers[statObj.stat] = Math.max(-6, Math.min(6, (targetEntity.modifiers[statObj.stat]||0) + statObj.stage));
                if (statObj.stage > 0) logs.push(`<span style="color:#3498db">${EXTENDED_STAT_NAMES[statObj.stat]} de ${def.data.fr} augmente !</span>`);
                else logs.push(`<span style="color:#e74c3c">${EXTENDED_STAT_NAMES[statObj.stat]} de ${def.data.fr} diminue !</span>`);
            }
        } else logs.push(`Mais l'attaque a raté...`);
        return;
    }

    if (move.damageClass === "status" || STATUS_MOVES[move.nameEn]) {
        const statusData = STATUS_MOVES[move.nameEn];
        if (statusData) {
            let targetEntity = statusData.target === "enemy" ? def : atk;
            let targetName = statusData.target === "enemy" ? def.data.fr : atk.data.fr;
            for (let effect of statusData.effects) {
                targetEntity.modifiers[effect.stat] = Math.max(-6, Math.min(6, (targetEntity.modifiers[effect.stat]||0) + effect.stage));
                let statName = EXTENDED_STAT_NAMES[effect.stat];
                if (effect.stage > 0) logs.push(`<span style="color:#3498db">${statName} de ${targetName} augmente !</span>`);
                else logs.push(`<span style="color:#e74c3c">${statName} de ${targetName} diminue !</span>`);
            }
        }
        return; 
    }

    let A = move.damageClass === 'special' ? getEffectiveStat(atk, 'spatk') : getEffectiveStat(atk, 'atk');
    let D = move.damageClass === 'special' ? getEffectiveStat(def, 'spdef') : getEffectiveStat(def, 'def');
    
    if (atk.status === 'BRN' && move.damageClass === 'physical') A = Math.floor(A / 2);
    if (KAMIKAZE_MOVES.includes(move.nameEn)) A *= 1.5;

    // MÉCANIQUE : DÉGÂTS INFLUENCÉS PAR LA MÉTÉO
    let weatherMult = 1;
    if (battleData.weather === 'sun') { if (move.type === 'fire') weatherMult = 1.5; if (move.type === 'water') weatherMult = 0.5; }
    if (battleData.weather === 'rain') { if (move.type === 'water') weatherMult = 1.5; if (move.type === 'fire') weatherMult = 0.5; }

    let baseDmg = Math.floor(Math.floor(Math.floor(2 * (atk.level||1) / 5 + 2) * move.power * A / D) / 50) + 2;
    
    let atkTypes = atk.types || [];
    let defTypes = def.types || [];

    let stab = atkTypes.includes(move.type) ? 1.5 : 1;
    let mult = getEffectiveness(move.type, defTypes);
    
    let isCrit = Math.random() < (HIGH_CRIT_MOVES.includes(move.nameEn) ? 0.125 : 0.0625);
    let dmg = Math.floor(baseDmg * stab * mult * weatherMult * (Math.random() * (1 - 0.85) + 0.85) * (isCrit ? 1.5 : 1));
    
    if (FIXED_DAMAGE_MOVES[move.nameEn] !== undefined) {
        let val = FIXED_DAMAGE_MOVES[move.nameEn];
        dmg = val === "level" ? (atk.level || 1) : val;
        if (mult === 0) dmg = 0; 
    }

    if (move.power == 0 || !move.power) dmg = 0; 
    if (mult === 0) dmg = 0; else dmg = Math.max(1, dmg);

    let hitCount = 1;
    if (MULTI_HIT_2_5.includes(move.nameEn)) hitCount = (Math.random() < 0.35) ? 2 : (Math.random() < 0.7 ? 3 : (Math.random() < 0.85 ? 4 : 5));
    else if (MULTI_HIT_2.includes(move.nameEn)) hitCount = 2;

    let totalDmg = 0;
    for(let i=0; i<hitCount; i++) {
        if(def.currentHp <= 0) break;
        def.currentHp -= dmg;
        totalDmg += dmg;
    }

    if (dmg > 0 && isCrit) logs.push(`<span style="color:#f39c12">Coup Critique !</span>`);
    if (hitCount > 1 && totalDmg > 0) logs.push(`Touché ${hitCount} fois !`);
    if (mult > 1) logs.push(`C'est super efficace !`);
    if (mult < 1 && mult > 0) logs.push(`Ce n'est pas très efficace...`);
    if (mult === 0 && move.power > 0) logs.push(`Ça n'a aucun effet.`);

    if (KAMIKAZE_MOVES.includes(move.nameEn)) {
        atk.currentHp = 0; logs.push(`<span style="color:#e74c3c">${atk.data.fr} se sacrifie !</span>`);
    }

    if (move.nameEn === "fake-out" && def.currentHp > 0 && totalDmg > 0) def.flinched = true;

    if (totalDmg > 0 && def.currentHp > 0) {
        if (DRAIN_MOVES.includes(move.nameEn)) {
            atk.currentHp = Math.min(atk.maxHp, atk.currentHp + Math.max(1, Math.floor(totalDmg / 2)));
            logs.push(`<span style="color:#2ecc71">${def.data.fr} voit son énergie aspirée !</span>`);
        }
        if (RECOIL_MOVES.includes(move.nameEn)) {
            atk.currentHp -= Math.max(1, Math.floor(totalDmg / 3));
            logs.push(`<span style="color:#e74c3c">${atk.data.fr} est blessé par le contrecoup !</span>`);
        }
        const secEffect = SECONDARY_EFFECTS[move.nameEn];
        if (secEffect && Math.random() <= secEffect.chance) {
            let tEnt = secEffect.target === "enemy" ? def : atk;
            for (let effect of secEffect.effects) {
                tEnt.modifiers[effect.stat] = Math.max(-6, Math.min(6, (tEnt.modifiers[effect.stat]||0) + effect.stage));
                if (effect.stage > 0) logs.push(`<span style="color:#3498db">${EXTENDED_STAT_NAMES[effect.stat]} de ${secEffect.target==="enemy"?def.data.fr:atk.data.fr} augmente !</span>`);
                else logs.push(`<span style="color:#e74c3c">${EXTENDED_STAT_NAMES[effect.stat]} de ${secEffect.target==="enemy"?def.data.fr:atk.data.fr} diminue !</span>`);
            }
        }
        const secStatus = SECONDARY_STATUS[move.nameEn];
        if (secStatus && Math.random() * 100 <= secStatus.chance) applyStatusSync(def, secStatus, def.data.fr, logs);
    }

    if (def.currentHp <= 0) logs.push(`<b style="color:#e74c3c">${def.data.fr} est K.O. !</b>`);
}

async function endRealTimeBattle(data) {
    if (unsubscribeBattle) { unsubscribeBattle(); unsubscribeBattle = null; }
    
    let isWin = false;
    if (data.winner === myRole) {
        logMessage(`<b style="color:#2ecc71; font-size:1.2rem;">VICTOIRE !</b>`);
        isWin = true;
    } else if (data.winner === 'draw') {
        logMessage(`<b>Égalité.</b>`);
    } else {
        logMessage(`<b style="color:#e74c3c; font-size:1.2rem;">DÉFAITE...</b>`);
    }

    if (isWin && data.mode === 'ranked') {
        logMessage(`<span style="color:#f1c40f">🎁 Vous remportez un Booster Spécial (Shiny x3) !</span>`);
        await db.collection('users').doc(state.currentUser).update({
            specialBoostersLeft: firebase.firestore.FieldValue.increment(1)
        });
    }

    let oppId = myRole === 'p1' ? data.p2 : data.p1;
    let record = {
        player1: oppId, player2: state.currentUser,
        winner: data.winner === myRole ? state.currentUser : oppId,
        mode: data.mode, timestamp: Date.now()
    };
    
    let myHist = state.currentUserData.battleHistory || [];
    myHist.push(record); if(myHist.length > 20) myHist.shift();
    
    await db.collection('users').doc(state.currentUser).update({
        activeBattle: firebase.firestore.FieldValue.delete(),
        battleHistory: myHist
    });

    currentBattleId = null;
    
    setTimeout(() => {
        document.getElementById('pvp-battle-arena').classList.add('hidden');
        document.getElementById('pvp-menus').classList.remove('hidden');
        renderBattleUI();
    }, 5000);
}