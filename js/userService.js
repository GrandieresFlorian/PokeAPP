import { db } from './firebase-config.js';
import { state, CONSTS } from './state.js';
import { variantKey, mergeCardInto } from './cardUtils.js';
import { updateAuthUI, startNotificationListener } from './controllers/navController.js';
import { updateBoosterLogic } from './controllers/boosterController.js';
import { startFriendsListener } from './controllers/friendsController.js';
import { initQuests } from './controllers/questController.js';

// Promesse "données du jeu chargées" (settings + JSON), fournie par app.js.
let readyPromise = Promise.resolve();
export function setReadyPromise(p) { readyPromise = p; }

const isNum = v => typeof v === 'number' && Number.isFinite(v);

// ------------------------------------------------------------------
// Compression : fusionne les doublons en piles avec `quantity`
// ------------------------------------------------------------------
export function compressCollection(collection) {
    const grouped = new Map();
    (collection || []).forEach(card => {
        if (!card || typeof card !== 'object') return;
        if (!card.isTrainer && !(card.pokedexNumber || (card.data && card.data.pokedexNumber))) return; // carte corrompue

        const clean = { ...card, quantity: Number(card.quantity || 1) };
        if (!card.isTrainer) clean.pokedexNumber = Number(card.pokedexNumber || card.data.pokedexNumber);

        const key = variantKey(clean);
        if (!grouped.has(key)) grouped.set(key, clean);
        else mergeCardInto(grouped.get(key), clean);
    });
    return Array.from(grouped.values());
}

export function compressBerries(berries) {
    const grouped = new Map();
    (berries || []).forEach(b => {
        if (!b || typeof b !== 'object') return;
        const id = b.id || (b.data && b.data.id) || 'unknown';
        const qty = Number(b.quantity || 1);
        if (!grouped.has(id)) grouped.set(id, { ...b, id, quantity: qty });
        else grouped.get(id).quantity += qty;
    });
    return Array.from(grouped.values());
}

// ------------------------------------------------------------------
// Normalisation : applique TOUS les champs par défaut (y compris réparer
// les NaN déjà sauvegardés) et retourne les champs à réécrire dans Firestore.
// ------------------------------------------------------------------
export function normalizeUserData(raw) {
    const data = { ...raw };
    const patch = {};

    const ensureNumber = (key, def) => { if (!isNum(data[key])) { data[key] = def; patch[key] = def; } };
    const ensureArray = (key) => { if (!Array.isArray(data[key])) { data[key] = []; patch[key] = []; } };
    const ensureObject = (key, def) => { if (!data[key] || typeof data[key] !== 'object') { data[key] = def; patch[key] = def; } };

    ensureNumber('boostersLeft', CONSTS.MAX_BOOSTERS);
    ensureNumber('lastBoosterTime', Date.now());
    ensureNumber('trainerBoostersLeft', state.trainerConfig.maxBoosters);
    ensureNumber('lastTrainerBoosterTime', Date.now());
    ensureNumber('specialBoostersLeft', 0);
    ensureNumber('pokeBerrys', 0);
    ensureNumber('pokeDollars', 0);
    ensureNumber('pokePts', 0);

    ['collection', 'berries', 'friends', 'friendRequests', 'trades', 'battleRequests', 'battleHistory'].forEach(ensureArray);
    ensureObject('shards', {});
    ensureObject('mastery', { ko: {}, catch: {}, claimed: {} });
    ['ko', 'catch', 'claimed'].forEach(k => {
        if (!data.mastery[k] || typeof data.mastery[k] !== 'object') { data.mastery[k] = {}; patch.mastery = data.mastery; }
    });

    // Compression des cartes / baies (réécrite seulement si quelque chose change)
    const oldCol = data.collection;
    const newCol = compressCollection(oldCol);
    if (newCol.length !== oldCol.length || oldCol.some(c => c && !isNum(c.quantity))) {
        data.collection = newCol;
        patch.collection = newCol;
    }
    const oldBerries = data.berries;
    const newBerries = compressBerries(oldBerries);
    if (newBerries.length !== oldBerries.length || oldBerries.some(b => b && !isNum(b.quantity))) {
        data.berries = newBerries;
        patch.berries = newBerries;
    }

    return { data, patch };
}

// ------------------------------------------------------------------
// Point d'entrée UNIQUE pour connecter un utilisateur
// (chargement de page, connexion, inscription).
// ------------------------------------------------------------------
export async function loadUser(userId, prefetchedData = null) {
    await readyPromise;

    let raw = prefetchedData;
    if (!raw) {
        const doc = await db.collection('users').doc(userId).get();
        if (!doc.exists) return false;
        raw = doc.data();
    }

    const { data, patch } = normalizeUserData(raw);
    state.currentUser = userId;
    state.currentUserData = data;
    localStorage.setItem('pokeAppCurrentUser', userId);

    if (Object.keys(patch).length > 0) {
        db.collection('users').doc(userId).update(patch)
            .catch(err => console.error('Erreur de sauvegarde des valeurs par défaut :', err));
    }

    initQuests();
    updateAuthUI();
    updateBoosterLogic();
    startNotificationListener();
    startFriendsListener();
    return true;
}
