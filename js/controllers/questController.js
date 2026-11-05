import { db } from '../firebase-config.js';
import { state } from '../state.js';
import { updateSpecialBoosterUI } from './boosterController.js';

// ==========================================
// BASES DE DONNÉES DES QUÊTES
// ==========================================
const POOL_QUOTIDIENNES = [
    { type: 'open_boosters', target: 10, reward: 1, fr: "Ouvrir 10 boosters Pokémon", en: "Open 10 Pokémon packs" },
    { type: 'open_boosters', target: 25, reward: 1, fr: "Ouvrir 25 boosters Pokémon", en: "Open 25 Pokémon packs" },
    { type: 'recycle_pokemon', target: 10, reward: 1, fr: "Vendre 10 Pokémon en doublon", en: "Sell 10 duplicate Pokémon" },
    { type: 'recycle_pokemon', target: 20, reward: 1, fr: "Vendre 20 Pokémon en doublon", en: "Sell 20 duplicate Pokémon" },
    { type: 'open_trainer', target: 3, reward: 1, fr: "Ouvrir 3 boosters Dresseur", en: "Open 3 Trainer packs" },
    { type: 'open_trainer', target: 5, reward: 1, fr: "Ouvrir 5 boosters Dresseur", en: "Open 5 Trainer packs" },
    { type: 'recycle_trainer', target: 2, reward: 1, fr: "Vendre 2 cartes Dresseur", en: "Sell 2 Trainer cards" },
    { type: 'recycle_trainer', target: 5, reward: 1, fr: "Vendre 5 cartes Dresseur", en: "Sell 5 Trainer cards" },
    // Si tu ajoutes ces hooks plus tard dans ton jardin / combats :
    { type: 'plant_berry', target: 3, reward: 1, fr: "Planter 3 Baies dans la serre", en: "Plant 3 Berries in the greenhouse" },
    { type: 'harvest_berry', target: 3, reward: 1, fr: "Récolter 3 Baies", en: "Harvest 3 Berries" },
    { type: 'play_battle', target: 2, reward: 1, fr: "Faire 2 combats (Campagne ou PVP)", en: "Play 2 battles (Campaign or PVP)" }
];

const POOL_HEBDOMADAIRES = [
    { type: 'open_boosters', target: 100, reward: 3, fr: "Ouvrir 100 boosters Pokémon", en: "Open 100 Pokémon packs" },
    { type: 'open_boosters', target: 250, reward: 5, fr: "Ouvrir 250 boosters Pokémon", en: "Open 250 Pokémon packs" },
    { type: 'recycle_pokemon', target: 100, reward: 3, fr: "Vendre 100 Pokémon en doublon", en: "Sell 100 duplicate Pokémon" },
    { type: 'open_trainer', target: 25, reward: 4, fr: "Ouvrir 25 boosters Dresseur", en: "Open 25 Trainer packs" },
    { type: 'recycle_trainer', target: 20, reward: 3, fr: "Vendre 20 cartes Dresseur", en: "Sell 20 Trainer cards" },
    { type: 'plant_berry', target: 30, reward: 3, fr: "Planter 30 Baies", en: "Plant 30 Berries" },
    { type: 'play_battle', target: 20, reward: 4, fr: "Faire 20 combats", en: "Play 20 battles" }
];

// ==========================================
// CLASSEMENT DES JOUEURS (LEADERBOARD)
// ==========================================
async function afficherClassement() {
    const uniqueContainer = document.getElementById('leaderboard-unique');
    const totalContainer = document.getElementById('leaderboard-total');
    if (!uniqueContainer || !totalContainer) return;

    const BANNED_NAMES = ["test", "hacker-copie" ,"OriKage"];
    try {
        // On récupère tous les utilisateurs
        const snapshot = await db.collection('users').get();
        let usersData = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            // On ne prend que les joueurs qui ont au moins une carte
            if (data.collection && data.collection.length > 0) {
                // Nombre de cartes uniques (la taille du tableau compressé)
                const uniqueCount = data.collection.length;
                
                // Nombre total de cartes (somme de toutes les quantités)
                const totalCount = data.collection.reduce((sum, card) => sum + (Number(card.quantity) || 1), 0);
                
                // On récupère le pseudo (ou le nom d'utilisateur, ou l'ID par défaut)
                const pseudo = data.pseudo || data.username || doc.id.substring(0, 8);

                if (BANNED_NAMES.includes(pseudo.toLowerCase())) {
                    return; // Si banni, on passe au joueur suivant sans l'ajouter
                }
                
                usersData.push({ pseudo, uniqueCount, totalCount });
            }
        });

        // Fonction pour générer le HTML du Top 10
        const renderList = (list, key, colorClass) => {
            if (list.length === 0) return "<li style='text-align:center; color:#aaa;'>Aucun joueur classé.</li>";
            
            return list.map((u, i) => {
                let medal = i === 0 ? '🥇' : (i === 1 ? '🥈' : (i === 2 ? '🥉' : `<span style="display:inline-block; width:20px; text-align:center; color:#aaa;">${i+1}.</span>`));
                return `
                    <li style="display:flex; justify-content:space-between; padding: 12px 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <span style="font-weight: ${i < 3 ? 'bold' : 'normal'};">${medal} ${u.pseudo}</span>
                        <span class="${colorClass} font-bold">${u[key]}</span>
                    </li>
                `;
            }).join('');
        };

        // Tri et affichage du Top 10 "Uniques"
        const topUnique = [...usersData].sort((a, b) => b.uniqueCount - a.uniqueCount).slice(0, 10);
        uniqueContainer.innerHTML = renderList(topUnique, 'uniqueCount', 'text-accent');

        // Tri et affichage du Top 10 "Total"
        const topTotal = [...usersData].sort((a, b) => b.totalCount - a.totalCount).slice(0, 10);
        totalContainer.innerHTML = renderList(topTotal, 'totalCount', 'text-primary');

    } catch(e) {
        console.error("Erreur lors du chargement du classement :", e);
        uniqueContainer.innerHTML = "<li style='color:red;'>Erreur de chargement</li>";
        totalContainer.innerHTML = "<li style='color:red;'>Erreur de chargement</li>";
    }
}

// ==========================================
// UTILITAIRES DE TEMPS
// ==========================================
function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

function getWeekString() {
    // Calcule la semaine ISO actuelle (ex: "2026-W45")
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7 + 1);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ==========================================
// INITIALISATION ET GÉNÉRATION
// ==========================================
export function initQuests() {
    if (!state.currentUser) return;

    let userData = state.currentUserData;
    const today = getTodayString();
    const currentWeek = getWeekString();
    
    let needsUpdate = false;

    // 1. Check Quêtes Journalières
    if (!userData.questsDate || userData.questsDate !== today || !userData.dailyQuests) {
        userData.dailyQuests = genererQuetes(POOL_QUOTIDIENNES, 3);
        userData.questsDate = today;
        needsUpdate = true;
    }

    // 2. Check Quêtes Hebdomadaires
    if (!userData.questsWeek || userData.questsWeek !== currentWeek || !userData.weeklyQuests) {
        userData.weeklyQuests = genererQuetes(POOL_HEBDOMADAIRES, 2); // 2 quêtes hebdo
        userData.questsWeek = currentWeek;
        needsUpdate = true;
    }

    if (needsUpdate) {
        db.collection('users').doc(state.currentUser).update({
            questsDate: userData.questsDate,
            questsWeek: userData.questsWeek,
            dailyQuests: userData.dailyQuests,
            weeklyQuests: userData.weeklyQuests
        }).then(() => {
            afficherQuetes();
            updateQuestBadge(); // <--- AJOUT
        });
    } else {
        afficherQuetes();
        updateQuestBadge(); // <--- AJOUT
    }
    afficherClassement();
}

function genererQuetes(pool, count) {
    let shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(q => ({
        ...q,
        progress: 0,
        claimed: false
    }));
}

// ==========================================
// AFFICHAGE
// ==========================================
export function afficherQuetes() {
    const container = document.getElementById('quests-container');
    if (!container || !state.currentUserData) return;

    const isEn = state.currentLang === 'en';
    
    // NOUVEAU : Utilisation de Flexbox pour mettre les colonnes côte à côte
    let html = `
        <div style="display: flex; gap: 30px; flex-wrap: wrap; justify-content: center; width: 100%;">
            
            <!-- COLONNE JOURNALIÈRES -->
            <div style="flex: 1; min-width: 320px;">
                <h3 class="text-primary" style="border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-top: 0;">
                    ${isEn ? "Daily Quests (Resets at midnight)" : "Quêtes Journalières (Reset à minuit)"}
                </h3>
                <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 40px;">
                    ${genererHtmlListeQuetes(state.currentUserData.dailyQuests, 'daily')}
                </div>
            </div>

            <!-- COLONNE HEBDOMADAIRES -->
            <div style="flex: 1; min-width: 320px;">
                <h3 class="text-accent" style="border-bottom: 2px solid #f39c12; padding-bottom: 10px; margin-top: 0;">
                    ${isEn ? "Weekly Quests (Resets on Monday)" : "Quêtes Hebdomadaires (Reset le lundi)"}
                </h3>
                <div style="display: flex; flex-direction: column; gap: 15px;">
                    ${genererHtmlListeQuetes(state.currentUserData.weeklyQuests, 'weekly')}
                </div>
            </div>
            
        </div>
    `;

    container.innerHTML = html;

    container.querySelectorAll('.btn-claim-quest').forEach(btn => {
        btn.addEventListener('click', (e) => validerQuete(e.target.dataset.type, e.target.dataset.index));
    });
}

function genererHtmlListeQuetes(liste, listType) {
    if (!liste || liste.length === 0) return "<p style='color:#aaa;'>Aucune quête en cours.</p>";
    const isEn = state.currentLang === 'en';

    return liste.map((quete, index) => {
        const desc = isEn ? quete.en : quete.fr;
        const isCompleted = quete.progress >= quete.target;
        const progressPercent = Math.min((quete.progress / quete.target) * 100, 100);
        
        // CORRECTION : On force la valeur à 1 si elle est indéfinie (anciennes sauvegardes)
        const reward = quete.reward || 1; 

        let actionHtml = '';
        if (quete.claimed) {
            actionHtml = `<span style="color: #2ecc71; font-weight: bold;">✅ ${isEn ? "Claimed" : "Validée"}</span>`;
        } else if (isCompleted) {
            actionHtml = `<button class="btn btn-secondary btn-claim-quest" data-type="${listType}" data-index="${index}" style="margin: 0; padding: 8px 15px; background: #e67e22; border-color: #d35400;">🎁 +${reward} Shiny</button>`;
        } else {
            actionHtml = `<span style="color: #aaa;">${quete.progress} / ${quete.target}</span>`;
        }

        const barColor = listType === 'weekly' ? '#f39c12' : '#3498db'; 
        const barFilledColor = isCompleted ? '#2ecc71' : barColor;

        return `
            <div class="glass-panel" style="display: flex; justify-content: space-between; align-items: center; padding: 15px 25px; border-left: 5px solid ${barColor};">
                <div style="flex: 1; padding-right: 20px;">
                    <h4 style="margin: 0 0 10px 0;">${desc} <span style="font-size:0.8rem; color:#f1c40f;">(🎁 x${reward})</span></h4>
                    <div style="background: #222; border-radius: 10px; height: 10px; width: 100%; overflow: hidden; max-width: 350px;">
                        <div style="background: ${barFilledColor}; height: 100%; width: ${progressPercent}%; transition: width 0.3s;"></div>
                    </div>
                </div>
                <div>${actionHtml}</div>
            </div>
        `;
    }).join('');
}

// ==========================================
// PROGRESSION ET VALIDATION
// ==========================================
export function updateQuestProgress(actionType, amount = 1) {
    if (!state.currentUser || (!state.currentUserData.dailyQuests && !state.currentUserData.weeklyQuests)) return;

    let updated = false;

    // Fonction interne pour vérifier et incrémenter une liste
    const processList = (liste) => {
        if (!liste) return;
        liste.forEach(quete => {
            if (quete.type === actionType && quete.progress < quete.target) {
                quete.progress += amount;
                updated = true;
            }
        });
    };

    // On fait avancer les deux listes en même temps !
    processList(state.currentUserData.dailyQuests);
    processList(state.currentUserData.weeklyQuests);

    if (updated) {
        db.collection('users').doc(state.currentUser).update({
            dailyQuests: state.currentUserData.dailyQuests,
            weeklyQuests: state.currentUserData.weeklyQuests
        });
        afficherQuetes(); // Mettre à jour l'UI
        updateQuestBadge(); // <--- AJOUT (Allume le point rouge en direct si une quête est terminée)
    }
}

function validerQuete(listType, index) {
    let liste = listType === 'weekly' ? state.currentUserData.weeklyQuests : state.currentUserData.dailyQuests;
    let quete = liste[index];

    if (!quete || quete.claimed || quete.progress < quete.target) return;

    quete.claimed = true;
    
    // CORRECTION : Même sécurité ici pour le gain réel
    const reward = quete.reward || 1;
    state.currentUserData.specialBoostersLeft = (state.currentUserData.specialBoostersLeft || 0) + reward;

    db.collection('users').doc(state.currentUser).update({
        dailyQuests: state.currentUserData.dailyQuests,
        weeklyQuests: state.currentUserData.weeklyQuests,
        specialBoostersLeft: state.currentUserData.specialBoostersLeft
    }).then(() => {
        afficherQuetes();
        import('./boosterController.js').then(({ updateSpecialBoosterUI }) => updateSpecialBoosterUI());
        
        // --- NOUVEAU SYSTÈME VISUEL ---
        updateQuestBadge(); // Éteint le point rouge si on a tout récupéré
        showToast(state.currentLang === 'en' ? `Quest completed! +${reward} Shiny Pack(s) ✨` : `Quête validée ! +${reward} Booster(s) Shiny ✨`);
    });
}

// ==========================================
// NOTIFICATIONS ET BADGES (NOUVEAU)
// ==========================================
export function updateQuestBadge() {
    if (!state.currentUser || !state.currentUserData) return;
    
    let hasClaimable = false;
    
    // On cherche si une quête est terminée mais non récupérée
    const checkList = (list) => {
        if (!list) return;
        for (let q of list) {
            if (q.progress >= q.target && !q.claimed) {
                hasClaimable = true;
                break;
            }
        }
    };
    
    checkList(state.currentUserData.dailyQuests);
    if (!hasClaimable) checkList(state.currentUserData.weeklyQuests);
    
    // ⚠️ Assure-toi que l'ID correspond bien à ton bouton Quêtes dans ton index.html (souvent 'nav-quetes' ou 'nav-quests')
    const navQuetes = document.getElementById('nav-quetes') || document.getElementById('nav-quests'); 
    
    if (navQuetes) {
        // Nettoie l'ancien point rouge s'il y en a un
        let existingBadge = navQuetes.querySelector('.quest-badge');
        if (existingBadge) existingBadge.remove();
        
        // S'il y a une récompense, on crée le point rouge
        if (hasClaimable) {
            navQuetes.style.position = 'relative'; // Nécessaire pour accrocher le point
            const badge = document.createElement('span');
            badge.className = 'quest-badge';
            badge.style.cssText = 'position: absolute; top: 0px; right: 0px; width: 12px; height: 12px; background-color: #e74c3c; border-radius: 50%; border: 2px solid #2c3e50; pointer-events: none;';
            navQuetes.appendChild(badge);
        }
    }
}

function showToast(message) {
    let toast = document.createElement('div');
    toast.innerHTML = message;
    // Style de la petite notification discrète et élégante
    toast.style.cssText = "position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.9); color: white; padding: 12px 24px; border-radius: 8px; z-index: 9999; font-weight: bold; border-left: 4px solid #f1c40f; box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: opacity 0.5s ease; pointer-events: none;";
    document.body.appendChild(toast);
    
    // Disparaît doucement après 3 secondes
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}