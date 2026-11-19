import skeletonUrl from '../assets/HalloweenCreature/CreatureScene/HalloweenCreature.skel?url';
import atlasUrl from '../assets/HalloweenCreature/CreatureScene/HalloweenCreature.atlas?url';
import imageUrl from '../assets/HalloweenCreature/CreatureScene/HalloweenCreature.png?url';
import type { SpinePlayback } from './spineAnimation';
import type { SheetGrid } from './bakeSkullSheet';

export const SPINE_URLS = { skeleton: skeletonUrl, atlas: atlasUrl, image: imageUrl };
export const SKULL: SpinePlayback = { skin: 'skull', animation: 'still', loop: true };
// 40 frames over the 1.28 s 'still' loop is ~31 fps, as in particles_demo. Pylinka plays an atlas's columns as the
// animation and uses its rows for variants, so the frames sit in one row (40 x 96 = 3,840 px, within any desktop
// GPU's texture limit); 96 px cells stay sharp at the largest (90 px) skulls.
export const SHEET_GRID: SheetGrid = { frames: 40, cellPx: 96 };
