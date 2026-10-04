import PreviewCanvas from '../dev/PreviewCanvas';

/** STUB — owned by the rig module. */
export default function RigPreview() {
  return (
    <PreviewCanvas>
      <mesh position={[0, 0, -4]}>
        <torusKnotGeometry args={[0.8, 0.25, 128, 16]} />
        <meshStandardMaterial color="#0e7490" emissive="#22d3ee" emissiveIntensity={2} metalness={0.6} roughness={0.3} />
      </mesh>
    </PreviewCanvas>
  );
}
