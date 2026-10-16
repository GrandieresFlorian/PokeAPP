import { db } from '../firebase-config.js';
import { state } from '../state.js';
import { getPokemonPow, getCardImageUrl } from '../utils.js';

export async function proposerCombat(friendId) {
    if (!state.currentUser) return;
    const today = new Date().toDateString();
    
    let proposed = state.currentUserData.battlesProposedToday || 0;
    let lastDate = state.currentUserData.lastBattleDate;
    
    if (lastDate !== today) {
        proposed = 0;
        lastDate = today;
    }
    
    if (proposed >= 3) {
        alert("Vous avez atteint votre limite de 3 défis par jour ! Revenez demain.");
        return;
    }

    try {
        const targetRef = db.collection('users').doc(friendId);
        const targetDoc = await targetRef.get();
        if (!targetDoc.exists) return alert("Joueur introuvable.");
        
        let reqs = targetDoc.data().battleRequests || [];
        if (reqs.some(r => r.from === state.currentUser)) {
            alert("Vous avez déjà un défi en attente chez ce joueur.");
            return;
        }
        
        reqs.push({
            id: Date.now().toString(),
            from: state.currentUser,
            date: new Date().getTime()
        });
        
        await targetRef.update({ battleRequests: reqs });
        
        await db.collection('users').doc(state.currentUser).update({
            battlesProposedToday: proposed + 1,
            lastBattleDate: today
        });
        
        alert(`Défi envoyé à ${friendId} ! ⚔️ (Reste ${2 - proposed} défis aujourd'hui)`);
    } catch (e) {
        console.error(e);
        alert("Erreur lors de l'envoi du défi.");
    }
}

export async function accepterCombat(battleId, challengerId) {
    if (!state.currentUser) return;
    const req = state.currentUserData.battleRequests.find(r => r.id === battleId);
    if (!req) return;

    try {
        let myReqs = state.currentUserData.battleRequests.filter(r => r.id !== battleId);
        const challengerRef = db.collection('users').doc(challengerId);
        const challengerDoc = await challengerRef.get();
        
        if (!challengerDoc.exists) {
            alert("L'adversaire n'existe plus.");
            await db.collection('users').doc(state.currentUser).update({ battleRequests: myReqs });
            return;
        }
        
        const challengerData = challengerDoc.data();
        let mySafeCollection = (state.currentUserData.collection || []).filter(c => c && typeof c === 'object');
        let challengerSafeCollection = (challengerData.collection || []).filter(c => c && typeof c === 'object');
        
        if (mySafeCollection.length < 3) {
            alert("Vous devez avoir au moins 3 cartes pour combattre !");
            return;
        }
        if (challengerSafeCollection.length < 3) {
            alert("L'adversaire n'a pas assez de cartes pour combattre.");
            await db.collection('users').doc(state.currentUser).update({ battleRequests: myReqs });
            return;
        }
        
        // Sélection de 3 cartes uniques aléatoires
        let myTeam = [...mySafeCollection].sort(() => 0.5 - Math.random()).slice(0, 3);
        let theirTeam = [...challengerSafeCollection].sort(() => 0.5 - Math.random()).slice(0, 3);
        
        // Calcul du POW pour les 6 cartes
        for(let i=0; i<3; i++) {
            myTeam[i].pow = await getPokemonPow(myTeam[i]);
            theirTeam[i].pow = await getPokemonPow(theirTeam[i]);
        }
        
        let myWins = 0;
        let theirWins = 0;
        let rounds = [];
        
        // Déroulement des 3 manches
        for(let i=0; i<3; i++) {
            let m = myTeam[i];
            let t = theirTeam[i];
            let winner = m.pow > t.pow ? state.currentUser : (t.pow > m.pow ? challengerId : 'Égalité');
            if (m.pow > t.pow) myWins++;
            else if (t.pow > m.pow) theirWins++;
            
            rounds.push({
                round: i+1,
                myCard: m,
                theirCard: t,
                winner: winner
            });
        }
        
        let finalWinner = 'Égalité';
        if (myWins > theirWins) finalWinner = state.currentUser;
        else if (theirWins > myWins) finalWinner = challengerId;
        
        const resultObj = {
            id: Date.now().toString(),
            date: new Date().getTime(),
            player1: state.currentUser,
            player2: challengerId,
            winner: finalWinner,
            score: `${myWins} - ${theirWins}`,
            rounds: rounds
        };
        
        // Mise à jour de Soi-même (Le défenseur)
        let myHistory = state.currentUserData.battleHistory || [];
        myHistory.unshift(resultObj);
        if (myHistory.length > 15) myHistory = myHistory.slice(0, 15);
        
        let myBoosters = state.currentUserData.specialBoostersLeft || 0;
        if (finalWinner === state.currentUser) myBoosters++; // Booster si Victoire
        
        await db.collection('users').doc(state.currentUser).update({
            battleRequests: myReqs,
            battleHistory: myHistory,
            specialBoostersLeft: myBoosters
        });
        
        // Mise à jour du Challenger
        let theirHistory = challengerData.battleHistory || [];
        theirHistory.unshift(resultObj);
        if (theirHistory.length > 15) theirHistory = theirHistory.slice(0, 15);
        
        let theirBoosters = challengerData.specialBoostersLeft || 0;
        if (finalWinner === challengerId) theirBoosters++; // Booster si Victoire
        
        await challengerRef.update({
            battleHistory: theirHistory,
            specialBoostersLeft: theirBoosters
        });
        
        alert(`Combat terminé ! Le vainqueur est : ${finalWinner} ! 🏆 (Voir les résultats dans l'Arène)`);
    } catch(e) {
        console.error(e);
        alert("Erreur lors de la résolution du combat.");
    }
}

export async function refuserCombat(battleId) {
    if (!state.currentUser) return;
    let myReqs = state.currentUserData.battleRequests.filter(r => r.id !== battleId);
    await db.collection('users').doc(state.currentUser).update({ battleRequests: myReqs });
}

export function renderBattleUI() {
    const reqList = document.getElementById('combat-requests-list');
    const histList = document.getElementById('combat-history-list');
    if (!reqList || !histList) return;
    
    reqList.innerHTML = "";
    histList.innerHTML = "";
    
    const reqs = state.currentUserData.battleRequests || [];
    const hist = state.currentUserData.battleHistory || [];
    
    if (reqs.length === 0) {
        reqList.innerHTML = "<li class='friend-item' style='color:#777;'>Aucun défi en attente.</li>";
    } else {
        reqs.forEach(r => {
            const li = document.createElement('li');
            li.className = "friend-item";
            li.innerHTML = `
                <span>⚔️ <b style="color:#e74c3c;">${r.from}</b> vous défie !</span>
                <div>
                    <button class="btn-small-action btn-accept" style="background-color:#2ecc71;">✔ Accepter</button>
                    <button class="btn-small-action btn-reject" style="background-color:#e74c3c;">✖</button>
                </div>`;
            li.querySelector('.btn-accept').addEventListener('click', (e) => { e.target.textContent = '...'; accepterCombat(r.id, r.from); });
            li.querySelector('.btn-reject').addEventListener('click', () => refuserCombat(r.id));
            reqList.appendChild(li);
        });
    }
    
    if (hist.length === 0) {
        histList.innerHTML = "<li class='friend-item' style='color:#777;'>Aucun combat récent.</li>";
    } else {
        hist.forEach(h => {
            const li = document.createElement('li');
            li.className = "friend-item";
            li.style.flexDirection = "column";
            li.style.alignItems = "flex-start";
            li.style.background = "#1a1a1a";
            li.style.padding = "15px";
            li.style.borderRadius = "8px";
            li.style.marginBottom = "10px";
            li.style.border = "1px solid #333";
            
            const isMeP1 = h.player1 === state.currentUser;
            const me = isMeP1 ? h.player1 : h.player2;
            const them = isMeP1 ? h.player2 : h.player1;
            
            const winColor = h.winner === state.currentUser ? '#2ecc71' : (h.winner === 'Égalité' ? '#f1c40f' : '#e74c3c');
            const winText = h.winner === state.currentUser ? 'VICTOIRE' : (h.winner === 'Égalité' ? 'ÉGALITÉ' : 'DÉFAITE');
            
            let roundsHtml = `<div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap; width:100%;">`;
            h.rounds.forEach(r => {
                const myC = isMeP1 ? r.myCard : r.theirCard;
                const thC = isMeP1 ? r.theirCard : r.myCard;
                const rWin = r.winner === state.currentUser;
                const isDraw = r.winner === 'Égalité';
                
                const borderColor = isDraw ? '#f1c40f' : (rWin ? '#2ecc71' : '#e74c3c');
                
                roundsHtml += `
                <div style="background:#242424; padding:8px; border-radius:5px; border:2px solid ${borderColor}; text-align:center; flex:1; min-width: 120px;">
                    <span style="font-size:0.8rem; color:#aaa; font-weight:bold;">Manche ${r.round}</span><br>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                        <div style="text-align:center;" title="${myC.data.fr || myC.data.en}">
                            <img src="${getCardImageUrl(myC)}" style="width:40px; height:40px; object-fit:cover; border-radius:5px; background:#444;">
                            <div style="font-size:0.75rem; color:#fceea7; margin-top:4px; font-weight:bold;">POW ${myC.pow}</div>
                        </div>
                        <span style="font-size:0.8rem; color:#777; font-weight:bold; margin: 0 5px;">vs</span>
                        <div style="text-align:center;" title="${thC.data.fr || thC.data.en}">
                            <img src="${getCardImageUrl(thC)}" style="width:40px; height:40px; object-fit:cover; border-radius:5px; background:#444;">
                            <div style="font-size:0.75rem; color:#fceea7; margin-top:4px; font-weight:bold;">POW ${thC.pow}</div>
                        </div>
                    </div>
                </div>`;
            });
            roundsHtml += `</div>`;
            
            li.innerHTML = `
                <div style="width:100%; display:flex; justify-content:space-between; align-items:center; margin-bottom: 5px;">
                    <span style="font-size: 1.1rem;">Contre <b style="color:#3498db;">${them}</b></span>
                    <span style="color:${winColor}; font-weight:bold; font-size:1.1rem; background:rgba(0,0,0,0.5); padding:4px 10px; border-radius:4px; text-shadow: 1px 1px 2px #000;">${winText} (${h.score})</span>
                </div>
                ${roundsHtml}
            `;
            histList.appendChild(li);
        });
    }
}