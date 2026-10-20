import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { getPokemonPow, getPokemonDetails, getCardImageUrl, getEffectiveness, getMovesForLevel } from '../utils.js';
import { allerASection } from './navController.js';

let currentBattleId = null;
let myRole = null; // 'p1' (Hôte) ou 'p2' (Invité)
let unsubscribeBattle = null;

// =========================================================================
// 1. SALON ET INVITATIONS
// =========================================================================

export function initPvPListener() {
    if(!state.currentUser) return;
    // On écoute le compte du joueur : si l'ami accepte, 'activeBattle' s'ajoutera ici.
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
            // Algorithme d'Équilibrage (Différence < 50 POW)
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
        p1: req.from, // Hôte (Celui qui a lancé le défi)
        p2: state.currentUser, // Invité
        team1: await formatTeam(team1), 
        team2: await formatTeam(team2),
        active1: 0, active2: 0,
        action1: null, action2: null,
        log: [`<b style="color:#f39c12;">Le combat ${req.type === 'ranked' ? 'Classé' : 'Amical'} commence !</b>`],
        status: 'playing', mode: req.type, winner: null
    });

    // On prévient l'Hôte que le combat a commencé
    await db.collection('users').doc(req.from).update({ activeBattle: battleRef.id });
    // On met à jour l'Invité et on efface la requête
    await db.collection('users').doc(state.currentUser).update({ 
        activeBattle: battleRef.id,
        battleRequests: state.currentUserData.battleRequests.filter(r => r.id !== req.id)
    });
}

async function formatTeam(rawTeam) {
    return await Promise.all(rawTeam.map(async pkmn => {
        const d = await getPokemonDetails(pkmn);
        let maxHp = Math.floor(((2 * d.baseStats.hp) * (pkmn.level || 1)) / 100) + (pkmn.level || 1) + 10;
        return {
            ...pkmn,
            data: pkmn.data || state.pokemonDataList[pkmn.pokedexNumber - 1],
            moves: await getMovesForLevel(pkmn.pokedexNumber, pkmn.level || 1),
            maxHp: maxHp, currentHp: maxHp,
            stats: { 
                atk: Math.floor(((2 * d.baseStats.atk) * (pkmn.level||1)) / 100) + 5,
                def: Math.floor(((2 * d.baseStats.def) * (pkmn.level||1)) / 100) + 5,
                spatk: Math.floor(((2 * d.baseStats.spatk) * (pkmn.level||1)) / 100) + 5,
                spdef: Math.floor(((2 * d.baseStats.spdef) * (pkmn.level||1)) / 100) + 5,
                speed: Math.floor(((2 * d.baseStats.speed) * (pkmn.level||1)) / 100) + 5
            },
            types: d.types
        };
    }));
}

// ---------- SELECTION AMICALE ----------

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

    // On écoute la "Salle" en temps réel
    unsubscribeBattle = db.collection('active_battles').doc(battleId).onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        
        myRole = (data.p1 === state.currentUser) ? 'p1' : 'p2';
        renderSynchronousUI(data);

        // LE CŒUR DU JEU : Si je suis l'Hôte (p1) et que les DEUX joueurs ont choisi, je calcule le tour
        if (myRole === 'p1' && data.action1 && data.action2 && data.status === 'playing') {
            resolveSynchronousTurn(data, doc.ref);
        }

        // Fin de match
        if (data.status === 'finished') {
            endRealTimeBattle(data);
        }
    });

    document.getElementById('btn-pvp-switch').onclick = () => openSynchronousSwitchMenu();
    document.getElementById('btn-pvp-surrender').onclick = () => surrenderBattle();
}

function renderSynchronousUI(data) {
    let myTeam = myRole === 'p1' ? data.team1 : data.team2;
    let enemyTeam = myRole === 'p1' ? data.team2 : data.team1;
    let myActiveIdx = myRole === 'p1' ? data.active1 : data.active2;
    let enemyActiveIdx = myRole === 'p1' ? data.active2 : data.active1;
    
    let pActive = myTeam[myActiveIdx];
    let eActive = enemyTeam[enemyActiveIdx];

    // Joueur
    document.getElementById('pvp-player-name').textContent = pActive.data.fr;
    document.getElementById('pvp-player-lvl').textContent = `Niv. ${pActive.level}`;
    document.getElementById('pvp-player-hp-text').textContent = `${Math.max(0, pActive.currentHp)} / ${pActive.maxHp}`;
    document.getElementById('pvp-player-hp-fill').style.width = `${(Math.max(0, pActive.currentHp) / pActive.maxHp) * 100}%`;
    document.getElementById('pvp-player-sprite').src = getCardImageUrl(pActive);
    updateBarColor('pvp-player-hp-fill', pActive.currentHp, pActive.maxHp);
    document.getElementById('pvp-player-team-ui').innerHTML = myTeam.map((p, i) => `<div class="ball ${p.currentHp <= 0 ? 'fainted' : (i === myActiveIdx ? 'active' : 'alive')}"></div>`).join('');

    // Adversaire
    document.getElementById('pvp-enemy-name').textContent = eActive.data.fr;
    document.getElementById('pvp-enemy-lvl').textContent = `Niv. ${eActive.level}`;
    document.getElementById('pvp-enemy-hp-text').textContent = `${Math.max(0, eActive.currentHp)} / ${eActive.maxHp}`;
    document.getElementById('pvp-enemy-hp-fill').style.width = `${(Math.max(0, eActive.currentHp) / eActive.maxHp) * 100}%`;
    document.getElementById('pvp-enemy-sprite').src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${eActive.pokedexNumber}.png`;
    updateBarColor('pvp-enemy-hp-fill', eActive.currentHp, eActive.maxHp);
    document.getElementById('pvp-enemy-team-ui').innerHTML = enemyTeam.map((p, i) => `<div class="ball ${p.currentHp <= 0 ? 'fainted' : (i === enemyActiveIdx ? 'active' : 'alive')}"></div>`).join('');

    // Logs
    const logBox = document.getElementById('pvp-battle-log');
    logBox.innerHTML = data.log.slice(-10).join('<br>'); // Affiche les 10 dernières actions
    logBox.scrollTop = logBox.scrollHeight;

    // Gestion des boutons (On cache si on a déjà joué)
    let myAction = myRole === 'p1' ? data.action1 : data.action2;
    
    if (myAction || data.status !== 'playing') {
        document.getElementById('pvp-action-wrapper').classList.add('hidden');
        document.getElementById('pvp-waiting-action').classList.remove('hidden');
    } else {
        document.getElementById('pvp-waiting-action').classList.add('hidden');
        document.getElementById('pvp-action-wrapper').classList.remove('hidden');
        
        // S'il est mort, on le force à Switch (on cache les attaques)
        if (pActive.currentHp <= 0) {
            document.getElementById('pvp-moves-container').classList.add('hidden');
        } else {
            document.getElementById('pvp-moves-container').classList.remove('hidden');
            const container = document.getElementById('pvp-moves-container');
            container.innerHTML = "";
            pActive.moves.forEach(move => {
                const btn = document.createElement('button');
                btn.className = `move-btn type-${move.type}`;
                btn.innerHTML = `<span class="move-name">${move.nameFr}</span><span style="font-size:0.7rem; font-weight:normal;">POW ${move.power || "-"}</span>`;
                btn.onclick = () => submitAction({ type: 'move', move: move });
                container.appendChild(btn);
            });
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

function openSynchronousSwitchMenu() {
    document.getElementById('pvp-action-wrapper').classList.add('hidden');
    document.getElementById('pvp-team-selection').classList.remove('hidden');
    document.getElementById('pvp-selection-title').textContent = "Qui voulez-vous envoyer ?";
    document.getElementById('pvp-selection-counter').classList.add('hidden');
    document.getElementById('btn-confirm-pvp-team').classList.add('hidden');
    
    db.collection('active_battles').doc(currentBattleId).get().then(doc => {
        let data = doc.data();
        let myTeam = myRole === 'p1' ? data.team1 : data.team2;
        let myActiveIdx = myRole === 'p1' ? data.active1 : data.active2;
        let isDead = myTeam[myActiveIdx].currentHp <= 0;

        let btnCancel = document.getElementById('btn-cancel-pvp-team');
        btnCancel.textContent = "Retour";
        if(isDead) btnCancel.classList.add('hidden'); else btnCancel.classList.remove('hidden');
        btnCancel.onclick = () => {
            document.getElementById('pvp-team-selection').classList.add('hidden');
            document.getElementById('pvp-action-wrapper').classList.remove('hidden');
        };

        const grid = document.getElementById('pvp-selection-grid');
        grid.innerHTML = "";
        
        myTeam.forEach((carte, index) => {
            const div = document.createElement('div');
            div.className = `mini-card`;
            div.style.backgroundImage = `url('${getCardImageUrl(carte)}')`;
            let hpBar = document.createElement('div');
            hpBar.style.cssText = `position:absolute; bottom:0; left:0; right:0; height:10px; background:#333;`;
            let ratio = carte.currentHp / carte.maxHp;
            hpBar.innerHTML = `<div style="height:100%; width:${ratio*100}%; background:${ratio > 0.5 ? '#2ecc71' : '#e74c3c'};"></div>`;
            div.appendChild(hpBar);

            if(carte.currentHp <= 0 || index === myActiveIdx) {
                div.style.filter = "grayscale(1) brightness(0.5)"; div.style.cursor = "not-allowed";
            } else {
                div.onclick = () => {
                    document.getElementById('pvp-team-selection').classList.add('hidden');
                    submitAction({ type: 'switch', index: index });
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
            winner: myRole === 'p1' ? 'p2' : 'p1', // L'autre gagne
            log: firebase.firestore.FieldValue.arrayUnion(`<b style="color:#e74c3c;">Un joueur a abandonné le combat !</b>`)
        });
    }
}

// =========================================================================
// 3. RÉSOLUTION DES DÉGÂTS (Exécuté uniquement par l'Hôte / P1)
// =========================================================================

async function resolveSynchronousTurn(data, battleRef) {
    let t1 = data.team1; let t2 = data.team2;
    let a1 = data.action1; let a2 = data.action2;
    let active1 = data.active1; let active2 = data.active2;
    let turnLogs = ["<hr>"]; // Séparateur visuel de tour

    let p1 = t1[active1]; let p2 = t2[active2];

    // 1. GESTION DES SWITCHS PRIORITAIRES
    if (a1.type === 'switch') { active1 = a1.index; p1 = t1[active1]; turnLogs.push(`Joueur 1 envoie <b>${p1.data.fr}</b> !`); }
    if (a2.type === 'switch') { active2 = a2.index; p2 = t2[active2]; turnLogs.push(`Joueur 2 envoie <b>${p2.data.fr}</b> !`); }

    // 2. EXÉCUTION DES ATTAQUES
    let move1 = a1.type === 'move' ? a1.move : null;
    let move2 = a2.type === 'move' ? a2.move : null;

    if (move1 && move2) {
        let p1Speed = p1.stats.speed; let p2Speed = p2.stats.speed;
        let p1GoesFirst = p1Speed >= p2Speed;
        if (p1Speed === p2Speed) p1GoesFirst = Math.random() > 0.5;

        if (p1GoesFirst) {
            evalMove(p1, p2, move1, turnLogs);
            if (p2.currentHp > 0 && p1.currentHp > 0) evalMove(p2, p1, move2, turnLogs);
        } else {
            evalMove(p2, p1, move2, turnLogs);
            if (p1.currentHp > 0 && p2.currentHp > 0) evalMove(p1, p2, move1, turnLogs);
        }
    } 
    else if (move1 && p1.currentHp > 0) evalMove(p1, p2, move1, turnLogs);
    else if (move2 && p2.currentHp > 0) evalMove(p2, p1, move2, turnLogs);

    // 3. VÉRIFICATION DES MORTS & FIN DE MATCH
    let p1Alive = t1.some(p => p.currentHp > 0);
    let p2Alive = t2.some(p => p.currentHp > 0);
    let status = 'playing';
    let winner = null;

    if (!p1Alive && !p2Alive) { status = 'finished'; winner = 'draw'; turnLogs.push("<b>Match Nul !</b>"); }
    else if (!p1Alive) { status = 'finished'; winner = 'p2'; turnLogs.push(`<b>Le Joueur 2 gagne le combat !</b>`); }
    else if (!p2Alive) { status = 'finished'; winner = 'p1'; turnLogs.push(`<b>Le Joueur 1 gagne le combat !</b>`); }

    // On Sauvegarde le tout sur Firebase (Ce qui déclenchera l'UI des 2 joueurs)
    await battleRef.update({
        team1: t1, team2: t2,
        active1: active1, active2: active2,
        action1: null, action2: null,
        log: data.log.concat(turnLogs),
        status: status, winner: winner
    });
}

function evalMove(atk, def, move, logs) {
    logs.push(`<b>${atk.data.fr}</b> utilise <span style="color:#3498db">${move.nameFr}</span> !`);
    
    let A = move.damageClass === 'special' ? atk.stats.spatk : atk.stats.atk;
    let D = move.damageClass === 'special' ? def.stats.spdef : def.stats.def;
    
    let baseDmg = Math.floor(Math.floor(Math.floor(2 * (atk.level||1) / 5 + 2) * move.power * A / D) / 50) + 2;
    let stab = atk.types.includes(move.type) ? 1.5 : 1;
    let mult = getEffectiveness(move.type, def.types);
    
    let isCrit = Math.random() < 0.0625;
    let dmg = Math.floor(baseDmg * stab * mult * (Math.random() * (1 - 0.85) + 0.85) * (isCrit ? 1.5 : 1));
    
    if (move.power == 0 || !move.power) dmg = 0; // Attaques de statut
    if (mult === 0) dmg = 0; else dmg = Math.max(1, dmg);

    def.currentHp -= dmg;
    
    if (dmg > 0 && isCrit) logs.push(`<span style="color:#f39c12">Coup Critique !</span>`);
    if (mult > 1) logs.push(`C'est super efficace !`);
    if (mult < 1 && mult > 0) logs.push(`Ce n'est pas très efficace...`);
    if (mult === 0 && move.power > 0) logs.push(`Ça n'a aucun effet.`);
    
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

    // Récompense si Classé et Gagné
    if (isWin && data.mode === 'ranked') {
        logMessage(`<span style="color:#f1c40f">🎁 Vous remportez un Booster Spécial (Shiny x3) !</span>`);
        await db.collection('users').doc(state.currentUser).update({
            specialBoostersLeft: firebase.firestore.FieldValue.increment(1)
        });
    }

    // Historique
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