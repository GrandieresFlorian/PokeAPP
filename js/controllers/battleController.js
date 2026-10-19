import { db } from '../firebase-config.js';
import { state } from '../state.js';
import { getPokemonPow } from '../utils.js';

export async function proposerCombat(friendId) {
    if (!state.currentUser) return;
    
    const today = new Date().toDateString();
    if (state.currentUserData.lastBattleDate !== today) {
        state.currentUserData.battlesProposedToday = 0;
        state.currentUserData.lastBattleDate = today;
    }
    
    if (state.currentUserData.battlesProposedToday >= 3) {
        alert(state.currentLang === 'en' ? "You have reached the limit of 3 challenges per day." : "Vous avez atteint la limite de 3 défis par jour.");
        return;
    }

    try {
        const friendRef = db.collection('users').doc(friendId);
        const friendDoc = await friendRef.get();
        if (!friendDoc.exists) return;

        let friendData = friendDoc.data();
        let requests = friendData.battleRequests || [];
        
        if (requests.some(req => req.from === state.currentUser)) {
            alert(state.currentLang === 'en' ? "Challenge already sent!" : "Défi déjà envoyé !");
            return;
        }

        requests.push({
            id: Date.now().toString(),
            from: state.currentUser,
            timestamp: Date.now()
        });

        await friendRef.update({ battleRequests: requests });
        
        state.currentUserData.battlesProposedToday++;
        await db.collection('users').doc(state.currentUser).update({
            battlesProposedToday: state.currentUserData.battlesProposedToday,
            lastBattleDate: state.currentUserData.lastBattleDate
        });

        alert(state.currentLang === 'en' ? `Challenge sent to ${friendId}!` : `Défi envoyé à ${friendId} !`);
    } catch (e) {
        console.error(e);
    }
}

export function renderBattleUI() {
    const requestsList = document.getElementById('combat-requests-list');
    const historyList = document.getElementById('combat-history-list');
    if (!requestsList || !historyList) return;

    requestsList.innerHTML = "";
    historyList.innerHTML = "";

    const requests = state.currentUserData.battleRequests || [];
    if (requests.length === 0) {
        requestsList.innerHTML = `<li class="friend-item" style="color: #777;">${state.currentLang === 'en' ? 'No pending challenges.' : 'Aucun défi en attente.'}</li>`;
    } else {
        requests.forEach(req => {
            const li = document.createElement('li');
            li.className = "friend-item";
            li.innerHTML = `<span>${req.from}</span>
                <div>
                    <button class="btn-small-action btn-accept">⚔️</button>
                    <button class="btn-small-action btn-reject">❌</button>
                </div>`;
            
            li.querySelector('.btn-accept').addEventListener('click', () => accepterCombat(req.id, req.from));
            li.querySelector('.btn-reject').addEventListener('click', () => refuserCombat(req.id));
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
            let resultText = bat.winner === state.currentUser ? (state.currentLang === 'en' ? 'Victory 🏆' : 'Victoire 🏆') : (state.currentLang === 'en' ? 'Defeat 💀' : 'Défaite 💀');
            let color = bat.winner === state.currentUser ? '#2ecc71' : '#e74c3c';
            li.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:5px; width:100%;">
                    <div style="display:flex; justify-content:space-between;">
                        <span><b>${bat.player1}</b> vs <b>${bat.player2}</b></span>
                        <span style="color:${color}; font-weight:bold;">${resultText}</span>
                    </div>
                    <span style="font-size:0.8rem; color:#aaa;">${new Date(bat.timestamp).toLocaleString()}</span>
                </div>
            `;
            historyList.appendChild(li);
        });
    }
}

async function refuserCombat(reqId) {
    let requests = state.currentUserData.battleRequests.filter(r => r.id !== reqId);
    await db.collection('users').doc(state.currentUser).update({ battleRequests: requests });
}

async function accepterCombat(reqId, challengerId) {
    if (!state.currentUser) return;
    
    let myCollection = state.currentUserData.collection || [];
    let myFighters = myCollection.filter(c => !c.isBaie).sort((a, b) => (b.level || 1) - (a.level || 1)).slice(0, 3);
    
    if (myFighters.length === 0) {
        alert(state.currentLang === 'en' ? "You need at least 1 Pokémon to battle!" : "Il vous faut au moins 1 Pokémon pour combattre !");
        return;
    }

    try {
        const challengerRef = db.collection('users').doc(challengerId);
        const challengerDoc = await challengerRef.get();
        if (!challengerDoc.exists) return;

        let challengerData = challengerDoc.data();
        let challengerCollection = challengerData.collection || [];
        let challengerFighters = challengerCollection.filter(c => !c.isBaie).sort((a, b) => (b.level || 1) - (a.level || 1)).slice(0, 3);

        if (challengerFighters.length === 0) return alert(state.currentLang === 'en' ? "The opponent has no Pokémon." : "L'adversaire n'a aucun Pokémon.");

        let myScore = 0;
        let theirScore = 0;

        for (let i = 0; i < 3; i++) {
            let myPow = 0; let theirPow = 0;
            if (myFighters[i]) myPow = await getPokemonPow(myFighters[i]) * (myFighters[i].level || 1);
            if (challengerFighters[i]) theirPow = await getPokemonPow(challengerFighters[i]) * (challengerFighters[i].level || 1);
            
            if (myPow > theirPow) myScore++;
            else if (theirPow > myPow) theirScore++;
            else { myScore++; theirScore++; }
        }

        let winnerId = myScore >= theirScore ? state.currentUser : challengerId;

        const battleRecord = {
            player1: challengerId,
            player2: state.currentUser,
            winner: winnerId,
            timestamp: Date.now()
        };

        let myRequests = state.currentUserData.battleRequests.filter(r => r.id !== reqId);
        let myHistory = state.currentUserData.battleHistory || [];
        myHistory.push(battleRecord);
        if (myHistory.length > 20) myHistory.shift();
        
        let myUpdates = { battleRequests: myRequests, battleHistory: myHistory };
        if (winnerId === state.currentUser) {
            myUpdates.specialBoostersLeft = (state.currentUserData.specialBoostersLeft || 0) + 1;
        }
        await db.collection('users').doc(state.currentUser).update(myUpdates);

        let theirHistory = challengerData.battleHistory || [];
        theirHistory.push(battleRecord);
        if (theirHistory.length > 20) theirHistory.shift();
        
        let theirUpdates = { battleHistory: theirHistory };
        if (winnerId === challengerId) {
            theirUpdates.specialBoostersLeft = (challengerData.specialBoostersLeft || 0) + 1;
        }
        await challengerRef.update(theirUpdates);

        alert(winnerId === state.currentUser 
            ? (state.currentLang === 'en' ? "You won! You earned a Special Pack!" : "Vous avez gagné ! Vous recevez un Booster Spécial (x3 Shiny) !") 
            : (state.currentLang === 'en' ? "You lost the battle..." : "Vous avez perdu le combat..."));

    } catch (e) {
        console.error(e);
    }
}