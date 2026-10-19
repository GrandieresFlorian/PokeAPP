import { state, CONSTS } from '../state.js';

export function initNav() {
    const navLinks = document.querySelectorAll('.nav-links li');
    navLinks.forEach(link => { 
        link.addEventListener('click', () => allerASection(link.getAttribute('data-target'))); 
    });

    const langToggle = document.getElementById('lang-toggle');
    
    langToggle.textContent = state.currentLang === 'en' ? '🇬🇧 EN' : '🇫🇷 FR';
    applyTranslation();

    langToggle.addEventListener('click', () => {
        state.currentLang = state.currentLang === 'en' ? 'fr' : 'en'; 
        localStorage.setItem('pokeAppLang', state.currentLang); 
        langToggle.textContent = state.currentLang === 'en' ? '🇬🇧 EN' : '🇫🇷 FR';
        applyTranslation();
    });
}

export function applyTranslation() {
    document.querySelectorAll('.translatable').forEach(el => {
        const texteTraduit = el.getAttribute(`data-${state.currentLang}`);
        if (texteTraduit) el.innerHTML = texteTraduit; 
    });

    document.querySelectorAll('.pokemon-name, #enemy-name, #player-name').forEach(el => {
        const nomTraduit = el.getAttribute(`data-${state.currentLang}`);
        if (nomTraduit) el.textContent = nomTraduit;
    });

    const activeFighterSpan = document.querySelector('#campagne-active-pokemon span');
    if (activeFighterSpan) {
        const badgeTraduit = activeFighterSpan.getAttribute(`data-${state.currentLang}`);
        if (badgeTraduit) activeFighterSpan.textContent = badgeTraduit;
    }

    document.querySelectorAll('.type-badge').forEach(el => {
        const typeTraduit = el.getAttribute(`data-${state.currentLang}`);
        if (typeTraduit) el.textContent = typeTraduit;
    });

    document.querySelectorAll('.move-name').forEach(el => {
        const moveTraduit = el.getAttribute(`data-${state.currentLang}`);
        if (moveTraduit) el.textContent = moveTraduit;
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
        const displayName = state.currentUserData.displayName || state.currentUser;
        userNameDisplay.textContent = displayName;
        
        // CORRECTION : On met à jour les attributs de traduction pour qu'ils n'écrasent plus le pseudo
        userNameDisplay.setAttribute('data-fr', displayName);
        userNameDisplay.setAttribute('data-en', displayName);
        
        const sbAvatar = document.getElementById('sidebar-avatar');
        sbAvatar.style.display = 'block';
        sbAvatar.src = state.currentUserData.avatar || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/0.png';
        
        authNavBtn.setAttribute('data-fr', 'Se déconnecter');
        authNavBtn.setAttribute('data-en', 'Logout');
        authNavBtn.textContent = state.currentLang === 'en' ? 'Logout' : 'Se déconnecter';
        authNavBtn.style.backgroundColor = "#e74c3c"; 
    } else {
        userNameDisplay.textContent = state.currentLang === 'en' ? "Not connected" : "Non connecté";
        userNameDisplay.setAttribute('data-fr', 'Non connecté');
        userNameDisplay.setAttribute('data-en', 'Not connected');
        
        document.getElementById('sidebar-avatar').style.display = 'none';
        
        authNavBtn.setAttribute('data-fr', 'Se connecter');
        authNavBtn.setAttribute('data-en', 'Login');
        authNavBtn.textContent = state.currentLang === 'en' ? 'Login' : 'Se connecter';
        authNavBtn.style.backgroundColor = "#3498db"; 
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