import type { Renderer } from 'pixi.js';
import { createPylinka, type ParticleSystemView, type PylinkaRuntime, type TextureInput } from '@pylinka/core/pixi';
import { FACING_RIGHT, type SkullSheet } from './bakeSkullSheet';
import { EmitterSway } from './EmitterSway';
import { skullProject, SYSTEM, type Setup } from './skullEffects';

// Pylinka's default dt clamp. The birds use a larger one only so their warm-up can take big steps (see warmUp).
const MAX_DT = 0.05;
const BIRDS_MAX_DT = 0.25;
// Pylinka runs at most this many queued updates per render, dropping older ones (MAX_QUEUED_STEPS in @pylinka/core).
const STEPS_PER_RENDER = 4;
// Swirl's emitter swings this fraction of the window width either side of centre, once every SWAY_PERIOD seconds.
export const SWIRL_SWAY = 0.25;
const SWAY_PERIOD = 2;

// One setup's Pylinka runtime and its single skull system. Setups are built once per count and kept, so switching
// between them is instant; a hidden setup's view isn't rendered, so Pylinka doesn't simulate it and it resumes where
// it was.
export class SkullEmitter {
  readonly setup: Setup;
  readonly fx: PylinkaRuntime;
  readonly system: ParticleSystemView;
  // The swirl's emitter swings either side of its centre; the others stay put.
  readonly sway: EmitterSway | null;
  private centre = { x: 0, y: 0 };

  private constructor(setup: Setup, fx: PylinkaRuntime) {
    this.setup = setup;
    this.fx = fx;
    const system = fx.systems[SYSTEM];
    if (!system) throw new Error(`No system "${SYSTEM}" in the ${setup} project`);
    this.system = system;
    this.sway = setup === 'swirl' ? new EmitterSway(SWAY_PERIOD, MAX_DT) : null;
  }

  static async create(renderer: Renderer, setup: Setup, count: number, sheet: SkullSheet): Promise<SkullEmitter> {
    const fx = await createPylinka(skullProject(setup, count), {
      renderer,
      textures: { [SYSTEM]: skullTexture(setup, sheet) },
      maxDt: setup === 'birds' ? BIRDS_MAX_DT : MAX_DT,
    });
    return new SkullEmitter(setup, fx);
  }

  get view(): ParticleSystemView['view'] {
    return this.system.view;
  }

  // Where the emitter sits (world px); for the swirl, the centre of its swing.
  placeEmitter(x: number, y: number): void {
    this.centre = { x, y };
    this.system.setEmitterPosition(x, y);
  }

  step(seconds: number): void {
    if (this.sway) this.system.setEmitterPosition(this.centre.x + this.sway.advance(seconds), this.centre.y);
    this.fx.update(seconds);
  }

  // Simulates ahead, for a setup whose steady state takes longer to reach than Pylinka's prewarm (capped at 10 s).
  // Pylinka only simulates when it renders, running at most STEPS_PER_RENDER queued updates each time, so this queues
  // that many and has the caller render, until `seconds` have passed. Call while the view is shown.
  warmUp(seconds: number, render: () => void): void {
    const step = this.setup === 'birds' ? BIRDS_MAX_DT : MAX_DT;
    for (let t = 0; t < seconds; t += step * STEPS_PER_RENDER) {
      for (let i = 0; i < STEPS_PER_RENDER; i++) this.step(step);
      render();
    }
  }

  destroy(): void {
    this.view.removeFromParent();
    this.fx.destroy();
  }
}

// The skull flipbook. Pylinka plays the sheet's columns over time and picks a row per particle: the fountains face
// left or right at random; the birds all face right, the way they fly.
function skullTexture(setup: Setup, sheet: SkullSheet): TextureInput {
  const flipbook = { image: sheet.image, cols: sheet.cols, rows: sheet.rows, fps: sheet.fps, play: 'loop' as const };
  return setup === 'birds'
    ? { ...flipbook, pick: 'per-spawn', row: FACING_RIGHT }
    : { ...flipbook, pick: 'per-particle' };
}
