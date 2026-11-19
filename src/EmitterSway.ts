// Emitter x offset at time t: a sine wave of the given period and amplitude, starting at the centre moving right.
export function swayX(seconds: number, amplitude: number, periodSeconds: number): number {
  return amplitude * Math.sin((2 * Math.PI * seconds) / periodSeconds);
}

// Swings an emitter back and forth along x. Keeps its own clock so a rebuilt emitter starts at the centre.
export class EmitterSway {
  amplitude = 0; // px either side of centre; set by the host from the screen width
  private seconds = 0;
  private readonly periodSeconds: number;
  private readonly maxStep: number;

  // `maxStep` is the runtime's dt clamp: Pylinka never simulates more than that per update, so the wave mustn't
  // advance further either or it would run ahead of the skulls after a stalled frame.
  constructor(periodSeconds: number, maxStep: number) {
    this.periodSeconds = periodSeconds;
    this.maxStep = maxStep;
  }

  // Advances the wave by one update's seconds and returns the emitter's x offset from centre.
  advance(seconds: number): number {
    if (seconds > 0) this.seconds += Math.min(seconds, this.maxStep); // false for NaN too, which would stick

    return swayX(this.seconds, this.amplitude, this.periodSeconds);
  }
}
