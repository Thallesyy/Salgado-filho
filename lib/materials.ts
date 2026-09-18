import { Color, DoubleSide, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial } from "three";

/** Shared materials, created lazily once, reused everywhere to keep draw state small. */
let _m: ReturnType<typeof create> | null = null;

function create() {
  const std = (color: string, roughness = 0.6, metalness = 0) => new MeshStandardMaterial({ color, roughness, metalness });
  return {
    white: std("#eceae5", 0.45),
    offWhite: std("#d9d6cf", 0.55),
    concrete: std("#b8b3aa", 0.85),
    darkConcrete: std("#77736c", 0.9),
    steel: std("#a9adb3", 0.32, 0.9),
    darkSteel: std("#3c4046", 0.4, 0.8),
    graphite: std("#23262b", 0.5, 0.2),
    black: std("#0d0e10", 0.6),
    rubber: std("#141416", 0.9),
    wood: std("#8a6a4b", 0.55),
    seatFabric: std("#2d3b55", 0.85),
    seatLeather: std("#1f2530", 0.55),
    headrest: std("#e9e6df", 0.8),
    grass: std("#56693b", 1),
    hedge: std("#3d5230", 1),
    trunk: std("#4b3a2c", 1),
    safetyOrange: std("#ff6b1a", 0.6),
    safetyYellow: std("#f2c230", 0.55),
    vest: new MeshStandardMaterial({ color: "#ff7a1f", roughness: 0.5, emissive: new Color("#ff5a00"), emissiveIntensity: 0.15 }),
    glass: new MeshPhysicalMaterial({
      color: "#9fb4c4",
      roughness: 0.04,
      metalness: 0.1,
      transparent: true,
      opacity: 0.22,
      envMapIntensity: 1.6,
      side: DoubleSide,
      depthWrite: false,
    }),
    tintedGlass: new MeshPhysicalMaterial({
      color: "#4b6272",
      roughness: 0.06,
      metalness: 0.3,
      transparent: true,
      opacity: 0.55,
      envMapIntensity: 1.8,
      depthWrite: false,
    }),
    lightWarm: new MeshBasicMaterial({ color: new Color(4.2, 3.6, 2.8), toneMapped: false }),
    lightCool: new MeshBasicMaterial({ color: new Color(3.2, 3.6, 4.0), toneMapped: false }),
    lightPanel: new MeshBasicMaterial({ color: new Color(2.4, 2.4, 2.3), toneMapped: false }),
    screenGlow: new MeshBasicMaterial({ color: new Color(0.6, 0.9, 1.4), toneMapped: false }),
    red: new MeshBasicMaterial({ color: new Color(5, 0.3, 0.2), toneMapped: false }),
    green: new MeshBasicMaterial({ color: new Color(0.3, 5, 0.8), toneMapped: false }),
  };
}

export const mats = () => (_m ??= create());
export type Mats = ReturnType<typeof create>;
