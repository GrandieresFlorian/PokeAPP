import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { updateAuthUI, allerASection } from './navController.js';
import { updateBoosterLogic } from './boosterController.js';
import { startFriendsListener, stopFriendsListener } from './friendsController.js';

export function initAuth() {
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const authNavBtn = document.getElementById('auth-nav-btn');
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const authMessage = document.getElementById('auth-message');

    loginBtn.addEventListener('click', async () => {
        const user = usernameInput.value.trim(); const pass = passwordInput.value;
        if (!user || !pass) return authMessage.textContent = "Veuillez remplir tous les champs.";
        authMessage.textContent = "Connexion...";
        try {
            const doc = await db.collection('users').doc(user).get();
            if (doc.exists && doc.data().password === pass) {
                state.currentUser = user;
                state.currentUserData = doc.data();
                localStorage.setItem('pokeAppCurrentUser', user);
                authMessage.textContent = "";
                updateAuthUI(); updateBoosterLogic(); startFriendsListener();
                allerASection('section-boosters');
            } else { authMessage.textContent = "Identifiants incorrects."; }
        } catch (e) { authMessage.textContent = "Erreur serveur."; }
    });

    signupBtn.addEventListener('click', async () => {
        const user = usernameInput.value.trim(); const pass = passwordInput.value;
        if (!user || !pass) return authMessage.textContent = "Remplissez tout.";
        try {
            const docRef = db.collection('users').doc(user);
            const doc = await docRef.get();
            if (doc.exists) { authMessage.textContent = "Nom pris."; return; }
            state.currentUserData = { password: pass, collection: [], boostersLeft: CONSTS.MAX_BOOSTERS, lastBoosterTime: Date.now(), friends: [], friendRequests: [], trades: [] };
            await docRef.set(state.currentUserData);
            state.currentUser = user;
            localStorage.setItem('pokeAppCurrentUser', user);
            updateAuthUI(); updateBoosterLogic(); startFriendsListener();
            allerASection('section-boosters');
        } catch (e) { authMessage.textContent = "Erreur."; }
    });

    authNavBtn.addEventListener('click', () => {
        if (state.currentUser) {
            stopFriendsListener();
            state.currentUser = null;
            state.currentUserData = { collection: [] };
            localStorage.removeItem('pokeAppCurrentUser');
            updateAuthUI(); updateBoosterLogic();
            allerASection('section-boosters');
        } else { allerASection('section-auth'); }
    });
}