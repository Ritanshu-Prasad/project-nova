import { describe, expect, it } from 'vitest';

interface Point {
  x: number;
  y: number;
}

function calculateWaveWaypoints(n: number, stepWidth = 155, startX = 90, baseY = 120, waveAmplitude = 36) {
  const planetCoords: Point[] = Array.from({ length: n }, (_, i) => ({
    x: startX + i * stepWidth,
    y: baseY + (i % 2 === 0 ? waveAmplitude : -waveAmplitude),
  }));
  const lastX = startX + Math.max(0, n - 1) * stepWidth;
  const flagCoord: Point = {
    x: lastX + 120,
    y: baseY + (n % 2 === 0 ? waveAmplitude : -waveAmplitude),
  };
  return [...planetCoords, flagCoord];
}

function calculateFlightKeyframes(
  allWaypoints: Point[],
  fromIndex: number,
  destinationIndex: number,
  baseY = 120
) {
  if (allWaypoints.length === 0) {
    return { xs: [0], ys: [0], angles: [35], duration: 1.5 };
  }

  const startIdx = Math.min(allWaypoints.length - 1, Math.max(0, fromIndex));
  const targetIdx = Math.min(allWaypoints.length - 1, Math.max(0, destinationIndex));

  if (startIdx === targetIdx && targetIdx === 0) {
    const p = allWaypoints[0];
    const pStart = { x: p.x - 90, y: baseY - 15 };
    const midX = (pStart.x + p.x) / 2;
    const SAMPLES = 16;
    const xs: number[] = [];
    const ys: number[] = [];
    const angles: number[] = [];

    for (let k = 0; k <= SAMPLES; k++) {
      const t = k / SAMPLES;
      const u = 1 - t;
      const bx = u * u * u * pStart.x + 3 * u * u * t * midX + 3 * u * t * t * midX + t * t * t * p.x;
      const by = u * u * u * pStart.y + 3 * u * u * t * pStart.y + 3 * u * t * t * p.y + t * t * t * p.y;
      const dx = 3 * u * u * (midX - pStart.x) + 3 * t * t * (p.x - midX);
      const dy = 6 * u * t * (p.y - pStart.y);
      const tangent = (Math.atan2(dy, dx) * 180) / Math.PI;

      xs.push(bx);
      ys.push(by - 32);
      angles.push(Math.round(tangent + 45));
    }
    angles[angles.length - 1] = 35;
    return { xs, ys, angles, duration: 1.6 };
  }

  if (startIdx === targetIdx) {
    const p = allWaypoints[targetIdx];
    return {
      xs: [p.x - 45, p.x],
      ys: [p.y - 40, p.y - 32],
      angles: [25, 35],
      duration: 1.2,
    };
  }

  const xs: number[] = [];
  const ys: number[] = [];
  const angles: number[] = [];

  const stepDir = targetIdx > startIdx ? 1 : -1;
  const segments = Math.abs(targetIdx - startIdx);
  const SAMPLES_PER_SEGMENT = 16;

  for (let s = 0; s < segments; s++) {
    const idx = startIdx + s * stepDir;
    const nextIdx = idx + stepDir;
    const p1 = allWaypoints[idx];
    const p2 = allWaypoints[nextIdx];
    const midX = (p1.x + p2.x) / 2;

    for (let k = 0; k <= SAMPLES_PER_SEGMENT; k++) {
      if (s > 0 && k === 0) continue;
      const t = k / SAMPLES_PER_SEGMENT;
      const u = 1 - t;

      const bx = u * u * u * p1.x + 3 * u * u * t * midX + 3 * u * t * t * midX + t * t * t * p2.x;
      const by = u * u * u * p1.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p2.y;

      const dx = 3 * u * u * (midX - p1.x) + 3 * t * t * (p2.x - midX);
      const dy = 6 * u * t * (p2.y - p1.y);
      const tangent = (Math.atan2(dy, dx) * 180) / Math.PI;

      xs.push(bx);
      ys.push(by - 32);
      angles.push(Math.round(tangent + 45));
    }
  }

  angles[angles.length - 1] = 35;
  const duration = Math.max(1.5, Math.min(3.2, segments * 1.05));
  return { xs, ys, angles, duration };
}

describe('RocketProgress Wave Trajectory & Spaceship Flight', () => {
  it('generates undulating sine-wave coordinates alternating in height', () => {
    const waypoints = calculateWaveWaypoints(4);
    // 4 planets + 1 graduation flag = 5 waypoints
    expect(waypoints).toHaveLength(5);

    // Planet 0 (even) is lower down (y = 156)
    expect(waypoints[0].y).toBe(156);
    // Planet 1 (odd) is higher up (y = 84)
    expect(waypoints[1].y).toBe(84);
    // Planet 2 (even) is lower down (y = 156)
    expect(waypoints[2].y).toBe(156);
    // Planet 3 (odd) is higher up (y = 84)
    expect(waypoints[3].y).toBe(84);
    // Graduation flag alternates from planet 3 (odd -> even y = 156)
    expect(waypoints[4].y).toBe(156);

    // x coordinates advance linearly
    expect(waypoints[1].x - waypoints[0].x).toBe(155);
    expect(waypoints[2].x - waypoints[1].x).toBe(155);
    expect(waypoints[3].x - waypoints[2].x).toBe(155);
  });

  it('animates flight from previous planet to current planet when 2 modules completed', () => {
    const waypoints = calculateWaveWaypoints(5);
    // 2 modules completed -> previous is index 1, current is index 2
    const flight = calculateFlightKeyframes(waypoints, 1, 2);

    expect(flight.xs.length).toBeGreaterThan(10);
    // Starts at planet 1 x coordinate
    expect(flight.xs[0]).toBeCloseTo(waypoints[1].x, 0);
    // Ends at planet 2 x coordinate
    expect(flight.xs[flight.xs.length - 1]).toBeCloseTo(waypoints[2].x, 0);
    // Hover height is 32px above planet center
    expect(flight.ys[0]).toBeCloseTo(waypoints[1].y - 32, 0);
    expect(flight.ys[flight.ys.length - 1]).toBeCloseTo(waypoints[2].y - 32, 0);

    // Settled resting angle
    expect(flight.angles[flight.angles.length - 1]).toBe(35);
  });

  it('animates flight from last viewed position across multiple modules (e.g. 0 to 2)', () => {
    const waypoints = calculateWaveWaypoints(5);
    // Last viewed was 0, current is 2
    const flight = calculateFlightKeyframes(waypoints, 0, 2);

    expect(flight.xs[0]).toBeCloseTo(waypoints[0].x, 0);
    expect(flight.xs[flight.xs.length - 1]).toBeCloseTo(waypoints[2].x, 0);
    // Duration scales with segment count
    expect(flight.duration).toBeGreaterThanOrEqual(2.0);
  });

  it('handles graduation flight to the final flag when all modules are cleared', () => {
    const waypoints = calculateWaveWaypoints(4);
    // All 4 modules passed -> target is flag (index 4)
    const flight = calculateFlightKeyframes(waypoints, 3, 4);

    expect(flight.xs[0]).toBeCloseTo(waypoints[3].x, 0);
    expect(flight.xs[flight.xs.length - 1]).toBeCloseTo(waypoints[4].x, 0);
    expect(flight.ys[flight.ys.length - 1]).toBeCloseTo(waypoints[4].y - 32, 0);
  });

  it('provides orbital entry approach vector when pilot is at planet 0', () => {
    const waypoints = calculateWaveWaypoints(4);
    const flight = calculateFlightKeyframes(waypoints, 0, 0);

    // Starts 90px left of planet 0
    expect(flight.xs[0]).toBeCloseTo(waypoints[0].x - 90, 0);
    // Ends at planet 0
    expect(flight.xs[flight.xs.length - 1]).toBeCloseTo(waypoints[0].x, 0);
  });
});
