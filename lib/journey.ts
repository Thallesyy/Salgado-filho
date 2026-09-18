import { motionValue } from "framer-motion";

/**
 * Chapter boundaries in journey-progress space (0..1).
 * Everything, camera, aircraft, sun, sound, typography, is a pure function
 * of this single number, so scrubbing backwards replays the film exactly.
 */
export const SCENES = [
  { id: "arrival", n: "01", title: "Chegada", start: 0.0, end: 0.12 },
  { id: "terminal", n: "02", title: "O Terminal", start: 0.12, end: 0.255 },
  { id: "security", n: "03", title: "Embarque", start: 0.255, end: 0.385 },
  { id: "boarding", n: "04", title: "A Bordo", start: 0.385, end: 0.505 },
  { id: "takeoff", n: "05", title: "Decolagem", start: 0.505, end: 0.69 },
  { id: "flight", n: "06", title: "Sobre Porto Alegre", start: 0.69, end: 0.85 },
  { id: "aerial", n: "07", title: "O Portal do Sul", start: 0.85, end: 1.0 },
] as const;

export type SceneId = (typeof SCENES)[number]["id"];

/** Altura de rolagem da jornada, em alturas de tela. */
export const JOURNEY_VH = 2000;

export const sceneIndexAt = (p: number) => {
  for (let i = SCENES.length - 1; i >= 0; i--) if (p >= SCENES[i].start) return i;
  return 0;
};

type JourneyState = {
  /** raw scroll progress through the journey, 0..1 */
  target: number;
  /** GSAP-scrubbed progress used by everything that renders */
  progress: number;
  /** progress actually used for this frame (differs during still capture) */
  render: number;
  /** d(progress)/dt, units per second */
  velocity: number;
  /** 0..1 through the epilogue section below the journey */
  finale: number;
  finaleRender: number;
  /** seconds since start */
  time: number;
  /** relógio fixo para gravar vídeo quadro a quadro (só em desenvolvimento) */
  videoTime: number | null;
  capturing: boolean;
  ready: boolean;
  quality: "high" | "medium" | "low" | "safe";
  reducedMotion: boolean;
};

export const journey: JourneyState = {
  target: 0,
  progress: 0,
  render: 0,
  velocity: 0,
  finale: 0,
  finaleRender: 0,
  time: 0,
  videoTime: null,
  capturing: false,
  ready: false,
  quality: "high",
  reducedMotion: false,
};

/** Motion values mirror the store for the DOM layer (Framer Motion). */
export const progressMV = motionValue(0);
export const finaleMV = motionValue(0);
export const velocityMV = motionValue(0);
