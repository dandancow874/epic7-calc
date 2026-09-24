export function calculatorSpecialFieldLabel(
  heroId: string,
  field: string,
  value: unknown,
): string | undefined {
  if (heroId === 'chaos_sect_axe' && field === 'targetSkillTreeCompleted') return '转职技能树（生命+25%，防御+15%）';
  if (heroId === 'chaos_sect_axe' && field === 'targetInjuryPercent') {
    const injuryPercent = Math.min(50, Math.max(0, Number(value) || 0));
    const damageIncreasePercent = trimPercent(injuryPercent * 0.8);
    return `目标伤口比例 ${trimPercent(injuryPercent)}%（芒刺符文加伤+${damageIncreasePercent}%·点满上限40%·待验证）`;
  }
  if (heroId === 'vigilante_leader_glenn' && field === 'targetSkillTreeCompleted') return '转职技能树（攻击+20%，生命+10%）';
  if (heroId === 'haru' && field === 'skill3Stack') return '锚之打击叠层（每层+45%）';
  if (heroId === 'monarch_of_the_sword_iseria' && field === 'casterFractureStack') {
    const stacks = Math.min(10, Math.max(0, Number(value) || 0));
    return `龟裂层数（攻击+${stacks * 20}%）`;
  }
  return undefined;
}

function trimPercent(value: number) {
  return Number(value.toFixed(1));
}
