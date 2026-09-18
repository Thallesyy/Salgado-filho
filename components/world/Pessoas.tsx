"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AnimationMixer,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  DataUtils,
  DynamicDrawUsage,
  Euler,
  HalfFloatType,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  Quaternion,
  RGBADepthPacking,
  RGBAFormat,
  UnsignedByteType,
  Vector3,
  type AnimationClip,
  type Group,
  type SkinnedMesh,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clone as clonarComEsqueleto } from "three/examples/jsm/utils/SkeletonUtils.js";
import { journey } from "@/lib/journey";
import { mulberry32 } from "@/lib/math";
import type { Agent } from "./People";

/**
 * Pessoas de verdade no lugar dos bonecos: oito personagens com esqueleto e
 * animação (Quaternius, licença CC0). Mil pessoas animadas com esqueleto
 * custariam caro, então cada modelo tem a animação "assada" uma vez no carregamento:
 * oito quadros da caminhada, parado, sentado e atendendo no balcão viram uma
 * textura com a posição e a normal de cada vértice em cada pose. A placa de vídeo
 * lê a pose de cada pessoa nessa textura e mistura dois quadros vizinhos, então
 * a caminhada fica suave e cada modelo inteiro sai em uma única chamada de desenho.
 */
export const PESSOA = {
  homemCasual: { url: "/modelos/pessoas/homem-casual.glb", altura: 1.76 },
  homemTerno: { url: "/modelos/pessoas/homem-terno.glb", altura: 1.78 },
  homemMoletom: { url: "/modelos/pessoas/homem-moletom.glb", altura: 1.74 },
  homemColete: { url: "/modelos/pessoas/homem-colete.glb", altura: 1.77 },
  mulherTerno: { url: "/modelos/pessoas/mulher-terno.glb", altura: 1.66 },
  mulherVestido: { url: "/modelos/pessoas/mulher-vestido.glb", altura: 1.63 },
  mulherCasual: { url: "/modelos/pessoas/mulher-casual.glb", altura: 1.65 },
  mulherColete: { url: "/modelos/pessoas/mulher-colete.glb", altura: 1.66 },
} as const;
type Tipo = keyof typeof PESSOA;
const TIPOS = Object.keys(PESSOA) as Tipo[];

const VIAJANTES: Tipo[] = ["homemCasual", "homemTerno", "homemMoletom", "mulherTerno", "mulherVestido", "mulherCasual"];
const EQUIPE: Tipo[] = ["homemTerno", "mulherTerno"];
const PATIO: Tipo[] = ["homemColete", "mulherColete"];

function tipoDe(ag: Agent): Tipo {
  const r = mulberry32(ag.seed * 131 + 5);
  const lista = ag.vest ? PATIO : ag.uniform ? EQUIPE : VIAJANTES;
  return lista[Math.floor(r() * lista.length) % lista.length];
}

const PASSOS = 8;
const POSE = { parado: PASSOS, sentado: PASSOS + 1, balcao: PASSOS + 2 };
const N_POSES = PASSOS + 3;
/** altura do quadril de quem está sentado em banco ou poltrona */
const QUADRIL_SENTADO = 0.5;

/* --------------------------------------------------------------- assar poses */

type Assado = {
  geo: BufferGeometry;
  pos: DataTexture;
  nrm: DataTexture;
  largura: number;
  linhas: number;
  /** metros andados em um ciclo completo da caminhada */
  passada: number;
};

const assados = new Map<string, Assado>();
const _v = new Vector3();
const _w = new Vector3();
const _q = new Quaternion();

const osso = (raiz: Object3D, nome: string) => raiz.getObjectByName(nome) ?? raiz.getObjectByName(nome.replace(/\./g, ""));

/** Gira o osso em torno do eixo local que melhor satisfaz o critério (medido na ponta). */
function girarMelhor(o: Object3D, ponta: Object3D, raiz: Object3D, ang: number, nota: (p: Vector3) => number) {
  const original = o.quaternion.clone();
  let melhor = -Infinity;
  let escolhido = original.clone();
  for (const eixo of [new Vector3(1, 0, 0), new Vector3(0, 0, 1)]) {
    for (const s of [1, -1]) {
      o.quaternion.copy(original).multiply(_q.setFromAxisAngle(eixo, s * ang));
      raiz.updateMatrixWorld(true);
      const n = nota(ponta.getWorldPosition(_w));
      if (n > melhor) {
        melhor = n;
        escolhido = o.quaternion.clone();
      }
    }
  }
  o.quaternion.copy(escolhido);
  raiz.updateMatrixWorld(true);
}

function assar(url: string, cena: Object3D, clips: AnimationClip[], altura: number): Assado {
  const pronto = assados.get(url);
  if (pronto) return pronto;

  const raiz = clonarComEsqueleto(cena);
  raiz.updateMatrixWorld(true);
  const malhas: SkinnedMesh[] = [];
  raiz.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh) malhas.push(o as SkinnedMesh);
  });
  const mixer = new AnimationMixer(raiz);
  const clip = (n: string) => clips.find((c) => c.name === n || c.name.endsWith("|" + n));

  const total = malhas.reduce((s, m) => s + m.geometry.attributes.position.count, 0);
  const largura = Math.min(2048, total);
  const linhas = Math.ceil(total / largura);
  const porPose = largura * linhas;
  const bruto = new Float32Array(porPose * N_POSES * 4);
  const normais = new Uint8Array(porPose * N_POSES * 4);
  const quadril = osso(raiz, "Hips");

  const capturar = (pose: number) => {
    raiz.updateMatrixWorld(true);
    let base = 0;
    for (const m of malhas) {
      const g = m.geometry;
      const a = g.attributes.position;
      const tmp = new Float32Array(a.count * 3);
      for (let i = 0; i < a.count; i++) {
        _v.fromBufferAttribute(a, i);
        m.applyBoneTransform(i, _v);
        _v.applyMatrix4(m.matrixWorld);
        tmp[i * 3] = _v.x;
        tmp[i * 3 + 1] = _v.y;
        tmp[i * 3 + 2] = _v.z;
      }
      const tg = new BufferGeometry();
      tg.setAttribute("position", new BufferAttribute(tmp, 3));
      if (g.index) tg.setIndex(g.index);
      tg.computeVertexNormals();
      const nn = tg.attributes.normal.array as Float32Array;
      for (let i = 0; i < a.count; i++) {
        const o = (pose * porPose + base + i) * 4;
        bruto[o] = tmp[i * 3];
        bruto[o + 1] = tmp[i * 3 + 1];
        bruto[o + 2] = tmp[i * 3 + 2];
        bruto[o + 3] = 1;
        normais[o] = Math.round((nn[i * 3] * 0.5 + 0.5) * 255);
        normais[o + 1] = Math.round((nn[i * 3 + 1] * 0.5 + 0.5) * 255);
        normais[o + 2] = Math.round((nn[i * 3 + 2] * 0.5 + 0.5) * 255);
        normais[o + 3] = 255;
      }
      tg.dispose();
      base += a.count;
    }
    return quadril ? quadril.getWorldPosition(new Vector3()) : new Vector3();
  };

  // caminhada: oito quadros do ciclo, medindo o quanto o pé varre para trás
  const andar = clip("Walk");
  const pe = osso(raiz, "Foot.L") ?? osso(raiz, "LowerLeg.L_end");
  let peMin = Infinity;
  let peMax = -Infinity;
  if (andar) {
    const acao = mixer.clipAction(andar);
    acao.play();
    for (let k = 0; k < PASSOS; k++) {
      mixer.setTime((andar.duration * k) / PASSOS);
      capturar(k);
      if (pe) {
        const z = pe.getWorldPosition(_w).z;
        peMin = Math.min(peMin, z);
        peMax = Math.max(peMax, z);
      }
    }
    acao.stop();
  }

  // parado
  const paradoClip = clip("Idle_Neutral") ?? clip("Idle");
  if (paradoClip) {
    const acao = mixer.clipAction(paradoClip);
    acao.play();
    mixer.setTime(paradoClip.duration * 0.3);
  }
  capturar(POSE.parado);
  // escala: da sola ao topo da cabeça na pose parada
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < total; i++) {
    const y = bruto[(POSE.parado * porPose + i) * 4 + 1];
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const s = altura / Math.max(1e-6, maxY - minY);

  // sentado: coxas para a frente, canelas para baixo, antebraços no colo
  for (const lado of ["L", "R"]) {
    const coxa = osso(raiz, `UpperLeg.${lado}`);
    const canela = osso(raiz, `LowerLeg.${lado}`);
    const tornozelo = osso(raiz, `LowerLeg.${lado}_end`);
    if (coxa && canela) girarMelhor(coxa, canela, raiz, 1.5, (p) => p.z);
    if (canela && tornozelo) girarMelhor(canela, tornozelo, raiz, 1.5, (p) => -p.y);
    const pezinho = osso(raiz, `Foot.${lado}`);
    if (pezinho && tornozelo && pezinho.parent && !tornozelo.children.includes(pezinho)) {
      const alvo = tornozelo.getWorldPosition(new Vector3());
      pezinho.position.copy(pezinho.parent.worldToLocal(alvo));
    }
    const antebraco = osso(raiz, `LowerArm.${lado}`);
    const pulso = osso(raiz, `Wrist.${lado}`);
    if (antebraco && pulso) girarMelhor(antebraco, pulso, raiz, 1.1, (p) => p.z);
  }
  const quadrilSentado = capturar(POSE.sentado);

  // atendente no balcão
  const balcao = clip("Interact");
  if (balcao) {
    mixer.stopAllAction();
    const acao = mixer.clipAction(balcao);
    acao.play();
    mixer.setTime(balcao.duration * 0.45);
  }
  capturar(POSE.balcao);

  // leva tudo para metros, com os pés em y = 0 (e o quadril na altura do assento quando sentado)
  for (let p = 0; p < N_POSES; p++) {
    const dy = p === POSE.sentado ? QUADRIL_SENTADO - (quadrilSentado.y - minY) * s : 0;
    for (let i = 0; i < total; i++) {
      const o = (p * porPose + i) * 4;
      bruto[o] *= s;
      bruto[o + 1] = (bruto[o + 1] - minY) * s + dy;
      bruto[o + 2] *= s;
    }
  }

  // geometria base: posição da pose parada, cor de cada material e índices
  const posBase = new Float32Array(total * 3);
  const cores = new Float32Array(total * 3);
  const indices: number[] = [];
  let base = 0;
  for (const m of malhas) {
    const a = m.geometry.attributes.position;
    const cor = (m.material as MeshStandardMaterial).color ?? new Color(0.5, 0.5, 0.5);
    for (let i = 0; i < a.count; i++) {
      const o = (POSE.parado * porPose + base + i) * 4;
      posBase.set([bruto[o], bruto[o + 1], bruto[o + 2]], (base + i) * 3);
      cores.set([cor.r, cor.g, cor.b], (base + i) * 3);
    }
    const idx = m.geometry.index;
    if (idx) for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + base);
    else for (let i = 0; i < a.count; i++) indices.push(i + base);
    base += a.count;
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(posBase, 3));
  geo.setAttribute("color", new BufferAttribute(cores, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const meio = new Uint16Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) meio[i] = DataUtils.toHalfFloat(bruto[i]);
  const pos = new DataTexture(meio, largura, linhas * N_POSES, RGBAFormat, HalfFloatType);
  const nrm = new DataTexture(normais, largura, linhas * N_POSES, RGBAFormat, UnsignedByteType);
  for (const t of [pos, nrm]) {
    t.minFilter = t.magFilter = NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
  }

  // o pé fica no chão cerca de 60% do ciclo, varrendo para trás a distância do passo
  const varrido = Number.isFinite(peMax - peMin) ? (peMax - peMin) * s : 0.8;
  const passada = Math.min(1.8, Math.max(1.0, varrido / 0.6));

  mixer.stopAllAction();
  const pronto2: Assado = { geo, pos, nrm, largura, linhas, passada };
  assados.set(url, pronto2);
  return pronto2;
}

/* -------------------------------------------------------- material com poses */

const vatPars = /* glsl */ `
uniform sampler2D uVatPos;
uniform sampler2D uVatNrm;
uniform float uVatW;
uniform float uVatRows;
attribute vec3 aAnim;
vec3 vatLer(sampler2D tex, float pose) {
  int W = int(uVatW);
  int id = gl_VertexID;
  return texelFetch(tex, ivec2(id % W, int(pose + 0.5) * int(uVatRows) + id / W), 0).xyz;
}
`;

function comPoses(material: MeshStandardMaterial | MeshDepthMaterial, a: Assado, normais: boolean) {
  const uniforms = {
    uVatPos: { value: a.pos },
    uVatNrm: { value: a.nrm },
    uVatW: { value: a.largura },
    uVatRows: { value: a.linhas },
  };
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    let vs = shader.vertexShader.replace("#include <common>", "#include <common>\n" + vatPars);
    if (normais)
      vs = vs.replace(
        "#include <beginnormal_vertex>",
        `vec3 objectNormal = normalize(mix(vatLer(uVatNrm, aAnim.x), vatLer(uVatNrm, aAnim.y), aAnim.z) * 2.0 - 1.0);
#ifdef USE_TANGENT
vec3 objectTangent = vec3(tangent.xyz);
#endif`,
      );
    vs = vs.replace("#include <begin_vertex>", "vec3 transformed = mix(vatLer(uVatPos, aAnim.x), vatLer(uVatPos, aAnim.y), aAnim.z);");
    shader.vertexShader = vs;
  };
  material.customProgramCacheKey = () => "poa-vat-" + (normais ? "n" : "d");
  return material;
}

/* ------------------------------------------------------------------ multidão */

type Grupo = { mesh: InstancedMesh; anim: InstancedBufferAttribute; passada: number; n: number };

const _m = new Matrix4();
const _mb = new Matrix4();
const _p = new Vector3();
const _s = new Vector3();
const _e = new Euler();
const _qa = new Quaternion();
const _rot = new Matrix4();
const _raiz = new Matrix4();

/**
 * Multidão de pessoas animadas. Quem anda vai e volta entre dois pontos com a
 * cadência amarrada à distância percorrida (o pé não escorrega), quem espera
 * fica parado com um leve balanço, e os sentados usam a pose de assento.
 */
export default function Crowd({ agents, visibleIn, scale = 1 }: { agents: Agent[]; visibleIn: [number, number][]; scale?: number }) {
  const group = useRef<Group>(null);
  const gltfs = TIPOS.map((t) => useGLTF(PESSOA[t].url)); // eslint-disable-line react-hooks/rules-of-hooks

  // placas fracas desenham menos gente: 3 de cada 4 no nível baixo, 3 de cada 5 no seguro
  const lista = useMemo(() => {
    if (journey.quality === "safe") return agents.filter((_, i) => i % 5 < 3);
    if (journey.quality === "low") return agents.filter((_, i) => i % 4 !== 3);
    return agents;
  }, [agents]);
  const tipos = useMemo(() => lista.map(tipoDe), [lista]);

  const grupos = useMemo(() => {
    const out = {} as Record<Tipo, Grupo>;
    TIPOS.forEach((t, k) => {
      const a = assar(PESSOA[t].url, gltfs[k].scene, gltfs[k].animations, PESSOA[t].altura);
      const n = tipos.filter((x) => x === t).length;
      // atributos compartilhados entre todas as multidões: a placa recebe cada modelo uma vez só
      const geo = new BufferGeometry();
      for (const [nome, attr] of Object.entries(a.geo.attributes)) geo.setAttribute(nome, attr);
      geo.setIndex(a.geo.index);
      geo.boundingSphere = a.geo.boundingSphere;
      const anim = new InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3), 3);
      anim.setUsage(DynamicDrawUsage);
      geo.setAttribute("aAnim", anim);
      const mat = comPoses(new MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }), a, true);
      const mesh = new InstancedMesh(geo, mat, Math.max(1, n));
      mesh.customDepthMaterial = comPoses(new MeshDepthMaterial({ depthPacking: RGBADepthPacking }), a, false);
      mesh.count = n;
      mesh.visible = n > 0;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      out[t] = { mesh, anim, passada: a.passada, n };
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipos, ...gltfs.map((g) => g.scene)]);

  // sombra de contato: um disco suave sob cada pessoa, que funciona até sem mapa de sombra
  const sombras = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.45, "rgba(0,0,0,0.55)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new CanvasTexture(c);
    const geo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const forca = journey.quality === "safe" ? 0.55 : 0.35;
    const mat = new MeshBasicMaterial({ map: tex, transparent: true, opacity: forca, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });
    mat.alphaMap = tex;
    const im = new InstancedMesh(geo, mat, Math.max(1, lista.length));
    im.count = lista.length;
    im.frustumCulled = false;
    im.renderOrder = 1;
    return im;
  }, [lista]);

  const malas = useMemo(() => {
    const corpo = mergeGeometries([
      new RoundedBoxGeometry(0.4, 0.58, 0.24, 2, 0.04).translate(0, 0.34, 0),
      new BoxGeometry(0.05, 0.05, 0.05).translate(-0.16, 0.025, -0.09).toNonIndexed(),
      new BoxGeometry(0.05, 0.05, 0.05).translate(0.16, 0.025, -0.09).toNonIndexed(),
    ])!;
    const alca = mergeGeometries([
      new BoxGeometry(0.018, 0.5, 0.018).translate(-0.1, 0.88, -0.1),
      new BoxGeometry(0.018, 0.5, 0.018).translate(0.1, 0.88, -0.1),
      new BoxGeometry(0.24, 0.03, 0.03).translate(0, 1.13, -0.1),
    ])!;
    const comMala = lista.filter((a) => a.bag && !a.vest && !a.uniform).length;
    const cap = Math.max(1, comMala);
    const c = new Color();
    const corpoMesh = new InstancedMesh(corpo, new MeshStandardMaterial({ roughness: 0.42, metalness: 0.1 }), cap);
    const alcaMesh = new InstancedMesh(alca, new MeshStandardMaterial({ color: "#1d1f23", roughness: 0.5, metalness: 0.6 }), cap);
    let k = 0;
    lista.forEach((ag) => {
      if (!ag.bag || ag.vest || ag.uniform) return;
      const r = mulberry32(ag.seed * 17 + 3);
      const paleta = ["#23262d", "#3a4a63", "#6b2a2e", "#9aa3ad", "#1f3b34", "#c7b89b", "#2e2e30", "#5b4636"];
      corpoMesh.setColorAt(k++, c.set(paleta[Math.floor(r() * paleta.length)]));
    });
    for (const m of [corpoMesh, alcaMesh]) {
      m.count = comMala;
      m.castShadow = true;
      m.receiveShadow = true;
      m.frustumCulled = false;
    }
    return { corpo: corpoMesh, alca: alcaMesh };
  }, [lista]);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const p = journey.render;
    let vis = false;
    for (const [a, b] of visibleIn) if (p >= a && p <= b) vis = true;
    g.visible = vis;
    if (!vis) return;
    const t = journey.time;
    const vagas = {} as Record<Tipo, number>;
    for (const tp of TIPOS) vagas[tp] = 0;
    let mala = 0;

    lista.forEach((ag, i) => {
      const tipo = tipos[i];
      const gr = grupos[tipo];
      const slot = vagas[tipo]++;
      const rr = mulberry32(ag.seed * 31 + 7);
      const h = (0.94 + rr() * 0.12) * scale;
      const fase0 = rr() * 100;
      let x = ag.a[0];
      let z = ag.a[2];
      let yaw = ag.yaw ?? 0;
      let poseA = POSE.parado;
      let poseB = POSE.parado;
      let mistura = 0;
      let andando = false;

      if (ag.kind === "walk" && ag.b) {
        const dx = ag.b[0] - ag.a[0];
        const dz = ag.b[2] - ag.a[2];
        const len = Math.hypot(dx, dz) || 1;
        const vel = ag.speed ?? 1.3;
        const dist = t * vel + fase0 * len;
        const s = dist % (2 * len);
        const ida = s < len;
        const u = ida ? s / len : 2 - s / len;
        x = ag.a[0] + dx * u;
        z = ag.a[2] + dz * u;
        yaw = Math.atan2(ida ? dx : -dx, ida ? dz : -dz);
        const f = ((dist / (gr.passada * h)) % 1) * PASSOS;
        poseA = Math.floor(f) % PASSOS;
        poseB = (poseA + 1) % PASSOS;
        mistura = f - Math.floor(f);
        andando = true;
      } else if (ag.kind === "sit") {
        poseA = poseB = POSE.sentado;
      } else {
        if (ag.uniform && ag.kind === "stand" && rr() < 0.7) poseA = poseB = POSE.balcao;
        yaw += Math.sin(t * 0.3 + fase0) * 0.06;
      }

      _q.setFromEuler(_e.set(0, yaw, 0));
      _m.compose(_p.set(x, ag.a[1], z), _q, _s.setScalar(h));
      gr.mesh.setMatrixAt(slot, _m);
      gr.anim.setXYZ(slot, poseA, poseB, mistura);
      const raio = (ag.kind === "sit" ? 1.0 : 0.85) * h;
      _mb.compose(_p.set(x, ag.a[1] + 0.012, z), _q, _s.set(raio, 1, raio * (ag.kind === "sit" ? 1.3 : 1)));
      sombras.setMatrixAt(i, _mb);

      if (ag.bag && !ag.vest && !ag.uniform) {
        // mala de rodinhas: puxada atrás e inclinada quando anda, de pé ao lado quando espera
        if (andando) _mb.makeTranslation(0.24, 0, -0.5).multiply(_rot.makeRotationFromEuler(_e.set(0.5, 0, 0)));
        else if (ag.kind === "sit") _mb.makeTranslation(0.42, 0, 0.45);
        else _mb.makeTranslation(0.36, 0, 0.12);
        _qa.setFromEuler(_e.set(0, yaw, 0));
        _raiz.compose(_p.set(x, ag.a[1], z), _qa, _s.setScalar(scale)).multiply(_mb);
        malas.corpo.setMatrixAt(mala, _raiz);
        // alça recolhida quando a mala está parada
        if (!andando) _raiz.multiply(_rot.makeTranslation(0, -0.44, 0));
        malas.alca.setMatrixAt(mala, _raiz);
        mala++;
      }
    });

    for (const tp of TIPOS) {
      const gr = grupos[tp];
      if (!gr.n) continue;
      gr.mesh.instanceMatrix.needsUpdate = true;
      gr.anim.needsUpdate = true;
    }
    sombras.instanceMatrix.needsUpdate = true;
    malas.corpo.instanceMatrix.needsUpdate = true;
    malas.alca.instanceMatrix.needsUpdate = true;
  }, 0);

  return (
    <group ref={group}>
      {TIPOS.map((t) => (
        <primitive key={t} object={grupos[t].mesh} />
      ))}
      <primitive object={sombras} />
      <primitive object={malas.corpo} />
      <primitive object={malas.alca} />
    </group>
  );
}

TIPOS.forEach((t) => useGLTF.preload(PESSOA[t].url));
