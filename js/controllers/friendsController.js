import { db } from '../firebase-config.js';
import { state } from '../state.js';
import { initierEchange, accepterEchange, refuserEchange } from './tradeController.js';

let friendsListener = null;

export function startFriendsListener() {
    if (!state.currentUser) return;
    if (friendsListener) friendsListener();
    friendsListener = db.collection('users').doc(state.currentUser).onSnapshot(doc => {
        if (doc.exists) {
            state.currentUserData.friends = doc.data().friends || [];
            state.currentUserData.friendRequests = doc.data().friendRequests || [];
            state.currentUserData.trades = doc.data().trades || [];
            renderFriendsUI();
        }
    });
}

export function stopFriendsListener() {
    if(friendsListener) { friendsListener(); friendsListener = null; }
}

export function initFriends() {
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
        friends.forEach(friend => {
            const li = document.createElement('li');
            li.className = "friend-item";
            li.innerHTML = `<span>${friend}</span><button class="btn-small-action" style="background-color: #9b59b6;">Échanger 🔄</button>`;
            li.querySelector('button').addEventListener('click', () => initierEchange(friend));
            friendsList.appendChild(li);
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
            li.innerHTML = `
                <div style="width: 100%; display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <span><b>${trade.from}</b> propose un échange :</span>
                    <div>
                        <button class="btn-small-action btn-accept">✔ Accepter</button>
                        <button class="btn-small-action btn-reject">✖ Refuser</button>
                    </div>
                </div>
                <div style="font-size: 0.9rem; color: #aaa;">
                    <b>Il offre :</b> ${trade.offer.length} carte(s)<br>
                    <b>Il demande :</b> ${trade.request.length} carte(s)
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