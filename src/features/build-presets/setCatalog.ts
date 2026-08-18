export type EquipmentSet = { code: string; name: string; pieces: 2 | 4; icon: string };

const icon = (name: string) => `/assets/sets/fribbels/${name}.png`;

export const equipmentSets: EquipmentSet[] = [
  { code: 'set_speed', name: '速度套', pieces: 4, icon: icon('setspeed') }, { code: 'set_att', name: '攻击套', pieces: 4, icon: icon('setattack') },
  { code: 'set_cri_dmg', name: '破灭套', pieces: 4, icon: icon('setdestruction') }, { code: 'set_counter', name: '反击套', pieces: 4, icon: icon('setcounter') },
  { code: 'set_vampire', name: '吸血套', pieces: 4, icon: icon('setlifesteal') }, { code: 'set_rage', name: '愤怒套', pieces: 4, icon: icon('setrage') },
  { code: 'set_fervor', name: '全力套装', pieces: 2, icon: '/assets/sets/fervor-set.png' },
  { code: 'set_revenge', name: '复仇套', pieces: 4, icon: icon('setrevenge') }, { code: 'set_scar', name: '伤口套', pieces: 4, icon: icon('setinjury') },
  { code: 'set_shield', name: '保护套', pieces: 4, icon: icon('setprotection') }, { code: 'set_revenant', name: '逆袭套', pieces: 4, icon: icon('setreversal') },
  { code: 'set_riposte', name: '截击套', pieces: 4, icon: icon('setriposte') }, { code: 'set_opener', name: '开幕套', pieces: 2, icon: icon('setwarfare') },
  { code: 'set_cri', name: '暴击套', pieces: 2, icon: icon('setcritical') }, { code: 'set_acc', name: '命中套', pieces: 2, icon: icon('sethit') },
  { code: 'set_res', name: '抗性套', pieces: 2, icon: icon('setresist') }, { code: 'set_max_hp', name: '生命套', pieces: 2, icon: icon('sethealth') },
  { code: 'set_def', name: '防御套', pieces: 2, icon: icon('setdefense') }, { code: 'set_immune', name: '免疫套', pieces: 2, icon: icon('setimmunity') },
  { code: 'set_penetrate', name: '穿透套', pieces: 2, icon: icon('setpenetration') }, { code: 'set_torrent', name: '激流套', pieces: 2, icon: icon('settorrent') },
  { code: 'set_chase', name: '追击套', pieces: 2, icon: icon('setpursuit') }, { code: 'set_coop', name: '夹攻套', pieces: 2, icon: icon('setunity') },
  { code: 'set_weak', name: '弱化套', pieces: 2, icon: icon('setweakening') },
];

export function equipmentSet(code: string) {
  return equipmentSets.find((set) => set.code === code) || { code, name: code, pieces: 2 as const, icon: icon('setcritical') };
}

export function cycleEquipmentSet(sets: string[], set: EquipmentSet) {
  const selected = sets.filter((code) => code === set.code).length;
  const usedPieces = sets.reduce((total, code) => total + equipmentSet(code).pieces, 0);
  if (selected > 0 && usedPieces + set.pieces > 6) {
    return sets.filter((code) => code !== set.code);
  }
  return [...sets, set.code];
}
