export interface PerfStats {
  fps: number;
  drawCalls: number | null; // null when the renderer isn't WebGL and calls can't be counted
  emitters: number;
  particles: number;
  maxParticles: number;
  frameTimeMs: number;
}

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatPerf(s: PerfStats): string {
  const drawCalls = s.drawCalls === null ? 'n/a' : integer.format(s.drawCalls);
  // Abbreviated to fit one line on narrow windows; the full names are in #perf's tooltip in index.html.
  return [
    `FPS ${integer.format(s.fps)}`,
    `DC ${drawCalls}`,
    `Em ${integer.format(s.emitters)}`,
    `Pt ${integer.format(s.particles)}`,
    `Max ${integer.format(s.maxParticles)}`,
    `FT ${s.frameTimeMs.toFixed(1)}ms`,
  ].join(' | ');
}

export interface WindowAverages {
  fps: number;
  drawCalls: number;
  frameTimeMs: number;
}

// Averages over a short window: per-frame figures flicker too fast to read and updating the DOM every frame costs time itself.
export class PerfWindow {
  private frames = 0;
  private workMs = 0;
  private drawCalls = 0;

  constructor(
    private startMs: number,
    private readonly lengthMs = 500,
  ) {}

  addFrame(workMs: number, drawCalls: number): void {
    this.frames++;
    this.workMs += workMs;
    this.drawCalls += drawCalls;
  }

  // Returns the window's averages and starts a new window, or null while the window is still filling.
  flush(nowMs: number): WindowAverages | null {
    const elapsed = nowMs - this.startMs;
    if (elapsed < this.lengthMs || this.frames === 0) return null;
    const averages = {
      fps: (this.frames * 1000) / elapsed,
      drawCalls: this.drawCalls / this.frames,
      frameTimeMs: this.workMs / this.frames,
    };
    this.startMs = nowMs;
    this.frames = this.workMs = this.drawCalls = 0;
    return averages;
  }
}
