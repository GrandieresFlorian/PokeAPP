import { db } from '../firebase-config.js';
import { state } from '../state.js';
import { updateAuthUI, allerASection, stopNotificationListener } from './navController.js';
import { updateBoosterLogic } from './boosterController.js';
import { stopFriendsListener } from './friendsController.js';
import { loadUser, normalizeUserData } from '../userService.js';

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
                // Même chemin que le chargement de page : valeurs par défaut, migration, quêtes, listeners
                await loadUser(user, doc.data());
                authMessage.textContent = "";
                allerASection('section-boosters');
            } else { authMessage.textContent = "Identifiants incorrects."; }
        } catch (e) { console.error(e); authMessage.textContent = "Erreur serveur."; }
    });

    signupBtn.addEventListener('click', async () => {
        const user = usernameInput.value.trim(); const pass = passwordInput.value;
        if (!user || !pass) return authMessage.textContent = "Remplissez tout.";
        try {
            const docRef = db.collection('users').doc(user);
            const doc = await docRef.get();
            if (doc.exists) { authMessage.textContent = "Nom pris."; return; }

            // Document de départ complet : plus aucun champ "undefined" (ex: trainerBoostersLeft)
            const { data } = normalizeUserData({ password: pass });
            await docRef.set(data);
            await loadUser(user, data);
            allerASection('section-boosters');
        } catch (e) { console.error(e); authMessage.textContent = "Erreur."; }
    });

    authNavBtn.addEventListener('click', () => {
        if (state.currentUser) {
            stopFriendsListener();
            stopNotificationListener();
            state.currentUser = null;
            state.currentUserData = { collection: [] };
            localStorage.removeItem('pokeAppCurrentUser');
            updateAuthUI(); updateBoosterLogic();
            allerASection('section-boosters');
        } else { allerASection('section-auth'); }
    });
}
