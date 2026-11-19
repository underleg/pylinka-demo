import { Assets } from 'pixi.js';
import { Spine, SkinsAndAnimationBoundsProvider } from '@esotericsoftware/spine-pixi-v8';

// All three URLs are passed explicitly (not derived from the atlas location) because Vite fingerprints each file
// in a build, so the image is no longer beside the atlas under the name the atlas records.
export interface SpineAssetUrls {
  skeleton: string;
  atlas: string;
  image: string;
}

export interface SpinePlayback {
  skin: string;
  animation: string;
  loop: boolean;
}

// Loaded once; every instance made by createSpine afterwards shares the parsed skeleton and atlas.
// The runtime must match the editor's major.minor: these exports are Spine 4.2, as is @esotericsoftware/spine-pixi-v8 4.2.x.
export async function loadSpineAssets(urls: SpineAssetUrls): Promise<void> {
  await Assets.load([
    { alias: urls.skeleton, src: urls.skeleton },
    { alias: urls.atlas, src: urls.atlas, data: { images: urls.image } },
  ]);
}

// Never self-animating: the skull particles and the flipbook bake each pose it at an exact time with poseAt.
export function createSpine(urls: SpineAssetUrls, playback: SpinePlayback): Spine {
  const spine = Spine.from({
    skeleton: urls.skeleton,
    atlas: urls.atlas,
    autoUpdate: false,
    // Without a provider, bounds come only from bounding-box (hit-box) attachments, not the drawn images. This one
    // covers every frame of the animation, so the bounds are fixed and the skeleton never outgrows its layout box.
    boundsProvider: new SkinsAndAnimationBoundsProvider(playback.animation, [playback.skin]),
  });
  spine.skeleton.setSkinByName(playback.skin);
  spine.skeleton.setSlotsToSetupPose();
  spine.state.setAnimation(0, playback.animation, playback.loop);
  // Pose the first frame now so bounds measured before the first tick match what will be drawn.
  spine.update(0);
  return spine;
}

// Poses a manually driven instance at a time along its animation; loops wrap inside Spine.
export function poseAt(spine: Spine, seconds: number): void {
  const entry = spine.state.getCurrent(0);
  if (!entry) throw new Error('Spine instance has no animation on track 0');
  entry.trackTime = seconds;
  spine.update(0);
}

export function animationDuration(spine: Spine): number {
  const animation = spine.state.getCurrent(0)?.animation;
  if (!animation) throw new Error('Spine instance has no animation on track 0');
  return animation.duration;
}

export function localBounds(spine: Spine): { x: number; y: number; width: number; height: number } {
  // Copied because Pixi reuses the returned Bounds object.
  const { x, y, width, height } = spine.getLocalBounds();
  return { x, y, width, height };
}
