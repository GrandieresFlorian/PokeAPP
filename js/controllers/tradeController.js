import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { getCardImageUrl } from '../utils.js';
import { allerASection } from './navController.js';
import { variantKey, addToCollection } from '../cardUtils.js';

let currentTradeTarget = null;
let targetCollectionCache = [];
let myOfferSelection = [];
let theirOfferSelection = [];

export function initTrade() {
    document.getElementById('cancel-trade-btn').addEventListener('click', () => allerASection('section-amis'));

    document.getElementById('send-trade-btn').addEventListener('click', async () => {
        if (myOfferSelection.length === 0 && theirOfferSelection.length === 0) return alert("Sélectionnez au moins une carte.");
        
        const tradeMsg = document.getElementById('trade-message');
        tradeMsg.textContent = "Envoi en cours..."; tradeMsg.style.color = "#f1c40f";
        document.getElementById('send-trade-btn').disabled = true;

        try {
            const targetRef = db.collection('users').doc(currentTradeTarget);
            const tradeEntry = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                from: state.currentUser,
                offer: myOfferSelection,
                request: theirOfferSelection
            };
            // Transaction : deux propositions simultanées ne s'écrasent plus
            await db.runTransaction(async tx => {
                const snap = await tx.get(targetRef);
                if (!snap.exists) throw new Error('target-missing');
                const targetTrades = snap.data().trades || [];
                tx.update(targetRef, { trades: [...targetTrades, tradeEntry] });
            });
            tradeMsg.textContent = "Proposition envoyée !"; tradeMsg.style.color = "#2ecc71";
            setTimeout(() => { document.getElementById('send-trade-btn').disabled = false; allerASection('section-amis'); }, 1500);
        } catch (e) {
            tradeMsg.textContent = "Erreur lors de l'envoi."; tradeMsg.style.color = "#e74c3c";
            document.getElementById('send-trade-btn').disabled = false;
        }
    });
}

export async function initierEchange(friendId) {
    currentTradeTarget = friendId;
    myOfferSelection = [];
    theirOfferSelection = [];
    
    allerASection('section-trade');
    document.getElementById('trade-target-name').textContent = friendId + " (Chargement...)";
    document.getElementById('trade-message').textContent = "";
    document.getElementById('my-trade-collection').innerHTML = "<p style='color:#ccc;'>Chargement de vos cartes...</p>";
    document.getElementById('their-trade-collection').innerHTML = "<p style='color:#ccc;'>Récupération des cartes de l'ami...</p>";
    document.getElementById('my-trade-selection').innerHTML = "";
    document.getElementById('their-trade-selection').innerHTML = "";
    
    try {
        const doc = await db.collection('users').doc(friendId).get();
        if (!doc.exists) {
            alert("Joueur introuvable.");
            allerASection('section-amis');
            return;
        }
        
        // SÉCURITÉ : On filtre les cartes "nulles" ou corrompues qui font planter le code
        targetCollectionCache = (doc.data().collection || []).filter(c => c && typeof c === 'object');
        let mySafeCollection = (state.currentUserData.collection || []).filter(c => c && typeof c === 'object');
        
        let usedDates = new Set();
        
        // On sécurise les dates pour l'ami
        targetCollectionCache.forEach(c => { 
            if (!c.date || usedDates.has(c.date)) c.date = Date.now() + Math.random();
            usedDates.add(c.date);
        });
        
        usedDates.clear();
        
        // On sécurise NOS dates
        mySafeCollection.forEach(c => { 
            if (!c.date || usedDates.has(c.date)) c.date = Date.now() + Math.random();
            usedDates.add(c.date);
        });
        
        state.currentUserData.collection = mySafeCollection;

    } catch (e) { 
        console.error("Détails de l'erreur :", e);
        alert("Erreur de récupération : " + e.message); 
        allerASection('section-amis');
        return; 
    }

    document.getElementById('trade-target-name').textContent = friendId;
    renderTradeGrids(); 
}

function renderTradeGrids() {
    const myGrid = document.getElementById('my-trade-collection');
    const theirGrid = document.getElementById('their-trade-collection');
    const mySelectionBox = document.getElementById('my-trade-selection');
    const theirSelectionBox = document.getElementById('their-trade-selection');

    const createMiniCard = (carte, isMine) => {
        const div = document.createElement('div');
        
        if (!carte || !carte.data || !carte.data.en) {
            div.style.display = "none";
            return div;
        }

        const isSelected = isMine ? myOfferSelection.some(c => c.date === carte.date) : theirOfferSelection.some(c => c.date === carte.date);
        
        div.className = `mini-card ${isSelected ? 'selected' : ''}`;
        div.style.backgroundImage = `url('${getCardImageUrl(carte)}')`;
        
        const rarete = carte.mega ? "MG" : (carte.data.rarity || "C");
        div.style.backgroundColor = CONSTS.couleursRarete[rarete] || "#333";
        
        if (carte.shiny || (carte.mega && carte.shiny)) div.innerHTML = '<div class="mini-card-holo"></div>';

        div.onclick = () => {
            if (isMine) {
                if (isSelected) myOfferSelection = myOfferSelection.filter(c => c.date !== carte.date);
                else myOfferSelection.push(carte);
            } else {
                if (isSelected) theirOfferSelection = theirOfferSelection.filter(c => c.date !== carte.date);
                else theirOfferSelection.push(carte);
            }
            renderTradeGrids(); 
        };
        return div;
    };

    myGrid.innerHTML = ""; theirGrid.innerHTML = "";
    mySelectionBox.innerHTML = ""; theirSelectionBox.innerHTML = "";

    (state.currentUserData.collection || []).forEach(carte => myGrid.appendChild(createMiniCard(carte, true)));
    targetCollectionCache.forEach(carte => theirGrid.appendChild(createMiniCard(carte, false)));

    myOfferSelection.forEach(carte => {
        let clone = createMiniCard(carte, true); clone.onclick = null; mySelectionBox.appendChild(clone);
    });
    theirOfferSelection.forEach(carte => {
        let clone = createMiniCard(carte, false); clone.onclick = null; theirSelectionBox.appendChild(clone);
    });
}

export async function refuserEchange(tradeId) {
    if (!state.currentUser) return;
    const myRef = db.collection('users').doc(state.currentUser);
    try {
        const trades = await db.runTransaction(async tx => {
            const snap = await tx.get(myRef);
            const remaining = (snap.data().trades || []).filter(t => t.id !== tradeId);
            tx.update(myRef, { trades: remaining });
            return remaining;
        });
        state.currentUserData.trades = trades;
    } catch (e) { console.error(e); alert("Erreur lors du refus de l'échange."); }
}

// Échange ATOMIQUE : lecture des deux documents, vérification des cartes
// (par date ET par variante) dans les données ACTUELLES, puis écriture des deux
// collections dans la même transaction. On déplace les cartes réelles, pas
// l'instantané enregistré dans la proposition.
export async function accepterEchange(tradeId, senderId) {
    if (!state.currentUser) return;
    const myRef = db.collection('users').doc(state.currentUser);
    const senderRef = db.collection('users').doc(senderId);

    try {
        const result = await db.runTransaction(async tx => {
            const [mySnap, senderSnap] = await Promise.all([tx.get(myRef), tx.get(senderRef)]);
            if (!senderSnap.exists) return { status: 'no-sender' };

            const myData = mySnap.data();
            const trade = (myData.trades || []).find(t => t.id === tradeId);
            if (!trade) return { status: 'no-trade' };

            const myTrades = myData.trades.filter(t => t.id !== tradeId);
            const myCol = (myData.collection || []).map(c => ({ ...c }));
            const senderCol = (senderSnap.data().collection || []).map(c => ({ ...c }));

            // Retire de `col` la carte réellement possédée qui correspond à la référence
            const take = (col, ref) => {
                const i = col.findIndex(c => c && c.date === ref.date && variantKey(c) === variantKey(ref));
                return i === -1 ? null : col.splice(i, 1)[0];
            };

            const toSender = [];
            const toMe = [];
            for (const ref of (trade.request || [])) {
                const card = take(myCol, ref);
                if (!card) { tx.update(myRef, { trades: myTrades }); return { status: 'invalid', trades: myTrades }; }
                toSender.push(card);
            }
            for (const ref of (trade.offer || [])) {
                const card = take(senderCol, ref);
                if (!card) { tx.update(myRef, { trades: myTrades }); return { status: 'invalid', trades: myTrades }; }
                toMe.push(card);
            }

            toSender.forEach(c => addToCollection(senderCol, c));
            toMe.forEach(c => addToCollection(myCol, c));

            tx.update(myRef, { collection: myCol, trades: myTrades });
            tx.update(senderRef, { collection: senderCol });
            return { status: 'ok', collection: myCol, trades: myTrades };
        });

        if (result.trades) state.currentUserData.trades = result.trades;

        if (result.status === 'ok') {
            // État local synchronisé : sans ça, la prochaine sauvegarde annulerait l'échange
            state.currentUserData.collection = result.collection;
            alert("Échange réussi !");
        } else if (result.status === 'invalid') {
            alert("Échange impossible : une ou plusieurs cartes ne sont plus possédées. La proposition a été supprimée.");
        } else if (result.status === 'no-sender') {
            alert("Le joueur n'existe plus.");
        }
    } catch (e) {
        console.error(e);
        alert("Erreur lors de la transaction. Rien n'a été modifié, réessayez.");
    }
}
