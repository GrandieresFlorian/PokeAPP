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

export function getCardImageUrl(carte, format = 'normal') {
    if (!carte || !carte.data || !carte.data.en) return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/0.png";
    
    let nomEn = carte.data.en;
    let nomPourUrl = nomEn.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace('♀', '-f').replace('♂', '-m').replace(/['’.]/g, '').replace(/\s+/g, "-");
    
    if (carte.mega) {
        let formImageSuffix = carte.megaForm;
        if (carte.pokedexNumber === 670 || carte.pokedexNumber === 718) {
            formImageSuffix = "mega";
        }
        return `https://img.pokemondb.net/artwork/${nomPourUrl}-${formImageSuffix}.jpg`;
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
        const enName = t.charAt(0).toUpperCase() + t.slice(1); 
        const frName = TYPE_TRANSLATIONS[t] || enName;
        const displayName = state.currentLang === 'fr' ? frName : enName;
        html += `<span class="type-badge type-${t}" data-en="${enName}" data-fr="${frName}">${displayName}</span>`;
    });
    return html;
}

export function getPokemonPow(carte) {
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

// IDs mis à jour avec les NOMS EXACTS de Pokékalos en français !
export const TOUTES_LES_BAIES = [
    { id: "ceriz", fr: "Baie Ceriz", en: "Cheri Berry" },
    { id: "maron", fr: "Baie Maron", en: "Chesto Berry" },
    { id: "pecha", fr: "Baie Pêcha", en: "Pecha Berry" },
    { id: "fraive", fr: "Baie Fraive", en: "Rawst Berry" },
    { id: "willia", fr: "Baie Willia", en: "Aspear Berry" },
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
    { id: "repoi", fr: "Baie Repoi", en: "Wepear Berry" },
    { id: "nanana", fr: "Baie Nanana", en: "Pinap Berry" },
    { id: "grena", fr: "Baie Grena", en: "Pomeg Berry" },
    { id: "alga", fr: "Baie Alga", en: "Kelpsy Berry" },
    { id: "qualot", fr: "Baie Qualot", en: "Qualot Berry" },
    { id: "lonme", fr: "Baie Lonme", en: "Hondew Berry" },
    { id: "resin", fr: "Baie Resin", en: "Grepa Berry" },
    { id: "tamato", fr: "Baie Tamato", en: "Tamato Berry" },
    { id: "siam", fr: "Baie Siam", en: "Cornn Berry" },
    { id: "mangou", fr: "Baie Mangou", en: "Magost Berry" },
    { id: "rabuta", fr: "Baie Rabuta", en: "Rabuta Berry" },
    { id: "tronci", fr: "Baie Tronci", en: "Nomel Berry" },
    { id: "kiwan", fr: "Baie Kiwan", en: "Spelon Berry" },
    { id: "palma", fr: "Baie Palma", en: "Pamtre Berry" },
    { id: "stekpa", fr: "Baie Stekpa", en: "Watmel Berry" },
    { id: "durin", fr: "Baie Durin", en: "Durin Berry" },
    { id: "myrte", fr: "Baie Myrte", en: "Belue Berry" },
    { id: "chocco", fr: "Baie Chocco", en: "Occa Berry" },
    { id: "pocpoc", fr: "Baie Pocpoc", en: "Passho Berry" },
    { id: "parma", fr: "Baie Parma", en: "Wacan Berry" },
    { id: "ratam", fr: "Baie Ratam", en: "Rindo Berry" },
    { id: "nanone", fr: "Baie Nanone", en: "Yache Berry" },
    { id: "pomroz", fr: "Baie Pomroz", en: "Chople Berry" },
    { id: "kebia", fr: "Baie Kébia", en: "Kebia Berry" },
    { id: "jouca", fr: "Baie Jouca", en: "Shuca Berry" },
    { id: "cobaba", fr: "Baie Cobaba", en: "Coba Berry" },
    { id: "payapa", fr: "Baie Payapa", en: "Payapa Berry" },
    { id: "tanga", fr: "Baie Tanga", en: "Tanga Berry" },
    { id: "charti", fr: "Baie Charti", en: "Charti Berry" },
    { id: "sedra", fr: "Baie Sédra", en: "Kasib Berry" },
    { id: "fraigo", fr: "Baie Fraigo", en: "Haban Berry" },
    { id: "lampou", fr: "Baie Lampou", en: "Colbur Berry" },
    { id: "babiri", fr: "Baie Babiri", en: "Babiri Berry" },
    { id: "zalis", fr: "Baie Zalis", en: "Chilan Berry" },
    { id: "litchii", fr: "Baie Litchii", en: "Liechi Berry" },
    { id: "lingan", fr: "Baie Lingan", en: "Ganlon Berry" },
    { id: "sailak", fr: "Baie Sailak", en: "Salac Berry" },
    { id: "pitaye", fr: "Baie Pitaye", en: "Petaya Berry" },
    { id: "abriko", fr: "Baie Abriko", en: "Apicot Berry" },
    { id: "lansat", fr: "Baie Lansat", en: "Lansat Berry" },
    { id: "frista", fr: "Baie Frista", en: "Starf Berry" },
    { id: "enigma", fr: "Baie Enigma", en: "Enigma Berry" },
    { id: "micle", fr: "Baie Micle", en: "Micle Berry" },
    { id: "cherim", fr: "Baie Chérim", en: "Custap Berry" },
    { id: "jaboca", fr: "Baie Jaboca", en: "Jaboca Berry" },
    { id: "pommo", fr: "Baie Pommo", en: "Rowap Berry" },
    { id: "selro", fr: "Baie Selro", en: "Roseli Berry" },
    { id: "rangma", fr: "Baie Rangma", en: "Maranga Berry" }
];

export const BAIES_BOOSTERS = [
    { id: "ceriz", fr: "Baie Ceriz", en: "Cheri Berry" },
    { id: "pecha", fr: "Baie Pêcha", en: "Pecha Berry" },
    { id: "oran", fr: "Baie Oran", en: "Oran Berry" },
    { id: "sitrus", fr: "Baie Sitrus", en: "Sitrus Berry" },
    { id: "nanana", fr: "Baie Nanana", en: "Pinap Berry" }
];

export const MUTATION_RECIPES = [
    // Mutations Basiques (Création du Tier 2)
    { p1: "nanana", p2: "nanana", result: "maron", chance: 0.05 },
    { p1: "ceriz", p2: "pecha", result: "fraive", chance: 0.05 },
    { p1: "oran", p2: "sitrus", result: "willia", chance: 0.05 },
    { p1: "pecha", p2: "oran", result: "mepo", chance: 0.05 },
    { p1: "sitrus", p2: "nanana", result: "kika", chance: 0.05 },
    { p1: "ceriz", p2: "oran", result: "prine", chance: 0.05 },

    // Mutations Avancées (Création du Tier 3)
    { p1: "maron", p2: "fraive", result: "figuy", chance: 0.02 },
    { p1: "willia", p2: "mepo", result: "wiki", chance: 0.02 },
    { p1: "kika", p2: "prine", result: "mago", chance: 0.02 },
    { p1: "maron", p2: "willia", result: "gowav", chance: 0.02 },
    { p1: "fraive", p2: "mepo", result: "papaya", chance: 0.02 },

    // Mutations Expertes (Création du Tier 4)
    { p1: "figuy", p2: "wiki", result: "framby", chance: 0.01 },
    { p1: "mago", p2: "gowav", result: "remu", chance: 0.01 },
    { p1: "papaya", p2: "figuy", result: "nanab", chance: 0.01 }
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