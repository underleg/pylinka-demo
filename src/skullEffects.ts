import type { ParamDef, PylinkaProject, System } from '@pylinka/graph';
import { GraphBuilder, type KnobInput, type PortRef } from './graphBuilder';

// The three emitter setups from particles_demo, rebuilt as Pylinka node graphs. Particlr is configured with module
// settings (a cone shape, a gravity vector, a size curve); Pylinka has none of those, only nodes, so each behaviour
// below is spelled out as the few nodes that compute it. The tuned numbers are particles_demo's (src/skullLayer.ts).

export const SETUPS = ['cascade', 'birds', 'swirl'] as const;
export type Setup = (typeof SETUPS)[number];

// The one system in every project; the app looks it up by this name.
export const SYSTEM = 'skulls';

// Pylinka draws a particle whose scale is 1 as an 8 px quad (BASE_SPRITE_PX in @pylinka/core), so a size in px is
// written as px / 8.
const SPRITE_PX = 8;
const DEG = Math.PI / 180;

// Values that depend on the window, set by the app through Pylinka's knobs (live uniforms: no rebuild).
export const KNOBS = {
  birdsExit: 'birdsExit', // vec2: birds die once x or y passes this (world px); x is just off the right edge
  attractorA: 'attractorA', // vec2: the swirl's two attractors (world px)
  attractorB: 'attractorB',
  attractorRadius: 'attractorRadius', // f32: where each attractor's pull fades to nothing (px)
} as const;

// --- Cascade ---------------------------------------------------------------------------------------------------------

// Collision plane below the emitter (y down). Pylinka collides particle *centres*, so anything drawing the floor must
// sit lower by about half a skull, or skulls appear to sink into it.
export const FLOOR_Y = 80;
export const GRAVITY = 450; // px/s²; light, so the arc is floaty and lands in time for a bounce or two
const BOUNCE = 0.55; // share of vertical speed kept on each bounce
const FLOOR_FRICTION = 0.2; // share of sideways speed lost on each bounce

export const LIFE_MIN = 2.5; // seconds
export const LIFE_MAX = 3.5;
const FADE_IN = 0.15; // fraction of life
const FADE_OUT_SECONDS = 0.25;
const PEAK_ALPHA = 0.9;
const SIZE_MIN = 56; // px at full size; skulls grow from half this over life
const SIZE_MAX = 80;
const SPEED_MIN = 300; // px/s
const SPEED_MAX = 360;
const FAN = 30; // degrees, centred on straight up

// particles_demo gives a skull a new random spin each time it hits the floor. That needs per-particle state on the
// CPU, which Pylinka keeps on the GPU, so here each skull gets one random spin that starts at the time a skull
// typically first lands: launched at 290-360 px/s upward against 450 px/s², a skull reaches the floor 80 px below in
// 1.52-1.80 s. Still in the air before that, as in particles_demo.
export const SPIN_MIN = 90; // deg/s
export const SPIN_MAX = 360;
export const SPIN_FROM = 1.65; // seconds of age

// --- Swirl -----------------------------------------------------------------------------------------------------------

// Both attractors pull straight at their point with the same strength and smooth falloff, so neither wins.
export const ATTRACTOR_STRENGTH = 3000; // px/s² at the point, easing smoothly to 0 at the radius
// The radius is this multiple of the emitter-to-attractor distance, so skulls launched from the emitter are always
// inside the pull whatever the window size.
export const ATTRACTOR_REACH = 1.2;
// Mild drag lets a pulled skull spiral in rather than swing straight through the point and out again.
const SWIRL_DRAG = 1;

// --- Birds -----------------------------------------------------------------------------------------------------------

export const BIRD_BAND = 300; // px height of the spawn line; birds keep their height, so this is the flock's height
export const BIRD_SPEED_MIN = 40; // px/s
export const BIRD_SPEED_MAX = 120;
export const BIRD_SIZE = 90; // px, the fastest bird; the slowest is 35% of this
const BIRD_SIZE_SLOWEST = 0.35;
// Longer than the slowest crossing of any screen, so lifetime never ends a flight; the exit does.
const BIRD_LIFE = 600;

// --- Projects --------------------------------------------------------------------------------------------------------

// A project for one setup holding `count` skulls alive at once. Pylinka fixes a pool's size when it is built, so a
// new count means a new project and runtime.
export function skullProject(setup: Setup, count: number): PylinkaProject {
  const builders: Record<Setup, (b: GraphBuilder) => void> = { cascade, birds, swirl };
  const graph = new GraphBuilder();
  builders[setup](graph);
  const system: System = {
    id: 's1',
    name: SYSTEM,
    capacity: count,
    // Skulls are opaque art: additive blending would make them glow and show through each other.
    blendMode: 'normal',
    enabled: true,
    space: 'world',
    emitter: { mode: 'flow', rate: birthRate(setup, count) },
    graph: { nodes: graph.nodes, edges: graph.edges },
  };
  const now = new Date(0).toISOString(); // fixed, so a project is the same each time it's built
  return {
    format: 'pylinka/v1',
    version: 1,
    catalogVersion: 1,
    id: `skulls-${setup}`,
    name: `Skulls: ${setup}`,
    createdAt: now,
    updatedAt: now,
    params: PARAMS[setup],
    assets: [],
    systems: [system],
  };
}

// The pool's capacity holds the count, so births are set to outpace deaths and the full pool just drops the extra.
export function birthRate(setup: Setup, count: number): number {
  return setup === 'birds'
    ? // A bird takes several seconds to cross, so births of half the flock per second far outpace departures, and
      // each bird that exits right is replaced on the left within a frame or two.
      count / 2
    : // Births outpace deaths by half again (rate x mean life = 1.5 x count); with only a small margin the count
      // sags below the cap between births.
      (1.5 * count) / ((LIFE_MIN + LIFE_MAX) / 2);
}

const param = (id: string, name: string, type: 'f32' | 'vec2'): ParamDef => ({
  id,
  name,
  type,
  scale: 'linear',
  default: type === 'f32' ? { t: 'f32', v: 1 } : { t: 'vec2', v: [0, 0] },
});

const PARAMS: Record<Setup, ParamDef[]> = {
  cascade: [],
  birds: [param('p1', KNOBS.birdsExit, 'vec2')],
  swirl: [
    param('p1', KNOBS.attractorA, 'vec2'),
    param('p2', KNOBS.attractorB, 'vec2'),
    param('p3', KNOBS.attractorRadius, 'f32'),
  ],
};
const paramId = (setup: Setup, name: string): string => {
  const found = PARAMS[setup].find((p) => p.name === name);
  if (!found) throw new Error(`No knob "${name}" in the ${setup} project`);
  return found.id;
};

// --- Graphs ----------------------------------------------------------------------------------------------------------
// Pylinka evaluates a graph in two passes: once at birth (spawn position, life, velocity) and every frame after
// (forces, size, alpha, rotation). A random node's value is only stable within one pass, so every random used after
// birth is drawn in the per-frame pass, never shared with the birth pass.

function cascade(b: GraphBuilder): void {
  fountain(b);
  b.add('output.addForce', { force: b.add('field.gravity', { g: [0, GRAVITY] }, undefined, 'force') });
  b.add(
    'output.collidePlane',
    { point: [0, FLOOR_Y], normal: [0, -1], restitution: BOUNCE, friction: FLOOR_FRICTION },
    // Relative to the emitter, so the floor stays 80 px below it wherever the app puts it.
    { space: 'emitter' },
  );
  // Random tilt, plus a random spin (90-360 °/s either way) once the skull has landed.
  const tilt = b.add('gen.randomRange', { min: -Math.PI, max: Math.PI });
  const coin = b.add('math.sub', { a: b.add('gen.random'), b: 0.5 });
  const direction = b.add('math.div', { a: coin, b: b.add('math.abs', { x: coin }) }); // -1 or +1
  const rate = b.add('math.mul', { a: b.add('gen.randomRange', { min: SPIN_MIN * DEG, max: SPIN_MAX * DEG }), b: direction });
  const spinning = b.add('math.max', { a: b.add('math.sub', { a: b.add('input.age'), b: SPIN_FROM }), b: 0 });
  b.add('output.writeRotation', { rot: b.add('math.mad', { a: rate, b: spinning, c: tilt }) }, { unit: 'radians' });
}

function swirl(b: GraphBuilder): void {
  fountain(b);
  b.add('output.drag', { drag: b.add('field.drag', { coefficient: SWIRL_DRAG }, undefined, 'drag') });
  attractor(b, paramId('swirl', KNOBS.attractorA));
  attractor(b, paramId('swirl', KNOBS.attractorB));
  // A random tilt and no spin: with no floor there is nothing to spin them.
  b.add('output.initRotation', { rot: b.add('gen.randomRange', { min: -Math.PI, max: Math.PI }) }, { unit: 'radians' });
}

function birds(b: GraphBuilder): void {
  // A vertical line at the emitter; each bird flies right at its own speed and keeps its height.
  const line = b.add('shape.polygonalChain', { start: [0, -BIRD_BAND / 2], end: [0, BIRD_BAND / 2] }, undefined, 'pos');
  b.add('output.spawnPosition', { pos: line });
  b.add('output.initLife', { life: BIRD_LIFE });
  const speed = b.add('gen.randomRange', { min: BIRD_SPEED_MIN, max: BIRD_SPEED_MAX });
  b.add('output.initVelocity', { vel: b.add('math.makeVec2', { x: speed, y: 0 }) });
  // Size follows speed, so smaller birds are slower and read as further away. Speed is read back from the velocity:
  // birds feel no forces, so it never changes.
  const speedNow = b.add('math.length', { v: b.add('input.velocity') });
  const t = b.add('math.clamp', {
    x: b.add('math.div', { a: b.add('math.sub', { a: speedNow, b: BIRD_SPEED_MIN }), b: BIRD_SPEED_MAX - BIRD_SPEED_MIN }),
    min: 0,
    max: 1,
  });
  const smallest = (BIRD_SIZE * BIRD_SIZE_SLOWEST) / SPRITE_PX;
  b.add('output.writeScale', { scale: b.add('math.mix', { a: smallest, b: BIRD_SIZE / SPRITE_PX, t }) });
  // Birds die only on reaching the exit just past the right edge, which the app moves as the window resizes.
  const exit: KnobInput = { knob: paramId('birds', KNOBS.birdsExit), value: [1e6, 1e6] };
  b.add('output.killIfOutOfRect', { min: [-1e6, -1e6], max: exit });
}

// A 30° fan of skulls fired up from the emitter, growing as they age and fading in and out. Shared by cascade and
// swirl, which differ only in what pulls the skulls once they are moving.
function fountain(b: GraphBuilder): void {
  b.add('output.spawnPosition', { pos: b.add('shape.point', { offset: [0, 0] }, undefined, 'pos') });
  b.add('output.initLife', { life: b.add('gen.randomRange', { min: LIFE_MIN, max: LIFE_MAX }) });
  // A speed along +x, turned to a random angle in the fan (-90° is straight up: y is down).
  const speed = b.add('gen.randomRange', { min: SPEED_MIN, max: SPEED_MAX });
  const angle = b.add('gen.randomRange', { min: (-90 - FAN / 2) * DEG, max: (-90 + FAN / 2) * DEG });
  const velocity = b.add('math.rotate2d', { v: b.add('math.makeVec2', { x: speed, y: 0 }), angle });
  b.add('output.initVelocity', { vel: velocity });

  // Grow from half size to full over life, so skulls start small at the emitter and are largest at the end.
  const size = b.add('gen.randomRange', { min: SIZE_MIN / SPRITE_PX, max: SIZE_MAX / SPRITE_PX });
  const growth = b.add('gen.scaleOverLife', { from: 0.5, to: 1 }, { ease: 'power1.in' });
  b.add('output.writeScale', { scale: b.add('math.mul', { a: size, b: growth }) });

  // Fade in over the first 15% of life, hold, then fade out over the end. Like particles_demo's gradient this works
  // in fractions of each skull's own life, so placing the fade against the longest life makes it 179-250 ms.
  const age = b.add('input.ageNormalized');
  const fadeIn = clamp01(b, b.add('math.div', { a: age, b: FADE_IN }));
  const left = b.add('math.sub', { a: 1, b: age });
  const fadeOut = clamp01(b, b.add('math.div', { a: left, b: FADE_OUT_SECONDS / LIFE_MAX }));
  const alpha = b.add('math.mul', { a: b.add('math.mul', { a: fadeIn, b: fadeOut }), b: PEAK_ALPHA });
  b.add('output.writeAlpha', { alpha });
}

// Pulls straight at a knob's point at up to ATTRACTOR_STRENGTH, easing smoothly (smoothstep) to nothing at the
// radius knob. field.radial pushes away from its centre at a given strength, so a negative strength pulls; the
// falloff is computed from the particle's distance to the point and fed in as that strength.
function attractor(b: GraphBuilder, pointParamId: string): void {
  const point: KnobInput = { knob: pointParamId, value: [0, 0] };
  const position = b.add('input.position');
  const axis = (v: PortRef | KnobInput, index: 'x' | 'y') => b.add('math.component', { v }, { index });
  const dx = b.add('math.sub', { a: axis(point, 'x'), b: axis(position, 'x') });
  const dy = b.add('math.sub', { a: axis(point, 'y'), b: axis(position, 'y') });
  const distance = b.add('math.length', { v: b.add('math.makeVec2', { x: dx, y: dy }) });
  const radius: KnobInput = { knob: paramId('swirl', KNOBS.attractorRadius), value: 1 };
  const w = clamp01(b, b.add('math.sub', { a: 1, b: b.add('math.div', { a: distance, b: radius }) }));
  const smooth = b.add('math.mul', { a: b.add('math.mul', { a: w, b: w }), b: b.add('math.mad', { a: -2, b: w, c: 3 }) });
  const strength = b.add('math.mul', { a: smooth, b: -ATTRACTOR_STRENGTH });
  b.add('output.addForce', { force: b.add('field.radial', { center: point, strength }, undefined, 'force') });
}

function clamp01(b: GraphBuilder, x: PortRef): PortRef {
  return b.add('math.clamp', { x, min: 0, max: 1 });
}
