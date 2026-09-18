"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  FogExp2,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  PMREMGenerator,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type WebGLRenderTarget,
} from "three";
import { frame } from "@/lib/frame";
import { journey } from "@/lib/journey";
import { mulberry32, smoothstep } from "@/lib/math";

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}
`;

// Artistic analytic sky: day → golden hour → dusk, with Belt of Venus,
// sun disc, Mie glow and a layer of high cirrus lit by the sunset.
export const skyFrag = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uGold;
uniform float uSet;
uniform float uNight;
uniform float uTime;
uniform float uEnv;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  float mu = clamp(dot(d, uSunDir), -1.0, 1.0);
  vec2 sxz = normalize(uSunDir.xz + 1e-5);
  float facing = clamp(dot(normalize(d.xz + 1e-5), sxz) * 0.5 + 0.5, 0.0, 1.0);

  vec3 zenDay = vec3(0.16, 0.34, 0.74);
  vec3 horDay = vec3(0.68, 0.79, 0.9);
  vec3 zenSet = vec3(0.12, 0.16, 0.36);
  vec3 horSetSun = vec3(1.25, 0.52, 0.22);
  vec3 horSetAway = vec3(0.55, 0.4, 0.55);
  vec3 zenNight = vec3(0.012, 0.018, 0.05);
  vec3 horNight = vec3(0.05, 0.06, 0.12);

  vec3 horSet = mix(horSetAway, horSetSun, pow(facing, 3.0));
  vec3 zen = mix(mix(zenDay, zenSet, uGold), zenNight, uNight);
  vec3 hor = mix(mix(horDay, horSet, uGold), mix(horNight, horSetSun * 0.35, pow(facing, 5.0) * (1.0 - smoothstep(0.6, 1.0, uNight))), uNight);

  float t = pow(1.0 - clamp(h, 0.0, 1.0), 5.0);
  vec3 col = mix(zen, hor, t);

  // Belt of Venus: pink band opposite the sun at dusk
  col += vec3(0.35, 0.16, 0.22) * uSet * (1.0 - uNight) * pow(1.0 - facing, 3.0) * exp(-abs(h - 0.06) * 18.0);

  // Mie glow & sun disc
  float glow = pow(max(mu, 0.0), 6.0) * (0.25 + 0.9 * uGold) + pow(max(mu, 0.0), 90.0) * 1.6;
  col += uSunColor * glow * (1.0 - uNight * 0.85) * smoothstep(-0.25, 0.02, h + uSunDir.y * 0.5);
  float disc = smoothstep(0.99965, 0.99985, mu);
  col += uSunColor * disc * mix(60.0, 6.0, uEnv) * (1.0 - smoothstep(-0.02, -0.06, uSunDir.y));

  // high cirrus
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.08) * 0.9 + vec2(uTime * 0.004, 0.0);
    float c = fbm(uv * 1.2) * fbm(uv * 0.35 + 3.0);
    c = smoothstep(0.18, 0.55, c) * smoothstep(0.0, 0.15, h) * 0.9;
    vec3 lit = mix(vec3(1.0), vec3(1.6, 0.75, 0.45), uGold) * (0.6 + 1.2 * pow(max(mu, 0.0), 3.0));
    // after sunset the underside stays lit pink for a while before going grey-blue
    lit = mix(lit, vec3(1.25, 0.62, 0.72) * (0.7 + 0.8 * pow(max(mu, 0.0), 2.0)), uSet * (1.0 - smoothstep(0.55, 0.95, uNight)));
    lit = mix(lit, vec3(0.1, 0.1, 0.16), smoothstep(0.7, 1.0, uNight));
    c *= 1.0 - 0.5 * smoothstep(0.75, 1.0, uNight);
    col = mix(col, lit * mix(0.95, 0.8, uGold), c * (1.0 - uEnv * 0.5));
  }

  // below the horizon: ground haze
  if (h < 0.0) col = mix(hor, mix(vec3(0.28, 0.27, 0.25), vec3(0.03, 0.03, 0.05), uNight) * mix(1.0, 0.6, uGold), smoothstep(0.0, -0.25, h));

  if (any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

export function makeSkyMaterial(env = false) {
  return new ShaderMaterial({
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: BackSide,
    depthWrite: false,
    depthTest: env ? true : true,
    fog: false,
    uniforms: {
      uSunDir: { value: new Vector3(0, 1, 0) },
      uSunColor: { value: new Color(1, 1, 1) },
      uGold: { value: 0 },
      uSet: { value: 0 },
      uNight: { value: 0 },
      uTime: { value: 0 },
      uEnv: { value: env ? 1 : 0 },
    },
  });
}

function syncSky(m: ShaderMaterial) {
  const d = frame.dir;
  const u = m.uniforms;
  u.uSunDir.value.copy(d.sunDir);
  u.uSunColor.value.copy(d.sunColor);
  u.uGold.value = smoothstep(24, 3, d.sunElevation);
  u.uSet.value = smoothstep(6, -1, d.sunElevation);
  u.uNight.value = d.night;
  u.uTime.value = journey.time;
}

export default function Atmosphere() {
  const { scene, gl, camera } = useThree();
  const skyMat = useMemo(() => makeSkyMaterial(false), []);
  const sky = useMemo(() => {
    const m = new Mesh(new SphereGeometry(1, 64, 32), skyMat);
    m.scale.setScalar(40000);
    m.frustumCulled = false;
    m.renderOrder = -10;
    return m;
  }, [skyMat]);

  const stars = useMemo(() => {
    const r = mulberry32(7);
    const pos: number[] = [];
    const size: number[] = [];
    for (let i = 0; i < 2400; i++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const y = Math.abs(u) * 0.95 + 0.02;
      pos.push(Math.cos(th) * s * 38000, y * 38000, Math.sin(th) * s * 38000);
      size.push(0.6 + Math.pow(r(), 6) * 2.4);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("size", new Float32BufferAttribute(size, 1));
    const m = new ShaderMaterial({
      uniforms: { uAlpha: { value: 0 } },
      vertexShader: `attribute float size; varying float vS; void main(){ vS=size; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position=p.xyww; gl_PointSize=size*1.6; }`,
      fragmentShader: `uniform float uAlpha; varying float vS; void main(){ float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.0,d); gl_FragColor=vec4(vec3(1.,.97,.92)*(1.+vS), a*uAlpha); }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      fog: false,
    });
    const pts = new Points(g, m);
    pts.frustumCulled = false;
    pts.renderOrder = -9;
    return pts;
  }, []);

  const follow = useMemo(() => new Object3D(), []);

  const sun = useMemo(() => {
    const l = new DirectionalLight(0xffffff, 3);
    l.castShadow = true;
    const size = journey.quality === "high" ? 2048 : journey.quality === "medium" ? 1536 : 1024;
    l.shadow.mapSize.set(size, size);
    const c = l.shadow.camera;
    c.left = -110;
    c.right = 110;
    c.top = 110;
    c.bottom = -110;
    c.near = 1;
    c.far = 1400;
    l.shadow.bias = -0.00025;
    l.shadow.normalBias = 0.045;
    return l;
  }, []);
  const hemi = useMemo(() => new HemisphereLight(0xbfd4f2, 0x7a705f, 0.8), []);

  // ambiente do saguão: em vez de refletir o céu aberto, o piso, o aço e o vidro
  // de dentro do terminal refletem um forro claro com luminárias, vidraças
  // com a cor do céu dos dois lados e o piso de granilite
  const envInterior = useMemo(() => {
    const s = new Scene();
    const plano = (w: number, h: number, cor: Color, pos: [number, number, number], rot: [number, number, number]) => {
      const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color: cor, side: BackSide, toneMapped: false }));
      m.position.set(...pos);
      m.rotation.set(...rot);
      s.add(m);
      return m;
    };
    const piso = new Color(0.42, 0.4, 0.37);
    const forro = new Color(0.5, 0.47, 0.43);
    const parede = new Color(0.5, 0.48, 0.45);
    const vidro = new Color(0.8, 0.9, 1.05);
    plano(240, 90, piso, [0, -2, 0], [Math.PI / 2, 0, 0]);
    plano(240, 90, forro, [0, 16, 0], [-Math.PI / 2, 0, 0]);
    const lados = [
      plano(240, 18, vidro.clone(), [0, 7, -34], [0, Math.PI, 0]),
      plano(240, 18, vidro.clone(), [0, 7, 34], [0, 0, 0]),
    ];
    plano(90, 18, parede, [-110, 7, 0], [0, -Math.PI / 2, 0]);
    plano(90, 18, parede, [110, 7, 0], [0, Math.PI / 2, 0]);
    // fileiras de luminárias no forro
    const luz = new MeshBasicMaterial({ color: new Color(3.2, 2.9, 2.5), toneMapped: false });
    const faixa = new BoxGeometry(200, 0.1, 0.5);
    for (let z = -28; z <= 28; z += 7) {
      const f = new Mesh(faixa, luz);
      f.position.set(0, 15.8, z);
      s.add(f);
    }
    return { scene: s, lados };
  }, []);

  // environment: re-filter the sky into a PMREM when the light changes enough
  const env = useMemo(() => {
    const s = new Scene();
    const m = makeSkyMaterial(true);
    const mesh = new Mesh(new SphereGeometry(100, 48, 24), m);
    s.add(mesh);
    return { scene: s, mat: m, gen: new PMREMGenerator(gl), rt: null as WebGLRenderTarget | null, lastP: -1, lastT: 0, inside: false };
  }, [gl]);

  useLayoutEffect(() => {
    scene.fog = new FogExp2(0xc9d6e2, 0.0001);
    scene.add(follow);
    follow.add(sky);
    follow.add(stars);
    scene.add(sun);
    scene.add(sun.target);
    scene.add(hemi);
    return () => {
      scene.remove(follow, sun, sun.target, hemi);
      scene.fog = null;
      env.rt?.dispose();
      env.gen.dispose();
    };
  }, [scene, follow, sky, stars, sun, hemi, env]);

  const focus = useMemo(() => new Vector3(), []);
  const lightSpace = useMemo(() => new Vector3(), []);

  useFrame((state) => {
    const d = frame.dir;
    follow.position.copy(camera.position);
    syncSky(skyMat);
    (stars.material as ShaderMaterial).uniforms.uAlpha.value = smoothstep(0.35, 0.95, d.night);

    const fog = scene.fog as FogExp2 | null;
    if (!fog) return;
    fog.color.copy(d.fogColor);
    fog.density = d.fogDensity;
    // set the renderer clear to match the horizon (visible only at the very edges)
    gl.setClearColor(d.fogColor);

    sun.color.copy(d.sunColor);
    sun.intensity = d.sunIntensity;
    hemi.color.copy(d.skyColor);
    hemi.groundColor.copy(d.groundColor);
    // dentro do saguão o telhado corta a luz do céu: quem ilumina é o ambiente
    // de interior (forro, luminárias, vidraças) e as luzes práticas
    hemi.intensity = d.hemiIntensity * (1 - 0.7 * d.interior);
    scene.environmentIntensity = d.envIntensity;

    // shadow frustum follows what the camera looks at, snapped to texels
    const dist = Math.min(frame.shot.focus, 70);
    focus.copy(camera.position).addScaledVector(frame.viewDir, dist * 0.6);
    const texel = 220 / sun.shadow.mapSize.x;
    lightSpace.copy(focus);
    lightSpace.x = Math.round(lightSpace.x / texel) * texel;
    lightSpace.z = Math.round(lightSpace.z / texel) * texel;
    sun.target.position.copy(lightSpace);
    sun.position.copy(lightSpace).addScaledVector(d.sunDir, 600);
    sun.target.updateMatrixWorld();
    const wantShadows = d.shadows && d.sunElevation > 1.2 && journey.finaleRender === 0;
    sun.shadow.autoUpdate = wantShadows;
    if (!wantShadows) sun.shadow.needsUpdate = false;

    // safe tier: no float cube render targets, lean on the hemisphere light instead
    if (journey.quality === "safe") {
      hemi.intensity = d.hemiIntensity * 1.9;
      scene.environment = null;
      return;
    }

    // environment refresh
    const P = journey.render + journey.finaleRender * 0.4;
    const now = state.clock.elapsedTime;
    const moved = Math.abs(P - env.lastP) > 0.004;
    const inside = d.interior > 0.5 && journey.finaleRender === 0;
    if (env.lastP < 0 || inside !== env.inside || (moved && (now - env.lastT > 0.25 || journey.capturing))) {
      let rt: WebGLRenderTarget;
      if (inside) {
        // as vidraças acompanham a cor do céu lá fora
        for (const l of envInterior.lados) (l.material as MeshBasicMaterial).color.copy(d.fogColor).multiplyScalar(1.1 * d.envIntensity + 0.15);
        rt = env.gen.fromScene(envInterior.scene, 0.02, 0.1, 500);
      } else {
        syncSky(env.mat);
        rt = env.gen.fromScene(env.scene, 0, 0.1, 500);
      }
      env.inside = inside;
      env.rt?.dispose();
      env.rt = rt;
      scene.environment = rt.texture;
      env.lastP = P;
      env.lastT = now;
    }
  }, -1);

  return null;
}
