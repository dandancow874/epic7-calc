import { describe, expect, it } from 'vitest';
import { calculateDockedWindowLayout } from './windowLayout';

describe('calculateDockedWindowLayout', () => {
  it.each([
    { label: '4K', width: 3840, height: 2080, scale: 2, frameWidth: 16, frameHeight: 62 },
    { label: '2K', width: 2560, height: 1392, scale: 1.5, frameWidth: 12, frameHeight: 46 },
    { label: '1080p', width: 1920, height: 1040, scale: 1, frameWidth: 8, frameHeight: 31 },
  ])('keeps the complete $label window above the taskbar', ({ width, height, scale, frameWidth, frameHeight }) => {
    const layout = calculateDockedWindowLayout({
      workX: 0,
      workY: 0,
      workWidth: width,
      workHeight: height,
      scaleFactor: scale,
      frameWidth,
      frameHeight,
    });

    const outerWidth = layout.innerWidth + frameWidth;
    const outerHeight = layout.innerHeight + frameHeight;
    expect(layout.x + outerWidth).toBe(width);
    expect(layout.y + outerHeight + layout.bottomGap).toBe(height);
    expect(layout.minHeight).toBeLessThanOrEqual(layout.innerHeight);
  });

  it('shrinks the docked window width with the UI scale', () => {
    const normal = calculateDockedWindowLayout({ workX: 0, workY: 0, workWidth: 3840, workHeight: 2080, scaleFactor: 2, frameWidth: 16, frameHeight: 62, uiScale: 1 });
    const compact = calculateDockedWindowLayout({ workX: 0, workY: 0, workWidth: 3840, workHeight: 2080, scaleFactor: 2, frameWidth: 16, frameHeight: 62, uiScale: 0.67 });
    expect(compact.innerWidth + 16).toBe(Math.round((normal.innerWidth + 16) * 0.67));
    expect(compact.innerHeight).toBe(normal.innerHeight);
    expect(compact.x + compact.innerWidth + 16).toBe(3840);
  });
});
