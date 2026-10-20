export const TWO_TURN_INVUL_MOVES = ["fly", "dig", "dive", "bounce", "phantom-force"];
export const TWO_TURN_CHARGE_MOVES = ["solar-beam", "sky-attack", "razor-wind", "skull-bash"];
export const DELAYED_MOVES = ["future-sight", "doom-desire"];
export const HAZARD_MOVES = ["stealth-rock", "spikes", "toxic-spikes", "sticky-web"];
export const HAZARD_CLEAR_MOVES = ["defog", "rapid-spin"];
// --- CARTE ET ZONES ---
export const ZONES = [
    { id: "route1", name: "Route 1", minLvl: 2, maxLvl: 5, encounters: [{id: 16, chance: 50}, {id: 19, chance: 50}] },
    { id: "route2", name: "Route 2", minLvl: 3, maxLvl: 6, encounters: [{id: 19, chance: 45}, {id: 16, chance: 45}, {id: 10, chance: 5}, {id: 13, chance: 5}] },
    { id: "foretjade", name: "Forêt de Jade", minLvl: 4, maxLvl: 8, encounters: [{id: 10, chance: 40}, {id: 13, chance: 40}, {id: 11, chance: 10}, {id: 14, chance: 5}, {id: 25, chance: 5}] },
    { id: "route3", name: "Route 3", minLvl: 6, maxLvl: 10, encounters: [{id: 16, chance: 45}, {id: 21, chance: 45}, {id: 39, chance: 10}] },
    { id: "montselenite", name: "Mont Sélénite", minLvl: 8, maxLvl: 12, encounters: [{id: 41, chance: 70}, {id: 74, chance: 20}, {id: 46, chance: 9}, {id: 35, chance: 1}] },
    { id: "route4", name: "Route 4", minLvl: 10, maxLvl: 14, encounters: [{id: 19, chance: 40}, {id: 21, chance: 40}, {id: 23, chance: 20}] },
    { id: "route24", name: "Routes 24 & 25", minLvl: 10, maxLvl: 15, encounters: [{id: 13, chance: 30}, {id: 10, chance: 30}, {id: 63, chance: 20}, {id: 43, chance: 15}, {id: 69, chance: 5}] },
    { id: "route5", name: "Routes 5 & 6", minLvl: 13, maxLvl: 17, encounters: [{id: 16, chance: 40}, {id: 43, chance: 30}, {id: 52, chance: 30}] },
    { id: "cavetaupiqueur", name: "Cave Taupiqueur", minLvl: 15, maxLvl: 22, encounters: [{id: 50, chance: 95}, {id: 51, chance: 5}] },
    { id: "route9", name: "Routes 9 & 10", minLvl: 14, maxLvl: 19, encounters: [{id: 19, chance: 30}, {id: 21, chance: 30}, {id: 23, chance: 20}, {id: 100, chance: 20}] },
    { id: "grottesombre", name: "Grotte Sombre", minLvl: 16, maxLvl: 22, encounters: [{id: 41, chance: 60}, {id: 74, chance: 30}, {id: 66, chance: 9}, {id: 95, chance: 1}] },
    { id: "lavanville", name: "Tour Pokémon", minLvl: 20, maxLvl: 26, encounters: [{id: 92, chance: 85}, {id: 93, chance: 9}, {id: 104, chance: 6}] },
    { id: "route12", name: "Routes 12 à 15", minLvl: 22, maxLvl: 28, encounters: [{id: 43, chance: 30}, {id: 48, chance: 30}, {id: 16, chance: 20}, {id: 132, chance: 20}] },
    { id: "pistecyclable", name: "Piste Cyclable", minLvl: 24, maxLvl: 30, encounters: [{id: 84, chance: 40}, {id: 88, chance: 40}, {id: 20, chance: 20}] },
    { id: "parcsafari", name: "Parc Safari", minLvl: 25, maxLvl: 35, encounters: [{id: 32, chance: 20}, {id: 29, chance: 20}, {id: 102, chance: 20}, {id: 111, chance: 15}, {id: 114, chance: 10}, {id: 123, chance: 5}, {id: 127, chance: 5}, {id: 128, chance: 4}, {id: 113, chance: 1}] },
    { id: "ilesecume", name: "Îles Écume", minLvl: 28, maxLvl: 36, encounters: [{id: 41, chance: 40}, {id: 86, chance: 30}, {id: 90, chance: 20}, {id: 124, chance: 10}] },
    { id: "manoir", name: "Manoir Pokémon", minLvl: 30, maxLvl: 38, encounters: [{id: 88, chance: 30}, {id: 109, chance: 30}, {id: 77, chance: 20}, {id: 37, chance: 10}, {id: 126, chance: 10}] },
    { id: "centrale", name: "Centrale", minLvl: 32, maxLvl: 40, encounters: [{id: 81, chance: 40}, {id: 100, chance: 40}, {id: 25, chance: 10}, {id: 26, chance: 5}, {id: 125, chance: 5}] },
    { id: "route21", name: "Chenal 21 (Surf)", minLvl: 25, maxLvl: 35, encounters: [{id: 72, chance: 90}, {id: 73, chance: 10}] },
    { id: "routevictoire", name: "Route Victoire", minLvl: 40, maxLvl: 50, encounters: [{id: 74, chance: 40}, {id: 41, chance: 40}, {id: 66, chance: 15}, {id: 95, chance: 5}] },
    { id: "caverneazure", name: "Caverne Azurée", minLvl: 55, maxLvl: 65, encounters: [{id: 42, chance: 25}, {id: 132, chance: 25}, {id: 105, chance: 15}, {id: 64, chance: 15}, {id: 47, chance: 10}, {id: 108, chance: 5}, {id: 113, chance: 5}] }
];

// --- LISTES DES MÉCANIQUES SPÉCIALES ---
export const USELESS_MOVES = ["splash"];
export const PRIORITY_MOVES = ["quick-attack", "mach-punch", "extreme-speed", "aqua-jet", "bullet-punch", "ice-shard", "sucker-punch", "fake-out", "shadow-sneak", "vacuum-wave"];
export const HEAL_MOVES = ["recover", "roost", "soft-boiled", "synthesis", "morning-sun", "moonlight", "heal-order", "milk-drink", "slack-off"];
export const DRAIN_MOVES = ["absorb", "mega-drain", "giga-drain", "leech-life", "drain-punch", "horn-leech", "dream-eater"];
export const RECOIL_MOVES = ["take-down", "double-edge", "submission", "wood-hammer", "flare-blitz", "brave-bird", "wild-charge", "head-smash"];
export const MULTI_HIT_2_5 = ["fury-attack", "fury-swipes", "double-slap", "bullet-seed", "icicle-spear", "rock-blast", "pin-missile", "bone-rush", "arm-thrust", "tail-slap"];
export const MULTI_HIT_2 = ["double-kick", "twin-needle", "bonemerang", "gear-grind", "dual-chop"];
export const FLINCH_MOVES = ["bite", "headbutt", "air-slash", "iron-head", "zen-headbutt", "waterfall", "dark-pulse", "astonish", "fake-out", "rock-slide"];

export const OHKO_MOVES = ["fissure", "horn-drill", "guillotine", "sheer-cold"];
export const KAMIKAZE_MOVES = ["self-destruct", "explosion", "memento"];
export const FORCE_FLEE_MOVES = ["roar", "whirlwind", "teleport", "dragon-tail", "circle-throw"];
export const HIGH_CRIT_MOVES = ["slash", "night-slash", "psycho-cut", "stone-edge", "leaf-blade", "cross-chop", "razor-leaf", "crabhammer", "shadow-claw", "drill-run", "aeroblast", "spacial-rend", "cross-poison"];
export const STAT_CLEAR_MOVES = ["haze", "clear-smog"];
export const FIXED_DAMAGE_MOVES = { "dragon-rage": 40, "sonic-boom": 20, "seismic-toss": "level", "night-shade": "level" };

// NOUVEAU : ATTAQUES INFLIGEANT DES STATUTS
export const STATUS_CONDITIONS = {
    "thunder-wave": { status: "PAR", chance: 100 },
    "stun-spore": { status: "PAR", chance: 100 },
    "glare": { status: "PAR", chance: 100 },
    "toxic": { status: "TOX", chance: 100 },
    "poison-powder": { status: "PSN", chance: 100 },
    "poison-gas": { status: "PSN", chance: 100 },
    "will-o-wisp": { status: "BRN", chance: 100 },
    "sleep-powder": { status: "SLP", chance: 100 },
    "spore": { status: "SLP", chance: 100 },
    "hypnosis": { status: "SLP", chance: 100 },
    "sing": { status: "SLP", chance: 100 },
    "grass-whistle": { status: "SLP", chance: 100 },
    "yawn": { status: "SLP", chance: 100 },
    "confuse-ray": { status: "CNF", chance: 100 },
    "supersonic": { status: "CNF", chance: 100 },
    "sweet-kiss": { status: "CNF", chance: 100 },
    "teeter-dance": { status: "CNF", chance: 100 },
    "swagger": { status: "CNF", chance: 100, stat: "atk", stage: 2 },
    "flatter": { status: "CNF", chance: 100, stat: "spatk", stage: 1 }
};

export const SECONDARY_STATUS = {
    "flamethrower": { status: "BRN", chance: 10 },
    "fire-blast": { status: "BRN", chance: 10 },
    "ember": { status: "BRN", chance: 10 },
    "fire-punch": { status: "BRN", chance: 10 },
    "flare-blitz": { status: "BRN", chance: 10 },
    "thunderbolt": { status: "PAR", chance: 10 },
    "thunder": { status: "PAR", chance: 30 },
    "thunder-punch": { status: "PAR", chance: 10 },
    "spark": { status: "PAR", chance: 30 },
    "body-slam": { status: "PAR", chance: 30 },
    "dragon-breath": { status: "PAR", chance: 30 },
    "ice-beam": { status: "FRZ", chance: 10 },
    "blizzard": { status: "FRZ", chance: 10 },
    "ice-punch": { status: "FRZ", chance: 10 },
    "powder-snow": { status: "FRZ", chance: 10 },
    "sludge-bomb": { status: "PSN", chance: 30 },
    "poison-jab": { status: "PSN", chance: 30 },
    "sludge": { status: "PSN", chance: 30 },
    "water-pulse": { status: "CNF", chance: 20 },
    "hurricane": { status: "CNF", chance: 30 },
    "confusion": { status: "CNF", chance: 10 }
};

// --- EFFETS SECONDAIRES DES ATTAQUES ---
export const SECONDARY_EFFECTS = {
    "close-combat": { target: "self", effects: [{stat: "def", stage: -1}, {stat: "spdef", stage: -1}], chance: 1 },
    "superpower": { target: "self", effects: [{stat: "atk", stage: -1}, {stat: "def", stage: -1}], chance: 1 },
    "overheat": { target: "self", effects: [{stat: "spatk", stage: -2}], chance: 1 },
    "leaf-storm": { target: "self", effects: [{stat: "spatk", stage: -2}], chance: 1 },
    "draco-meteor": { target: "self", effects: [{stat: "spatk", stage: -2}], chance: 1 },
    "power-up-punch": { target: "self", effects: [{stat: "atk", stage: 1}], chance: 1 },
    "flame-charge": { target: "self", effects: [{stat: "speed", stage: 1}], chance: 1 },
    "rock-tomb": { target: "enemy", effects: [{stat: "speed", stage: -1}], chance: 1 },
    "icy-wind": { target: "enemy", effects: [{stat: "speed", stage: -1}], chance: 1 },
    "crunch": { target: "enemy", effects: [{stat: "def", stage: -1}], chance: 0.2 },
    "shadow-ball": { target: "enemy", effects: [{stat: "spdef", stage: -1}], chance: 0.2 },
    "psychic": { target: "enemy", effects: [{stat: "spdef", stage: -1}], chance: 0.1 },
    "moonblast": { target: "enemy", effects: [{stat: "spatk", stage: -1}], chance: 0.3 }
};

// --- DICTIONNAIRE MULTI-STATS ---
export const STATUS_MOVES = {
    "growl": { effects: [{stat: "atk", stage: -1}], target: "enemy", fr: "l'Attaque", en: "Attack" },
    "tail-whip": { effects: [{stat: "def", stage: -1}], target: "enemy", fr: "la Défense", en: "Defense" },
    "leer": { effects: [{stat: "def", stage: -1}], target: "enemy", fr: "la Défense", en: "Defense" },
    "string-shot": { effects: [{stat: "speed", stage: -1}], target: "enemy", fr: "la Vitesse", en: "Speed" },
    "sand-attack": { effects: [{stat: "speed", stage: -1}], target: "enemy", fr: "la Précision", en: "Accuracy" },
    "screech": { effects: [{stat: "def", stage: -2}], target: "enemy", fr: "la Défense", en: "Defense" },
    "charm": { effects: [{stat: "atk", stage: -2}], target: "enemy", fr: "l'Attaque", en: "Attack" },
    "scary-face": { effects: [{stat: "speed", stage: -2}], target: "enemy", fr: "la Vitesse", en: "Speed" },
    "swords-dance": { effects: [{stat: "atk", stage: 2}], target: "self", fr: "l'Attaque", en: "Attack" },
    "harden": { effects: [{stat: "def", stage: 1}], target: "self", fr: "la Défense", en: "Defense" },
    "withdraw": { effects: [{stat: "def", stage: 1}], target: "self", fr: "la Défense", en: "Defense" },
    "defense-curl": { effects: [{stat: "def", stage: 1}], target: "self", fr: "la Défense", en: "Defense" },
    "amnesia": { effects: [{stat: "spdef", stage: 2}], target: "self", fr: "la Déf. Spé", en: "Sp. Def" },
    "agility": { effects: [{stat: "speed", stage: 2}], target: "self", fr: "la Vitesse", en: "Speed" },
    "iron-defense": { effects: [{stat: "def", stage: 2}], target: "self", fr: "la Défense", en: "Defense" },
    "acid-armor": { effects: [{stat: "def", stage: 2}], target: "self", fr: "la Défense", en: "Defense" },
    "barrier": { effects: [{stat: "def", stage: 2}], target: "self", fr: "la Défense", en: "Defense" },
    "howl": { effects: [{stat: "atk", stage: 1}], target: "self", fr: "l'Attaque", en: "Attack" },
    "bulk-up": { effects: [{stat: "atk", stage: 1}, {stat: "def", stage: 1}], target: "self", fr: "l'Att. et la Déf.", en: "Attack and Defense" },
    "calm-mind": { effects: [{stat: "spatk", stage: 1}, {stat: "spdef", stage: 1}], target: "self", fr: "l'Att. Spé et Déf. Spé", en: "Sp. Atk and Sp. Def" },
    "dragon-dance": { effects: [{stat: "atk", stage: 1}, {stat: "speed", stage: 1}], target: "self", fr: "l'Att. et la Vitesse", en: "Attack and Speed" },
    "nasty-plot": { effects: [{stat: "spatk", stage: 2}], target: "self", fr: "l'Att. Spé", en: "Sp. Atk" },
    "tail-glow": { effects: [{stat: "spatk", stage: 3}], target: "self", fr: "l'Att. Spé", en: "Sp. Atk" },
};

export const STAT_NAMES = {
    fr: { atk: "Atk", def: "Déf", spatk: "AtkS", spdef: "DéfS", speed: "Vit" },
    en: { atk: "Atk", def: "Def", spatk: "SpA", spdef: "SpD", speed: "Spe" }
};

export const PROTECT_MOVES = ["protect", "detect"];
export const SEED_MOVES = ["leech-seed"];

// Dictionnaire des talents (à exporter en bas du fichier)
export const ABILITIES_DB = {
    // Boosts quand PV < 30%
    "overgrow": { type: "low_hp_boost", element: "grass" }, // Engrais
    "blaze": { type: "low_hp_boost", element: "fire" }, // Brasier
    "torrent": { type: "low_hp_boost", element: "water" }, // Torrent
    "swarm": { type: "low_hp_boost", element: "bug" }, // Essaim

    // Vitesse doublée sous la météo
    "chlorophyll": { type: "weather_speed", weather: "sun" }, // Chlorophylle
    "swift-swim": { type: "weather_speed", weather: "rain" }, // Glissade
    "sand-rush": { type: "weather_speed", weather: "sandstorm" }, // Baigne Sable

    // Météo invoquée à l'entrée
    "drizzle": { type: "on_entry_weather", weather: "rain", msg: "Le Crachin commence à tomber 🌧️ !" },
    "drought": { type: "on_entry_weather", weather: "sun", msg: "La Sécheresse intensifie les rayons du soleil ☀️ !" },
    "sand-stream": { type: "on_entry_weather", weather: "sandstorm", msg: "Sable Volant déclenche une Tempête de Sable 🌪️ !" },
    "snow-warning": { type: "on_entry_weather", weather: "hail", msg: "Alerte Neige fait tomber la Grêle ❄️ !" },

    // Malus à l'entrée
    "intimidate": { type: "on_entry_stat", stat: "atk", stage: -1, msg: "Intimidation baisse l'Attaque adverse !" },

    // Effets au contact (Quand on se fait taper)
    "static": { type: "on_hit_status", statusObj: {status: "PAR", chance: 30}, msg: "Statik paralyse l'attaquant !" },
    "flame-body": { type: "on_hit_status", statusObj: {status: "BRN", chance: 30}, msg: "Corps Ardent brûle l'attaquant !" },
    "rough-skin": { type: "on_hit_damage", percent: 8, msg: "Peau Dure blesse l'attaquant !" }
};