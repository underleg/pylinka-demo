import { describe, expect, it, vi } from 'vitest';
import { countDrawCalls, type DrawTarget } from './drawCalls';

function fakeGl(): DrawTarget {
  return { drawArrays: vi.fn(), drawElements: vi.fn(), drawArraysInstanced: vi.fn(), drawElementsInstanced: vi.fn() };
}

describe('countDrawCalls', () => {
  it('counts every kind of draw call and resets when read', () => {
    const gl = fakeGl();
    const take = countDrawCalls(gl);
    gl.drawArrays();
    gl.drawElements();
    gl.drawArraysInstanced();
    gl.drawElementsInstanced();
    expect(take()).toBe(4);
    expect(take()).toBe(0);
  });

  it('still forwards each call to the real method', () => {
    const original = vi.fn();
    const gl = { ...fakeGl(), drawElements: original };
    countDrawCalls(gl);
    (gl.drawElements as (...args: number[]) => void)(4, 6, 5123, 0);
    expect(original).toHaveBeenCalledWith(4, 6, 5123, 0);
  });
});
