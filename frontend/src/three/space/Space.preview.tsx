import PreviewCanvas from '../../dev/PreviewCanvas';
import Sky from './Sky';
import SpaceWorld from './SpaceWorld';
import Warp from './Warp';

/** STUB — owned by the space module. */
export default function SpacePreview() {
  return (
    <PreviewCanvas>
      <Sky />
      <SpaceWorld />
      <Warp />
    </PreviewCanvas>
  );
}
