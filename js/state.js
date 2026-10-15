export const state = {
    currentUser: localStorage.getItem('pokeAppCurrentUser') || null,
    currentUserData: { collection: [], boostersLeft: 10, lastBoosterTime: Date.now(), friends: [], friendRequests: [], trades: [] },
    pokemonDataList: [],
    currentLang: 'en',
    collectionMode: 'normal',
    cartesRetournees: 0,
    currentPulls: [],
    currentPullIndex: 0,
    isOpening: false,
    boosterTimerInterval: null
};

export const CONSTS = {
    MAX_POKEMON: 1025,
    MAX_BOOSTERS: 10,
    REGEN_TIME_MS: 5 * 60 * 1000,
    couleursRarete: { "C": "#5a6369", "U": "#5eb84b", "R": "#3498db", "E": "#7d3c98", "L": "#b7950b", "M": "#a93226", "MG": "#111111" },
    poidsRarete: { "C": 1, "U": 2, "R": 3, "E": 4, "L": 5, "M": 6, "MG": 7 },
    megaIds: { 3: ["mega"], 6: ["mega-x", "mega-y"], 9: ["mega"], 150: ["mega-x", "mega-y"] } // Simplified for brevity in this snippet
};