export const state = {
    currentUser: localStorage.getItem('pokeAppCurrentUser') || null,
    currentUserData: { collection: [], berries: [], garden: null, pokeBerrys: 0, boostersLeft: 10, lastBoosterTime: Date.now(), friends: [], friendRequests: [], trades: [], battleRequests: [], battleHistory: [], specialBoostersLeft: 0, battlesProposedToday: 0, lastBattleDate: null, gardenPresets: [
        { id: 1, name: "Preset 1", layout: {} },
        { id: 2, name: "Preset 2", layout: {} },
        { id: 3, name: "Preset 3", layout: {} },
        { id: 4, name: "Preset 4", layout: {} },
        { id: 5, name: "Preset 5", layout: {} }
    ] },
    pokemonDataList: [],
    movesData: { dictionary: {}, pokemonMoves: {} }, // NOUVEAU
    currentLang: localStorage.getItem('pokeAppLang') || 'fr',
    collectionMode: 'normal',
    cartesRetournees: 0,
    currentPulls: [],
    currentPullIndex: 0,
    isOpening: false,
    currentPullIsSpecial: false,
    boosterTimerInterval: null,
    probabilities: { "C": 60, "U": 20, "R": 10, "E": 7, "L": 2, "M": 1, "mega": 2, "shiny": 0.4 },
    berryConfig: {
        default: { 
            growTime: 3 * 60 * 1000, yieldMin: 2, yieldMax: 4, needsWater: false,
            waterInterval: 60 * 1000, witherTime: 2 * 60 * 1000, sellPrice: 10
        }
    }
};

export const CONSTS = {
    MAX_POKEMON: 1025,
    MAX_BOOSTERS: 10,
    REGEN_TIME_MS: 5 * 60 * 1000,
    couleursRarete: { "C": "#5a6369", "U": "#5eb84b", "R": "#3498db", "E": "#7d3c98", "L": "#b7950b", "M": "#a93226", "MG": "#111111" },
    poidsRarete: { "C": 1, "U": 2, "R": 3, "E": 4, "L": 5, "M": 6, "MG": 7 },
    megaIds: {
        3: ["mega"], 6: ["mega-x", "mega-y"], 9: ["mega"], 15: ["mega"], 18: ["mega"],
        65: ["mega"], 80: ["mega"], 94: ["mega"], 115: ["mega"], 127: ["mega"],
        130: ["mega"], 142: ["mega"], 150: ["mega-x", "mega-y"], 181: ["mega"],
        208: ["mega"], 212: ["mega"], 214: ["mega"], 229: ["mega"], 248: ["mega"],
        254: ["mega"], 257: ["mega"], 260: ["mega"], 282: ["mega"], 302: ["mega"],
        303: ["mega"], 306: ["mega"], 308: ["mega"], 310: ["mega"], 319: ["mega"],
        323: ["mega"], 334: ["mega"], 354: ["mega"], 359: ["mega", "mega-z"], 362: ["mega"],
        373: ["mega"], 376: ["mega"], 380: ["mega"], 381: ["mega"], 384: ["mega"],
        428: ["mega"], 445: ["mega", "mega-z"], 448: ["mega", "mega-z"], 460: ["mega"], 475: ["mega"],
        531: ["mega"], 719: ["mega"],
        26: ["mega-x", "mega-y"], 36: ["mega"], 71: ["mega"], 121: ["mega"], 149: ["mega"],
        154: ["mega"], 160: ["mega"], 227: ["mega"], 358: ["mega"], 398: ["mega"],
        478: ["mega"], 485: ["mega"], 491: ["mega"], 500: ["mega"], 530: ["mega"],
        545: ["mega"], 560: ["mega"], 604: ["mega"], 609: ["mega"], 623: ["mega"],
        652: ["mega"], 655: ["mega"], 658: ["mega"], 668: ["mega"], 670: ["mega-em"],
        678: ["mega"], 687: ["mega"], 689: ["mega"], 691: ["mega"], 701: ["mega"],
        718: ["mega-pam"], 740: ["mega"], 768: ["mega"], 780: ["mega"], 801: ["mega"],
        807: ["mega"], 870: ["mega"], 952: ["mega"], 970: ["mega"], 978: ["mega"], 998: ["mega"]
    }
};