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
    return `Méga ${nom}`;
}

export function getCardImageUrl(carte, format = 'normal') {
    // Sécurité si la carte est mal formée
    if (!carte || !carte.data || !carte.data.en) return "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/0.png";
    
    let nomEn = carte.data.en;
    let nomPourUrl = nomEn.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace('♀', '-f').replace('♂', '-m').replace(/['’.]/g, '').replace(/\s+/g, "-");
    
    if (carte.mega) {
        // Lien vers les artworks pour les Mégas (format .jpg)
        return `https://img.pokemondb.net/artwork/${nomPourUrl}-${carte.megaForm}.jpg`;
    }
    
    // Pour les Pokémon normaux/shinys (format .png depuis PokéAPI)
    return carte.shiny 
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${carte.pokedexNumber}.png` 
        : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${carte.pokedexNumber}.png`;
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