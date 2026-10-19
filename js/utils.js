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
    if (form === "mega-x") return `Méga ${nom} X`;
    if (form === "mega-y") return `Méga ${nom} Y`;
    if (form === "mega-z") return `Méga ${nom} Z`;
    if (form === "mega-em") return `Méga ${nom} F.É.`; 
    if (form === "mega-pam") return `Méga ${nom} Parfait`; 
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
        const displayName = state.currentLang === 'fr' ? (TYPE_TRANSLATIONS[t] || t) : t;
        html += `<span class="type-badge type-${t}">${displayName}</span>`;
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


export const TOUTES_LES_BAIES = [
    { id: "ceriz", fr: "Baie Ceriz", en: "Cheri Berry" },
    { id: "maron", fr: "Baie Maron", en: "Chesto Berry" },
    { id: "pecha", fr: "Baie Pêcha", en: "Pecha Berry" },
    { id: "fraive", fr: "Baie Fraive", en: "Rawst Berry" },
    { id: "wilma", fr: "Baie Wilma", en: "Aspear Berry" },
    { id: "mepo", fr: "Baie Mepo", en: "Leppa Berry" },
    { id: "oran", fr: "Baie Oran", en: "Oran Berry" },
    { id: "kika", fr: "Baie Kika", en: "Persim Berry" },
    { id: "prine", fr: "Baie Prine", en: "Lum Berry" },
    { id: "sitrus", fr: "Baie Sitrus", en: "Sitrus Berry" },
    { id: "figuy", fr: "Baie Figuy", en: "Figy Berry" },
    { id: "wiki", fr: "Baie Wiki", en: "Wiki Berry" },
    { id: "mago", fr: "Baie Mago", en: "Mago Berry" },
    { id: "gowav", fr: "Baie Gowav", en: "Aguav Berry" },
    { id: "papaya", fr: "Baie Papaya", en: "Iapapa Berry" },
    { id: "framby", fr: "Baie Framby", en: "Razz Berry" },
    { id: "remu", fr: "Baie Remu", en: "Bluk Berry" },
    { id: "nanab", fr: "Baie Nanab", en: "Nanab Berry" },
    { id: "repo", fr: "Baie Repo", en: "Wepear Berry" },
    { id: "nanana", fr: "Baie Nanana", en: "Pinap Berry" },
    { id: "grena", fr: "Baie Grena", en: "Pomeg Berry" },
    { id: "alga", fr: "Baie Alga", en: "Kelpsy Berry" },
    { id: "qualot", fr: "Baie Qualot", en: "Qualot Berry" },
    { id: "lonme", fr: "Baie Lonme", en: "Hondew Berry" },
    { id: "resin", fr: "Baie Resin", en: "Grepa Berry" },
    { id: "tamato", fr: "Baie Tamato", en: "Tamato Berry" },
    { id: "siro", fr: "Baie Siro", en: "Cornn Berry" },
    { id: "mangou", fr: "Baie Mangou", en: "Magost Berry" },
    { id: "rabuta", fr: "Baie Rabuta", en: "Rabuta Berry" },
    { id: "tronci", fr: "Baie Tronci", en: "Nomel Berry" },
    { id: "kiwan", fr: "Baie Kiwan", en: "Spelon Berry" },
    { id: "palma", fr: "Baie Palma", en: "Pamtre Berry" },
    { id: "stekpa", fr: "Baie Stekpa", en: "Watmel Berry" },
    { id: "durin", fr: "Baie Durin", en: "Durin Berry" },
    { id: "myrte", fr: "Baie Myrte", en: "Belue Berry" },
    { id: "occa", fr: "Baie Occa", en: "Occa Berry" },
    { id: "passho", fr: "Baie Passho", en: "Passho Berry" },
    { id: "wacan", fr: "Baie Wacan", en: "Wacan Berry" },
    { id: "rindo", fr: "Baie Rindo", en: "Rindo Berry" },
    { id: "yache", fr: "Baie Yache", en: "Yache Berry" },
    { id: "chople", fr: "Baie Chople", en: "Chople Berry" },
    { id: "kebia", fr: "Baie Kebia", en: "Kebia Berry" },
    { id: "shuca", fr: "Baie Shuca", en: "Shuca Berry" },
    { id: "coba", fr: "Baie Coba", en: "Coba Berry" },
    { id: "payapa", fr: "Baie Payapa", en: "Payapa Berry" },
    { id: "tanga", fr: "Baie Tanga", en: "Tanga Berry" },
    { id: "charti", fr: "Baie Charti", en: "Charti Berry" },
    { id: "kasib", fr: "Baie Kasib", en: "Kasib Berry" },
    { id: "haban", fr: "Baie Haban", en: "Haban Berry" },
    { id: "colbur", fr: "Baie Colbur", en: "Colbur Berry" },
    { id: "babiri", fr: "Baie Babiri", en: "Babiri Berry" },
    { id: "chilan", fr: "Baie Chilan", en: "Chilan Berry" },
    { id: "liechi", fr: "Baie Liechi", en: "Liechi Berry" },
    { id: "ganlon", fr: "Baie Ganlon", en: "Ganlon Berry" },
    { id: "salac", fr: "Baie Salac", en: "Salac Berry" },
    { id: "petaya", fr: "Baie Petaya", en: "Petaya Berry" },
    { id: "apicot", fr: "Baie Apicot", en: "Apicot Berry" },
    { id: "lansat", fr: "Baie Lansat", en: "Lansat Berry" },
    { id: "frena", fr: "Baie Frena", en: "Starf Berry" },
    { id: "enigma", fr: "Baie Enigma", en: "Enigma Berry" },
    { id: "micle", fr: "Baie Micle", en: "Micle Berry" },
    { id: "custap", fr: "Baie Custap", en: "Custap Berry" },
    { id: "jaboca", fr: "Baie Jaboca", en: "Jaboca Berry" },
    { id: "rowap", fr: "Baie Rowap", en: "Rowap Berry" },
    { id: "roseli", fr: "Baie Roseli", en: "Roseli Berry" },
    { id: "maranga", fr: "Baie Maranga", en: "Maranga Berry" }
];

export const BAIES_BOOSTERS = [
    { id: "ceriz", fr: "Baie Ceriz", en: "Cheri Berry" },
    { id: "pecha", fr: "Baie Pêcha", en: "Pecha Berry" },
    { id: "oran", fr: "Baie Oran", en: "Oran Berry" },
    { id: "sitrus", fr: "Baie Sitrus", en: "Sitrus Berry" },
    { id: "nanana", fr: "Baie Nanana", en: "Pinap Berry" }
];


export function sauvegarderBaie(baieData) {
    import('./firebase-config.js').then(({db}) => {
        if (!state.currentUser) return;
        if (!state.currentUserData.berries) state.currentUserData.berries = [];
        state.currentUserData.berries.push({
            data: baieData, id: baieData.id, date: new Date().getTime()
        });
        db.collection('users').doc(state.currentUser).update({ berries: state.currentUserData.berries })
            .catch(err => console.error("Erreur de sauvegarde baie:", err));
    });
}
