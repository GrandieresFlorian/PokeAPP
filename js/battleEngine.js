import { getEffectiveness } from './utils.js';
import { ABILITIES_DB, HIGH_CRIT_MOVES, FIXED_DAMAGE_MOVES } from './data/campagneData.js';

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
    let atkTypes = atkEntity.battleStats ? atkEntity.battleStats.types : (atkEntity.types || []);
    let defTypes = defEntity.battleStats ? defEntity.battleStats.types : (defEntity.types || []);
    
    let mult = getEffectiveness(move.type, defTypes);
    if (mult === 0) return { damage: 0, isCrit: false, mult: 0 };

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

    let baseDmg = Math.floor(Math.floor(Math.floor(2 * level / 5 + 2) * move.power * A / D) / 50) + 2;
    let stab = atkTypes.includes(move.type) ? 1.5 : 1;
    let random = (Math.random() * (1 - 0.85) + 0.85);
    let critMult = isCrit ? 1.5 : 1;

    let damage = Math.floor(baseDmg * stab * mult * weatherMult * random * critMult);
    
    return { damage: Math.max(1, damage), isCrit, mult };
}