import { db } from '../firebase-config.js';
import { state } from '../state.js';

let friendsListener = null;

export function startFriendsListener() {
    if (!state.currentUser) return;
    if (friendsListener) friendsListener();
    friendsListener = db.collection('users').doc(state.currentUser).onSnapshot(doc => {
        if (doc.exists) {
            state.currentUserData.friends = doc.data().friends || [];
            state.currentUserData.friendRequests = doc.data().friendRequests || [];
            // call renderFriendsUI()
        }
    });
}

export function stopFriendsListener() {
    if(friendsListener) { friendsListener(); friendsListener = null; }
}

export function initFriends() {
    // Event listeners for Add friend button
}