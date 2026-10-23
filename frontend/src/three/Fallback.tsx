import { Z } from '../core/layers';

/** No 3D: a light CSS star-field behind the same menus, lessons and quizzes (also used when WebGL is unavailable or crashes). */
export default function Fallback() {
  return (
    <div className="gfx-starfield fixed inset-0 overflow-hidden" style={{ zIndex: Z.canvas }} aria-hidden="true">
      <div className="gfx-stars far" />
      <div className="gfx-stars" />
    </div>
  );
}
