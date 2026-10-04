import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

/**
 * Compiles every material in the scene (hidden objects included) shortly after mount, so revealing the
 * new world or the warp later does not stall on shader compilation (ANGLE/D3D compiles are slow).
 * Lights are gathered from visible objects only — keep lights visible and toggle their intensity.
 */
export function usePrecompile(): void {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      gl.compileAsync(scene, camera).catch(() => {
        /* compilation errors surface on first render anyway */
      });
    });
    return () => cancelAnimationFrame(id);
  }, [gl, scene, camera]);
}
