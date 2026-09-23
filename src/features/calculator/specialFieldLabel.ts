export function calculatorSpecialFieldLabel(heroId: string, field: string, value: unknown): string | undefined {
  if (heroId === 'haru' && field === 'skill3Stack') return '锚之打击叠层（每层+45%）';
  if (heroId === 'monarch_of_the_sword_iseria' && field === 'casterFractureStack') {
    const stacks = Math.min(10, Math.max(0, Number(value) || 0));
    return `龟裂层数（攻击+${stacks * 20}%）`;
  }
  return undefined;
}
