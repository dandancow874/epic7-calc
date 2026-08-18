import type { LibraryAttribute, LibraryRole, LibraryZodiac } from './types';

export const roleLabels: Record<LibraryRole, string> = {
  warrior: '战士', knight: '骑士', thief: '潜行者', ranger: '射手', mage: '法师', soul_weaver: '精灵师', common: '通用',
};

export const attributeLabels: Record<LibraryAttribute, string> = {
  fire: '火焰', ice: '寒气', wind: '自然', light: '光明', dark: '黑暗',
};

export const roleOptions = (Object.keys(roleLabels) as LibraryRole[]).filter((role) => role !== 'common');
export const artifactRoleOptions = Object.keys(roleLabels) as LibraryRole[];
export const attributeOptions = Object.keys(attributeLabels) as LibraryAttribute[];
export const zodiacLabels: Record<LibraryZodiac, { name: string; symbol: string }> = {
  ram: { name: '白羊座', symbol: '♈' }, bull: { name: '金牛座', symbol: '♉' }, twins: { name: '双子座', symbol: '♊' },
  crab: { name: '巨蟹座', symbol: '♋' }, lion: { name: '狮子座', symbol: '♌' }, maiden: { name: '处女座', symbol: '♍' },
  scales: { name: '天秤座', symbol: '♎' }, scorpion: { name: '天蝎座', symbol: '♏' }, archer: { name: '射手座', symbol: '♐' },
  goat: { name: '摩羯座', symbol: '♑' }, waterbearer: { name: '水瓶座', symbol: '♒' }, fish: { name: '双鱼座', symbol: '♓' },
};
export const zodiacOptions = Object.keys(zodiacLabels) as LibraryZodiac[];

export function elementIcon(attribute: LibraryAttribute) {
  const file = attribute === 'wind' ? 'earth' : attribute;
  return `/assets/elements/${file}.png`;
}

export function roleIcon(role: LibraryRole) {
  return `/assets/classes/${role}.png`;
}

export function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
