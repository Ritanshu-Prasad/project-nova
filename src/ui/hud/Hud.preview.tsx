import { useEffect, useRef } from 'react';
import { debugJump, startDirector } from '../../core/director';
import { useGlobalInput } from '../../core/input';
import { damp, easeOutCubic } from '../../core/math';
import { rt } from '../../core/runtime';
import { PHASES, useNova, type Phase } from '../../core/store';
import { useRaf } from '../../core/useRaf';
import { markPreviewReady, previewParams } from '../../dev/previewParams';
import Cursor from './Cursor';
import Hud from './Hud';
import HudBackdrop from './HudBackdrop';
import TopBar from './TopBar';

/**
 * DEV ONLY — `/?preview=hud`: TopBar + Hud + Cursor over a static CSS backdrop.
 *
 *   static (default): rt.heading / pitch / yaw / speedKms / engine / shake animate for life per phase;
 *                     any `rt.<key>=` param pins that value. e.g. ?preview=hud&phase=landed&pillar=1
 *   live=1:           runs the real director + global input from `phase` (default preflight), with a
 *                     stand-in head rig driven by the mouse — press 1/2/3, hold Space, etc.
 */

const pinned = (key: string) => previewParams.has(`rt.${key}`);
const LIGHT_SPEED_KMS = 299_792;
const BASE_HEADING = 247;
const DEG = 180 / Math.PI;

const startPhase = (): Phase => {
  const p = previewParams.get('phase') as Phase | null;
  return p && PHASES.includes(p) ? p : 'preflight';
};

/** Stand-in for ShipRig: head yaw/pitch follow the look target, heading follows the yaw. */
function headRig(dt: number) {
  rt.yaw = damp(rt.yaw, -rt.lookX * 0.5, 4, dt);
  rt.pitch = damp(rt.pitch, -rt.lookY * 0.28, 4, dt);
  rt.heading = (((BASE_HEADING - rt.yaw * DEG) % 360) + 360) % 360;
}

function StaticDriver() {
  useEffect(() => {
    const { phase } = useNova.getState();
    if (!pinned('hud') && phase !== 'gate' && phase !== 'wake' && phase !== 'preflight') rt.hud = 1;
  }, []);

  useRaf((dt, time) => {
    const { phase, cleared, systems } = useNova.getState();
    rt.dt = dt;
    rt.time = time;
    rt.phaseTime += dt;
    if (!pinned('yaw')) rt.yaw = Math.sin(time * 0.27) * 0.2;
    if (!pinned('pitch')) rt.pitch = Math.sin(time * 0.41 + 1) * 0.05;
    if (!pinned('heading')) rt.heading = (((BASE_HEADING - rt.yaw * DEG) % 360) + 360) % 360;

    let speed = 0;
    let engine = 0;
    let shake = 0;
    let fov = 0;
    switch (phase) {
      case 'preflight':
        engine = systems.core || cleared ? 0.22 : 0;
        shake = engine ? 0.04 : 0;
        break;
      case 'launch': {
        const t = Math.min(time % 2.6, 1.45);
        speed = 237.8 * t * 42;
        engine = 1;
        shake = 0.75;
        fov = 16;
        break;
      }
      case 'warp':
        speed = LIGHT_SPEED_KMS * 0.98;
        engine = 0.95;
        shake = 0.32;
        fov = 30;
        break;
      case 'arrive':
        speed = 18_000 + (1_240 - 18_000) * easeOutCubic(Math.min(1, (time % 4.5) / 3.2));
        engine = 0.3;
        shake = 0.05;
        break;
      case 'landed':
        speed = 1_240;
        engine = 0.12;
        shake = 0.01;
        break;
      default:
        break;
    }
    if (!pinned('speedKms')) rt.speedKms = speed;
    if (!pinned('engine')) rt.engine = engine;
    if (!pinned('shake')) rt.shake = shake;
    if (!pinned('fovKick')) rt.fovKick = fov;
  });
  return null;
}

function LiveDriver() {
  useGlobalInput();
  useEffect(() => {
    const stop = startDirector();
    debugJump(startPhase());
    return stop;
  }, []);
  useRaf((dt) => headRig(dt));
  return null;
}

function ReadyMarker() {
  const frames = useRef(0);
  useRaf(() => {
    frames.current += 1;
    if (frames.current === 30) markPreviewReady();
  });
  return null;
}

export default function HudPreview() {
  const live = previewParams.get('live') === '1';
  return (
    <div className="nova-root">
      <HudBackdrop />
      {live ? <LiveDriver /> : <StaticDriver />}
      <Hud />
      <TopBar />
      <Cursor />
      <ReadyMarker />
    </div>
  );
}
