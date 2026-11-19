import { Container, RenderTexture, type Renderer } from 'pixi.js';
import type { Spine } from '@esotericsoftware/spine-pixi-v8';
import { fitInBox, type Rect } from './layout';
import { animationDuration, localBounds, poseAt } from './spineAnimation';

export interface SheetGrid {
  frames: number;
  cellPx: number; // bake resolution: particles drawn larger than this blur
}

// Atlas rows. Pylinka can't mirror a particle (its scale is a single number), so the sheet carries the skull both
// ways round and each particle picks a row: at random for a 50/50 mix, or a fixed row for a flock that all faces one
// way. The art itself faces left.
export const FACING_LEFT = 0;
export const FACING_RIGHT = 1;

export interface SkullSheet {
  image: HTMLCanvasElement;
  cols: number;
  rows: number;
  fps: number;
}

// Renders one loop of a manually driven Spine instance's animation into a row of cells, then adds a mirrored copy of
// that row below it. Frames are evenly spaced over the loop and the fps is set so one pass through the row takes
// exactly one loop of the animation.
export function bakeSkullSheet(renderer: Renderer, spine: Spine, grid: SheetGrid): SkullSheet {
  const duration = animationDuration(spine);
  // The whole animation's bounds, so every frame uses the same fit and the skull doesn't jitter between cells.
  const bounds = localBounds(spine);
  const target = RenderTexture.create({ width: grid.frames * grid.cellPx, height: grid.cellPx });
  const stage = new Container();
  stage.addChild(spine);

  for (let i = 0; i < grid.frames; i++) {
    poseAt(spine, (i * duration) / grid.frames);
    const cell: Rect = { x: i * grid.cellPx, y: 0, width: grid.cellPx, height: grid.cellPx };
    const placement = fitInBox(bounds, cell);
    spine.scale.set(placement.scale);
    spine.position.set(placement.x, placement.y);
    renderer.render({ container: stage, target, clear: i === 0 });
  }

  const row = renderer.extract.canvas(target) as HTMLCanvasElement;
  stage.removeChild(spine);
  stage.destroy();
  target.destroy(true);
  return { image: withMirroredRow(row, grid), cols: grid.frames, rows: 2, fps: grid.frames / duration };
}

// Each cell is mirrored in place, so frame i is still in column i and both rows animate in step.
function withMirroredRow(row: HTMLCanvasElement, grid: SheetGrid): HTMLCanvasElement {
  const sheet = document.createElement('canvas');
  sheet.width = row.width;
  sheet.height = row.height * 2;
  const ctx = sheet.getContext('2d');
  if (!ctx) throw new Error('Could not get a 2D context to build the skull sheet');
  // Measured from the canvas rather than taken from the grid, in case the extract came back at a higher resolution.
  const cellPx = row.height;
  ctx.drawImage(row, 0, FACING_LEFT * cellPx);
  for (let i = 0; i < grid.frames; i++) {
    ctx.save();
    ctx.translate((i + 1) * cellPx, FACING_RIGHT * cellPx);
    ctx.scale(-1, 1);
    ctx.drawImage(row, i * cellPx, 0, cellPx, cellPx, 0, 0, cellPx, cellPx);
    ctx.restore();
  }
  return sheet;
}
