import { state, CONSTS } from '../state.js';

export function initNav() {
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => { 
        link.addEventListener('click', () => allerASection(link.getAttribute('data-target'))); 
    });

    const langToggle = document.getElementById('lang-toggle');
    langToggle.addEventListener('click', () => {
        state.currentLang = state.currentLang === 'en' ? 'fr' : 'en'; 
        langToggle.textContent = state.currentLang === 'en' ? '🇬🇧 EN' : '🇫🇷 FR';

        // 1. Met à jour les noms des Pokémon et Baies (Collection, Boosters, Jardin, Profil, Arène)
        document.querySelectorAll('.pokemon-name, #enemy-name, #player-name').forEach(el => {
            const nomTraduit = el.getAttribute(`data-${state.currentLang}`);
            if (nomTraduit) el.textContent = nomTraduit;
        });

        // 2. Mettre à jour le badge du combattant actif en haut de la page Campagne
        const activeFighterSpan = document.querySelector('#campagne-active-pokemon span');
        if (activeFighterSpan) {
            const badgeTraduit = activeFighterSpan.getAttribute(`data-${state.currentLang}`);
            if (badgeTraduit) activeFighterSpan.textContent = badgeTraduit;
        }

        // 3. Met à jour les badges de Types
        document.querySelectorAll('.type-badge').forEach(el => {
            const typeTraduit = el.getAttribute(`data-${state.currentLang}`);
            if (typeTraduit) el.textContent = typeTraduit;
        });

        // 4. Met à jour les Noms des Capacités (Boutons d'attaque de la Campagne)
        document.querySelectorAll('.move-name').forEach(el => {
            const moveTraduit = el.getAttribute(`data-${state.currentLang}`);
            if (moveTraduit) el.textContent = moveTraduit;
        });
    });
}

export function allerASection(targetId) {
    const navLinks = document.querySelectorAll('.nav-links li');
    const sections = document.querySelectorAll('.view-section');
    navLinks.forEach(l => l.classList.remove('active'));
    const link = Array.from(navLinks).find(l => l.getAttribute('data-target') === targetId);
    if(link) link.classList.add('active');
    
    sections.forEach(sec => sec.classList.add('hidden')); 
    document.getElementById(targetId).classList.remove('hidden');
}

export function updateAuthUI() {
    const userNameDisplay = document.getElementById('user-name-display');
    const authNavBtn = document.getElementById('auth-nav-btn');
    const debugTools = document.getElementById('debug-tools');
    const debugDenied = document.getElementById('debug-denied');

    if (state.currentUser) {
        userNameDisplay.textContent = state.currentUserData.displayName || state.currentUser;
        const sbAvatar = document.getElementById('sidebar-avatar');
        sbAvatar.style.display = 'block';
        sbAvatar.src = state.currentUserData.avatar || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/0.png';
        authNavBtn.textContent = "Se déconnecter"; authNavBtn.style.backgroundColor = "#e74c3c"; 
    } else {
        userNameDisplay.textContent = "Non connecté";
        document.getElementById('sidebar-avatar').style.display = 'none';
        authNavBtn.textContent = "Se connecter"; authNavBtn.style.backgroundColor = "#3498db"; 
    }

    if (debugTools && debugDenied) {
        if (state.currentUser === 'test') {
            debugTools.classList.remove('hidden');
            debugDenied.classList.add('hidden');
        } else {
            debugTools.classList.add('hidden');
            debugDenied.classList.remove('hidden');
        }
    }
}