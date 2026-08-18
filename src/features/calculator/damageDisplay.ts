export function damageRemainingPercent(damage: number, barrier: number, targetMaxHP: number) {
  if (targetMaxHP <= 0) return 0;
  return Math.max(0, damage - Math.max(0, barrier)) / targetMaxHP * 100;
}
