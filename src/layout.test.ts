import { describe, expect, it } from 'vitest';
import { bandPoint, effectCentre, fitInBox } from './layout';

describe('effectCentre', () => {
  it('uses the window centre when there are no overlays', () => {
    expect(effectCentre(800, 600, 0, 0)).toEqual({ x: 400, y: 300 });
  });

  it('centres in the band between the menu and the footer', () => {
    // Open band runs from y=40 to y=600-200=400, so its middle is 220.
    expect(effectCentre(800, 600, 40, 200)).toEqual({ x: 400, y: 220 });
  });

  it('moves down into the freed space when the footer is hidden', () => {
    expect(effectCentre(800, 600, 40, 0)).toEqual({ x: 400, y: 320 });
  });
});

describe('fitInBox', () => {
  it('scales down to the box and moves an off-centre origin so the content starts at the box corner', () => {
    // Like a Spine skeleton: 400 units square, origin at the feet (bottom centre), so bounds start at (-200, -400).
    const placement = fitInBox({ x: -200, y: -400, width: 400, height: 400 }, { x: 16, y: 80, width: 100, height: 100 });
    expect(placement).toEqual({ scale: 0.25, x: 16 + 50, y: 80 + 100 });
  });

  it('keeps the aspect ratio, centring the narrow axis', () => {
    const placement = fitInBox({ x: 0, y: 0, width: 200, height: 100 }, { x: 0, y: 0, width: 100, height: 100 });
    expect(placement).toEqual({ scale: 0.5, x: 0, y: 25 });
  });
});

describe('bandPoint', () => {
  it('measures x across the full width and y down the open band between the overlays', () => {
    // Band runs from y=40 to y=600-100=500 (460 tall).
    expect(bandPoint(800, 600, 40, 100, 0.25, 0.5)).toEqual({ x: 200, y: 270 });
    expect(bandPoint(800, 600, 40, 100, 0.75, 0.5)).toEqual({ x: 600, y: 270 });
    expect(bandPoint(800, 600, 40, 100, 0.5, 1)).toEqual({ x: 400, y: 500 });
  });

  it('agrees with effectCentre at the middle of the band', () => {
    expect(bandPoint(800, 600, 40, 100, 0.5, 0.5)).toEqual(effectCentre(800, 600, 40, 100));
  });
});
