import { Z } from '../core/layers';

/** STUB — owned by the rig module. CSS-only backdrop when WebGL is unavailable. */
export default function Fallback() {
  return <div className="fixed inset-0 bg-void" style={{ zIndex: Z.canvas }} />;
}
