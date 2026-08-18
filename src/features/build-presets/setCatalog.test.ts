import { describe, expect, it } from 'vitest';
import { cycleEquipmentSet, equipmentSet } from './setCatalog';

describe('equipment set catalog', () => {
  it('contains the two-piece full-power set', () => {
    expect(equipmentSet('set_fervor')).toMatchObject({ name: '全力套装', pieces: 2 });
  });

  it('allows three full-power sets to fill all six equipment slots', () => {
    const fervor = equipmentSet('set_fervor');
    const once = cycleEquipmentSet([], fervor);
    const twice = cycleEquipmentSet(once, fervor);
    expect(cycleEquipmentSet(twice, fervor)).toEqual(['set_fervor', 'set_fervor', 'set_fervor']);
  });

  it('cycles a two-piece set through three copies and then clears it', () => {
    const torrent = equipmentSet('set_torrent');
    const once = cycleEquipmentSet([], torrent);
    const twice = cycleEquipmentSet(once, torrent);
    const threeTimes = cycleEquipmentSet(twice, torrent);
    expect(threeTimes).toEqual(['set_torrent', 'set_torrent', 'set_torrent']);
    expect(cycleEquipmentSet(threeTimes, torrent)).toEqual([]);
  });

  it('clears an active set when all six equipment slots are occupied', () => {
    expect(cycleEquipmentSet(['set_speed', 'set_torrent'], equipmentSet('set_torrent'))).toEqual(['set_speed']);
  });
});
