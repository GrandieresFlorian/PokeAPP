import { state, CONSTS } from './state.js';

export function tirerRarete() {
    const chance = Math.random() * 100; 
    const p = state.probabilities;
    
    let seuilC = p["C"]; let seuilU = seuilC + p["U"]; let seuilR = seuilU + p["R"];
    let seuilE = seuilR + p["E"]; let seuilL = seuilE + p["L"];
    
    if (chance < seuilC) return "C"; if (chance < seuilU) return "U"; 
    if (chance < seuilR) return "R"; if (chance < seuilE) return "E"; 
    if (chance < seuilL) return "L"; return "M";                  
}

export function formatMegaName(nom, form) {
    if (form && form !== "mega") return `Méga ${nom} ${form.replace('mega-', '').toUpperCase()}`;
    return `Méga ${nom}`;
}

export function getCardImageUrl(carte, format = 'normal') {
    if (!carte || !carte.data || !carte.data.en) return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/0.png";
    let nomPourUrl = carte.data.en.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace('♀', '-f').replace('♂', '-m').replace(/['’.]/g, '').replace(/\s+/g, "-");
    
    if (carte.mega) {
        let formImageSuffix = carte.megaForm;
        if (carte.pokedexNumber === 670 || carte.pokedexNumber === 718) formImageSuffix = "mega";
        return `https://img.pokemondb.net/artwork/${nomPourUrl}-${formImageSuffix}.jpg`;
    }
    return carte.shiny 
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${carte.pokedexNumber}.png` 
        : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${carte.pokedexNumber}.png`;
}

export const TYPE_TRANSLATIONS = {
    "normal": "Normal", "fire": "Feu", "water": "Eau", "electric": "Électrik", "grass": "Plante",
    "ice": "Glace", "fighting": "Combat", "poison": "Poison", "ground": "Sol", "flying": "Vol",
    "psychic": "Psy", "bug": "Insecte", "rock": "Roche", "ghost": "Spectre", "dragon": "Dragon",
    "dark": "Ténèbres", "steel": "Acier", "fairy": "Fée"
};

export const TYPE_EFFECTIVENESS = {
    normal: { rock: 0.5, ghost: 0, steel: 0.5 }, fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
    water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 }, electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
    grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
    ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
    fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
    poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
    ground: { fire: 2, water: 1, electric: 2, grass: 0.5, ice: 1, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
    flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
    psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
    bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
    rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
    ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 }, dragon: { dragon: 2, steel: 0.5, fairy: 0 },
    dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 }, steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
    fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 }
};

export function getEffectiveness(atkType, defTypes) {
    let mult = 1;
    const matchups = TYPE_EFFECTIVENESS[atkType];
    if (!matchups) return 1;
    defTypes.forEach(t => { if (matchups[t] !== undefined) mult *= matchups[t]; });
    return mult;
}

export async function getPokemonDetails(carte) {
    const id = carte.pokedexNumber;
    const dataOrigine = state.pokemonDataList[id - 1]; 
    
    let pow = 300, types = ["normal"], baseStats = { hp: 50, atk: 50, def: 50, spatk: 50, spdef: 50, speed: 50 };
    
    if (dataOrigine) {
        if (dataOrigine.pow) pow = dataOrigine.pow;
        if (dataOrigine.types) types = dataOrigine.types;
        if (dataOrigine.baseStats) baseStats = { ...dataOrigine.baseStats };
    }
    
    if (carte.mega) {
        pow += 100;
        baseStats.atk += 20; baseStats.def += 20; baseStats.spatk += 20; baseStats.spdef += 20; baseStats.speed += 20;
    }
    
    // NOUVEAU : Lecture instantanée depuis moves.json en RAM
    let allMoves = state.movesData.pokemonMoves[id] || [];
    
    return { pow, types, allMoves, baseStats };
}

export async function getMoveDetails(identifier) {
    let name = identifier;
    // Rétrocompatibilité : Si le jeu envoyait encore une URL, on extrait juste le nom
    if (identifier.includes('/')) {
        const parts = identifier.split('/').filter(Boolean);
        name = parts[parts.length - 1]; 
    }
    
    // NOUVEAU : Lecture instantanée depuis le dictionnaire moves.json en RAM
    if (state.movesData.dictionary && state.movesData.dictionary[name]) {
        return state.movesData.dictionary[name];
    }
    
    return { nameEn: "Tackle", nameFr: "Charge", power: 40, type: "normal", damageClass: "physical" };
}

export async function getMovesForLevel(pokemonId, level) {
    const details = await getPokemonDetails({pokedexNumber: pokemonId, mega: false});
    if (!details.allMoves || details.allMoves.length === 0) return [await getMoveDetails("tackle")];
    
    let available = details.allMoves.filter(m => m.level <= level).sort((a,b) => b.level - a.level);
    
    const uniqueMoves = []; const seen = new Set();
    for(let m of available) {
        if(!seen.has(m.name)) { seen.add(m.name); uniqueMoves.push(m); }
    }
    
    const selected = uniqueMoves.slice(0, 4);
    const finalMoves = [];
    for (let m of selected) finalMoves.push(await getMoveDetails(m.name));
    
    if (finalMoves.length === 0) finalMoves.push(await getMoveDetails("tackle"));
    return finalMoves;
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

export async function getPokemonPow(carte) {
    const id = carte.pokedexNumber;
    const dataOrigine = state.pokemonDataList[id - 1];
    let pow = (dataOrigine && dataOrigine.pow) ? dataOrigine.pow : 300;
    return carte.mega ? pow + 100 : pow;
}

export function sauvegarderCarte(pokemonData, numeroPokedex, isShiny, isMega, megaForm) {
    if (!state.currentUserData.collection) state.currentUserData.collection = [];
    
    // On cherche si la carte exacte existe déjà dans la collection
    const existingCard = state.currentUserData.collection.find(c => 
        c.pokedexNumber === numeroPokedex && // Correction : "numeroPokedex" au lieu de "pokedexNumber"
        c.shiny === isShiny && 
        c.mega === isMega && 
        c.megaForm === megaForm
    );

    if (existingCard) {
        // Si elle existe, on augmente juste la quantité ! (Plus de surcharge Firebase)
        existingCard.quantity = (existingCard.quantity || 1) + 1;
    } else {
        // Sinon on la crée pour la première fois avec quantité = 1
        const nouvelleCarte = {
            data: pokemonData,
            pokedexNumber: numeroPokedex, // Correction ici aussi
            shiny: isShiny,
            mega: isMega,
            megaForm: megaForm,
            date: Date.now(),
            level: 1,
            maxLevel: 20,
            quantity: 1
        };
        state.currentUserData.collection.push(nouvelleCarte);
    }

    // Sauvegarde dans Firebase
    import('./firebase-config.js').then(({db}) => {
        if (!state.currentUser) return; 
        db.collection('users').doc(state.currentUser).update({ 
            collection: state.currentUserData.collection 
        }).catch(err => console.error(err));
    });
}

export const TOUTES_LES_BAIES = [
    { id: "ceriz", fr: "Baie Ceriz", en: "Cheri Berry" }, { id: "maron", fr: "Baie Maron", en: "Chesto Berry" },
    { id: "pecha", fr: "Baie Pêcha", en: "Pecha Berry" }, { id: "fraive", fr: "Baie Fraive", en: "Rawst Berry" },
    { id: "willia", fr: "Baie Willia", en: "Aspear Berry" }, { id: "mepo", fr: "Baie Mepo", en: "Leppa Berry" },
    { id: "oran", fr: "Baie Oran", en: "Oran Berry" }, { id: "kika", fr: "Baie Kika", en: "Persim Berry" },
    { id: "prine", fr: "Baie Prine", en: "Lum Berry" }, { id: "sitrus", fr: "Baie Sitrus", en: "Sitrus Berry" },
    { id: "figuy", fr: "Baie Figuy", en: "Figy Berry" }, { id: "wiki", fr: "Baie Wiki", en: "Wiki Berry" },
    { id: "mago", fr: "Baie Mago", en: "Mago Berry" }, { id: "gowav", fr: "Baie Gowav", en: "Aguav Berry" },
    { id: "papaya", fr: "Baie Papaya", en: "Iapapa Berry" }, { id: "framby", fr: "Baie Framby", en: "Razz Berry" },
    { id: "remu", fr: "Baie Remu", en: "Bluk Berry" }, { id: "nanab", fr: "Baie Nanab", en: "Nanab Berry" },
    { id: "repoi", fr: "Baie Repoi", en: "Wepear Berry" }, { id: "nanana", fr: "Baie Nanana", en: "Pinap Berry" },
    { id: "grena", fr: "Baie Grena", en: "Pomeg Berry" }, { id: "alga", fr: "Baie Alga", en: "Kelpsy Berry" },
    { id: "qualot", fr: "Baie Qualot", en: "Qualot Berry" }, { id: "lonme", fr: "Baie Lonme", en: "Hondew Berry" },
    { id: "resin", fr: "Baie Resin", en: "Grepa Berry" }, { id: "tamato", fr: "Baie Tamato", en: "Tamato Berry" },
    { id: "siam", fr: "Baie Siam", en: "Cornn Berry" }, { id: "mangou", fr: "Baie Mangou", en: "Magost Berry" },
    { id: "rabuta", fr: "Baie Rabuta", en: "Rabuta Berry" }, { id: "tronci", fr: "Baie Tronci", en: "Nomel Berry" },
    { id: "kiwan", fr: "Baie Kiwan", en: "Spelon Berry" }, { id: "palma", fr: "Baie Palma", en: "Pamtre Berry" },
    { id: "stekpa", fr: "Baie Stekpa", en: "Watmel Berry" }, { id: "durin", fr: "Baie Durin", en: "Durin Berry" },
    { id: "myrte", fr: "Baie Myrte", en: "Belue Berry" }, { id: "chocco", fr: "Baie Chocco", en: "Occa Berry" },
    { id: "pocpoc", fr: "Baie Pocpoc", en: "Passho Berry" }, { id: "parma", fr: "Baie Parma", en: "Wacan Berry" },
    { id: "ratam", fr: "Baie Ratam", en: "Rindo Berry" }, { id: "nanone", fr: "Baie Nanone", en: "Yache Berry" },
    { id: "pomroz", fr: "Baie Pomroz", en: "Chople Berry" }, { id: "kebia", fr: "Baie Kébia", en: "Kebia Berry" },
    { id: "jouca", fr: "Baie Jouca", en: "Shuca Berry" }, { id: "cobaba", fr: "Baie Cobaba", en: "Coba Berry" },
    { id: "payapa", fr: "Baie Payapa", en: "Payapa Berry" }, { id: "tanga", fr: "Baie Tanga", en: "Tanga Berry" },
    { id: "charti", fr: "Baie Charti", en: "Charti Berry" }, { id: "sedra", fr: "Baie Sédra", en: "Kasib Berry" },
    { id: "fraigo", fr: "Baie Fraigo", en: "Haban Berry" }, { id: "lampou", fr: "Baie Lampou", en: "Colbur Berry" },
    { id: "babiri", fr: "Baie Babiri", en: "Babiri Berry" }, { id: "zalis", fr: "Baie Zalis", en: "Chilan Berry" },
    { id: "litchii", fr: "Baie Litchii", en: "Liechi Berry" }, { id: "lingan", fr: "Baie Lingan", en: "Ganlon Berry" },
    { id: "sailak", fr: "Baie Sailak", en: "Salac Berry" }, { id: "pitaye", fr: "Baie Pitaye", en: "Petaya Berry" },
    { id: "abriko", fr: "Baie Abriko", en: "Apicot Berry" }, { id: "lansat", fr: "Baie Lansat", en: "Lansat Berry" },
    { id: "frista", fr: "Baie Frista", en: "Starf Berry" }, { id: "enigma", fr: "Baie Enigma", en: "Enigma Berry" },
    { id: "micle", fr: "Baie Micle", en: "Micle Berry" }, { id: "cherim", fr: "Baie Chérim", en: "Custap Berry" },
    { id: "jaboca", fr: "Baie Jaboca", en: "Jaboca Berry" }, { id: "pommo", fr: "Baie Pommo", en: "Rowap Berry" },
    { id: "selro", fr: "Baie Selro", en: "Roseli Berry" }, { id: "rangma", fr: "Baie Rangma", en: "Maranga Berry" }
];

export const TOUS_LES_DRESSEURS = [
    {
        id: "canon", fr: "Canon", en: "Beauty",
        variants: [
            { id: "canon_g1", gen: "G1", rarity: "C", img: "URL_POKEPEDIA_CANON_G1.png" },
            { id: "canon_g2", gen: "G2", rarity: "U", img: "URL_POKEPEDIA_CANON_G2.png" },
            { id: "canon_g3", gen: "G3", rarity: "R", img: "URL_POKEPEDIA_CANON_G3.png" }
        ]
    },
    {
        id: "croupier", fr: "Croupier", en: "Gamer",
        variants: [
            { id: "croupier_g1", gen: "G1", rarity: "C", img: "URL_POKEPEDIA_CROUPIER_G1.png" }
        ]
    },
    {
        id: "gamin", fr: "Gamin", en: "Youngster",
        variants: [
            { id: "gamin_g1", gen: "G1", rarity: "C", img: "URL_POKEPEDIA_GAMIN_G1.png" },
            { id: "gamin_g2", gen: "G2", rarity: "C", img: "URL_POKEPEDIA_GAMIN_G2.png" }
        ]
    },
    // Ajoute ici le reste : Dompteur, Exorciste, Fillette, Gentleman, Intello, Rocket, etc.
];

// Fonction utilitaire pour tirer un dresseur au hasard
// Fonction de tirage des dresseurs basée sur les probabilités globales
export function getRandomTrainer() {
    const list = state.dresseursData;
    if (!list || list.length === 0) return null;
    
    // 1. On tire d'abord une rareté selon les pourcentages globaux du jeu (C, U, R, E, L, M)[cite: 26]
    const rarityCible = tirerRarete();
    
    // 2. On rassemble toutes les variantes de tous les dresseurs qui correspondent à cette rareté
    let poolCorrespondant = [];
    
    list.forEach(trainerClass => {
        if (trainerClass.variants) {
            trainerClass.variants.forEach(variant => {
                if (variant.rarity === rarityCible) {
                    poolCorrespondant.push({
                        isTrainer: true,
                        baseId: trainerClass.id,
                        variantId: variant.id,
                        fr: trainerClass.fr,
                        en: trainerClass.en,
                        gen: variant.gen,
                        rarity: variant.rarity,
                        img: variant.img,
                        quantity: 1,
                        date: Date.now()
                    });
                }
            });
        }
    });
    
    // 3. Si aucune variante ne correspond exactement à la rareté tirée (sécurité), on prend un dresseur totalement aléatoire
    if (poolCorrespondant.length === 0) {
        const trainerClass = list[Math.floor(Math.random() * list.length)];
        const variant = trainerClass.variants[Math.floor(Math.random() * trainerClass.variants.length)];
        return {
            isTrainer: true,
            baseId: trainerClass.id,
            variantId: variant.id,
            fr: trainerClass.fr,
            en: trainerClass.en,
            gen: variant.gen,
            rarity: variant.rarity,
            img: variant.img,
            quantity: 1,
            date: Date.now()
        };
    }
    
    // 4. On pioche un dresseur au hasard parmi ceux qui ont la bonne rareté
    return poolCorrespondant[Math.floor(Math.random() * poolCorrespondant.length)];
}
export const BAIES_BOOSTERS = [
    { id: "ceriz", fr: "Baie Ceriz", en: "Cheri Berry" }, { id: "pecha", fr: "Baie Pêcha", en: "Pecha Berry" },
    { id: "oran", fr: "Baie Oran", en: "Oran Berry" }, { id: "sitrus", fr: "Baie Sitrus", en: "Sitrus Berry" },
    { id: "nanana", fr: "Baie Nanana", en: "Pinap Berry" }
];

export const MUTATION_RECIPES = [
    { p1: "nanana", p2: "nanana", result: "maron", chance: 0.05 }, { p1: "ceriz", p2: "pecha", result: "fraive", chance: 0.05 },
    { p1: "oran", p2: "sitrus", result: "willia", chance: 0.05 }, { p1: "pecha", p2: "oran", result: "mepo", chance: 0.05 },
    { p1: "sitrus", p2: "nanana", result: "kika", chance: 0.05 }, { p1: "ceriz", p2: "oran", result: "prine", chance: 0.05 },
    { p1: "maron", p2: "fraive", result: "figuy", chance: 0.02 }, { p1: "willia", p2: "mepo", result: "wiki", chance: 0.02 },
    { p1: "kika", p2: "prine", result: "mago", chance: 0.02 }, { p1: "maron", p2: "willia", result: "gowav", chance: 0.02 },
    { p1: "fraive", p2: "mepo", result: "papaya", chance: 0.02 }, { p1: "figuy", p2: "wiki", result: "framby", chance: 0.01 },
    { p1: "mago", p2: "gowav", result: "remu", chance: 0.01 }, { p1: "papaya", p2: "figuy", result: "nanab", chance: 0.01 }
];

export function sauvegarderBaie(baieData) {
    import('./firebase-config.js').then(({db}) => {
        if (!state.currentUser) return;
        if (!state.currentUserData.berries) state.currentUserData.berries = [];
        
        // On cherche si on possède déjà cette baie
        const existingBaie = state.currentUserData.berries.find(b => b.id === baieData.id);
        
        if (existingBaie) {
            // Si oui, on incrémente juste sa quantité !
            existingBaie.quantity = (existingBaie.quantity || 1) + 1;
        } else {
            // Sinon on la crée avec une quantité de 1
            state.currentUserData.berries.push({ 
                data: baieData, 
                id: baieData.id, 
                date: Date.now(), 
                quantity: 1 
            });
        }
        
        db.collection('users').doc(state.currentUser).update({ 
            berries: state.currentUserData.berries 
        }).catch(err => console.error(err));
    });
}

export function sauvegarderDresseur(trainerData) {
    if (!state.currentUserData.collection) state.currentUserData.collection = [];
    
    // On cherche si le dresseur exact (même variante) existe déjà
    let existing = state.currentUserData.collection.find(c => c.isTrainer && c.variantId === trainerData.variantId);
    
    if (existing) {
        existing.quantity = (existing.quantity || 1) + 1;
    } else {
        // On s'assure qu'il a bien l'attribut isTrainer à true
        const nouveauDresseur = {
            ...trainerData,
            isTrainer: true,
            quantity: 1,
            date: Date.now()
        };
        state.currentUserData.collection.push(nouveauDresseur);
    }

    // Sauvegarde dans Firebase
    import('./firebase-config.js').then(({db}) => {
        if (!state.currentUser) return; 
        db.collection('users').doc(state.currentUser).update({ 
            collection: state.currentUserData.collection 
        }).catch(err => console.error(err));
    });
}