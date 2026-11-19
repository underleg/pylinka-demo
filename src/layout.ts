export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Placement {
  scale: number;
  x: number;
  y: number;
}

// The screen point at fractions (fx, fy) of the band left open by the overlays: fx across the full width, fy down
// from the menu to the footer. Measuring y in the band, not the window, keeps things clear of the menu and footer.
export function bandPoint(
  width: number,
  height: number,
  topInset: number,
  bottomInset: number,
  fx: number,
  fy: number,
): Point {
  return { x: width * fx, y: topInset + (height - topInset - bottomInset) * fy };
}

// Centres within the open band, so the menu and footer never cover the effect.
export function effectCentre(width: number, height: number, topInset: number, bottomInset: number): Point {
  return bandPoint(width, height, topInset, bottomInset, 0.5, 0.5);
}

// Scales content (bounds in its own local units, origin anywhere) to fit a box without distortion, centred in it.
// Needed for Spine skeletons, whose origin is usually at the feet and whose size is in editor units, not pixels.
export function fitInBox(bounds: Rect, box: Rect): Placement {
  const scale = Math.min(box.width / bounds.width, box.height / bounds.height);
  return {
    scale,
    x: box.x + (box.width - bounds.width * scale) / 2 - bounds.x * scale,
    y: box.y + (box.height - bounds.height * scale) / 2 - bounds.y * scale,
  };
}
