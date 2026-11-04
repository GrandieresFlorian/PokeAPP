import { db } from '../firebase-config.js';
import { state } from '../state.js';
import { updateSpecialBoosterUI } from './boosterController.js';

// Liste de toutes les quêtes possibles
const POOL_QUETES = [
    { type: 'open_boosters', target: 10, fr: "Ouvrir 10 boosters Pokémon", en: "Open 10 Pokémon packs" },
    { type: 'open_boosters', target: 25, fr: "Ouvrir 25 boosters Pokémon", en: "Open 25 Pokémon packs" },
    { type: 'recycle_pokemon', target: 5, fr: "Recycler (vendre) 5 Pokémon", en: "Recycle (sell) 5 Pokémon" },
    { type: 'recycle_pokemon', target: 15, fr: "Recycler (vendre) 15 Pokémon", en: "Recycle (sell) 15 Pokémon" },
    { type: 'open_trainer', target: 10, fr: "Ouvrir 10 boosters Dresseur", en: "Open 10 Trainer packs" },
    { type: 'open_trainer', target: 20, fr: "Ouvrir 20 boosters Dresseur", en: "Open 20 Trainer packs" },
    { type: 'recycle_trainer', target: 3, fr: "Recycler (vendre) 3 Dresseurs", en: "Recycle (sell) 3 Trainers" }
];

export function initQuests() {
    if (!state.currentUser) return;

    const today = new Date().toISOString().split('T')[0]; // Format "YYYY-MM-DD"
    let userData = state.currentUserData;

    // Si le joueur n'a pas de quêtes ou si on est un nouveau jour -> Reset
    if (!userData.questsDate || userData.questsDate !== today) {
        genererNouvellesQuetes(today);
    } else {
        afficherQuetes();
    }
}

function genererNouvellesQuetes(today) {
    // Choisir 3 quêtes aléatoires uniques
    let shuffled = [...POOL_QUETES].sort(() => 0.5 - Math.random());
    let selectedQuests = shuffled.slice(0, 3).map(q => ({
        ...q,
        progress: 0,
        claimed: false
    }));

    state.currentUserData.questsDate = today;
    state.currentUserData.dailyQuests = selectedQuests;

    db.collection('users').doc(state.currentUser).update({
        questsDate: today,
        dailyQuests: selectedQuests
    }).then(() => afficherQuetes());
}

export function afficherQuetes() {
    const container = document.getElementById('quests-container');
    if (!container) return;
    
    if (!state.currentUserData.dailyQuests) {
        container.innerHTML = "<p>Aucune quête disponible.</p>";
        return;
    }

    container.innerHTML = state.currentUserData.dailyQuests.map((quete, index) => {
        const isEn = state.currentLang === 'en';
        const desc = isEn ? quete.en : quete.fr;
        const isCompleted = quete.progress >= quete.target;
        const progressPercent = Math.min((quete.progress / quete.target) * 100, 100);

        let actionHtml = '';
        if (quete.claimed) {
            actionHtml = `<span style="color: #2ecc71; font-weight: bold;">✅ ${isEn ? "Claimed" : "Validée"}</span>`;
        } else if (isCompleted) {
            actionHtml = `<button class="btn btn-secondary btn-claim-quest" data-index="${index}" style="margin: 0; padding: 8px 15px;">🎁 ${isEn ? "Claim!" : "Récupérer!"}</button>`;
        } else {
            actionHtml = `<span style="color: #aaa;">${quete.progress} / ${quete.target}</span>`;
        }

        return `
            <div class="glass-panel" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 25px;">
                <div style="flex: 1;">
                    <h4 style="margin: 0 0 10px 0;">${desc}</h4>
                    <div style="background: #222; border-radius: 10px; height: 10px; width: 100%; overflow: hidden; max-width: 300px;">
                        <div style="background: ${isCompleted ? '#f1c40f' : '#3498db'}; height: 100%; width: ${progressPercent}%; transition: width 0.3s;"></div>
                    </div>
                </div>
                <div>${actionHtml}</div>
            </div>
        `;
    }).join('');

    // Ajouter les écouteurs pour récupérer les récompenses
    container.querySelectorAll('.btn-claim-quest').forEach(btn => {
        btn.addEventListener('click', (e) => validerQuete(e.target.dataset.index));
    });
}

// Fonction appelée partout dans le code pour faire avancer les quêtes
export function updateQuestProgress(actionType, amount = 1) {
    if (!state.currentUser || !state.currentUserData.dailyQuests) return;

    let updated = false;
    state.currentUserData.dailyQuests.forEach(quete => {
        if (quete.type === actionType && quete.progress < quete.target) {
            quete.progress += amount;
            updated = true;
        }
    });

    if (updated) {
        db.collection('users').doc(state.currentUser).update({
            dailyQuests: state.currentUserData.dailyQuests
        });
        afficherQuetes(); // Mettre à jour l'UI en temps réel
    }
}

function validerQuete(index) {
    let quete = state.currentUserData.dailyQuests[index];
    if (!quete || quete.claimed || quete.progress < quete.target) return;

    quete.claimed = true;
    state.currentUserData.specialBoostersLeft = (state.currentUserData.specialBoostersLeft || 0) + 1;

    db.collection('users').doc(state.currentUser).update({
        dailyQuests: state.currentUserData.dailyQuests,
        specialBoostersLeft: state.currentUserData.specialBoostersLeft
    }).then(() => {
        afficherQuetes();
        updateSpecialBoosterUI();
        alert(state.currentLang === 'en' ? "Quest completed! +1 Shiny Pack ✨" : "Quête validée ! +1 Booster Shiny ✨");
    });
}