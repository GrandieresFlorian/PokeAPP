import { state, CONSTS } from './state.js';

export function tirerRarete() {
    const chance = Math.random() * 100; 
    const p = state.probabilities;
    
    let seuilC = p["C"];
    let seuilU = seuilC + p["U"];
    let seuilR = seuilU + p["R"];
    let seuilE = seuilR + p["E"];
    let seuilL = seuilE + p["L"];
    
    if (chance < seuilC) return "C"; 
    if (chance < seuilU) return "U"; 
    if (chance < seuilR) return "R"; 
    if (chance < seuilE) return "E"; 
    if (chance < seuilL) return "L"; 
    return "M";                  
}

export function formatMegaName(nom, form) {
    if (form && form !== "mega") {
        return `Méga ${nom} ${form.replace('mega-', '').toUpperCase()}`;
    }
    return `Méga ${nom}`;
}

const DITTOBASE_IDS = {
    701: 10300, 
    801: 10318  
};

export function getCardImageUrl(carte, format = 'normal') {
    if (!carte || !carte.data || !carte.data.en) return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/0.png";
    
    let nomEn = carte.data.en;
    let nomPourUrl = nomEn.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace('♀', '-f').replace('♂', '-m').replace(/['’.]/g, '').replace(/\s+/g, "-");
    
    if (carte.mega) {
        if (carte.shiny) {
            let dittoId = DITTOBASE_IDS[carte.pokedexNumber] || carte.pokedexNumber;
            let formSuffix = carte.megaForm === "mega" ? "mega" : carte.megaForm; 
            return `https://assets.dittobase.com/home/${dittoId}-${nomPourUrl}-${formSuffix}-shiny.png`;
        } else {
            return `https://img.pokemondb.net/artwork/${nomPourUrl}-${carte.megaForm}.jpg`;
        }
    }
    
    return carte.shiny 
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${carte.pokedexNumber}.png` 
        : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${carte.pokedexNumber}.png`;
}

// Map pour stocker les types récupérés depuis PokeAPI
export const pokemonTypeCache = {};

// Dictionnaire de traduction des types (PokeAPI renvoie en anglais)
const TYPE_TRANSLATIONS = {
    "normal": "Normal", "fire": "Feu", "water": "Eau", "electric": "Électrik", "grass": "Plante",
    "ice": "Glace", "fighting": "Combat", "poison": "Poison", "ground": "Sol", "flying": "Vol",
    "psychic": "Psy", "bug": "Insecte", "rock": "Roche", "ghost": "Spectre", "dragon": "Dragon",
    "dark": "Ténèbres", "steel": "Acier", "fairy": "Fée"
};

export async function getPokemonDetails(carte) {
    const id = carte.pokedexNumber;
    const cacheKey = `pokeDetails_${id}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    let pow = 0;
    let types = [];
    
    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        pow = parsed.pow;
        types = parsed.types;
        pokemonTypeCache[id] = types;
    } else {
        try {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            const apiData = await res.json();
            
            let totalStats = 0;
            apiData.stats.forEach(s => totalStats += s.base_stat);
            pow = totalStats;
            
            types = apiData.types.map(t => t.type.name);
            
            const toCache = { pow: pow, types: types };
            localStorage.setItem(cacheKey, JSON.stringify(toCache));
            pokemonTypeCache[id] = types;
        } catch (e) {
            pow = 300; 
            types = ["normal"];
            pokemonTypeCache[id] = types;
        }
    }
    
    if (carte.mega) pow += 100;
    
    return { pow, types };
}

export function generateTypeBadgesHTML(types) {
    if (!types || types.length === 0) return '<span style="color:#aaa;">Pokémon</span>';
    
    let html = '';
    types.forEach(t => {
        // Met la première lettre du type anglais en majuscule (ex: "water" -> "Water")
        const enName = t.charAt(0).toUpperCase() + t.slice(1); 
        const frName = TYPE_TRANSLATIONS[t] || enName;
        
        const displayName = state.currentLang === 'fr' ? frName : enName;
        
        // On ajoute data-en et data-fr pour que le bouton de langue puisse les trouver
        html += `<span class="type-badge type-${t}" data-en="${enName}" data-fr="${frName}">${displayName}</span>`;
    });
    return html;
}

export function getPokemonPow(carte) {
    // Wrapper asynchrone pour préserver la compatibilité
    return getPokemonDetails(carte).then(res => res.pow);
}

export function sauvegarderCarte(pokemonData, numeroPokedex, isShiny, isMega, megaForm) {
    import('./firebase-config.js').then(({db}) => {
        if (!state.currentUser) return; 
        state.currentUserData.collection.push({
            data: pokemonData, pokedexNumber: numeroPokedex, shiny: isShiny, mega: isMega, megaForm: megaForm, date: new Date().getTime()
        });
        db.collection('users').doc(state.currentUser).update({ collection: state.currentUserData.collection })
            .catch(err => console.error("Erreur de sauvegarde:", err));
    });
}