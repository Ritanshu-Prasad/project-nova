import {
  BackSide,
  BoxGeometry,
  CubeCamera,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NoColorSpace,
  NoToneMapping,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  WebGLCubeRenderTarget,
  type WebGLRenderer,
} from 'three';

const BAKE_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/**
 * Renders a procedural field into a cube map once (a `fragmentShader` that reads `varying vec3 vDir`,
 * an un-normalised direction, and writes RGBA data). Expensive noise is paid for a single time at
 * startup instead of every frame. The caller owns (and must dispose) the returned target.
 */
export function bakeCube(gl: WebGLRenderer, size: number, fragmentShader: string, mipmaps: boolean): WebGLCubeRenderTarget {
  const target = new WebGLCubeRenderTarget(size, {
    format: RGBAFormat,
    type: UnsignedByteType,
    generateMipmaps: mipmaps,
    minFilter: mipmaps ? LinearMipmapLinearFilter : LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
  });
  target.texture.colorSpace = NoColorSpace;

  const scene = new Scene();
  const geometry = new BoxGeometry(2, 2, 2);
  const material = new ShaderMaterial({
    vertexShader: BAKE_VERT,
    fragmentShader,
    side: BackSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  scene.add(new Mesh(geometry, material));
  const camera = new CubeCamera(0.1, 10, target);

  const autoClear = gl.autoClear;
  const toneMapping = gl.toneMapping;
  gl.autoClear = true;
  gl.toneMapping = NoToneMapping;
  camera.update(gl, scene);
  gl.autoClear = autoClear;
  gl.toneMapping = toneMapping;

  geometry.dispose();
  material.dispose();
  return target;
}
