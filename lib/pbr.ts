"use client";

import { useEffect, useMemo, useState } from "react";
import { NoColorSpace, RepeatWrapping, SRGBColorSpace, TextureLoader, Vector2, type MeshStandardMaterial, type Texture } from "three";

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

/** Uma carga por arquivo, compartilhada por todos os componentes. */
const cargas = new Map<string, Promise<Texture>>();
const prontas = new Map<string, Texture>();
function carregar(url: string) {
  let c = cargas.get(url);
  if (!c) {
    c = new TextureLoader().loadAsync(url).then((t) => {
      prontas.set(url, t);
      return t;
    });
    cargas.set(url, c);
  }
  return c;
}

/**
 * Devolve os mapas já na escala pedida (`repeat` em repetições por superfície
 * inteira, não por metro). Não segura a cena: enquanto as imagens chegam, o
 * resultado é vazio e a superfície aparece lisa; quando chegam, o componente
 * redesenha com relevo. Numa conexão lenta de celular, o aeroporto aparece na
 * hora e ganha textura depois, em vez de a tela ficar só com o céu.
 */
export function usePbr(id: PbrId, repeat: [number, number], opts: { cor?: boolean } = {}): Pbr {
  const urls = [arquivo(id, MAPAS.normal), arquivo(id, MAPAS.rugosidade), arquivo(id, MAPAS.cor)];
  const todas = () => urls.every((u) => prontas.has(u));
  const [ok, setOk] = useState(todas);
  useEffect(() => {
    if (ok) return;
    let vivo = true;
    Promise.all(urls.map(carregar))
      .then(() => vivo && setOk(true))
      .catch(() => {}); // sem textura, a superfície só fica lisa
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ok]);
  const [rx, ry] = repeat;
  return useMemo(() => {
    if (!ok) return {};
    const saida: Pbr = {
      normalMap: escalar(prontas.get(urls[0])!, rx, ry, false),
      roughnessMap: escalar(prontas.get(urls[1])!, rx, ry, false),
    };
    if (opts.cor) saida.map = escalar(prontas.get(urls[2])!, rx, ry, true);
    return saida;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, id, rx, ry, opts.cor]);
}

/** Começa a baixar as imagens cedo, sem esperar os componentes pedirem. */
export function preloadPbr() {
  for (const id of Object.values(PBR)) for (const m of Object.values(MAPAS)) carregar(arquivo(id, m)).catch(() => {});
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
