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

export async function getPokemonPow(carte) {
    const id = carte.pokedexNumber;
    const cacheKey = `powCache_${id}`;
    const cachedPow = localStorage.getItem(cacheKey);
    let pow = 0;
    if (cachedPow) {
        pow = parseInt(cachedPow);
    } else {
        try {
            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            const apiData = await res.json();
            let totalStats = 0;
            apiData.stats.forEach(s => totalStats += s.base_stat);
            localStorage.setItem(cacheKey, totalStats);
            pow = totalStats;
        } catch (e) {
            pow = 300; 
        }
    }
    if (carte.mega) pow += 100;
    return pow;
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