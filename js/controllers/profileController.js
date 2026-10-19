import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { getCardImageUrl, formatMegaName, generateTypeBadgesHTML } from '../utils.js';
import { allerASection } from './navController.js';

let vitrineSelection = [];

export function initProfile() {
    document.getElementById('nav-profil').addEventListener('click', () => {
        if (!state.currentUser) return alert("Veuillez vous connecter.");
        voirProfil(state.currentUser);
    });

    document.getElementById('btn-edit-profil').addEventListener('click', openEditMode);
    document.getElementById('btn-cancel-profil').addEventListener('click', () => {
        document.getElementById('profil-edit-mode').classList.add('hidden');
        document.getElementById('profil-view-mode').classList.remove('hidden');
    });
    document.getElementById('btn-save-profil').addEventListener('click', saveProfile);
}

export async function voirProfil(userId) {
    allerASection('section-profil');
    document.getElementById('profil-edit-mode').classList.add('hidden');
    document.getElementById('profil-view-mode').classList.remove('hidden');
    
    const isMe = (userId === state.currentUser);
    const btnEdit = document.getElementById('btn-edit-profil');
    
    if (isMe) {
        btnEdit.classList.remove('hidden');
        renderProfileData(state.currentUserData, userId);
    } else {
        btnEdit.classList.add('hidden');
        document.getElementById('profil-name').textContent = "Chargement...";
        document.getElementById('profil-desc').textContent = "...";
        document.getElementById('profil-vitrine').innerHTML = "";
        try {
            const doc = await db.collection('users').doc(userId).get();
            if (doc.exists) renderProfileData(doc.data(), userId);
            else document.getElementById('profil-name').textContent = "Joueur introuvable";
        } catch(e) { console.error(e); }
    }
}

function renderProfileData(userData, userId) {
    document.getElementById('profil-name').textContent = userData.displayName || userId;
    document.getElementById('profil-id-text').textContent = "@" + userId;
    document.getElementById('profil-avatar').src = userData.avatar || "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/0.png";
    document.getElementById('profil-desc').textContent = userData.description || "Aucune description renseignée.";
    
    const vitrineContainer = document.getElementById('profil-vitrine');
    vitrineContainer.innerHTML = "";
    
    const vitrineCards = userData.vitrine || [];
    if (vitrineCards.length === 0) { vitrineContainer.innerHTML = "<p style='color:#777;'>Cette vitrine est vide.</p>"; return; }
    
    vitrineCards.forEach(carte => {
        const div = document.createElement('div');
        div.innerHTML = creerHtmlCarte(carte);
        vitrineContainer.appendChild(div.firstElementChild);
    });
}

function getUniqueCards(collection) {
    const uniques = []; const keys = new Set();
    collection.forEach(c => {
        if (!c || (!c.data && !c.isBaie)) return;
        const key = c.isBaie ? `baie_${c.id}` : `${c.pokedexNumber}_${c.shiny}_${c.mega}_${c.megaForm}`;
        if (!keys.has(key)) { keys.add(key); uniques.push(c); }
    });
    return uniques;
}

function openEditMode() {
    document.getElementById('profil-view-mode').classList.add('hidden');
    document.getElementById('profil-edit-mode').classList.remove('hidden');
    document.getElementById('edit-pseudo').value = state.currentUserData.displayName || state.currentUser;
    document.getElementById('edit-avatar').value = state.currentUserData.avatar || "";
    document.getElementById('edit-desc').value = state.currentUserData.description || "";
    vitrineSelection = [...(state.currentUserData.vitrine || [])];
    renderEditVitrine();
}

function renderEditVitrine() {
    const grid = document.getElementById('edit-vitrine-collection');
    const selectionBox = document.getElementById('edit-vitrine-selection');
    document.getElementById('vitrine-count').textContent = `${vitrineSelection.length} / 4`;
    grid.innerHTML = ""; selectionBox.innerHTML = "";
    
    const createMini = (carte, isSelected) => {
        const div = document.createElement('div');
        let imageUrl = getCardImageUrl(carte);
        if (carte.isBaie) {
            let enName = (carte.en || carte.data.en).toLowerCase().replace(/\s+/g, '-');
            imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${enName}.png`;
        }

        div.className = `mini-card ${isSelected ? 'selected' : ''}`;
        div.style.backgroundImage = `url('${imageUrl}')`;
        
        if (carte.isBaie) {
            div.style.backgroundColor = "#2ecc71"; div.style.backgroundSize = "contain"; div.style.imageRendering = "pixelated";
        } else {
            const rarete = carte.mega ? "MG" : (carte.data.rarity || "C");
            div.style.backgroundColor = CONSTS.couleursRarete[rarete] || "#333";
            if (carte.shiny || (carte.mega && carte.shiny)) div.innerHTML = '<div class="mini-card-holo"></div>';
        }
        
        div.onclick = () => {
            const getKey = c => c.isBaie ? `baie_${c.id || c.data.id}` : `${c.pokedexNumber}_${c.shiny}_${c.mega}_${c.megaForm}`;
            const targetKey = getKey(carte);
            const index = vitrineSelection.findIndex(c => getKey(c) === targetKey);
            
            if (index !== -1) vitrineSelection.splice(index, 1);
            else if (vitrineSelection.length < 4) vitrineSelection.push(carte);
            else alert("Vous ne pouvez mettre que 4 cartes dans votre vitrine !");
            
            renderEditVitrine();
        };
        return div;
    };
    
    const allUniqueCards = getUniqueCards([...(state.currentUserData.collection || []), ...(state.currentUserData.berries || [])]);
    allUniqueCards.forEach(carte => {
        const getKey = c => c.isBaie ? `baie_${c.id || c.data.id}` : `${c.pokedexNumber}_${c.shiny}_${c.mega}_${c.megaForm}`;
        const isSelected = vitrineSelection.some(c => getKey(c) === getKey(carte));
        grid.appendChild(createMini(carte, isSelected));
    });
    
    vitrineSelection.forEach(carte => {
        let clone = createMini(carte, true);
        const getKey = c => c.isBaie ? `baie_${c.id || c.data.id}` : `${c.pokedexNumber}_${c.shiny}_${c.mega}_${c.megaForm}`;
        clone.onclick = () => { vitrineSelection = vitrineSelection.filter(c => getKey(c) !== getKey(carte)); renderEditVitrine(); };
        selectionBox.appendChild(clone);
    });
}

async function saveProfile() {
    const btn = document.getElementById('btn-save-profil');
    btn.disabled = true; btn.textContent = "Sauvegarde...";
    const newPseudo = document.getElementById('edit-pseudo').value.trim();
    let newAvatar = document.getElementById('edit-avatar').value.trim();
    const newDesc = document.getElementById('edit-desc').value.trim();
    
    if (!isNaN(newAvatar) && newAvatar !== "") newAvatar = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${newAvatar}.png`;
    
    state.currentUserData.displayName = newPseudo || state.currentUser;
    state.currentUserData.avatar = newAvatar;
    state.currentUserData.description = newDesc;
    state.currentUserData.vitrine = vitrineSelection;
    
    try {
        await db.collection('users').doc(state.currentUser).update({
            displayName: state.currentUserData.displayName, avatar: state.currentUserData.avatar,
            description: state.currentUserData.description, vitrine: state.currentUserData.vitrine
        });
        import('./navController.js').then(({updateAuthUI}) => updateAuthUI());
        voirProfil(state.currentUser);
    } catch(e) { console.error(e); alert("Erreur lors de la sauvegarde du profil."); }
    
    btn.disabled = false; btn.textContent = "Enregistrer";
}

function creerHtmlCarte(carte) {
    if(!carte) return "";
    
    if (carte.isBaie) {
        let nomAffiche = state.currentLang === 'en' ? carte.data.en : carte.data.fr;
        let enName = carte.data.en.toLowerCase().replace(/\s+/g, '-');
        let imageUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${enName}.png`;
        return `
            <div class="card flipped" style="cursor:default; transform: scale(0.9);">
                <div class="card-inner">
                    <div class="card-front" style="background-color: #2ecc71; border-color: #27ae60;">
                        <div class="card-header"><h1 class="pokemon-name">${nomAffiche}</h1><div class="icon" style="background:white; color:#27ae60;">B</div></div>
                        <div class="image-wrapper" style="background-color: #fceea7;"><img class="pokemon-image" src="${imageUrl}" style="object-fit:contain; height:160px; padding:15px; image-rendering: pixelated;"></div>
                        <div class="card-subtext" style="justify-content:center;">Objet Consommable</div>
                        <div class="stats-bar" style="justify-content:center;"><span style="color:white; font-weight:bold;">BAIE POKÉMON</span></div>
                    </div>
                </div>
            </div>`;
    }

    if (!carte.data) return "";
    let nomEn = carte.data.en; let nomFr = carte.data.fr;
    let pokemonRarity = carte.mega ? "MG" : carte.data.rarity;
    let nomAffiche = state.currentLang === 'en' ? nomEn : nomFr;
    if (carte.mega) nomAffiche = formatMegaName(nomAffiche, carte.megaForm);
    let numeroFormate = String(carte.pokedexNumber).padStart(3, '0');
    
    let imageUrl = getCardImageUrl(carte);
    let classFond = "card-front"; let styleFond = "";
    
    if (carte.mega) classFond += carte.shiny ? " mega-shiny-bg" : " mega-bg";
    else {
        if (carte.shiny) classFond += " shiny-bg";
        else styleFond = `style="background-color: ${CONSTS.couleursRarete[pokemonRarity]}"`;
    }
    
    // AFFICHAGE INSTANTANÉ DU POW ET DU TYPE DEPUIS DATA.JSON
    const dataOrigine = state.pokemonDataList[carte.pokedexNumber - 1];
    let pow = (dataOrigine && dataOrigine.pow) ? dataOrigine.pow : 300;
    if (carte.mega) pow += 100;
    let cachedTypes = (dataOrigine && dataOrigine.types) ? generateTypeBadgesHTML(dataOrigine.types) : 'Pokémon';
    
    return `
        <div class="card flipped" style="cursor:default; transform: scale(0.9);">
            <div class="card-inner">
                <div class="${classFond}" ${styleFond}>
                    <div class="card-header"><h1 class="pokemon-name">${nomAffiche}</h1><div class="icon">${pokemonRarity}</div></div>
                    <div class="image-wrapper"><img class="pokemon-image" src="${imageUrl}"><span class="image-id">#${numeroFormate}</span></div>
                    <div class="card-subtext">${cachedTypes}</div>
                    <div class="stats-bar"><span class="pokemon-pow">POW ${pow}</span><span class="pokemon-aura">N° ${numeroFormate}</span></div>
                </div>
            </div>
        </div>`;
}