export interface DockedWindowLayoutInput {
  workX: number;
  workY: number;
  workWidth: number;
  workHeight: number;
  scaleFactor: number;
  frameWidth: number;
  frameHeight: number;
}

export interface DockedWindowLayout {
  x: number;
  y: number;
  innerWidth: number;
  innerHeight: number;
  minWidth: number;
  minHeight: number;
  bottomGap: number;
}

/**
 * Tauri's setSize() sets the client area, while Windows' work area limits the
 * whole window. Subtracting the measured frame keeps the title bar and borders
 * above the taskbar on every DPI setting.
 */
export function calculateDockedWindowLayout(input: DockedWindowLayoutInput): DockedWindowLayout {
  const scaleFactor = Math.max(0.5, input.scaleFactor || 1);
  const workWidth = Math.max(1, Math.round(input.workWidth));
  const workHeight = Math.max(1, Math.round(input.workHeight));
  const frameWidth = Math.max(0, Math.round(input.frameWidth));
  const frameHeight = Math.max(0, Math.round(input.frameHeight));
  const bottomGap = Math.min(workHeight - 1, Math.max(1, Math.round(8 * scaleFactor)));

  const minimumOuterWidth = Math.min(workWidth, 720);
  const proportionalOuterWidth = Math.round(workWidth * 0.375);
  const outerWidth = Math.min(workWidth, Math.max(minimumOuterWidth, proportionalOuterWidth));
  const outerHeight = Math.max(1, workHeight - bottomGap);
  const innerWidth = Math.max(1, outerWidth - frameWidth);
  const innerHeight = Math.max(1, outerHeight - frameHeight);

  return {
    x: Math.round(input.workX + workWidth - outerWidth),
    y: Math.round(input.workY),
    innerWidth,
    innerHeight,
    minWidth: Math.min(innerWidth, 720),
    minHeight: Math.min(innerHeight, Math.round(720 * scaleFactor)),
    bottomGap,
  };
}
