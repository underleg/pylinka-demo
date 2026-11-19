import { describe, expect, it } from 'vitest';
import { formatPerf, PerfWindow } from './perf';

describe('formatPerf', () => {
  it('uses the abbreviated layout, with thousands separators and one-decimal frame time', () => {
    const line = formatPerf({
      fps: 30, drawCalls: 12, emitters: 4, particles: 1250, maxParticles: 1320, frameTimeMs: 8.44,
    });
    expect(line).toBe('FPS 30 | DC 12 | Em 4 | Pt 1,250 | Max 1,320 | FT 8.4ms');
  });

  it('rounds averaged FPS and draw calls to whole numbers', () => {
    const line = formatPerf({ fps: 59.6, drawCalls: 3.4, emitters: 0, particles: 0, maxParticles: 0, frameTimeMs: 0 });
    expect(line).toContain('FPS 60 | DC 3 |');
  });

  it('shows n/a when draw calls cannot be counted', () => {
    const line = formatPerf({ fps: 60, drawCalls: null, emitters: 1, particles: 1, maxParticles: 1, frameTimeMs: 1 });
    expect(line).toContain('DC n/a');
  });
});

describe('PerfWindow', () => {
  it('returns null until the window has elapsed', () => {
    const w = new PerfWindow(0, 500);
    w.addFrame(2, 3);
    expect(w.flush(499)).toBeNull();
  });

  it('returns null for an elapsed window with no frames rather than dividing by zero', () => {
    expect(new PerfWindow(0, 500).flush(1000)).toBeNull();
  });

  it('averages the frames in the window, then starts a fresh one', () => {
    const w = new PerfWindow(0, 500);
    for (let i = 0; i < 15; i++) w.addFrame(i % 2 === 0 ? 4 : 6, 3); // 8 frames at 4ms, 7 at 6ms
    expect(w.flush(500)).toEqual({ fps: 30, drawCalls: 3, frameTimeMs: (8 * 4 + 7 * 6) / 15 });

    w.addFrame(10, 1);
    expect(w.flush(1000)).toEqual({ fps: 2, drawCalls: 1, frameTimeMs: 10 });
  });
});
