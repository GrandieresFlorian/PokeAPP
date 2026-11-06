// Utilitaires partagés (sans dépendance) pour identifier et fusionner des cartes.

// Clé unique d'une "variante" de carte (une pile = une variante).
export function variantKey(c) {
    if (c.isTrainer) return `t_${c.variantId}`;
    return `p_${Number(c.pokedexNumber)}_${c.shiny ? 1 : 0}_${c.mega ? 1 : 0}_${c.megaForm || 'none'}`;
}

const PROGRESS_FIELDS = ['level', 'xp', 'maxLevel', 'evs', 'talent', 'moves'];

// Fusionne `incoming` dans la pile `base` : additionne les quantités et garde
// la progression (niveau, XP, EVs, talent, moves) de la carte la plus avancée.
// N'écrit jamais `undefined` (Firestore le refuse).
export function mergeCardInto(base, incoming) {
    base.quantity = Number(base.quantity || 1) + Number(incoming.quantity || 1);

    const inLevel = incoming.level || 1;
    const baseLevel = base.level || 1;
    const inMax = incoming.maxLevel || 20;
    const baseMax = base.maxLevel || 20;

    const incomingMoreAdvanced = inLevel > baseLevel || (inLevel === baseLevel && (incoming.xp || 0) > (base.xp || 0));
    if (incomingMoreAdvanced) {
        PROGRESS_FIELDS.forEach(f => { if (incoming[f] !== undefined) base[f] = incoming[f]; });
    }
    // Le rang maximum ne doit jamais diminuer
    base.maxLevel = Math.max(baseMax, inMax);
    return base;
}

// Ajoute `card` à `collection` (tableau modifié en place) en fusionnant avec une pile existante.
export function addToCollection(collection, card) {
    const key = variantKey(card);
    const existing = collection.find(c => c && variantKey(c) === key);
    if (!existing) collection.push(card);
    else mergeCardInto(existing, card);
}
