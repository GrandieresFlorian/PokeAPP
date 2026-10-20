import { state, CONSTS } from '../state.js';
import { getCardImageUrl, formatMegaName } from '../utils.js';
import { allerASection, applyTranslation } from './navController.js';
import { ZONES } from '../data/campagneData.js';
import { startBattle, fleeBattle } from './campagneBattleController.js';

let activeFighter = null;

export function initCampagne() {
    document.getElementById('nav-campagne').addEventListener('click', () => {
        if (!state.currentUser) return alert("Connectez-vous d'abord !");
        openCampagne();
    });

    document.getElementById('btn-change-fighter').addEventListener('click', () => {
        document.getElementById('campagne-select-zone').classList.add('hidden');
        document.getElementById('campagne-select-pokemon').classList.remove('hidden');
    });

    document.getElementById('campagne-sort')?.addEventListener('change', renderTeamSelection);
    
    document.getElementById('btn-battle-flee').addEventListener('click', () => fleeBattle(false));
}

function openCampagne() {
    allerASection('section-campagne');
    document.getElementById('campagne-battle-arena').classList.add('hidden');
    
    if (!activeFighter) {
        document.getElementById('campagne-select-zone').classList.add('hidden');
        renderTeamSelection();
    } else {
        document.getElementById('campagne-select-pokemon').classList.add('hidden');
        document.getElementById('campagne-select-zone').classList.remove('hidden');
        updateFighterBadge();
        renderZones();
    }
}

function renderTeamSelection() {
    const grid = document.getElementById('campagne-team-grid');
    grid.innerHTML = "";
    document.getElementById('campagne-select-pokemon').classList.remove('hidden');

    const myCollection = (state.currentUserData.collection || []).filter(c => !c.isBaie);
    if (myCollection.length === 0) {
        grid.innerHTML = "<p style='color:#ccc;'>Vous n'avez aucun Pokémon. Ouvrez des boosters !</p>";
        return;
    }

    const uniqueCardsMap = {};
    myCollection.forEach(c => {
        const key = `${c.pokedexNumber}_${c.shiny}_${c.mega}_${c.megaForm}`;
        if (!uniqueCardsMap[key] || (c.level || 1) > (uniqueCardsMap[key].level || 1)) {
            uniqueCardsMap[key] = c;
        }
    });

    let uniqueCardsArray = Object.values(uniqueCardsMap);
    const sortDropdown = document.getElementById('campagne-sort');
    const sortMode = sortDropdown ? sortDropdown.value : 'pokedex';

    uniqueCardsArray.sort((a, b) => {
        // CORRECTION : On sécurise la lecture des données pour les Pokémon échangés
        let dataA = a.data || state.pokemonDataList[a.pokedexNumber - 1] || {};
        let dataB = b.data || state.pokemonDataList[b.pokedexNumber - 1] || {};

        if (sortMode === 'level') return ((b.level || 1) - (a.level || 1)) || (a.pokedexNumber - b.pokedexNumber);
        else if (sortMode === 'rarity') {
            const rarityA = a.mega ? "MG" : (dataA.rarity || "C");
            const rarityB = b.mega ? "MG" : (dataB.rarity || "C");
            return (CONSTS.poidsRarete[rarityB] || 0) - (CONSTS.poidsRarete[rarityA] || 0) || (a.pokedexNumber - b.pokedexNumber);
        } else if (sortMode === 'alpha') {
            const nameA = state.currentLang === 'en' ? (dataA.en || "") : (dataA.fr || "");
            const nameB = state.currentLang === 'en' ? (dataB.en || "") : (dataB.fr || "");
            return nameA.localeCompare(nameB) || (a.pokedexNumber - b.pokedexNumber);
        } else return a.pokedexNumber - b.pokedexNumber;
    });

    uniqueCardsArray.forEach(carte => {
        // CORRECTION : Même sécurisation ici
        let dataCarte = carte.data || state.pokemonDataList[carte.pokedexNumber - 1] || {};
        
        const div = document.createElement('div');
        div.className = `mini-card`;
        div.style.backgroundImage = `url('${getCardImageUrl(carte)}')`;
        const rarete = carte.mega ? "MG" : (dataCarte.rarity || "C");
        div.style.backgroundColor = CONSTS.couleursRarete[rarete] || "#333";
        if (carte.shiny || (carte.mega && carte.shiny)) div.innerHTML = '<div class="mini-card-holo"></div>';

        const lvlBadge = document.createElement('div');
        lvlBadge.textContent = `Niv. ${carte.level || 1}`;
        lvlBadge.style.cssText = "position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,0.7); color:white; font-size:0.7rem; font-weight:bold;";
        div.appendChild(lvlBadge);

        div.onclick = () => {
            // On injecte les données dans la carte si elles manquaient pour que le système de combat ne plante pas
            if (!carte.data) carte.data = dataCarte;
            activeFighter = carte;
            document.getElementById('campagne-select-pokemon').classList.add('hidden');
            document.getElementById('campagne-select-zone').classList.remove('hidden');
            updateFighterBadge();
            renderZones();
        };
        grid.appendChild(div);
    });
}

function updateFighterBadge() {
    if(!activeFighter) return;
    const badge = document.getElementById('campagne-active-pokemon');
    
    // CORRECTION : Sécurisation de l'affichage du nom
    let dataFighter = activeFighter.data || state.pokemonDataList[activeFighter.pokedexNumber - 1] || {};
    let nameEn = dataFighter.en || "Unknown";
    let nameFr = dataFighter.fr || "Inconnu";
    
    if (activeFighter.mega) {
        nameEn = formatMegaName(nameEn, activeFighter.megaForm);
        nameFr = formatMegaName(nameFr, activeFighter.megaForm);
    }
    
    let currentName = state.currentLang === 'en' ? nameEn : nameFr;
    let lvlStr = activeFighter.level || 1;
    
    badge.innerHTML = `
        <img src="${getCardImageUrl(activeFighter)}" style="width:40px; height:40px; object-fit:cover; border-radius:50%; background:#222;">
        <span data-en="${nameEn} (Niv. ${lvlStr})" data-fr="${nameFr} (Niv. ${lvlStr})">${currentName} (Niv. ${lvlStr})</span>
    `;
}

function renderZones() {
    const list = document.getElementById('campagne-zones-list');
    list.innerHTML = "";
    
    const seenArray = state.currentUserData.seen || [];
    const collectionIds = (state.currentUserData.collection || []).map(c => c.pokedexNumber);
    
    ZONES.forEach(z => {
        const div = document.createElement('div');
        div.className = "zone-card";
        
        let tooltipHtml = `<div class="zone-tooltip">
            <div class="zone-tooltip-title" data-en="Wild Pokémon" data-fr="Pokémon Sauvages">Pokémon Sauvages</div>
            <div class="zone-tooltip-grid">`;
        
        const totalChance = z.encounters.reduce((sum, enc) => sum + enc.chance, 0);

        z.encounters.forEach(enc => {
            const proba = Math.round((enc.chance / totalChance) * 100);
            const isKnown = seenArray.includes(enc.id) || collectionIds.includes(enc.id);
            
            if (isKnown) {
                const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${enc.id}.png`;
                tooltipHtml += `
                    <div class="tooltip-pkmn">
                        <img src="${spriteUrl}" alt="pkmn">
                        <span>${proba}%</span>
                    </div>`;
            } else {
                tooltipHtml += `
                    <div class="tooltip-pkmn unknown">
                        <div class="unknown-sprite">?</div>
                        <span>? %</span>
                    </div>`;
            }
        });

        tooltipHtml += `</div></div>`;

        div.innerHTML = `
            <h4>${z.name}</h4>
            <p><span class="translatable" data-fr="Niveau des Pokémon :" data-en="Pokémon Levels :">Niveau des Pokémon :</span> <span class="text-accent">${z.minLvl} - ${z.maxLvl}</span></p>
            ${tooltipHtml}
        `;
        div.onclick = () => {
            startBattle(z, activeFighter, () => {
                document.getElementById('campagne-battle-arena').classList.add('hidden');
                document.getElementById('campagne-select-zone').classList.remove('hidden');
                updateFighterBadge();
                renderZones();
            });
        };
        list.appendChild(div);
    });
    applyTranslation();
}