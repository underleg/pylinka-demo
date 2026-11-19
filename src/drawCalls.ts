const DRAW_METHODS = ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced'] as const;

type DrawMethod = (typeof DRAW_METHODS)[number];
export type DrawTarget = Record<DrawMethod, (...args: never[]) => void>;

// Pixi v8 keeps no draw-call count, so wrap the WebGL context's draw entry points and count what reaches the GPU.
// Returns a function that reads the count since its last call and resets it.
export function countDrawCalls(gl: DrawTarget): () => number {
  let count = 0;
  for (const name of DRAW_METHODS) {
    const original = gl[name].bind(gl) as (...args: never[]) => void;
    gl[name] = (...args: never[]) => {
      count++;
      original(...args);
    };
  }
  return () => {
    const taken = count;
    count = 0;
    return taken;
  };
}
