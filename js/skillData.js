// Données des attaques complémentaires (skill.json) : précision, description…
// Chargé UNE seule fois pour tout le jeu. moves.json ne contient pas la précision des attaques.
let skillsDB = {};

export const skillsReady = fetch('skill.json')
    .then(r => r.json())
    .then(d => { skillsDB = d; })
    .catch(() => console.log("skill.json introuvable"));

export function getSkillData(nameEn) {
    return skillsDB[nameEn] || {};
}
