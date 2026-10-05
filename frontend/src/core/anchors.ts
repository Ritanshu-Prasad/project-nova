import { Vector3, type Camera, type Object3D } from 'three';

/**
 * Screen positions (CSS px, viewport space) of 3D controls the tutorial points at.
 * The scene writes them every frame; the DOM reads them in its own rAF — no React renders.
 */
export interface Anchor {
  x: number;
  y: number;
  /** In front of the camera and inside the viewport. */
  visible: boolean;
}

export const anchors: Record<string, Anchor> = {};

const v = new Vector3();

/** Projects an object's world position (plus a local offset) to the screen and stores it under `key`. */
export function trackAnchor(key: string, obj: Object3D, camera: Camera, size: { width: number; height: number; left?: number; top?: number }, offset?: [number, number, number]) {
  v.set(...(offset ?? [0, 0, 0]));
  obj.localToWorld(v);
  v.project(camera);
  const x = (size.left ?? 0) + (v.x * 0.5 + 0.5) * size.width;
  const y = (size.top ?? 0) + (-v.y * 0.5 + 0.5) * size.height;
  const a = (anchors[key] ??= { x: 0, y: 0, visible: false });
  a.x = x;
  a.y = y;
  a.visible = v.z < 1 && x >= 0 && x <= size.width && y >= 0 && y <= size.height;
}
