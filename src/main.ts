import { Application, Graphics, UPDATE_PRIORITY, WebGLRenderer } from 'pixi.js';
import { registerPylinka } from '@pylinka/core/pixi';
import { bindSelect } from './bindSelect';
import { bakeSkullSheet, type SkullSheet } from './bakeSkullSheet';
import { countDrawCalls } from './drawCalls';
import { bandPoint, effectCentre, type Point } from './layout';
import { formatPerf, PerfWindow } from './perf';
import { SHEET_GRID, SKULL, SPINE_URLS } from './skullArt';
import { SkullEmitter, SWIRL_SWAY } from './SkullEmitter';
import { ATTRACTOR_REACH, BIRD_SIZE, FLOOR_Y, KNOBS, SETUPS, type Setup } from './skullEffects';
import { createSpine, loadSpineAssets } from './spineAnimation';

const INFO = ['hidden', 'shown'] as const;
// Pylinka has no per-emitter cap like Particlr's 10,000, so the menu goes one step further.
const COUNTS = ['10', '100', '1000', '10000', '100000'] as const;

// Pylinka bounces skull centres off FLOOR_Y, so the floor is drawn below that by roughly half a landed skull
// (measured by eye in particles_demo). Tilted skulls reach further in some directions, so a few overlap the line.
const FLOOR_DRAW_OFFSET = 18;
// The fountain rises ~170 px above the emitter but lands only ~100 px below it, so lower the emitter to centre the
// whole picture in the open band rather than the emitter itself.
const EMITTER_DROP = 35;
// Birds spawn and are removed this far beyond the screen edges, so they enter and leave wholly off screen.
const BIRD_OFFSCREEN = BIRD_SIZE / 2 + 5;
// The slowest bird (40 px/s) takes ~20 s to cross a wide screen; simulate that far ahead so the flock opens spread
// right across, not bunched at the left edge.
const BIRD_WARM_UP_SECONDS = 40;
// Swirl's emitter sits this far down the open band (the attractors are at half way).
const SWIRL_EMITTER_Y = 0.85;

function requireElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) throw new Error(`Missing #${id} (${type.name}) in index.html`);
  return element;
}

// Show a fatal error on the page too: otherwise a failure is just an empty dark screen.
function showFatal(error: unknown): void {
  console.error(error);
  const message = document.createElement('pre');
  message.id = 'error';
  message.textContent = error instanceof Error ? error.message : String(error);
  document.body.appendChild(message);
}

// Bakes the Spine skull's loop into the flipbook sheet every setup draws with. Particlr's version of this demo baked
// it once into its effect files; Pylinka takes the image at runtime, so it is baked here at startup instead.
async function bakeSkulls(app: Application): Promise<SkullSheet> {
  await loadSpineAssets(SPINE_URLS);
  const spine = createSpine(SPINE_URLS, SKULL);
  const sheet = bakeSkullSheet(app.renderer, spine, SHEET_GRID);
  spine.destroy();
  return sheet;
}

// Frame time is the CPU work of one frame (update + Pixi's render submit, which is where Pylinka's GPU step is
// encoded), not the gap between frames: the first callback runs before everything else on the ticker, the last after
// Pixi's render (UPDATE_PRIORITY.LOW). `current` is read every frame because the menu can switch or rebuild the setup.
function startPerfReadout(app: Application, current: () => SkullEmitter | null, line: HTMLElement): void {
  // Draw calls can only be counted on WebGL; WebGL is requested, but Pixi may still fall back.
  const takeDrawCalls = app.renderer instanceof WebGLRenderer ? countDrawCalls(app.renderer.gl) : null;
  const perfWindow = new PerfWindow(performance.now());
  let frameStart = 0;
  let maxParticles = 0;
  let measured: SkullEmitter | null = null;

  app.ticker.add(() => (frameStart = performance.now()), undefined, UPDATE_PRIORITY.INTERACTION);
  app.ticker.add(
    () => {
      const emitter = current();
      if (!emitter) return; // a setup is being built; the line shows that instead
      // The peak is per setup: carrying one setup's peak over to another would misreport it.
      if (emitter !== measured) [measured, maxParticles] = [emitter, 0];
      const now = performance.now();
      perfWindow.addFrame(now - frameStart, takeDrawCalls?.() ?? 0);
      // Pylinka reads its live count back from the GPU every 30 frames, so this lags by up to half a second.
      const particles = emitter.system.stats.aliveCount;
      maxParticles = Math.max(maxParticles, particles);

      const averages = perfWindow.flush(now);
      if (!averages) return;
      line.textContent = formatPerf({
        ...averages,
        drawCalls: takeDrawCalls ? averages.drawCalls : null,
        emitters: 1,
        particles,
        maxParticles,
      });
    },
    undefined,
    UPDATE_PRIORITY.UTILITY,
  );
}

async function main(): Promise<void> {
  const top = requireElement('top', HTMLElement);
  const info = requireElement('info', HTMLElement);
  const perfLine = requireElement('perf', HTMLElement);
  const emitterSelect = requireElement('select-emitter', HTMLSelectElement);
  const countSelect = requireElement('select-count', HTMLSelectElement);
  const infoSelect = requireElement('select-info', HTMLSelectElement);

  registerPylinka(); // once, before app.init: installs Pylinka's render pipe
  const app = new Application();
  // WebGL: Pylinka 2.1.0's WebGPU path needs pixi.js 8.19.0 exactly (8.20+ removed encoder.restoreRenderPass), and
  // draw calls can only be counted on WebGL.
  await app.init({ resizeTo: window, background: '#0b0b14', antialias: true, preference: 'webgl' });
  document.body.appendChild(app.canvas);

  perfLine.textContent = 'Baking skulls…';
  const sheet = await bakeSkulls(app);

  const floor = new Graphics();
  app.stage.addChild(floor); // first, so skulls draw over it

  const state = { setup: 'cascade' as Setup, count: 100 };
  // Setups built for the current count, made on first show. A count change destroys them: a Pylinka pool's capacity
  // is fixed when its system is built, so a new count needs a new runtime.
  const built = new Map<Setup, SkullEmitter>();
  let active: SkullEmitter | null = null;

  // A point at fractions of the open band. offsetHeight is 0 while the footer is hidden, so effects take that space.
  const band = (fx: number, fy: number) =>
    bandPoint(app.screen.width, app.screen.height, top.offsetHeight, info.offsetHeight, fx, fy);
  const placeFor: Record<Setup, (emitter: SkullEmitter) => void> = {
    cascade: (emitter) => {
      const centre = band(0.5, 0.5);
      emitter.placeEmitter(centre.x, centre.y + EMITTER_DROP);
    },
    birds: (emitter) => {
      // The spawn line sits just off the left edge; the exit is just off the right edge.
      emitter.placeEmitter(-BIRD_OFFSCREEN, band(0.5, 0.5).y);
      emitter.fx.params.set(KNOBS.birdsExit, app.screen.width + BIRD_OFFSCREEN, 1e6);
    },
    swirl: (emitter) => {
      const centre = band(0.5, SWIRL_EMITTER_Y);
      emitter.placeEmitter(centre.x, centre.y);
      if (emitter.sway) emitter.sway.amplitude = app.screen.width * SWIRL_SWAY;
      const a = band(0.25, 0.5);
      const b = band(0.75, 0.5);
      const distance = (p: Point) => Math.hypot(p.x - centre.x, p.y - centre.y);
      // One radius for both, measured from the emitter's centre, so skulls launched there are always in the pull.
      emitter.fx.params.set(KNOBS.attractorA, a.x, a.y);
      emitter.fx.params.set(KNOBS.attractorB, b.x, b.y);
      emitter.fx.params.set(KNOBS.attractorRadius, ATTRACTOR_REACH * Math.max(distance(a), distance(b)));
    },
  };
  const layout = () => {
    built.forEach((emitter) => placeFor[emitter.setup](emitter));
    const centre = effectCentre(app.screen.width, app.screen.height, top.offsetHeight, info.offsetHeight);
    floor
      .clear()
      .rect(0, centre.y + EMITTER_DROP + FLOOR_Y + FLOOR_DRAW_OFFSET, app.screen.width, 2)
      .fill({ color: 0x6a5acd });
  };

  const build = async (setup: Setup): Promise<SkullEmitter> => {
    const emitter = await SkullEmitter.create(app.renderer, setup, state.count, sheet);
    app.stage.addChild(emitter.view);
    placeFor[setup](emitter);
    // After placing, so the flock flies to this screen's exit.
    if (setup === 'birds') emitter.warmUp(BIRD_WARM_UP_SECONDS, () => app.renderer.render(app.stage));
    return emitter;
  };

  const show = async () => {
    let emitter = built.get(state.setup);
    if (!emitter) {
      perfLine.textContent = `Building ${state.count.toLocaleString('en-US')} particles…`;
      // Let the browser paint the message before the build blocks the main thread.
      await new Promise((resolve) => requestAnimationFrame(resolve));
      emitter = await build(state.setup);
      built.set(state.setup, emitter);
    }
    built.forEach((e, setup) => (e.view.visible = setup === state.setup));
    floor.visible = state.setup === 'cascade';
    active = emitter;
  };
  // Menu changes run one at a time, so a change made while a setup is still building waits its turn: otherwise a
  // build started at the old count could finish after a count change and be kept.
  let queue = Promise.resolve();
  const enqueue = (task: () => void | Promise<void>) => {
    queue = queue.then(task).catch(showFatal);
  };
  const refresh = () => enqueue(show);

  bindSelect(infoSelect, INFO, (value) => {
    info.hidden = value === 'hidden';
    layout();
  });
  bindSelect(countSelect, COUNTS, (value) => {
    enqueue(() => {
      state.count = Number(value);
      active = null;
      built.forEach((emitter) => emitter.destroy());
      built.clear();
    });
    refresh();
  });
  bindSelect(emitterSelect, SETUPS, (value) => {
    state.setup = value;
    refresh();
  });
  app.renderer.on('resize', layout);

  // Only the shown setup is updated; Pylinka doesn't simulate hidden views anyway, so the others pause where they were.
  app.ticker.add((t) => active?.step(t.deltaMS / 1000));
  startPerfReadout(app, () => active, perfLine);
}

main().catch(showFatal);
