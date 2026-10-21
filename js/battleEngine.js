import { getEffectiveness } from './utils.js';
import { ABILITIES_DB, HIGH_CRIT_MOVES, FIXED_DAMAGE_MOVES, WEIGHT_MOVES, GYRO_BALL_MOVES, ELECTRO_BALL_MOVES } from './data/campagneData.js';

// ==========================================
// MOTEUR DE CALCUL UNIVERSEL DES COMBATS
// ==========================================

// 1. Calcul des statistiques complètes selon le niveau et les EVs


export function calcStats(baseStats, level, evs = { hp: 0, atk: 0, def: 0, spatk: 0, spdef: 0, speed: 0 }) {
    return {
        maxHp: Math.floor(((2 * baseStats.hp + Math.floor(evs.hp / 4)) * level) / 100) + level + 10,
        hp: Math.floor(((2 * baseStats.hp + Math.floor(evs.hp / 4)) * level) / 100) + level + 10,
        atk: Math.floor(((2 * baseStats.atk + Math.floor(evs.atk / 4)) * level) / 100) + 5,
        def: Math.floor(((2 * baseStats.def + Math.floor(evs.def / 4)) * level) / 100) + 5,
        spatk: Math.floor(((2 * baseStats.spatk + Math.floor(evs.spatk / 4)) * level) / 100) + 5,
        spdef: Math.floor(((2 * baseStats.spdef + Math.floor(evs.spdef / 4)) * level) / 100) + 5,
        speed: Math.floor(((2 * baseStats.speed + Math.floor(evs.speed / 4)) * level) / 100) + 5,
    };
}

// 2. Calcul d'une statistique affectée par les modificateurs (Danse Lames, etc.), le statut et les talents
export function getEffectiveStat(entity, statName, currentWeather = 'none') {
    let statsObj = entity.battleStats || entity.stats || {};
    let base = statsObj[statName] || 10;
    let stage = entity.modifiers ? (entity.modifiers[statName] || 0) : 0;
    
    let multiplier = Math.max(2, 2 + stage) / Math.max(2, 2 - stage);
    let finalStat = Math.floor(base * multiplier);
    
    // Paralysie divise la vitesse par 2
    if (statName === 'speed' && entity.status === 'PAR') finalStat = Math.floor(finalStat / 2);
    
    // Talents influençant la vitesse sous un climat
    if (statName === 'speed' && entity.talent && ABILITIES_DB[entity.talent.en]) {
        let ab = ABILITIES_DB[entity.talent.en];
        if (ab.type === "weather_speed" && ab.weather === currentWeather) {
            finalStat *= 2; 
        }
    }
    
    return finalStat;
}

// 3. Calcul de l'esquive et de la précision globale
export function checkMoveHit(move, atkModifiers, defModifiers) {
    let accStage = Math.max(-6, Math.min(6, (atkModifiers.accuracy || 0) - (defModifiers.evasion || 0)));
    let accMult = accStage >= 0 ? (3 + accStage) / 3 : 3 / (3 - accStage);
    let moveAcc = move.accuracy || 100;
    
    return (Math.random() * 100) <= (moveAcc * accMult);
}

// 4. Calcul des dégâts bruts
export function calculateDamage(atkEntity, defEntity, move, currentWeather = 'none') {
    if (move.power === 0 || !move.power) return { damage: 0, isCrit: false, mult: 1 };

    let isCrit = Math.random() < (HIGH_CRIT_MOVES.includes(move.nameEn) ? 0.125 : 0.0625);
    let atkTypes = atkEntity.types || (atkEntity.battleStats ? atkEntity.battleStats.types : []) || [];
    let defTypes = defEntity.types || (defEntity.battleStats ? defEntity.battleStats.types : []) || [];
    // ------------------------
    
    let mult = getEffectiveness(move.type, defTypes);
    if (mult === 0) return { damage: 0, isCrit: false, mult: 0 };

    // -- 8. DÉGÂTS VARIABLES (Poids et Vitesse) --
    let movePower = move.power;
    if (WEIGHT_MOVES.includes(move.nameEn) && defEntity.data) {
        let weight = (defEntity.data.weight || 100) / 10; // PokeAPI stocke en hectogrammes
        if (weight < 10) movePower = 20;
        else if (weight < 25) movePower = 40;
        else if (weight < 50) movePower = 60;
        else if (weight < 100) movePower = 80;
        else if (weight < 200) movePower = 100;
        else movePower = 120;
    } else if (GYRO_BALL_MOVES.includes(move.nameEn)) {
        let atkSpd = getEffectiveStat(atkEntity, 'speed', currentWeather);
        let defSpd = getEffectiveStat(defEntity, 'speed', currentWeather);
        movePower = Math.min(150, Math.floor((25 * defSpd) / Math.max(1, atkSpd)) + 1);
    } else if (ELECTRO_BALL_MOVES.includes(move.nameEn)) {
        let atkSpd = getEffectiveStat(atkEntity, 'speed', currentWeather);
        let defSpd = getEffectiveStat(defEntity, 'speed', currentWeather);
        let ratio = atkSpd / Math.max(1, defSpd);
        if (ratio >= 4) movePower = 150;
        else if (ratio >= 3) movePower = 120;
        else if (ratio >= 2) movePower = 80;
        else if (ratio >= 1) movePower = 60;
        else movePower = 40;
    }

    if (FIXED_DAMAGE_MOVES[move.nameEn] !== undefined) {
        let val = FIXED_DAMAGE_MOVES[move.nameEn];
        return { 
            damage: val === "level" ? (atkEntity.level || 1) : val, 
            isCrit: false, 
            mult: mult 
        };
    }

    let level = atkEntity.level || 1;
    let A = move.damageClass === 'special' ? getEffectiveStat(atkEntity, 'spatk', currentWeather) : getEffectiveStat(atkEntity, 'atk', currentWeather);
    let D = move.damageClass === 'special' ? getEffectiveStat(defEntity, 'spdef', currentWeather) : getEffectiveStat(defEntity, 'def', currentWeather);
    
    if (atkEntity.status === 'BRN' && move.damageClass === 'physical') A = Math.floor(A / 2);

    // Boosts de Talents sur la stat d'attaque
    if (atkEntity.talent && ABILITIES_DB[atkEntity.talent.en]) {
        let ab = ABILITIES_DB[atkEntity.talent.en];
        if (ab.type === "low_hp_boost" && ab.element === move.type && (atkEntity.currentHp / atkEntity.maxHp) <= 0.33) {
            A = Math.floor(A * 1.5);
        }
    }

    let weatherMult = 1;
    if (currentWeather === 'sun') { if (move.type === 'fire') weatherMult = 1.5; if (move.type === 'water') weatherMult = 0.5; }
    if (currentWeather === 'rain') { if (move.type === 'water') weatherMult = 1.5; if (move.type === 'fire') weatherMult = 0.5; }

    let baseDmg = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * movePower * A / D) / 50) + 2;
    let stab = atkTypes.includes(move.type) ? 1.5 : 1;
    let random = (Math.random() * (1 - 0.85) + 0.85);
    let critMult = isCrit ? 1.5 : 1;

    let damage = Math.floor(baseDmg * stab * mult * weatherMult * random * critMult);
    
    return { damage: Math.max(1, damage), isCrit, mult };
}

// ==========================================
// MOTEUR DE PIÈGES (ENTRY HAZARDS)
// ==========================================
export function calculateHazardEffects(entity, hazards) {
    let logs = [];
    let types = entity.battleStats ? entity.battleStats.types : (entity.types || []);
    let name = entity.data.fr;

    // 1. Piège de Roc
    if (hazards.stealthRock) {
        let mult = getEffectiveness('rock', types);
        let dmg = Math.floor(entity.maxHp * (0.125 * mult));
        if (dmg < 1) dmg = 1;
        entity.currentHp -= dmg;
        logs.push(`<span style="color:#e67e22">Les rochers pointus blessent ${name} !</span>`);
    }

    // 2. Picots (immunité Vol)
    if (hazards.spikes > 0 && !types.includes('flying')) {
        let fraction = hazards.spikes === 1 ? 8 : (hazards.spikes === 2 ? 6 : 4);
        let dmg = Math.floor(entity.maxHp / fraction);
        entity.currentHp -= Math.max(1, dmg);
        logs.push(`<span style="color:#7f8c8d">${name} se blesse sur les Picots !</span>`);
    }

    // 3. Pics Toxik (Immunité Vol/Acier, Absorption par les types Poison)
    if (hazards.toxicSpikes > 0 && !types.includes('flying') && !types.includes('steel')) {
        if (types.includes('poison')) {
            hazards.toxicSpikes = 0; // Un type Poison absorbe les Pics Toxik
            logs.push(`<span style="color:#9b59b6">${name} dissipe les Pics Toxik !</span>`);
        } else if (!entity.status) {
            entity.status = hazards.toxicSpikes === 1 ? 'PSN' : 'TOX';
            entity.toxCount = 0;
            logs.push(`<span style="color:#8e44ad">${name} est empoisonné par les Pics Toxik !</span>`);
        }
    }

    // 4. Toile Gluante (immunité Vol)
    if (hazards.stickyWeb && !types.includes('flying')) {
        entity.modifiers.speed = Math.max(-6, (entity.modifiers.speed || 0) - 1);
        logs.push(`<span style="color:#f1c40f">${name} est pris dans la Toile Gluante ! Sa Vitesse baisse !</span>`);
    }

    return logs;
}