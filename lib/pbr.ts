"use client";

import { useTexture } from "@react-three/drei";
import { useMemo } from "react";
import { NoColorSpace, RepeatWrapping, SRGBColorSpace, Vector2, type MeshStandardMaterial, type Texture } from "three";

/**
 * Mapas de material fotografados (ambientCG, licença CC0), guardados em
 * /public/texturas. Eles entram por cima das texturas pintadas em canvas:
 * a cor continua vindo do desenho (marcações da pista, granilite, faixas) e a
 * foto entra no relevo e no brilho, que é o que dá matéria à superfície.
 */
export const PBR = {
  pedra: "tiles093",
  concreto: "concrete034",
  metal: "metal032",
  asfalto: "asphalt012",
} as const;

export type PbrId = (typeof PBR)[keyof typeof PBR];

const MAPAS = { cor: "cor", normal: "normal", rugosidade: "rugosidade" } as const;
const arquivo = (id: PbrId, mapa: string) => `/texturas/${id}/${mapa}.jpg`;

/** Uma cópia por escala de repetição; todas dividem a mesma imagem na memória da placa. */
const variantes = new Map<string, Texture>();
function escalar(base: Texture, rx: number, ry: number, srgb: boolean) {
  const chave = `${base.uuid}:${rx.toFixed(3)}x${ry.toFixed(3)}:${srgb}`;
  const pronta = variantes.get(chave);
  if (pronta) return pronta;
  const t = base.clone();
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  variantes.set(chave, t);
  return t;
}

export type Pbr = { map?: Texture; normalMap?: Texture; roughnessMap?: Texture };

/**
 * Carrega um conjunto de mapas e devolve as texturas já na escala pedida
 * (`repeat` em repetições por superfície inteira, não por metro).
 * Vale para todos os níveis, inclusive o seguro: é só leitura de textura,
 * sem alvo de renderização, então não pesa em driver instável.
 */
export function usePbr(id: PbrId, repeat: [number, number], opts: { cor?: boolean } = {}): Pbr {
  const urls = useMemo(() => ({ normalMap: arquivo(id, MAPAS.normal), roughnessMap: arquivo(id, MAPAS.rugosidade), map: arquivo(id, MAPAS.cor) }), [id]);
  const carregadas = useTexture(urls) as unknown as Record<string, Texture>;
  const [rx, ry] = repeat;
  return useMemo(() => {
    const saida: Pbr = {
      normalMap: escalar(carregadas.normalMap, rx, ry, false),
      roughnessMap: escalar(carregadas.roughnessMap, rx, ry, false),
    };
    if (opts.cor) saida.map = escalar(carregadas.map, rx, ry, true);
    return saida;
  }, [carregadas, rx, ry, opts.cor]);
}

/** Deixa as imagens prontas antes de a viagem começar. */
export function preloadPbr() {
  for (const id of Object.values(PBR)) for (const m of Object.values(MAPAS)) useTexture.preload(arquivo(id, m));
}

/** Média de cinza de cada mapa de rugosidade, medida nos arquivos instalados. */
export const MEDIA_RUGOSIDADE: Record<PbrId, number> = {
  tiles093: 0.748,
  concrete034: 0.516,
  metal032: 0.408,
  asphalt012: 0.805,
};

/**
 * Põe relevo e brilho fotografados em um material já existente. A rugosidade
 * base sobe na mesma proporção da média do mapa, para o material não ficar
 * mais brilhante do que era, só menos uniforme.
 */
export function aplicarPbr(material: MeshStandardMaterial, pbr: Pbr, id: PbrId, forca = 0.6) {
  if (!pbr.normalMap || material.normalMap) return material;
  material.normalMap = pbr.normalMap;
  material.normalScale = new Vector2(forca, forca);
  material.roughnessMap = pbr.roughnessMap ?? null;
  material.roughness = Math.min(1, material.roughness / MEDIA_RUGOSIDADE[id]);
  // asfalto quase não espelha: sem isso, em ângulo rasante ele pega o azul do céu
  if (id === PBR.asfalto) material.envMapIntensity = 0.45;
  material.needsUpdate = true;
  return material;
}
