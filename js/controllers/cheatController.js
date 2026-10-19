import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { updateBoosterLogic } from './boosterController.js';
import { TOUTES_LES_BAIES } from '../utils.js';

export function initCheats() {
    document.getElementById('cheat-clear-all').addEventListener('click', async () => {
        if (state.currentUser !== 'test') return;
        state.currentUserData.collection = [];
        state.currentUserData.berries = [];
        await db.collection('users').doc(state.currentUser).update({ collection: [], berries: [] });
        alert("Collection vidée !");
    });

    document.getElementById('cheat-unlock-all').addEventListener('click', async () => {
        if (state.currentUser !== 'test') return alert("Accès refusé : compte administrateur requis.");
        if (state.pokemonDataList.length === 0) return alert("Les données chargent...");

        state.currentUserData.collection = [];
        state.currentUserData.berries = [];
        let timeOffset = 0;

        // Débloque tous les Pokémon
        state.pokemonDataList.forEach((pokemon, index) => {
            const id = index + 1;
            state.currentUserData.collection.push({ data: pokemon, pokedexNumber: id, shiny: false, mega: false, megaForm: null, date: Date.now() + timeOffset++ });
            state.currentUserData.collection.push({ data: pokemon, pokedexNumber: id, shiny: true, mega: false, megaForm: null, date: Date.now() + timeOffset++ });
            if (CONSTS.megaIds[id]) {
                CONSTS.megaIds[id].forEach(form => {
                    state.currentUserData.collection.push({ data: pokemon, pokedexNumber: id, shiny: false, mega: true, megaForm: form, date: Date.now() + timeOffset++ });
                    state.currentUserData.collection.push({ data: pokemon, pokedexNumber: id, shiny: true, mega: true, megaForm: form, date: Date.now() + timeOffset++ });
                });
            }
        });

        // Débloque toutes les baies
        TOUTES_LES_BAIES.forEach(baie => {
            state.currentUserData.berries.push({
                data: baie, id: baie.id, date: Date.now() + timeOffset++
            });
        });
        
        await db.collection('users').doc(state.currentUser).update({ 
            collection: state.currentUserData.collection,
            berries: state.currentUserData.berries
        });
        alert("Triche activée : Collection complète (Pokémon + Baies) synchronisée en ligne !");
    });

    document.getElementById('cheat-refill-boosters').addEventListener('click', async () => {
        if (state.currentUser !== 'test') return alert("Accès refusé : compte administrateur requis.");
        state.currentUserData.boostersLeft = CONSTS.MAX_BOOSTERS;
        state.currentUserData.lastBoosterTime = Date.now();
        await db.collection('users').doc(state.currentUser).update({
            boostersLeft: state.currentUserData.boostersLeft,
            lastBoosterTime: state.currentUserData.lastBoosterTime
        });
        updateBoosterLogic();
        alert("Triche activée : Vous avez récupéré vos 10 boosters !");
    });
}