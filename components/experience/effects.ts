import { BlendFunction, Effect, EffectAttribute } from "postprocessing";
import {
  BasicDepthPacking,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  RedFormat,
  ShaderMaterial,
  Uniform,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type DepthPackingStrategies,
  type PerspectiveCamera,
  type Texture,
  type WebGLRenderer,
} from "three";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";

/**
 * Camera motion blur by depth reprojection.
 * Each pixel's world position is rebuilt from depth and reprojected with
 * last frame's view-projection; the screen-space delta is the blur vector.
 * Pixels closer than `attachedDepth` are treated as rigidly attached to the
 * camera (the aircraft cabin, wing and engine while riding inside), so the
 * cabin stays crisp while the runway streaks past.
 * Also applies a speed-scaled chromatic aberration on the same taps.
 */
const motionBlurFrag = /* glsl */ `
uniform mat4 uInvViewProj;
uniform mat4 uPrevViewProj;
uniform float uStrength;
uniform float uMaxBlur;
uniform float uAttached;
uniform float uCA;
uniform float uNear;
uniform float uFar;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 world = uInvViewProj * ndc;
  world /= world.w;
  vec4 prev = uPrevViewProj * vec4(world.xyz, 1.0);
  vec2 prevUv = (prev.xy / prev.w) * 0.5 + 0.5;
  vec2 vel = (uv - prevUv) * uStrength;

  float viewZ = (uNear * uFar) / ((uFar - uNear) * depth - uFar);
  float dist = -viewZ;
  vel *= smoothstep(uAttached * 0.75, uAttached * 1.25 + 0.001, dist);

  float len = length(vel);
  if (len > uMaxBlur) vel *= uMaxBlur / len;
  len = min(len, uMaxBlur);

  vec2 caDir = (uv - 0.5) * uCA;
  if (len < 0.0006 && uCA < 0.0002) {
    outputColor = inputColor;
    return;
  }

  const int SAMPLES = 12;
  float jitter = hash12(gl_FragCoord.xy + fract(time) * 97.0);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < SAMPLES; i++) {
    float t = (float(i) + jitter) / float(SAMPLES) - 0.5;
    vec2 o = uv + vel * t;
    acc.r += texture2D(inputBuffer, o + caDir).r;
    acc.g += texture2D(inputBuffer, o).g;
    acc.b += texture2D(inputBuffer, o - caDir).b;
  }
  outputColor = vec4(acc / float(SAMPLES), inputColor.a);
}
`;

export class MotionBlurEffect extends Effect {
  private prevViewProj = new Matrix4();
  private viewProj = new Matrix4();
  private hasPrev = false;
  camera: PerspectiveCamera | null = null;
  strength = 0.5;
  attached = 0;
  ca = 0;
  /** intervalo fixo entre quadros (gravação de vídeo); 0 usa o relógio real */
  fixedDelta = 0;

  constructor() {
    super("MotionBlurEffect", motionBlurFrag, {
      attributes: EffectAttribute.CONVOLUTION | EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uInvViewProj", new Uniform(new Matrix4())],
        ["uPrevViewProj", new Uniform(new Matrix4())],
        ["uStrength", new Uniform(0.5)],
        ["uMaxBlur", new Uniform(0.045)],
        ["uAttached", new Uniform(0)],
        ["uCA", new Uniform(0)],
        ["uNear", new Uniform(0.1)],
        ["uFar", new Uniform(1000)],
      ]),
    });
  }

  /** Invalidate history (e.g. after a jump cut or still capture). */
  reset() {
    this.hasPrev = false;
  }

  update(_renderer: WebGLRenderer, _input: WebGLRenderTarget, deltaTime = 1 / 60) {
    const cam = this.camera;
    if (!cam) return;
    const u = this.uniforms;
    cam.updateMatrixWorld();
    this.viewProj.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    if (!this.hasPrev) {
      this.prevViewProj.copy(this.viewProj);
      this.hasPrev = true;
    }
    u.get("uInvViewProj")!.value.copy(this.viewProj).invert();
    u.get("uPrevViewProj")!.value.copy(this.prevViewProj);
    // normalise to a 60 fps shutter so blur length is frame-rate independent
    const dt = this.fixedDelta || deltaTime;
    const fpsScale = Math.min(2.5, 1 / 60 / Math.max(dt, 1 / 240));
    u.get("uStrength")!.value = this.strength * fpsScale;
    u.get("uAttached")!.value = this.attached;
    u.get("uCA")!.value = this.ca;
    u.get("uNear")!.value = cam.near;
    u.get("uFar")!.value = cam.far;
    this.prevViewProj.copy(this.viewProj);
  }

  set mainCamera(c: Camera) {
    this.camera = c as PerspectiveCamera;
  }
}

/* ------------------------------------------------------------------------ */

/**
 * Replaces NaN/Inf texels before any blur runs. One bad normal on a
 * degenerate triangle would otherwise be smeared across the whole frame
 * by the bloom mip chain. Flagged as convolution so it gets its own pass.
 */
export class SanitizeEffect extends Effect {
  constructor() {
    super(
      "SanitizeEffect",
      /* glsl */ `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = texture2D(inputBuffer, uv).rgb;
  if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
  outputColor = vec4(min(c, vec3(64.0)), inputColor.a);
}`,
      { attributes: EffectAttribute.CONVOLUTION, blendFunction: BlendFunction.NORMAL },
    );
  }
}

/* ------------------------------------------------------------------------ */

const exposureFrag = /* glsl */ `
uniform float uExposure;
uniform vec3 uWhite;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(inputColor.rgb * uExposure * uWhite, inputColor.a);
}
`;

export class ExposureEffect extends Effect {
  constructor() {
    super("ExposureEffect", exposureFrag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uExposure", new Uniform(1)],
        ["uWhite", new Uniform([1, 1, 1])],
      ]),
    });
  }
  set exposure(v: number) {
    this.uniforms.get("uExposure")!.value = v;
  }
}

/* ------------------------------------------------------------------------ */

const filmFrag = /* glsl */ `
uniform float uSaturation;
uniform float uContrast;
uniform float uVignette;
uniform float uGrain;
uniform float uLetterbox;
uniform float uWarmth;
uniform float uFade;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = inputColor.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSaturation);
  c = (c - 0.5) * uContrast + 0.5;
  // split tone: cool shadows, warm highlights
  vec3 shadowTint = vec3(0.94, 0.98, 1.06);
  vec3 highTint = mix(vec3(1.0), vec3(1.05, 1.0, 0.92), uWarmth);
  c *= mix(shadowTint, highTint, smoothstep(0.0, 0.8, l));

  vec2 q = uv - 0.5;
  q.x *= aspect;
  float v = smoothstep(0.95, 0.2, length(q) * (0.75 + uVignette * 0.6));
  c *= mix(1.0, v, uVignette);

  float g = hash(uv * resolution + fract(time * 13.0) * 100.0) - 0.5;
  c += g * uGrain * (1.0 - l * 0.6);

  float bar = uLetterbox * 0.11;
  float edge = step(uv.y, bar) + step(1.0 - bar, uv.y);
  c = mix(c, vec3(0.0), clamp(edge, 0.0, 1.0));

  c = mix(c, vec3(0.0), uFade);
  outputColor = vec4(clamp(c, 0.0, 1.0), inputColor.a);
}
`;

export class FilmEffect extends Effect {
  constructor() {
    super("FilmEffect", filmFrag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uSaturation", new Uniform(1)],
        ["uContrast", new Uniform(1)],
        ["uVignette", new Uniform(0.4)],
        ["uGrain", new Uniform(0.05)],
        ["uLetterbox", new Uniform(0)],
        ["uWarmth", new Uniform(0.5)],
        ["uFade", new Uniform(0)],
      ]),
    });
  }
  set(name: string, v: number) {
    this.uniforms.get(name)!.value = v;
  }
}

/* ------------------------------------------------------------------------ */

/**
 * Oclusão ambiente calculada só com a profundidade, sem renderizar a cena de
 * novo para tirar normais. Em meia resolução: a normal de cada pixel sai da
 * diferença de profundidade dos vizinhos, doze amostras em espiral medem o
 * quanto a geometria em volta tampa o céu, e um desfoque que respeita bordas
 * limpa o ruído antes de o resultado escurecer a imagem. É o que assenta os
 * bancos no piso, o avião no pátio e as pessoas no chão.
 */
const aoVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const depthHelpers = /* glsl */ `
#include <packing>
uniform highp sampler2D tDepth;
float depthAt(vec2 uv) {
#if DEPTH_PACKING == 3201
  return unpackRGBAToDepth(texture2D(tDepth, uv));
#else
  return texture2D(tDepth, uv).r;
#endif
}
`;

const aoFrag = /* glsl */ `
${depthHelpers}
uniform mat4 uProj;
uniform mat4 uInvProj;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uMaxDist;
uniform float uAspect;
uniform float uSeed;
varying vec2 vUv;

vec3 viewPos(vec2 uv, float d) {
  vec4 v = uInvProj * vec4(vec3(uv, d) * 2.0 - 1.0, 1.0);
  return v.xyz / v.w;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  float d = depthAt(vUv);
  if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = viewPos(vUv, d);
  float dist = -P.z;
  if (dist > uMaxDist) { gl_FragColor = vec4(1.0); return; }

  // normal pelo vizinho mais parecido de cada lado, para não errar nas silhuetas
  vec2 tx = uTexel;
  vec3 Pr = viewPos(vUv + vec2(tx.x, 0.0), depthAt(vUv + vec2(tx.x, 0.0)));
  vec3 Pl = viewPos(vUv - vec2(tx.x, 0.0), depthAt(vUv - vec2(tx.x, 0.0)));
  vec3 Pu = viewPos(vUv + vec2(0.0, tx.y), depthAt(vUv + vec2(0.0, tx.y)));
  vec3 Pd = viewPos(vUv - vec2(0.0, tx.y), depthAt(vUv - vec2(0.0, tx.y)));
  vec3 dx = abs(Pr.z - P.z) < abs(P.z - Pl.z) ? Pr - P : P - Pl;
  vec3 dy = abs(Pu.z - P.z) < abs(P.z - Pd.z) ? Pu - P : P - Pd;
  vec3 N = normalize(cross(dx, dy));

  // raio em metros que cresce com a distância: contato de perto, massa de longe
  float radius = uRadius * clamp(dist / 14.0, 0.7, 3.5);
  float rUv = radius * uProj[1][1] * 0.5 / dist;
  if (rUv < uTexel.y * 2.5) { gl_FragColor = vec4(1.0); return; }
  rUv = min(rUv, 0.12);

  float ang = hash12(gl_FragCoord.xy + uSeed) * 6.2831853;
  float occ = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float fi = float(i);
    float r = (fi + 0.5) / float(SAMPLES);
    float a = ang + fi * 2.3999632;
    vec2 suv = vUv + vec2(cos(a) / uAspect, sin(a)) * (r * rUv);
    vec3 S = viewPos(suv, depthAt(suv));
    vec3 v = S - P;
    float vv = dot(v, v);
    float vn = dot(v, N);
    float queda = max(0.0, 1.0 - vv / (radius * radius));
    // estilo Alchemy: oclusor perto e de frente pesa mais que um distante e rasante
    float termo = max(0.0, vn - 0.015 * radius) / (vv + 0.02 * radius * radius);
    occ += min(1.0, termo * radius * 0.6) * queda;
  }
  float ao = max(pow(clamp(1.0 - 2.6 * occ / float(SAMPLES), 0.0, 1.0), 1.6), 0.15);
  ao = mix(ao, 1.0, smoothstep(uMaxDist * 0.6, uMaxDist, dist));
  gl_FragColor = vec4(ao, 0.0, 0.0, 1.0);
}
`;

const aoBlurFrag = /* glsl */ `
${depthHelpers}
uniform sampler2D tAO;
uniform vec2 uDir;
uniform float uNear;
uniform float uFar;
varying vec2 vUv;

float viewDist(vec2 uv) {
  return -perspectiveDepthToViewZ(depthAt(uv), uNear, uFar);
}

void main() {
  float z0 = viewDist(vUv);
  float soma = 0.0;
  float pesos = 0.0;
  for (int i = -3; i <= 3; i++) {
    vec2 uv = vUv + uDir * float(i);
    float z = viewDist(uv);
    float borda = max(0.0, 1.0 - abs(z - z0) / (z0 * 0.04 + 0.05));
    float w = exp(-float(i * i) / 6.0) * borda;
    soma += texture2D(tAO, uv).r * w;
    pesos += w;
  }
  gl_FragColor = vec4(pesos > 0.0 ? soma / pesos : 1.0, 0.0, 0.0, 1.0);
}
`;

const aoCompositeFrag = /* glsl */ `
uniform sampler2D tAO;
uniform float uIntensity;
uniform float uDebug;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float ao = texture2D(tAO, uv).r;
  if (uDebug > 0.5) { outputColor = vec4(vec3(ao), inputColor.a); return; }
  // luzes acesas, telas e céu claro não escurecem
  float lum = dot(inputColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  ao = mix(ao, 1.0, smoothstep(1.2, 4.0, lum));
  outputColor = vec4(inputColor.rgb * mix(1.0, ao, uIntensity), inputColor.a);
}
`;

export class AmbientOcclusionEffect extends Effect {
  camera: PerspectiveCamera | null = null;
  intensity = 0.8;
  /** mostra só o buffer de oclusão (ferramenta de desenvolvimento) */
  debug = false;
  radius = 0.9;
  maxDistance = 260;
  private rtA: WebGLRenderTarget;
  private rtB: WebGLRenderTarget;
  private aoMat: ShaderMaterial;
  private blurMat: ShaderMaterial;
  private quad: FullScreenQuad;
  private depth: Texture | null = null;
  private seed = 0;

  constructor(samples = 12) {
    super("AmbientOcclusionEffect", aoCompositeFrag, {
      attributes: EffectAttribute.DEPTH,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["tAO", new Uniform(null)],
        ["uIntensity", new Uniform(0.8)],
        ["uDebug", new Uniform(0)],
      ]),
    });
    const alvo = () =>
      new WebGLRenderTarget(1, 1, { type: HalfFloatType, format: RedFormat, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false });
    this.rtA = alvo();
    this.rtB = alvo();
    const defines = { SAMPLES: samples, DEPTH_PACKING: BasicDepthPacking };
    this.aoMat = new ShaderMaterial({
      vertexShader: aoVert,
      fragmentShader: aoFrag,
      defines: { ...defines },
      uniforms: {
        tDepth: { value: null },
        uProj: { value: new Matrix4() },
        uInvProj: { value: new Matrix4() },
        uTexel: { value: new Vector2(1, 1) },
        uRadius: { value: 0.9 },
        uMaxDist: { value: 260 },
        uAspect: { value: 1 },
        uSeed: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.blurMat = new ShaderMaterial({
      vertexShader: aoVert,
      fragmentShader: aoBlurFrag,
      defines: { ...defines },
      uniforms: {
        tDepth: { value: null },
        tAO: { value: null },
        uDir: { value: new Vector2() },
        uNear: { value: 0.1 },
        uFar: { value: 1000 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new FullScreenQuad(this.aoMat);
    this.uniforms.get("tAO")!.value = this.rtB.texture;
  }

  set mainCamera(c: Camera) {
    this.camera = c as PerspectiveCamera;
  }

  setDepthTexture(depthTexture: Texture, depthPacking: DepthPackingStrategies = BasicDepthPacking) {
    this.depth = depthTexture;
    for (const m of [this.aoMat, this.blurMat]) {
      m.uniforms.tDepth.value = depthTexture;
      if (m.defines.DEPTH_PACKING !== depthPacking) {
        m.defines.DEPTH_PACKING = depthPacking;
        m.needsUpdate = true;
      }
    }
  }

  setSize(width: number, height: number) {
    const w = Math.max(1, Math.round(width / 2));
    const h = Math.max(1, Math.round(height / 2));
    this.rtA.setSize(w, h);
    this.rtB.setSize(w, h);
    this.aoMat.uniforms.uTexel.value.set(1 / width, 1 / height);
    this.aoMat.uniforms.uAspect.value = width / height;
  }

  update(renderer: WebGLRenderer) {
    const cam = this.camera;
    this.uniforms.get("uIntensity")!.value = this.intensity;
    this.uniforms.get("uDebug")!.value = this.debug ? 1 : 0;
    if (!cam || !this.depth || this.intensity <= 0.001) return;
    const u = this.aoMat.uniforms;
    u.uProj.value.copy(cam.projectionMatrix);
    u.uInvProj.value.copy(cam.projectionMatrixInverse);
    u.uRadius.value = this.radius;
    u.uMaxDist.value = this.maxDistance;
    this.seed = (this.seed + 1) % 64;
    u.uSeed.value = this.seed * 17.0;
    const b = this.blurMat.uniforms;
    b.uNear.value = cam.near;
    b.uFar.value = cam.far;

    this.quad.material = this.aoMat;
    renderer.setRenderTarget(this.rtA);
    this.quad.render(renderer);

    this.quad.material = this.blurMat;
    b.tAO.value = this.rtA.texture;
    b.uDir.value.set(1 / this.rtA.width, 0);
    renderer.setRenderTarget(this.rtB);
    this.quad.render(renderer);

    b.tAO.value = this.rtB.texture;
    b.uDir.value.set(0, 1 / this.rtA.height);
    renderer.setRenderTarget(this.rtA);
    this.quad.render(renderer);
    this.uniforms.get("tAO")!.value = this.rtA.texture;
  }

  dispose() {
    this.rtA.dispose();
    this.rtB.dispose();
    this.aoMat.dispose();
    this.blurMat.dispose();
    this.quad.dispose();
    super.dispose();
  }
}

export const tmpVec2 = new Vector2();
