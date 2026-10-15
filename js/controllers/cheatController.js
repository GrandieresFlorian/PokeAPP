import { db } from '../firebase-config.js';
import { state } from '../state.js';

export function initCheats() {
    document.getElementById('cheat-clear-all').addEventListener('click', async () => {
        if (state.currentUser !== 'test') return;
        state.currentUserData.collection = [];
        await db.collection('users').doc(state.currentUser).update({ collection: [] });
        alert("Collection vidée !");
    });
}