import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { getPokemonPow, getPokemonDetails, getCardImageUrl, getMovesForLevel } from '../utils.js';
import { allerASection } from './navController.js';
import { 
    USELESS_MOVES, PRIORITY_MOVES, HEAL_MOVES, DRAIN_MOVES, RECOIL_MOVES, MULTI_HIT_2_5, MULTI_HIT_2, 
    FLINCH_MOVES, SECONDARY_EFFECTS, ROLLOUT_MOVES, STATUS_MOVES, STAT_NAMES, 
    OHKO_MOVES, KAMIKAZE_MOVES, FORCE_FLEE_MOVES, STAT_CLEAR_MOVES, FIXED_DAMAGE_MOVES,
    STATUS_CONDITIONS, SECONDARY_STATUS, ABILITIES_DB, POWDER_MOVES,
    TAUNT_MOVES, REST_MOVES, PAIN_SPLIT_MOVES, PERISH_SONG_MOVES, DESTINY_BOND_MOVES,
    COUNTER_MOVES, MIRROR_COAT_MOVES, BIDE_MOVES, ENCORE_MOVES, DISABLE_MOVES, WISH_MOVES
} from '../data/campagneData.js';
import { getEffectiveStat, checkMoveHit, calculateDamage } from '../battleEngine.js';

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

let currentBattleId = null;
let myRole = null; 
let unsubscribeBattle = null;

const STATUS_COLORS = { "BRN": "#e67e22", "PSN": "#9b59b6", "TOX": "#8e44ad", "PAR": "#f1c40f", "FRZ": "#3498db", "SLP": "#2c3e50" };

function logMessage(msg) {
    const logBox = document.getElementById('pvp-battle-log');
    if(!logBox) return; logBox.innerHTML += `<br>> ${msg}`; logBox.scrollTop = logBox.scrollHeight;
}

function updateBarColor(id, hp, maxHp) {
    const el = document.getElementById(id);
    if (!el) return;
    const ratio = hp / maxHp;
    el.style.backgroundColor = ratio > 0.5 ? "#2ecc71" : (ratio > 0.2 ? "#f39c12" : "#e74c3c");
}

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

function renderSynchronousUI(data) {
    updateGlobalFieldsUI(data);

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
    document.getElementById('pvp-player-sprite').style.opacity = pActive.invulnerable ? "0.3" : "1";

    document.getElementById('pvp-enemy-name').textContent = eActive.data.fr;
    document.getElementById('pvp-enemy-lvl').textContent = `Niv. ${eActive.level || 1}`;
    document.getElementById('pvp-enemy-hp-text').textContent = `${Math.max(0, eActive.currentHp)} / ${eActive.maxHp}`;
    document.getElementById('pvp-enemy-hp-fill').style.width = `${(Math.max(0, eActive.currentHp) / eActive.maxHp) * 100}%`;
    document.getElementById('pvp-enemy-sprite').src = eActive.transformedImage || getCardImageUrl(eActive);
    updateBarColor('pvp-enemy-hp-fill', eActive.currentHp, eActive.maxHp);
    document.getElementById('pvp-enemy-team-ui').innerHTML = enemyTeam.map((p, i) => `<div class="ball ${p.currentHp <= 0 ? 'fainted' : (i === enemyActiveIdx ? 'active' : 'alive')}"></div>`).join('');
    document.getElementById('pvp-enemy-sprite').style.opacity = eActive.invulnerable ? "0.3" : "1";

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
                
                // Fonction utilitaire pour générer le Tooltip en PvP
                const getTooltipHTML = (moveNameEn, moveNameFr, powerDisplay) => {
                    let sData = skillsDB[moveNameEn] || {};
                    let accStr = sData.accuracy ? sData.accuracy + "%" : "100%";
                    let descStr = sData.desc || "Description inconnue.";
                    return `
                        <div class="move-tooltip">
                            <strong style="color:#f1c40f;">${moveNameFr}</strong><br>
                            <span style="font-size:0.7rem; color:#aaa;">Puis: ${powerDisplay} | Préc: ${accStr}</span><br>
                            <div style="margin-top:5px; font-style:italic; line-height:1.2;">${descStr}</div>
                        </div>`;
                };
                
                if (pActive.chargingMove) {
                    container.innerHTML = `<button class="move-btn type-normal" disabled style="grid-column:span 2;">En attente d'attaque...</button>`;
                } else if (pActive.rolloutCount > 0) {
                    // -- FORCER ROULADE --
                    let rMove = pActive.moves.find(m => ROLLOUT_MOVES.includes(m.nameEn));
                    if (rMove) {
                        const btn = document.createElement('button');
                        btn.className = `move-btn type-${rMove.type}`;
                        let tooltipHTML = getTooltipHTML(rMove.nameEn, rMove.nameFr, rMove.power);
                        btn.innerHTML = `<span class="move-name">${rMove.nameFr}</span><span style="font-size:0.7rem; font-weight:normal;">TOUR ${pActive.rolloutCount + 1}/5</span>${tooltipHTML}`;
                        btn.style.gridColumn = "span 2";
                        btn.onclick = () => submitAction({ type: 'move', move: rMove });
                        container.appendChild(btn);
                    } else pActive.rolloutCount = 0;
                } else {
                    pActive.moves.forEach(move => {
                        const btn = document.createElement('button');
                        btn.className = `move-btn type-${move.type}`;
                        let displayPower = (move.damageClass === "status" || USELESS_MOVES.includes(move.nameEn) || FORCE_FLEE_MOVES.includes(move.nameEn) || STAT_CLEAR_MOVES.includes(move.nameEn) || OHKO_MOVES.includes(move.nameEn) || PROTECT_MOVES_LIST.includes(move.nameEn) || SEED_MOVES_LIST.includes(move.nameEn) || WEATHER_MOVES_DICT[move.nameEn] || move.nameEn === "transform" || ACCURACY_DROPS.includes(move.nameEn) || EVASION_UPS.includes(move.nameEn) || HAZARD_MOVES.includes(move.nameEn) || HAZARD_CLEAR_MOVES.includes(move.nameEn) || SCREENS.includes(move.nameEn) || WINDS.includes(move.nameEn) || TERRAINS.includes(move.nameEn) || TRAP_MOVES.includes(move.nameEn)) ? "-" : move.power;
                        if(FIXED_DAMAGE_MOVES[move.nameEn]) displayPower = "FIX";

                        let tooltipHTML = getTooltipHTML(move.nameEn, move.nameFr, displayPower);

                        btn.innerHTML = `<span class="move-name">${move.nameFr}</span><span style="font-size:0.7rem; font-weight:normal;">POW ${displayPower}</span>${tooltipHTML}`;
                        
                        // --- BLOCAGES UI ---
                        if (pActive.taunted && move.damageClass === 'status') {
                            btn.disabled = true;
                            btn.style.opacity = "0.4";
                            btn.title = "Interdit sous l'effet de Provoc !";
                        } else if (pActive.disabledMove && pActive.disabledMove.turns > 0 && pActive.disabledMove.name === move.nameEn) {
                            btn.disabled = true;
                            btn.style.opacity = "0.4";
                            btn.title = "Capacité entravée !";
                        } else {
                            btn.onclick = () => submitAction({ type: 'move', move: move });
                        }
                        
                        container.appendChild(btn);
                    });
                }
            }
        }
    } else {
        document.getElementById('pvp-action-wrapper').classList.add('hidden');
        document.getElementById('pvp-waiting-action').classList.remove('hidden');
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
        weather: 'none', weatherTurns: 0, trickRoom: 0, terrain: 'none', terrainTurns: 0, delayedAttacks: [],
        screens1: { reflect: 0, lightScreen: 0, auroraVeil: 0, tailwind: 0 },
        screens2: { reflect: 0, lightScreen: 0, auroraVeil: 0, tailwind: 0 },
        hazards1: { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false },
        hazards2: { stealthRock: false, spikes: 0, toxicSpikes: 0, stickyWeb: false },
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
            chargingMove: null, invulnerable: false, trapped: false, bound: {name: null, turns: 0}, rolloutCount: 0,
            types: [...d.types],
            original: {
                types: [...d.types],
                stats: JSON.parse(JSON.stringify(baseStatsObj)),
                moves: JSON.parse(JSON.stringify(initialMoves))
            }
        };
    }));
}

function openFriendlyTeamSelector(friendId) {
    document.getElementById('pvp-challenge-modal').classList.add('hidden');
    allerASection('section-combats');
    document.getElementById('pvp-menus').classList.add('hidden');
    document.getElementById('pvp-team-selection').classList.remove('hidden');
    document.getElementById('pvp-selection-title').textContent = "Sélectionnez 4 Pokémon pour le combat";
    
    let selected = [];
    renderTeamSelectionGrid(selected, () => {
        let btn = document.getElementById('btn-confirm-pvp-team');
        if(selected.length === 4) { btn.classList.remove('hidden'); btn.onclick = () => sendChallenge(friendId, 'friendly', selected); } 
        else btn.classList.add('hidden');
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
        if(selected.length === 4) { btn.classList.remove('hidden'); btn.onclick = () => createBattleRoom(req, enemyTeam, selected); } 
        else btn.classList.add('hidden');
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
    
    let rawCollection = (state.currentUserData.collection || []).filter(c => !c.isBaie);
    
    // --- DÉDUPLICATION DES POKÉMON ---
    let uniqueMap = {};
    rawCollection.forEach(c => {
        // On crée une clé unique pour chaque variante (ex: 25_normal_shiny, ou 6_mega-x_normal)
        let key = `${c.pokedexNumber}_${c.mega ? c.megaForm : 'normal'}_${c.shiny ? 'shiny' : 'normal'}`;
        
        if (!uniqueMap[key]) {
            uniqueMap[key] = c;
        } else {
            // S'il y a un doublon, on garde celui avec le rang (maxLevel) le plus élevé par sécurité
            let currentMax = uniqueMap[key].maxLevel || 20;
            let newMax = c.maxLevel || 20;
            if (newMax > currentMax) {
                uniqueMap[key] = c;
            }
        }
    });
    
    // On transforme la map en tableau et on trie par numéro de Pokédex décroissant
    let valid = Object.values(uniqueMap).sort((a, b) => b.pokedexNumber - a.pokedexNumber);
    
    valid.forEach(carte => {
        // Sécurité en cas de données manquantes
        let d = carte.data || state.pokemonDataList[carte.pokedexNumber - 1] || {}; 
        
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

function joinRealTimeBattle(battleId) {
    currentBattleId = battleId;
    allerASection('section-combats');
    document.getElementById('pvp-team-selection').classList.add('hidden');
    document.getElementById('pvp-menus').classList.add('hidden');
    document.getElementById('pvp-battle-arena').classList.remove('hidden');

    unsubscribeBattle = db.collection('active_battles').doc(battleId).onSnapshot(doc => {
        if (!doc.exists) {
            db.collection('users').doc(state.currentUser).update({ activeBattle: firebase.firestore.FieldValue.delete() });
            document.getElementById('pvp-battle-arena').classList.add('hidden');
            document.getElementById('pvp-menus').classList.remove('hidden');
            if (unsubscribeBattle) { unsubscribeBattle(); unsubscribeBattle = null; }
            currentBattleId = null;
            return;
        }
        const data = doc.data();
        
        myRole = (data.p1 === state.currentUser) ? 'p1' : 'p2';
        renderSynchronousUI(data);

        if (myRole === 'p1' && data.action1 && data.action2 && data.status === 'playing') resolveSynchronousTurn(data, doc.ref);
        if (data.status === 'finished') endRealTimeBattle(data);
    });

    document.getElementById('btn-pvp-switch').onclick = () => openSynchronousSwitchMenu(false);
    document.getElementById('btn-pvp-surrender').onclick = () => surrenderBattle();
}

function updateGlobalFieldsUI(data) {
    let globalBanner = document.getElementById('pvp-global-banner');
    const logBox = document.getElementById('pvp-battle-log');
    
    if (!globalBanner && logBox) {
        globalBanner = document.createElement('div');
        globalBanner.id = 'pvp-global-banner';
        globalBanner.style.cssText = "text-align:center; font-weight:bold; padding:5px; margin-bottom:5px; border-radius:5px; transition: 0.3s; font-size:0.8rem;";
        logBox.parentNode.insertBefore(globalBanner, logBox);
    }
    
    if (globalBanner) {
        let texts = [];
        if (data.weather !== 'none') {
            if (data.weather === 'sun') texts.push("☀️ Soleil");
            if (data.weather === 'rain') texts.push("🌧️ Pluie");
            if (data.weather === 'sandstorm') texts.push("🌪️ Sable");
            if (data.weather === 'hail') texts.push("❄️ Grêle");
        }
        if (data.terrain && data.terrain !== 'none') texts.push(`🌍 Terrain ${data.terrain}`);
        if (data.trickRoom > 0) texts.push("🌀 Distorsion active");
        
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

function submitAction(action) {
    if (!currentBattleId || !myRole) return;
    document.getElementById('pvp-action-wrapper').classList.add('hidden');
    document.getElementById('pvp-waiting-action').classList.remove('hidden');
    
    db.collection('active_battles').doc(currentBattleId).update({
        ['action' + (myRole === 'p1' ? '1' : '2')]: action
    });
}

function openSynchronousSwitchMenu(forced = false) {
    db.collection('active_battles').doc(currentBattleId).get().then(doc => {
        let data = doc.data();
        let myTeam = myRole === 'p1' ? data.team1 : data.team2;
        let myActiveIdx = myRole === 'p1' ? data.active1 : data.active2;
        let activePkmn = myTeam[myActiveIdx];

        if (!forced && (activePkmn.trapped || (activePkmn.bound && activePkmn.bound.turns > 0))) {
            logMessage(`<b>${activePkmn.data.fr} est piégé et ne peut pas être retiré !</b>`);
            return;
        }

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
    let types = target.types || (target.battleStats ? target.battleStats.types : []);

    // IMMUNITÉS LIÉES AUX TYPES (Acier, Poison, Feu, Electrik, Glace)
    if ((statusObj.status === 'PSN' || statusObj.status === 'TOX') && (types.includes('poison') || types.includes('steel'))) return;
    if (statusObj.status === 'BRN' && types.includes('fire')) return;
    if (statusObj.status === 'PAR' && types.includes('electric')) return;
    if (statusObj.status === 'FRZ' && types.includes('ice')) return;

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

    if (entity.bound && entity.bound.turns > 0) {
        let bindDmg = Math.max(1, Math.floor(entity.maxHp / 8));
        entity.currentHp -= bindDmg;
        entity.bound.turns--;
        logs.push(`<span style="color:#e74c3c">${name} souffre de l'étreinte de ${entity.bound.name} !</span>`);
        if (entity.bound.turns === 0) {
            entity.trapped = false;
            logs.push(`<b>${name} est libéré de ${entity.bound.name} !</b>`);
        }
    }

    // REQUIEM
    if (entity.perishCount > 0) {
        entity.perishCount--;
        if (entity.perishCount === 0) {
            entity.currentHp = 0; 
            logs.push(`<b style="color:#34495e">Le compte à rebours de Requiem tombe à zéro pour ${name} !</b>`);
        } else {
            logs.push(`<span style="color:#7f8c8d">Le compte à rebours de Requiem de ${name} est à ${entity.perishCount}.</span>`);
        }
    }

    // DIMINUTION PROVOC & ENTRAVE
    if (entity.taunted && entity.taunted > 0) {
        entity.taunted--;
        if (entity.taunted === 0) logs.push(`<b>${name} n'est plus provoqué.</b>`);
    }
    if (entity.disabledMove && entity.disabledMove.turns > 0) {
        entity.disabledMove.turns--;
        if (entity.disabledMove.turns === 0) {
            logs.push(`<b>${name} n'est plus entravé !</b>`);
            entity.disabledMove = null;
        }
    }

    // RÉINITIALISATION LIEN DU DESTIN
    entity.destinyBond = false;

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


function applyHazardsSync(entity, hazards, logs) {
    let name = entity.data.fr;
    let types = entity.types || [];
    if (hazards.stealthRock) {
        let mult = getEffectiveness('rock', types);
        entity.currentHp -= Math.max(1, Math.floor(entity.maxHp * (0.125 * mult)));
        logs.push(`<span style="color:#e67e22">Les rochers pointus blessent ${name} !</span>`);
    }
    if (hazards.spikes > 0 && !types.includes('flying')) {
        let fraction = hazards.spikes === 1 ? 8 : (hazards.spikes === 2 ? 6 : 4);
        entity.currentHp -= Math.max(1, Math.floor(entity.maxHp / fraction));
        logs.push(`<span style="color:#7f8c8d">${name} se blesse sur les Picots !</span>`);
    }
    if (hazards.toxicSpikes > 0 && !types.includes('flying') && !types.includes('steel')) {
        if (types.includes('poison')) {
            hazards.toxicSpikes = 0;
            logs.push(`<span style="color:#9b59b6">${name} dissipe les Pics Toxik en entrant !</span>`);
        } else if (!entity.status) {
            entity.status = hazards.toxicSpikes === 1 ? 'PSN' : 'TOX';
            logs.push(`<span style="color:#8e44ad">${name} est empoisonné par les Pics Toxik !</span>`);
        }
    }
    if (hazards.stickyWeb && !types.includes('flying')) {
        entity.modifiers.speed = Math.max(-6, (entity.modifiers.speed || 0) - 1);
        logs.push(`<span style="color:#f1c40f">${name} est ralenti par la Toile Gluante !</span>`);
    }
}

function revertTransformation(pkmn) {
    if (pkmn.transformedImage) {
        pkmn.types = [...pkmn.original.types];
        pkmn.stats = JSON.parse(JSON.stringify(pkmn.original.stats));
        pkmn.moves = JSON.parse(JSON.stringify(pkmn.original.moves));
        pkmn.transformedImage = null;
    }
}

function triggerEntryAbilitySync(entity, opponent, data, logs) {
    if (entity.talent && ABILITIES_DB[entity.talent.en]) {
        let ab = ABILITIES_DB[entity.talent.en];
        if (ab.type === "on_entry_weather") {
            data.weather = ab.weather; data.weatherTurns = 5;
            logs.push(`<span style="color:#f39c12"><b>${ab.msg}</b></span>`);
        } else if (ab.type === "on_entry_stat") {
            opponent.modifiers[ab.stat] = Math.max(-6, (opponent.modifiers[ab.stat] || 0) + ab.stage);
            logs.push(`<span style="color:#e74c3c">${ab.msg}</span>`);
        }
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
            p1.turnsActive = 0; p1.isSeeded = false; p1.confusion = 0; p1.toxCount = 0; p1.rolloutCount = 0;
            for(let s in p1.modifiers) p1.modifiers[s] = 0;
            turnLogs.push(`Le Joueur 1 envoie <b>${p1.data.fr}</b> !`); 
            applyHazardsSync(p1, data.hazards1, turnLogs);
            triggerEntryAbilitySync(p1, p2, data, turnLogs);
        }
        if (a2.type === 'force_switch') { 
            active2 = a2.index; p2 = t2[active2]; 
            p2.turnsActive = 0; p2.isSeeded = false; p2.confusion = 0; p2.toxCount = 0; p2.rolloutCount = 0;
            for(let s in p2.modifiers) p2.modifiers[s] = 0;
            turnLogs.push(`Le Joueur 2 envoie <b>${p2.data.fr}</b> !`); 
            applyHazardsSync(p2, data.hazards2, turnLogs);
            triggerEntryAbilitySync(p2, p1, data, turnLogs);
        }
    } else {
        if (a1.type === 'switch') { 
            revertTransformation(p1); 
            // 🧹 NETTOYAGE DU POKÉMON SORTANT (P1)
            for(let s in p1.modifiers) p1.modifiers[s] = 0;
            p1.isSeeded = false; p1.confusion = 0; p1.toxCount = 0; p1.rolloutCount = 0;
            
            active1 = a1.index; p1 = t1[active1]; 
            
            // 🧹 NETTOYAGE DU POKÉMON ENTRANT (P1)
            p1.turnsActive = 0; p1.isSeeded = false; p1.confusion = 0; p1.toxCount = 0; p1.rolloutCount = 0;
            for(let s in p1.modifiers) p1.modifiers[s] = 0;
            
            turnLogs.push(`Joueur 1 envoie <b>${p1.data.fr}</b> !`); 
            applyHazardsSync(p1, data.hazards1, turnLogs);
            triggerEntryAbilitySync(p1, p2, data, turnLogs);
        }
        if (a2.type === 'switch') { 
            revertTransformation(p2); 
            // 🧹 NETTOYAGE DU POKÉMON SORTANT (P2)
            for(let s in p2.modifiers) p2.modifiers[s] = 0;
            p2.isSeeded = false; p2.confusion = 0; p2.toxCount = 0; p2.rolloutCount = 0;
            
            active2 = a2.index; p2 = t2[active2]; 
            
            // 🧹 NETTOYAGE DU POKÉMON ENTRANT (P2)
            p2.turnsActive = 0; p2.isSeeded = false; p2.confusion = 0; p2.toxCount = 0; p2.rolloutCount = 0;
            for(let s in p2.modifiers) p2.modifiers[s] = 0;
            
            turnLogs.push(`Joueur 2 envoie <b>${p2.data.fr}</b> !`); 
            applyHazardsSync(p2, data.hazards2, turnLogs);
            triggerEntryAbilitySync(p2, p1, data, turnLogs);
        }

        p1.isProtected = false; p2.isProtected = false;
        p1.flinched = false; p2.flinched = false;

        let move1 = a1.type === 'move' ? a1.move : null;
        let move2 = a2.type === 'move' ? a2.move : null;

        if (move1 && move2) {
            let p1Speed = getEffectiveStat(p1, 'speed', data.weather) * (data.screens1.tailwind > 0 ? 2 : 1); 
            let p2Speed = getEffectiveStat(p2, 'speed', data.weather) * (data.screens2.tailwind > 0 ? 2 : 1);
            
            let p1Priority = PRIORITY_MOVES.includes(move1.nameEn) ? 1 : 0;
            if (move1.nameEn === "fake-out") p1Priority = 3;
            if (PROTECT_MOVES_LIST.includes(move1.nameEn)) p1Priority = 4;

            let p2Priority = PRIORITY_MOVES.includes(move2.nameEn) ? 1 : 0;
            if (move2.nameEn === "fake-out") p2Priority = 3;
            if (PROTECT_MOVES_LIST.includes(move2.nameEn)) p2Priority = 4;

            let p1GoesFirst = false;
            if (p1Priority > p2Priority) p1GoesFirst = true;
            else if (p2Priority > p1Priority) p1GoesFirst = false;
            else {
                p1GoesFirst = data.trickRoom > 0 ? (p1Speed <= p2Speed) : (p1Speed >= p2Speed);
                if (p1Speed === p2Speed) p1GoesFirst = Math.random() > 0.5;
            }

            if (p1GoesFirst) {
                if(preMoveCheckSync(p1, turnLogs)) evalMove(p1, p2, move1, turnLogs, data, true);
                
                if (p2.currentHp > 0 && p1.currentHp > 0) { 
                    turnLogs.push(`<div style="height:1px; background:#444; margin: 8px 0; opacity: 0.5;"></div>`);
                    if(preMoveCheckSync(p2, turnLogs)) evalMove(p2, p1, move2, turnLogs, data, false); 
                }
            } else {
                if(preMoveCheckSync(p2, turnLogs)) evalMove(p2, p1, move2, turnLogs, data, false);
                
                if (p1.currentHp > 0 && p2.currentHp > 0) { 
                    turnLogs.push(`<div style="height:1px; background:#444; margin: 8px 0; opacity: 0.5;"></div>`);
                    if(preMoveCheckSync(p1, turnLogs)) evalMove(p1, p2, move1, turnLogs, data, true); 
                }
            }
        } 
        else if (move1 && p1.currentHp > 0) { if(preMoveCheckSync(p1, turnLogs)) evalMove(p1, p2, move1, turnLogs, data, true); }
        else if (move2 && p2.currentHp > 0) { if(preMoveCheckSync(p2, turnLogs)) evalMove(p2, p1, move2, turnLogs, data, false); }

        applyEndTurnStatusSync(p1, p2, turnLogs);
        applyEndTurnStatusSync(p2, p1, turnLogs);
        
        if (data.weather && data.weather !== 'none') {
            data.weatherTurns--;
            if (data.weatherTurns <= 0) {
                turnLogs.push(`<b>La météo redevient normale.</b>`);
                data.weather = 'none';
            } else {
                let p1Types = p1.types || [];
                if (data.weather === 'sandstorm' && !p1Types.includes('rock') && !p1Types.includes('ground') && !p1Types.includes('steel') && p1.currentHp > 0) {
                    p1.currentHp -= Math.max(1, Math.floor(p1.maxHp / 16)); turnLogs.push(`<span style="color:#e67e22">${p1.data.fr} subit la tempête de sable !</span>`);
                }
                if (data.weather === 'hail' && !p1Types.includes('ice') && p1.currentHp > 0) {
                    p1.currentHp -= Math.max(1, Math.floor(p1.maxHp / 16)); turnLogs.push(`<span style="color:#bdc3c7">${p1.data.fr} subit la grêle !</span>`);
                }
                
                let p2Types = p2.types || [];
                if (data.weather === 'sandstorm' && !p2Types.includes('rock') && !p2Types.includes('ground') && !p2Types.includes('steel') && p2.currentHp > 0) {
                    p2.currentHp -= Math.max(1, Math.floor(p2.maxHp / 16)); turnLogs.push(`<span style="color:#e67e22">${p2.data.fr} subit la tempête de sable !</span>`);
                }
                if (data.weather === 'hail' && !p2Types.includes('ice') && p2.currentHp > 0) {
                    p2.currentHp -= Math.max(1, Math.floor(p2.maxHp / 16)); turnLogs.push(`<span style="color:#bdc3c7">${p2.data.fr} subit la grêle !</span>`);
                }
            }
        }

        // Attaques à retardement
        for (let i = data.delayedAttacks.length - 1; i >= 0; i--) {
            let da = data.delayedAttacks[i];
            da.timer--;
            if (da.timer <= 0) {
                let targetEntity = da.target === 'p1' ? p1 : p2;
                if (targetEntity.currentHp > 0) {
                    turnLogs.push(`<b>L'attaque ${da.move.nameFr} frappe ${targetEntity.data.fr} depuis le futur !</b>`);
                    let dmgInfo = calculateDamage({ level: 50, battleStats: {atk:100, spatk:100}, types:[] }, targetEntity, da.move, data.weather);
                    targetEntity.currentHp -= dmgInfo.damage;
                    if (targetEntity.currentHp <= 0) turnLogs.push(`<b style="color:#e74c3c">${targetEntity.data.fr} est K.O. !</b>`);
                }
                data.delayedAttacks.splice(i, 1);
            }
        }

        // GESTION DU VŒU (WISH)
        if (data.wish1 && data.wish1.timer > 0) {
            data.wish1.timer--;
            if (data.wish1.timer === 0 && p1.currentHp > 0) {
                p1.currentHp = Math.min(p1.maxHp, p1.currentHp + data.wish1.amount);
                turnLogs.push(`<span style="color:#2ecc71">Le Vœu s'est réalisé ! ${p1.data.fr} regagne des PV.</span>`);
                data.wish1 = null;
            }
        }
        if (data.wish2 && data.wish2.timer > 0) {
            data.wish2.timer--;
            if (data.wish2.timer === 0 && p2.currentHp > 0) {
                p2.currentHp = Math.min(p2.maxHp, p2.currentHp + data.wish2.amount);
                turnLogs.push(`<span style="color:#2ecc71">Le Vœu s'est réalisé ! ${p2.data.fr} regagne des PV.</span>`);
                data.wish2 = null;
            }
        }

        // Diminution des timers d'écrans
        ['reflect', 'lightScreen', 'auroraVeil', 'tailwind'].forEach(screen => {
            if (data.screens1[screen] > 0) data.screens1[screen]--;
            if (data.screens2[screen] > 0) data.screens2[screen]--;
        });
        if (data.trickRoom > 0) data.trickRoom--;
        if (data.terrainTurns > 0) {
            data.terrainTurns--;
            if (data.terrainTurns === 0) data.terrain = 'none';
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
        trickRoom: data.trickRoom, terrain: data.terrain, terrainTurns: data.terrainTurns, delayedAttacks: data.delayedAttacks,
        screens1: data.screens1, screens2: data.screens2, hazards1: data.hazards1, hazards2: data.hazards2,
        wish1: data.wish1 || null, wish2: data.wish2 || null,
        log: data.log.concat(turnLogs),
        status: status, winner: winner
    });
}

function evalMove(atk, def, rawMove, logs, battleData, isP1) {
    if (atk.flinched) {
        logs.push(`<span style="color:#f39c12">${atk.data.fr} a la trouille et ne peut pas attaquer !</span>`);
        return;
    }

    let aName = atk.data.fr; let defName = def.data.fr;
    let move = rawMove;

    if (atk.chargingMove) {
        move = atk.chargingMove;
        atk.chargingMove = null; atk.invulnerable = false;
    } else if (TWO_TURN_INVUL_MOVES.includes(move.nameEn)) {
        atk.chargingMove = move; atk.invulnerable = true;
        logs.push(`<b>${aName}</b> s'envole / disparaît / plonge !`);
        return;
    } else if (TWO_TURN_CHARGE_MOVES.includes(move.nameEn)) {
        if (move.nameEn === "solar-beam" && battleData.weather === "sun") { /* Direct */ }
        else {
            atk.chargingMove = move;
            logs.push(`<b>${aName}</b> se concentre / absorbe la lumière !`);
            return;
        }
    } else if (DELAYED_MOVES.includes(move.nameEn)) {
        battleData.delayedAttacks.push({ move: move, timer: 2, target: isP1 ? 'p2' : 'p1' });
        logs.push(`<b>${aName}</b> a prévu une attaque dans le futur !`);
        return;
    }

    logs.push(`<b>${atk.data.fr}</b> utilise <span style="color:#3498db">${move.nameFr}</span> !`);
    
    // --- MÉMORISATION POUR ENTRAVE ---
    atk.lastUsedMove = move;

    if (def.invulnerable) { logs.push(`Mais <b>${defName}</b> est introuvable ! L'attaque échoue.`); return; }

    if (POWDER_MOVES.includes(move.nameEn)) {
        let defTypes = def.types || [];
        if (defTypes.includes('grass')) {
            logs.push(`Ça n'affecte pas les Pokémon Plante !`);
            return;
        }
    }

    let myTeamState = isP1 ? battleData.screens1 : battleData.screens2;
    let opTeamState = isP1 ? battleData.screens2 : battleData.screens1;
    let opHazards = isP1 ? battleData.hazards2 : battleData.hazards1;
    let myHazards = isP1 ? battleData.hazards1 : battleData.hazards2;

    if (WEATHER_MOVES_DICT[move.nameEn]) {
        battleData.weather = WEATHER_MOVES_DICT[move.nameEn].weather; battleData.weatherTurns = 5;
        logs.push(`<span style="color:#f39c12"><b>${WEATHER_MOVES_DICT[move.nameEn].msg}</b></span>`);
        return;
    }
    if (TERRAINS.includes(move.nameEn)) {
        battleData.terrain = move.nameEn; battleData.terrainTurns = 5;
        logs.push(`<span style="color:#f39c12"><b>Un ${move.nameFr} recouvre le champ de bataille !</b></span>`);
        return;
    }
    if (SCREENS.includes(move.nameEn)) {
        if (move.nameEn === "reflect") myTeamState.reflect = 5;
        if (move.nameEn === "light-screen") myTeamState.lightScreen = 5;
        if (move.nameEn === "aurora-veil" && battleData.weather === "hail") myTeamState.auroraVeil = 5;
        logs.push(`<span style="color:#3498db">Un mur défensif protège l'équipe de ${aName} !</span>`);
        return;
    }
    if (WINDS.includes(move.nameEn)) {
        if (move.nameEn === "tailwind") { myTeamState.tailwind = 4; logs.push(`Le vent souffle en faveur de ${aName} !`); }
        if (move.nameEn === "trick-room") { battleData.trickRoom = 5; logs.push(`<b>L'ordre des vitesses est inversé (Distorsion) !</b>`); }
        return;
    }
    
    if (HAZARD_MOVES.includes(move.nameEn)) {
        if (move.nameEn === "stealth-rock" && !opHazards.stealthRock) { opHazards.stealthRock = true; logs.push(`<span style="color:#e67e22">Des pierres pointues lévitent autour de l'équipe adverse !</span>`); }
        else if (move.nameEn === "spikes" && opHazards.spikes < 3) { opHazards.spikes++; logs.push(`<span style="color:#7f8c8d">Des Picots sont répandus sur le terrain adverse !</span>`); }
        else if (move.nameEn === "toxic-spikes" && opHazards.toxicSpikes < 2) { opHazards.toxicSpikes++; logs.push(`<span style="color:#8e44ad">Des Pics Toxik sont répandus sur le terrain adverse !</span>`); }
        else if (move.nameEn === "sticky-web" && !opHazards.stickyWeb) { opHazards.stickyWeb = true; logs.push(`<span style="color:#f1c40f">Une Toile Gluante tisse le terrain adverse !</span>`); }
        else logs.push(`Mais cela échoue...`);
        return;
    }
    if (HAZARD_CLEAR_MOVES.includes(move.nameEn)) {
        myHazards.stealthRock = false; myHazards.spikes = 0; myHazards.toxicSpikes = 0; myHazards.stickyWeb = false;
        logs.push(`<span style="color:#3498db">Les pièges sur le terrain sont balayés !</span>`);
        if (move.nameEn === "defog") { opHazards.stealthRock = false; opHazards.spikes = 0; opHazards.toxicSpikes = 0; opHazards.stickyWeb = false; def.modifiers.evasion = Math.max(-6, (def.modifiers.evasion || 0) - 1); }
        return;
    }

    // ESQUIVE ET PRECISION CHECK
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

    let isStatusOnSelf = move.damageClass === "status" && (EVASION_UPS.includes(move.nameEn) || HEAL_MOVES.includes(move.nameEn) || PROTECT_MOVES_LIST.includes(move.nameEn) || WISH_MOVES.includes(move.nameEn));
    if (!isStatusOnSelf && move.nameEn !== "transform") {
        if (!checkMoveHit(move, atk.modifiers, def.modifiers)) {
            logs.push(`<b>Mais l'attaque a raté !</b>`);
            if (ROLLOUT_MOVES.includes(move.nameEn)) atk.rolloutCount = 0;
            return;
        }
    }

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
        if (ROLLOUT_MOVES.includes(move.nameEn)) atk.rolloutCount = 0;
        return; 
    }

    // TRAPPING & Siphons
    if (TRAP_MOVES.includes(move.nameEn)) {
        def.trapped = true; logs.push(`<b>${defName} ne peut plus s'enfuir !</b>`); return;
    }
    if (BIND_MOVES.includes(move.nameEn)) {
        def.trapped = true; def.bound = { name: move.nameFr, turns: Math.floor(Math.random() * 2) + 4 };
        logs.push(`<span style="color:#e74c3c"><b>${defName} est piégé par ${move.nameFr} !</b></span>`);
    }

    if (move.nameEn === "fake-out") {
        if ((atk.turnsActive || 0) > 0) { logs.push(`Mais cela échoue !`); return; }
    }

    // MANIPULATIONS
    if (TAUNT_MOVES.includes(move.nameEn)) {
        def.taunted = 3; 
        logs.push(`<span style="color:#e74c3c">${defName} est provoqué ! Il ne peut utiliser que des attaques offensives !</span>`);
        return; 
    }
    if (ENCORE_MOVES.includes(move.nameEn)) {
        logs.push(`<span style="color:#9b59b6">${defName} est forcé de répéter son attaque !</span>`);
        return; 
    }
    if (DISABLE_MOVES.includes(move.nameEn)) {
        if (def.lastUsedMove && (!def.disabledMove || def.disabledMove.turns === 0)) {
            def.disabledMove = { name: def.lastUsedMove.nameEn, turns: 4 };
            logs.push(`<span style="color:#9b59b6">La capacité ${def.lastUsedMove.nameFr} de ${defName} a été entravée !</span>`);
        } else {
            logs.push(`Mais cela échoue !`);
        }
        return; 
    }
    if (COUNTER_MOVES.includes(move.nameEn)) {
        logs.push(`<b>${aName}</b> se prépare à riposter (Riposte) !`);
        return; 
    }
    if (MIRROR_COAT_MOVES.includes(move.nameEn)) {
        logs.push(`<b>${aName}</b> se couvre d'un voile miroir !`);
        return; 
    }
    if (BIDE_MOVES.includes(move.nameEn)) {
        logs.push(`<b>${aName}</b> encaisse les coups pour accumuler de l'énergie !`);
        return; 
    }
    if (REST_MOVES.includes(move.nameEn)) {
        atk.currentHp = atk.maxHp; 
        atk.status = 'SLP';
        atk.statusTurns = 2;
        logs.push(`<span style="color:#2ecc71">${aName} s'endort pour restaurer ses PV !</span>`);
        return;
    }
    if (PAIN_SPLIT_MOVES.includes(move.nameEn)) {
        let avgHp = Math.floor((atk.currentHp + def.currentHp) / 2); 
        atk.currentHp = Math.min(atk.maxHp, avgHp);
        def.currentHp = Math.min(def.maxHp, avgHp);
        logs.push(`<span style="color:#9b59b6">Les PV des deux Pokémon sont mis en commun et divisés !</span>`);
        return;
    }
    if (PERISH_SONG_MOVES.includes(move.nameEn)) {
        if (!atk.perishCount) atk.perishCount = 4;
        if (!def.perishCount) def.perishCount = 4;
        logs.push(`<span style="color:#34495e">Tous les Pokémon entendent le Requiem... K.O. dans 3 tours !</span>`);
        return;
    }
    if (DESTINY_BOND_MOVES.includes(move.nameEn)) {
        atk.destinyBond = true;
        logs.push(`<span style="color:#8e44ad">${aName} lie son destin à son adversaire !</span>`);
        return;
    }
    if (WISH_MOVES.includes(move.nameEn)) {
        if (isP1) battleData.wish1 = { timer: 2, amount: Math.floor(atk.maxHp / 2) };
        else battleData.wish2 = { timer: 2, amount: Math.floor(atk.maxHp / 2) };
        logs.push(`<span style="color:#2ecc71">${aName} fait un Vœu !</span>`);
        return;
    }

    if (move.nameEn === "transform") {
        atk.types = [...(def.types || [])];
        atk.stats = JSON.parse(JSON.stringify(def.stats));
        atk.modifiers = JSON.parse(JSON.stringify(def.modifiers || {}));
        atk.moves = JSON.parse(JSON.stringify(def.moves));
        atk.transformedImage = def.transformedImage || getCardImageUrl(def);
        logs.push(`<span style="color:#9b59b6">${atk.data.fr} se transforme en ${def.data.fr} !</span>`);
        return;
    }

    if (SEED_MOVES_LIST.includes(move.nameEn)) {
        let defTypes = def.types || [];
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

    let hitCount = 1;
    if (MULTI_HIT_2_5.includes(move.nameEn)) hitCount = (Math.random() < 0.35) ? 2 : (Math.random() < 0.7 ? 3 : (Math.random() < 0.85 ? 4 : 5));
    else if (MULTI_HIT_2.includes(move.nameEn)) hitCount = 2;

    let totalDmg = 0;
    for(let i=0; i<hitCount; i++) {
        if(def.currentHp <= 0) break;

        if (def.currentHp <= 0 && def.destinyBond) {
            atk.currentHp = 0;
            logs.push(`<span style="color:#8e44ad">${defName} emporte ${aName} avec lui à cause du Lien du Destin !</span>`);
        }
        
        let dmgInfo = calculateDamage(atk, def, move, battleData.weather);
        let dmg = dmgInfo.damage;

        if (move.damageClass === 'physical' && opTeamState.reflect > 0) dmg = Math.floor(dmg / 2);
        if (move.damageClass === 'special' && opTeamState.lightScreen > 0) dmg = Math.floor(dmg / 2);
        if (opTeamState.auroraVeil > 0) dmg = Math.floor(dmg / 2);

        def.currentHp -= dmg;
        totalDmg += dmg;

        if (dmg > 0 && dmgInfo.isCrit && hitCount === 1) logs.push(`<span style="color:#f39c12">Coup Critique !</span>`);
        if (i === hitCount - 1) { 
            if (dmgInfo.mult > 1) logs.push(`C'est super efficace !`);
            else if (dmgInfo.mult > 0 && dmgInfo.mult < 1) logs.push(`Ce n'est pas très efficace...`);
            else if (dmgInfo.mult === 0 && move.power > 0) logs.push(`Ça n'a aucun effet.`);
        }
    }

    if (hitCount > 1 && totalDmg > 0) logs.push(`Touché ${hitCount} fois !`);

    if (totalDmg > 0 && def.talent && ABILITIES_DB[def.talent.en] && move.damageClass === "physical") {
        let abDef = ABILITIES_DB[def.talent.en];
        if (abDef.type === "on_hit_status" && Math.random() * 100 <= abDef.statusObj.chance) {
            applyStatusSync(atk, abDef.statusObj, atk.data.fr, logs);
            logs.push(`<span style="color:#8e44ad">${abDef.msg}</span>`);
        } else if (abDef.type === "on_hit_damage") {
            let recoil = Math.max(1, Math.floor(atk.maxHp / (100 / abDef.percent)));
            atk.currentHp -= recoil;
            logs.push(`<span style="color:#e74c3c">${abDef.msg}</span>`);
        }
    }

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
            let targetName = secEffect.target === "enemy" ? def.data.fr : atk.data.fr;
            for (let effect of secEffect.effects) {
                tEnt.modifiers[effect.stat] = Math.max(-6, Math.min(6, (tEnt.modifiers[effect.stat]||0) + effect.stage));
                if (effect.stage > 0) logs.push(`<span style="color:#3498db">${EXTENDED_STAT_NAMES[effect.stat]} de ${targetName} augmente !</span>`);
                else logs.push(`<span style="color:#e74c3c">${EXTENDED_STAT_NAMES[effect.stat]} de ${targetName} diminue !</span>`);
            }
        }
        const secStatus = SECONDARY_STATUS[move.nameEn];
        if (secStatus && Math.random() * 100 <= secStatus.chance) applyStatusSync(def, secStatus, def.data.fr, logs);
    }

    if (ROLLOUT_MOVES.includes(move.nameEn) && totalDmg > 0) {
        atk.rolloutCount = (atk.rolloutCount || 0) + 1;
        if (atk.rolloutCount >= 5) atk.rolloutCount = 0;
    }

    if (FLINCH_MOVES.includes(move.nameEn) && totalDmg > 0 && Math.random() < 0.3) {
        def.flinched = true;
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