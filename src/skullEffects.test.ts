import { describe, expect, it } from 'vitest';
import { V1_CATALOG, validateGraph } from '@pylinka/graph';
import { compile } from '@pylinka/compiler';
import { birthRate, KNOBS, LIFE_MAX, LIFE_MIN, SETUPS, skullProject, SYSTEM } from './skullEffects';

const bundle = (setup: (typeof SETUPS)[number], count = 100) => {
  const project = skullProject(setup, count);
  return { system: project.systems[0], params: project.params, assets: project.assets };
};

describe('skullProject', () => {
  for (const setup of SETUPS) {
    it(`builds a ${setup} graph Pylinka's validator accepts, warning only that births outpace the pool`, () => {
      // The overflow is the design: births outpace deaths and the full pool holds the count (see birthRate).
      const codes = validateGraph(bundle(setup), V1_CATALOG).map((d) => d.code);
      expect(codes).toEqual(['W101_CAPACITY_OVERFLOW']);
    });

    it(`compiles the ${setup} graph for both GPU backends`, () => {
      for (const backend of ['webgl2', 'webgpu'] as const) {
        expect(() => compile(bundle(setup), V1_CATALOG, backend)).not.toThrow();
      }
    });
  }

  it('binds knobs onto ports and never reads them through param.ref', () => {
    // Pylinka 2.1.0's WebGL2 code generator types a param.ref output as a float even for a vec2 knob, so its shader
    // fails to compile in the browser; compile() above still succeeds, because it only emits the source.
    for (const setup of SETUPS) {
      const { nodes } = skullProject(setup, 10).systems[0].graph;
      expect(nodes.filter((n) => n.kind === 'param.ref')).toEqual([]);
    }
  });

  it('has one system, sized to the requested count, under the name the app looks up', () => {
    for (const setup of SETUPS) {
      const project = skullProject(setup, 10_000);
      expect(project.systems).toHaveLength(1);
      expect(project.systems[0].name).toBe(SYSTEM);
      expect(project.systems[0].capacity).toBe(10_000);
    }
  });

  it('declares exactly the knobs each setup needs for the window', () => {
    const names = (setup: (typeof SETUPS)[number]) => skullProject(setup, 10).params.map((p) => p.name).sort();
    expect(names('cascade')).toEqual([]);
    expect(names('birds')).toEqual([KNOBS.birdsExit]);
    expect(names('swirl')).toEqual([KNOBS.attractorA, KNOBS.attractorB, KNOBS.attractorRadius].sort());
  });

  it('builds the same project every time, so a rebuild is repeatable', () => {
    expect(skullProject('swirl', 100)).toEqual(skullProject('swirl', 100));
  });
});

describe('birthRate', () => {
  it('outpaces deaths by half again for the fountains, so the pool stays full', () => {
    const meanLife = (LIFE_MIN + LIFE_MAX) / 2;
    expect(birthRate('cascade', 1000) * meanLife).toBeCloseTo(1500);
    expect(birthRate('swirl', 1000) * meanLife).toBeCloseTo(1500);
  });

  it('births half the flock per second for the birds', () => {
    expect(birthRate('birds', 100_000)).toBe(50_000);
  });
});
