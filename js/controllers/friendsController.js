import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { initierEchange, accepterEchange, refuserEchange } from './tradeController.js';
import { proposerCombat, renderBattleUI, initPvPListener } from './battleController.js';
import { getCardImageUrl } from '../utils.js';
import { updateSpecialBoosterUI } from './boosterController.js';
import { allerASection } from './navController.js'; // Ajoutez cet import tout en haut si ce n'est pas déjà fait

let friendsListener = null;

export function startFriendsListener() {
    if (!state.currentUser) return;
    if (friendsListener) friendsListener();
    friendsListener = db.collection('users').doc(state.currentUser).onSnapshot(doc => {
        if (doc.exists) {
            state.currentUserData.friends = doc.data().friends || [];
            state.currentUserData.friendRequests = doc.data().friendRequests || [];
            state.currentUserData.trades = doc.data().trades || [];
            state.currentUserData.battleRequests = doc.data().battleRequests || [];
            state.currentUserData.battleHistory = doc.data().battleHistory || [];
            state.currentUserData.specialBoostersLeft = doc.data().specialBoostersLeft || 0;
            state.currentUserData.battlesProposedToday = doc.data().battlesProposedToday || 0;
            state.currentUserData.lastBattleDate = doc.data().lastBattleDate || null;
            
            renderFriendsUI();
            renderBattleUI();
            updateSpecialBoosterUI();
        }
    });
}

export function stopFriendsListener() {
    if(friendsListener) { friendsListener(); friendsListener = null; }
}

export function initFriends() {
    initPvPListener();
    document.getElementById('nav-amis').addEventListener('click', () => {
        if (!state.currentUser) return alert("Connectez-vous d'abord !");
        allerASection('section-amis');
    });
    const friendIdInput = document.getElementById('friend-id-input');
    const addFriendBtn = document.getElementById('add-friend-btn');
    const friendMessage = document.getElementById('friend-message');

    addFriendBtn.addEventListener('click', async () => {
        const targetId = friendIdInput.value.trim();
        if (!state.currentUser) return;
        if (!targetId) return friendMessage.textContent = "Veuillez entrer un pseudo.", friendMessage.style.color = "#e74c3c";
        if (targetId === state.currentUser) return friendMessage.textContent = "Vous ne pouvez pas vous ajouter vous-même.", friendMessage.style.color = "#e74c3c";
        
        friendMessage.textContent = "Recherche...";
        friendMessage.style.color = "#f1c40f";
        
        try {
            const targetRef = db.collection('users').doc(targetId);
            const targetDoc = await targetRef.get();
            
            if (!targetDoc.exists) return friendMessage.textContent = "Joueur introuvable.", friendMessage.style.color = "#e74c3c";
            
            const targetData = targetDoc.data();
            const targetRequests = targetData.friendRequests || [];
            const targetFriends = targetData.friends || [];
            
            if (targetFriends.includes(state.currentUser)) return friendMessage.textContent = "Vous êtes déjà amis !", friendMessage.style.color = "#e74c3c";
            if (targetRequests.includes(state.currentUser)) return friendMessage.textContent = "Demande déjà envoyée.", friendMessage.style.color = "#e74c3c";
            
            targetRequests.push(state.currentUser);
            await targetRef.update({ friendRequests: targetRequests });
            
            friendMessage.textContent = "Demande envoyée avec succès !";
            friendMessage.style.color = "#2ecc71";
            friendIdInput.value = "";
            setTimeout(() => friendMessage.textContent = "", 3000);
        } catch (error) {
            friendMessage.textContent = "Erreur de connexion.";
            friendMessage.style.color = "#e74c3c";
        }
    });
}

function renderFriendsUI() {
    if (!state.currentUser) return;
    
    const friendsList = document.getElementById('friends-list');
    const friendRequestsList = document.getElementById('friend-requests-list');
    
    friendsList.innerHTML = "";
    friendRequestsList.innerHTML = "";
    
    const friends = state.currentUserData.friends || [];
    const requests = state.currentUserData.friendRequests || [];
    
    if (friends.length === 0) {
        friendsList.innerHTML = "<li class='friend-item' style='color: #777;'>Aucun ami pour le moment.</li>";
    } else {
        friendsList.innerHTML = "<li class='friend-item' style='color: #777;'>Chargement des amis...</li>";
        Promise.all(friends.map(f => db.collection('users').doc(f).get())).then(docs => {
            friendsList.innerHTML = "";
            docs.forEach(doc => {
                if(!doc.exists) return;
                const friendId = doc.id;
                const data = doc.data();
                const friendName = data.displayName || friendId;
                const avatarUrl = data.avatar || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/0.png';
                
                const li = document.createElement('li');
                li.className = "friend-item";
                li.innerHTML = `
                <div style="display:flex; align-items:center; cursor:pointer;" class="friend-profile-link" title="Voir le profil">
                    <img src="${avatarUrl}" style="width:45px; height:45px; border-radius:50%; margin-right:15px; border: 2px solid #3498db; object-fit:cover;">
                    <span style="font-weight:bold; font-size:1.1rem; flex-grow:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${friendName}</span>
                </div>
                <div style="display:flex; gap:8px; margin-left: 10px;">
                    <button class="btn-small-action btn-trade" style="background-color: #9b59b6;" title="Proposer un échange">🔄</button>
                    <button class="btn-small-action btn-combat" style="background-color: #e74c3c;" title="Défier (3 max/j)">⚔️</button>
                </div>`;
                
                li.querySelector('.friend-profile-link').addEventListener('click', () => {
                    import('./profileController.js').then(({voirProfil}) => voirProfil(friendId));
                });
                li.querySelector('.btn-trade').addEventListener('click', () => initierEchange(friendId));
                li.querySelector('.btn-combat').addEventListener('click', () => proposerCombat(friendId));
                friendsList.appendChild(li);
            });
        });
    }

    const tradeRequestsList = document.getElementById('trade-requests-list');
    const trades = state.currentUserData.trades || [];
    tradeRequestsList.innerHTML = "";
    
    if (trades.length === 0) {
        tradeRequestsList.innerHTML = "<li class='friend-item' style='color: #777;'>Aucune proposition.</li>";
    } else {
        trades.forEach(trade => {
            const li = document.createElement('li');
            li.className = "friend-item";
            li.style.flexDirection = "column";
            li.style.alignItems = "flex-start";

            const renderMiniCards = (cartes) => {
                if (!cartes || cartes.length === 0) return '<span style="color:#777; font-size:0.8rem; font-style: italic;">Rien</span>';
                return cartes.map(carte => {
                    if (!carte || !carte.data) return '';
                    const rarete = carte.mega ? "MG" : (carte.data.rarity || "C");
                    const bgColor = CONSTS.couleursRarete[rarete] || "#333";
                    const holoHtml = (carte.shiny || (carte.mega && carte.shiny)) ? '<div class="mini-card-holo"></div>' : '';
                    return `
                        <div class="mini-card" style="background-image: url('${getCardImageUrl(carte)}'); background-color: ${bgColor}; width: 45px; height: 60px; cursor: default;" title="${carte.data.fr || carte.data.en}">
                            ${holoHtml}
                        </div>`;
                }).join('');
            };

            const offerHtml = renderMiniCards(trade.offer);
            const requestHtml = renderMiniCards(trade.request);

            li.innerHTML = `
                <div style="width: 100%; display: flex; justify-content: space-between; margin-bottom: 10px; align-items: center;">
                    <span style="font-size: 1.1rem; color: #f1c40f;"><b>${trade.from}</b> propose :</span>
                    <div>
                        <button class="btn-small-action btn-accept">✔ Accepter</button>
                        <button class="btn-small-action btn-reject">✖ Refuser</button>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 10px; width: 100%; background: #1a1a1a; padding: 12px; border-radius: 8px; border: 1px solid #333;">
                    <div>
                        <span style="font-size: 0.9rem; color: #aaa; margin-bottom: 8px; display: block;">Il vous offre :</span>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">${offerHtml}</div>
                    </div>
                    <hr style="border: 0; border-top: 1px dashed #444; width: 100%; margin: 5px 0;">
                    <div>
                        <span style="font-size: 0.9rem; color: #aaa; margin-bottom: 8px; display: block;">En échange de :</span>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px;">${requestHtml}</div>
                    </div>
                </div>`;

            li.querySelector('.btn-accept').addEventListener('click', () => accepterEchange(trade.id, trade.from));
            li.querySelector('.btn-reject').addEventListener('click', () => refuserEchange(trade.id));
            tradeRequestsList.appendChild(li);
        });
    }
    
    if (requests.length === 0) {
        friendRequestsList.innerHTML = "<li class='friend-item' style='color: #777;'>Aucune demande en attente.</li>";
    } else {
        requests.forEach(req => {
            const li = document.createElement('li');
            li.className = "friend-item";
            li.innerHTML = `<span>${req}</span>
                <div>
                    <button class="btn-small-action btn-accept">✔</button>
                    <button class="btn-small-action btn-reject">✖</button>
                </div>`;
            li.querySelector('.btn-accept').addEventListener('click', () => acceptFriend(req));
            li.querySelector('.btn-reject').addEventListener('click', () => rejectFriend(req));
            friendRequestsList.appendChild(li);
        });
    }
}

async function acceptFriend(friendId) {
    if (!state.currentUser) return;
    try {
        let myRequests = state.currentUserData.friendRequests.filter(id => id !== friendId);
        let myFriends = state.currentUserData.friends || [];
        if (!myFriends.includes(friendId)) myFriends.push(friendId);
        
        await db.collection('users').doc(state.currentUser).update({ friendRequests: myRequests, friends: myFriends });
        
        const friendRef = db.collection('users').doc(friendId);
        const friendDoc = await friendRef.get();
        if (friendDoc.exists) {
            let theirFriends = friendDoc.data().friends || [];
            if (!theirFriends.includes(state.currentUser)) {
                theirFriends.push(state.currentUser);
                await friendRef.update({ friends: theirFriends });
            }
        }
    } catch(e) { console.error(e); }
}

async function rejectFriend(friendId) {
    if (!state.currentUser) return;
    let myRequests = state.currentUserData.friendRequests.filter(id => id !== friendId);
    await db.collection('users').doc(state.currentUser).update({ friendRequests: myRequests });
}