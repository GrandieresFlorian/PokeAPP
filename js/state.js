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
    boosterTimerInterval: null,
    probabilities: { "C": 60, "U": 20, "R": 10, "E": 7, "L": 2, "M": 1, "mega": 2, "shiny": 0.4 }
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
        323: ["mega"], 334: ["mega"], 354: ["mega"], 359: ["mega"], 362: ["mega"],
        373: ["mega"], 376: ["mega"], 380: ["mega"], 381: ["mega"], 384: ["mega"],
        428: ["mega"], 445: ["mega"], 448: ["mega"], 460: ["mega"], 475: ["mega"],
        531: ["mega"], 719: ["mega"],26: ["mega-x", "mega-y"], // Raichu X et Y
        36: ["mega"],   // Mélodelfe
        71: ["mega"],   // Empiflor
        121: ["mega"],  // Staross
        149: ["mega"],  // Dracolosse
        154: ["mega"],  // Méganium
        160: ["mega"],  // Aligatueur
        227: ["mega"],  // Airmure
        358: ["mega"],  // Éoko
        398: ["mega"],  // Étouraptor
        478: ["mega"],  // Momartik
        485: ["mega"],  // Heatran
        491: ["mega"],  // Darkrai
        500: ["mega"],  // Roitiflam
        530: ["mega"],  // Minotaupe
        545: ["mega"],  // Brutapode
        560: ["mega"],  // Baggaïd
        604: ["mega"],  // Ohmassacre
        609: ["mega"],  // Lugulabre
        623: ["mega"],  // Golemastoc
        652: ["mega"],  // Blindépique
        655: ["mega"],  // Goupelin
        658: ["mega"],  // Amphinobi
        668: ["mega"],  // Némélios
        670: ["mega"], // Floette Fleur Éternelle (Forme Spéciale)
        678: ["mega"],  // Mistigrix
        687: ["mega"],  // Sepiatroce
        689: ["mega"],  // Golgopathe
        691: ["mega"],  // Kravarech
        701: ["mega"],  // Brutalibré
        718: ["mega"], // Zygarde (Forme Spéciale / Parfaite)
        740: ["mega"],  // Crabominable
        768: ["mega"],  // Sarmuraï
        780: ["mega"],  // Draïeul
        801: ["mega"],  // Magearna
        807: ["mega"],  // Zeraora
        870: ["mega"],  // Hexadron
        952: ["mega"],  // Scovilain
        970: ["mega"],  // Floréclat
        978: ["mega"],  // Nigirigon
        998: ["mega"]   // Glaivodo
    }
};