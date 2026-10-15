import { db } from '../firebase-config.js';
import { state, CONSTS } from '../state.js';
import { getCardImageUrl } from '../utils.js';
import { allerASection } from './navController.js';

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
            const doc = await targetRef.get();
            let targetTrades = doc.data().trades || [];
            
            targetTrades.push({
                id: Date.now().toString(),
                from: state.currentUser,
                offer: myOfferSelection,
                request: theirOfferSelection
            });

            await targetRef.update({ trades: targetTrades });
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
    let myTrades = (state.currentUserData.trades || []).filter(t => t.id !== tradeId);
    await db.collection('users').doc(state.currentUser).update({ trades: myTrades });
}

export async function accepterEchange(tradeId, senderId) {
    if (!state.currentUser) return;
    const trade = state.currentUserData.trades.find(t => t.id === tradeId);
    if (!trade) return;

    try {
        const senderRef = db.collection('users').doc(senderId);
        const senderDoc = await senderRef.get();
        if (!senderDoc.exists) return alert("Le joueur n'existe plus.");
        
        let senderData = senderDoc.data();
        let myCollection = [...state.currentUserData.collection];
        let senderCollection = [...(senderData.collection || [])];

        const iHaveCards = trade.request.every(reqCard => myCollection.some(c => c.date === reqCard.date));
        const senderHasCards = trade.offer.every(offCard => senderCollection.some(c => c.date === offCard.date));

        if (!iHaveCards || !senderHasCards) {
            alert("Échange impossible : Une ou plusieurs cartes ne sont plus possédées.");
            return refuserEchange(tradeId); 
        }

        trade.request.forEach(reqCard => {
            myCollection = myCollection.filter(c => c.date !== reqCard.date);
            senderCollection.push(reqCard);
        });

        trade.offer.forEach(offCard => {
            senderCollection = senderCollection.filter(c => c.date !== offCard.date);
            myCollection.push(offCard);
        });

        let myTrades = state.currentUserData.trades.filter(t => t.id !== tradeId);
        await db.collection('users').doc(state.currentUser).update({ collection: myCollection, trades: myTrades });
        await senderRef.update({ collection: senderCollection });
        
        alert("Échange réussi !");
    } catch(e) { alert("Erreur lors de la transaction."); }
}