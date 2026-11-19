import { describe, expect, it } from 'vitest';
import { EmitterSway, swayX } from './EmitterSway';

describe('swayX', () => {
  it('traces one full sine wave per period: centre, right, centre, left, centre', () => {
    const at = (t: number) => swayX(t, 100, 2);
    expect(at(0)).toBeCloseTo(0);
    expect(at(0.5)).toBeCloseTo(100);
    expect(at(1)).toBeCloseTo(0);
    expect(at(1.5)).toBeCloseTo(-100);
    expect(at(2)).toBeCloseTo(0);
  });
});

describe('EmitterSway', () => {
  it('swings between ±amplitude on its period', () => {
    const sway = new EmitterSway(2, 0.05);
    sway.amplitude = 150;
    const xs = Array.from({ length: 120 }, () => sway.advance(1 / 30)); // 4 s
    expect(Math.max(...xs)).toBeCloseTo(150, 0);
    expect(Math.min(...xs)).toBeCloseTo(-150, 0);
    expect(xs[89]).toBeCloseTo(xs[29], 6); // 60 updates = 2 s apart
  });

  it('advances no further than the runtime simulates after a stalled frame', () => {
    const sway = new EmitterSway(2, 0.05);
    sway.amplitude = 100;
    expect(sway.advance(5)).toBeCloseTo(swayX(0.05, 100, 2));
  });

  it('ignores a negative or NaN step', () => {
    const sway = new EmitterSway(2, 0.05);
    sway.amplitude = 100;
    sway.advance(-1);
    expect(sway.advance(Number.NaN)).toBe(0);
  });
});
