import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { clamp, DEG, lerp, smoothstep, yawFromDir } from "./math";
import { k3, Track, type Key } from "./track";

/* ------------------------------------------------------------------------ */
/*  World layout, metres. +X east, -Z north, +Y up.                        */
/*  Origin: centre of the departures curb of Terminal 1.                    */
/* ------------------------------------------------------------------------ */

export const FLOOR = 5; // departures level
export const EYE = FLOOR + 1.65;
export const FACADE_Z = 16;
export const SECURITY_Z = -16;
export const GLASS_Z = -46;
export const TERMINAL_HALF_W = 110;

export const RUNWAY = { z: -420, x0: -2600, x1: 600, width: 45 }; // 3,200 m, 11/29
export const TAXIWAY_Z = -300;
export const APRON = { z0: GLASS_Z, z1: -230, x0: -320, x1: 320 };

export const GATE = { x: 0, z: -79, yaw: Math.PI }; // hero aircraft, nose-in
/** L1 door in aircraft-local coordinates (aircraft faces local -Z). */
export const DOOR_LOCAL = new Vector3(-1.98, 3.3, -12.5);
/** Jet bridge: rotunda by the glass wall → cab at the L1 door. */
export const BRIDGE = { rotunda: [13.5, -50] as const, cab: [4.4, -66.5] as const, floorTop: 5, floorCab: 3.3 };
export const CABIN_FLOOR = 3.3;

/** Porto Alegre landmarks, real positions relative to the airport (≈ km scale). */
export const LANDMARKS = {
  gasometro: new Vector3(-6750, 0, 4440),
  beiraRio: new Vector3(-6240, 0, 7920),
  arenaGremio: new Vector3(-2310, 0, -2220),
  centro: new Vector3(-6050, 0, 4550),
  guaibaBridge: new Vector3(-6250, 0, 1500),
  morroSantana: new Vector3(4900, 0, 6200),
};

/* ------------------------------------------------------------------------ */
/*  Hero aircraft trajectory                                                */
/* ------------------------------------------------------------------------ */

export const PHASE = {
  push0: 0.515,
  push1: 0.545,
  lineUp: 0.598,
  roll0: 0.615,
  rotate: 0.652,
  liftoff: 0.662,
  climb1: 0.69,
};

const ROLL_DIST = 1900;
const LIFT_SPEED = (2 * ROLL_DIST) / (PHASE.liftoff - PHASE.roll0); // units per progress
const CLIMB_SLOPE = 0.08;
const CLIMB_ACC = (LIFT_SPEED * CLIMB_SLOPE) / (PHASE.climb1 - PHASE.liftoff);

const groundTrack = new Track([
  k3(PHASE.push0, 0, 0, GATE.z, true),
  k3(0.528, 0, 0, -108),
  k3(0.538, -8, 0, -150),
  k3(0.5415, -22, 0, -158.6),
  k3(PHASE.push1, -40, 0, -160, true),
  k3(0.556, 40, 0, -160),
  k3(0.568, 300, 0, -161),
  k3(0.578, 520, 0, -168),
  k3(0.584, 640, 0, -205),
  k3(0.589, 680, 0, -290),
  k3(0.593, 676, 0, -370),
  k3(0.5955, 650, 0, -410),
  k3(0.597, 620, 0, -419.5),
  k3(PHASE.lineUp, RUNWAY.x1, 0, RUNWAY.z, true),
]);

function airbornePosition(p: number, out: Vector3) {
  if (p <= PHASE.liftoff) {
    const u = clamp((p - PHASE.roll0) / (PHASE.liftoff - PHASE.roll0));
    return out.set(RUNWAY.x1 - ROLL_DIST * u * u, 0, RUNWAY.z);
  }
  const dp = p - PHASE.liftoff;
  return out.set(RUNWAY.x1 - ROLL_DIST - LIFT_SPEED * dp, 0.5 * CLIMB_ACC * dp * dp, RUNWAY.z);
}

const climbEnd = airbornePosition(PHASE.climb1, new Vector3());
const climbTan = [-LIFT_SPEED, CLIMB_ACC * (PHASE.climb1 - PHASE.liftoff), 0];

const flightKeys: Key[] = [
  { p: PHASE.climb1, v: [climbEnd.x, climbEnd.y, climbEnd.z], m: climbTan },
  k3(0.705, -5000, 330, -380),
  k3(0.718, -6500, 520, 150),
  k3(0.73, -7500, 650, 1500),
  k3(0.745, -7800, 750, 3700),
  k3(0.76, -7600, 820, 6000),
  k3(0.775, -6800, 880, 8300),
  k3(0.792, -4600, 930, 9700),
  k3(0.81, -1600, 950, 9500),
  k3(0.828, 1300, 950, 7600),
  k3(0.846, 2900, 920, 4600),
  k3(0.866, 3200, 880, 1500),
  k3(0.89, 2200, 820, -1300),
  k3(0.925, -600, 760, -2300),
  k3(0.96, -3400, 720, -1900),
  k3(1.0, -5800, 700, -300),
  // epilogue: the flight keeps circling Porto Alegre while you read
  k3(1.1, -7300, 700, 3300),
  k3(1.2, -5200, 720, 7800),
  k3(1.3, 200, 760, 7200),
  k3(1.4, 3000, 780, 2400),
  k3(1.5, 1500, 800, -2200),
];
const flightTrack = new Track(flightKeys);

export type Pose = {
  position: Vector3;
  quaternion: Quaternion;
  yaw: number;
  pitch: number;
  roll: number;
  /** 0 parked … 1 full takeoff thrust */
  thrust: number;
  /** ground speed, knots (for the HUD) */
  knots: number;
  onGround: boolean;
};

const _a = new Vector3();
const _b = new Vector3();
const _e = new Euler(0, 0, 0, "YXZ");

function rawPosition(p: number, out: Vector3) {
  if (p < PHASE.lineUp) return groundTrack.sampleVec3(p, out);
  if (p < PHASE.roll0) return out.set(RUNWAY.x1, 0, RUNWAY.z);
  if (p < PHASE.climb1) return airbornePosition(p, out);
  return flightTrack.sampleVec3(p, out);
}

function headingAt(p: number): number {
  if (p < PHASE.push0) return GATE.yaw;
  if (p >= PHASE.lineUp && p < PHASE.climb1) return Math.PI / 2; // runway 29, due west in our frame
  const e = 0.0006;
  rawPosition(Math.max(p - e, 0), _a);
  rawPosition(p + e, _b);
  let dx = _b.x - _a.x;
  let dz = _b.z - _a.z;
  if (dx * dx + dz * dz < 1e-10) {
    rawPosition(Math.max(p - 0.004, 0), _a);
    rawPosition(p + 0.004, _b);
    dx = _b.x - _a.x;
    dz = _b.z - _a.z;
  }
  // pushback moves tail-first
  if (p < PHASE.push1) {
    dx = -dx;
    dz = -dz;
  }
  return yawFromDir(dx, dz);
}

export function aircraftPose(p: number, out: Pose): Pose {
  rawPosition(p, out.position);
  const yaw = headingAt(p);
  let pitch = 0;
  let roll = 0;

  if (p >= PHASE.rotate && p < PHASE.climb1 + 0.001) {
    const rot = 8 * DEG * smoothstep(PHASE.rotate, PHASE.liftoff + 0.002, p);
    const dp = Math.max(0, p - PHASE.liftoff);
    const gamma = Math.atan2(CLIMB_ACC * dp, LIFT_SPEED);
    pitch = rot + gamma;
  }
  if (p >= PHASE.climb1) {
    const d = 0.0015;
    rawPosition(p - d, _a);
    rawPosition(p + d, _b);
    const dy = _b.y - _a.y;
    const dxz = Math.hypot(_b.x - _a.x, _b.z - _a.z);
    const gamma = Math.atan2(dy, dxz);
    const aoa = lerp(8 * DEG, 3 * DEG, smoothstep(PHASE.climb1 - 0.02, 0.73, p));
    pitch = gamma + aoa;
    // coordinated-turn bank angle from path curvature
    const y0 = headingAt(p - 0.004);
    const y1 = headingAt(p + 0.004);
    let dyaw = y1 - y0;
    if (dyaw > Math.PI) dyaw -= Math.PI * 2;
    if (dyaw < -Math.PI) dyaw += Math.PI * 2;
    rawPosition(p - 0.004, _a);
    rawPosition(p + 0.004, _b);
    const ds = Math.max(1, _a.distanceTo(_b));
    const V2g = (88 * 88) / 9.81;
    roll = clamp(Math.atan(V2g * (dyaw / ds)), -32 * DEG, 32 * DEG);
    roll *= smoothstep(PHASE.climb1, 0.7, p);
  }

  out.yaw = yaw;
  out.pitch = pitch;
  out.roll = roll;
  _e.set(pitch, yaw, roll, "YXZ");
  out.quaternion.setFromEuler(_e);
  out.onGround = p < PHASE.liftoff;

  // thrust & speed for sound + HUD
  const taxiThrust = 0.18 * smoothstep(PHASE.push1, PHASE.push1 + 0.006, p);
  const spool = smoothstep(PHASE.lineUp + 0.004, PHASE.roll0 + 0.004, p);
  out.thrust =
    p < PHASE.push0 ? 0 : p < PHASE.lineUp ? 0.08 + taxiThrust : p < PHASE.climb1 + 0.02 ? lerp(0.25, 1, spool) : lerp(1, 0.72, smoothstep(0.7, 0.76, p));

  if (p < PHASE.lineUp) out.knots = p > PHASE.push0 ? (p < PHASE.push1 ? 3 : 14) * smoothstep(PHASE.push0, PHASE.push0 + 0.01, p) * (1 - smoothstep(0.594, PHASE.lineUp, p)) : 0;
  else if (p < PHASE.roll0) out.knots = 0;
  else if (p < PHASE.liftoff) out.knots = 148 * ((p - PHASE.roll0) / (PHASE.liftoff - PHASE.roll0));
  else out.knots = lerp(150, 250, smoothstep(PHASE.liftoff, 0.76, p));
  return out;
}

export const makePose = (): Pose => ({
  position: new Vector3(),
  quaternion: new Quaternion(),
  yaw: 0,
  pitch: 0,
  roll: 0,
  thrust: 0,
  knots: 0,
  onGround: true,
});

/* ------------------------------------------------------------------------ */
/*  Camera                                                                  */
/* ------------------------------------------------------------------------ */

// World-space camera (arrival → jet bridge)
const worldPos: Key[] = [
  k3(0.0, -70, 72, 250),
  k3(0.03, -42, 46, 192),
  k3(0.062, -14, 19, 112),
  k3(0.092, -2.5, 8.2, 56),
  k3(0.112, 0, EYE, 31),
  k3(0.128, 0, EYE, 20.5),
  // Scene 2, terminal
  k3(0.15, 0, EYE, 9),
  k3(0.175, -2.5, EYE, 1.5),
  k3(0.205, 0, EYE, -4.5),
  k3(0.232, 1.5, EYE, -9),
  k3(0.255, 0, EYE, -12),
  // Scene 3, security & gates
  k3(0.278, 0, EYE, -17.5),
  k3(0.3, 0, EYE, -23),
  k3(0.33, 2.2, EYE, -30.5),
  k3(0.36, 4.5, EYE, -38),
  k3(0.386, 9.5, EYE, -42.5),
  // Scene 4, jet bridge (rotunda → telescopic tunnel → cab)
  k3(0.405, 13.2, EYE, -49.6),
  k3(0.428, 8.95, 5.83, -58.25),
  k3(0.447, 5.0, CABIN_FLOOR + 1.7, -65.4),
];
const worldLook: Key[] = [
  k3(0.0, 0, 14, 0),
  k3(0.03, 0, 11, 8),
  k3(0.062, 0, 9, 14),
  k3(0.092, 0, 7.2, 16),
  k3(0.112, 0, 6.6, 8),
  k3(0.128, 0, 6.8, 0),
  k3(0.15, 0, 8.6, -10),
  k3(0.175, -16, 7.4, -5),
  k3(0.205, 5, 10.2, -13),
  k3(0.232, 0, 7.2, -22),
  k3(0.255, 0, 6.6, -26),
  k3(0.278, 0, 6.5, -32),
  k3(0.3, -3, 7.2, -40),
  k3(0.33, -6, 7.2, -70),
  k3(0.36, 0, 5.8, -78),
  k3(0.386, 13.5, 6.6, -50),
  k3(0.405, 8.95, 6.0, -58.25),
  k3(0.428, 4.4, 5.0, -66.5),
  k3(0.447, -1, 4.9, -66.6),
];

// Aircraft-local camera (door → seat → window → exit)
const Y = CABIN_FLOOR;
const localPos: Key[] = [
  k3(0.462, -1.0, Y + 1.66, -12.5),
  k3(0.476, -0.05, Y + 1.66, -11.4),
  k3(0.492, 0, Y + 1.64, -1.5),
  k3(0.504, -0.3, Y + 1.6, 5.4),
  k3(0.518, -0.95, Y + 1.2, 6.25),
  k3(0.56, -1.1, Y + 1.17, 6.3),
  k3(0.64, -1.2, Y + 1.16, 6.3),
  k3(0.69, -1.28, Y + 1.18, 6.25),
  k3(0.72, -1.45, Y + 1.15, 6.25),
  k3(0.76, -1.6, Y + 1.12, 6.26),
  k3(0.8, -1.63, Y + 1.1, 6.26),
  k3(0.845, -1.6, Y + 1.12, 6.26),
  k3(0.862, -4.2, Y + 1.4, 6.0),
  k3(0.884, -24, 10, 20),
  k3(0.905, -42, 20, 60),
  k3(0.93, -60, 30, 110),
];
const localLook: Key[] = [
  k3(0.462, 1.5, Y + 1.6, -12.2),
  k3(0.476, 0, Y + 1.55, 2),
  k3(0.492, 0, Y + 1.45, 12),
  k3(0.504, -2.2, Y + 1.3, 6.8),
  k3(0.518, -3.4, Y + 0.95, 5.2),
  k3(0.56, -4, Y + 0.85, 4.9),
  k3(0.64, -4, Y + 0.8, 5.6),
  k3(0.69, -4, Y + 0.45, 6.4),
  k3(0.72, -4, Y + 0.1, 6.6),
  k3(0.76, -5, Y - 0.55, 6.5),
  k3(0.8, -5, Y - 0.9, 6.9),
  k3(0.845, -5, Y - 0.35, 6.4),
  k3(0.862, -12, Y - 1.2, 6.2),
  k3(0.884, 0, 4, -4),
  k3(0.905, 0, 4, -2),
  k3(0.93, 0, 4, 0),
];

// World-space aerial finale
const aerialPos: Key[] = [
  k3(0.9, 1300, 830, -1650),
  k3(0.935, 1750, 900, -300),
  k3(0.965, 1900, 820, 1200),
  k3(1.0, 1500, 650, 1500),
];
const aerialLook: Key[] = [
  k3(0.9, 1000, 780, -1950),
  k3(0.935, -200, 300, -1200),
  k3(0.965, -500, 0, -400),
  k3(1.0, -700, 0, -400),
];

const parkedMatrix = new Matrix4().compose(
  new Vector3(GATE.x, 0, GATE.z),
  new Quaternion().setFromEuler(new Euler(0, GATE.yaw, 0)),
  new Vector3(1, 1, 1),
);
const parkedInverse = parkedMatrix.clone().invert();

const toWorld = (k: Key): Key => {
  const v = new Vector3(k.v[0], k.v[1], k.v[2]).applyMatrix4(parkedMatrix);
  return k3(k.p, v.x, v.y, v.z);
};
const toLocal = (k: Key): Key => {
  const v = new Vector3(k.v[0], k.v[1], k.v[2]).applyMatrix4(parkedInverse);
  return k3(k.p, v.x, v.y, v.z);
};

// overlap two keys across the frame switch so tangents match on both sides
export const FRAME_SWITCH = 0.455;
const worldPosTrack = new Track([...worldPos, ...localPos.slice(0, 2).map(toWorld)]);
const worldLookTrack = new Track([...worldLook, ...localLook.slice(0, 2).map(toWorld)]);
const localPosTrack = new Track([...worldPos.slice(-2).map(toLocal), ...localPos]);
const localLookTrack = new Track([...worldLook.slice(-2).map(toLocal), ...localLook]);
const aerialPosTrack = new Track(aerialPos);
const aerialLookTrack = new Track(aerialLook);

const fovTrack = new Track([
  { p: 0, v: [34] },
  { p: 0.09, v: [42] },
  { p: 0.13, v: [56] },
  { p: 0.2, v: [52] },
  { p: 0.33, v: [48] },
  { p: 0.37, v: [44] },
  { p: 0.41, v: [58] },
  { p: 0.5, v: [62] },
  { p: 0.56, v: [54] },
  { p: 0.66, v: [58] },
  { p: 0.75, v: [52] },
  { p: 0.86, v: [60] },
  { p: 0.92, v: [42] },
  { p: 1, v: [36] },
]);

export const AIRPORT_CENTER = new Vector3(-900, 0, -330);

export type CameraShot = {
  position: Vector3;
  target: Vector3;
  up: Vector3;
  fov: number;
  /** distance at which the lens is focused */
  focus: number;
  /** 0 = world rig, 1 = riding inside the aircraft */
  inAircraft: number;
};

export const makeShot = (): CameraShot => ({
  position: new Vector3(),
  target: new Vector3(),
  up: new Vector3(0, 1, 0),
  fov: 50,
  focus: 10,
  inAircraft: 0,
});

const _lp = new Vector3();
const _ll = new Vector3();
const _wp = new Vector3();
const _wl = new Vector3();
const _m = new Matrix4();
const _up = new Vector3();

export function cameraShot(p: number, finale: number, pose: Pose, out: CameraShot) {
  _m.compose(pose.position, pose.quaternion, _one);
  _up.set(0, 1, 0).applyQuaternion(pose.quaternion);

  if (p < FRAME_SWITCH) {
    worldPosTrack.sampleVec3(p, out.position);
    worldLookTrack.sampleVec3(p, out.target);
    out.up.set(0, 1, 0);
    out.inAircraft = 0;
  } else {
    localPosTrack.sampleVec3(p, _lp).applyMatrix4(_m);
    localLookTrack.sampleVec3(p, _ll).applyMatrix4(_m);
    const w = smoothstep(0.893, 0.935, p);
    if (w > 0) {
      aerialPosTrack.sampleVec3(p, _wp);
      aerialLookTrack.sampleVec3(p, _wl);
      _lp.lerp(_wp, w);
      _ll.lerp(_wl, w);
    }
    out.position.copy(_lp);
    out.target.copy(_ll);
    out.up.copy(_up).lerp(_ref_up, Math.max(w, smoothstep(0.855, 0.9, p) * 0.6)).normalize();
    out.inAircraft = 1 - smoothstep(0.85, 0.866, p);
  }

  // Epilogue: slow scroll-bound orbit around the airfield at dusk
  if (finale > 0) {
    const r0 = Math.hypot(1500 - AIRPORT_CENTER.x, 1500 - AIRPORT_CENTER.z);
    const a0 = Math.atan2(1500 - AIRPORT_CENTER.z, 1500 - AIRPORT_CENTER.x);
    const f = finale;
    const a = a0 - f * 1.35;
    const r = lerp(r0, 2600, f);
    _wp.set(AIRPORT_CENTER.x + Math.cos(a) * r, lerp(650, 1050, f), AIRPORT_CENTER.z + Math.sin(a) * r);
    const blend = smoothstep(0, 0.04, f);
    out.position.lerp(_wp, blend);
    out.target.lerp(_wl.set(AIRPORT_CENTER.x + 200, 0, AIRPORT_CENTER.z), blend);
    out.up.set(0, 1, 0);
  }

  out.fov = fovTrack.sample(p)[0];
  out.focus = out.position.distanceTo(out.target);
  if (p > 0.515 && p < 0.86) out.focus = 60; // looking out of the window: lens on the wing / world
  return out;
}

const _one = new Vector3(1, 1, 1);
const _ref_up = new Vector3(0, 1, 0);
