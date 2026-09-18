"use client";

import { useEffect } from "react";
import { mats } from "@/lib/materials";
import { aplicarPbr, PBR, usePbr } from "@/lib/pbr";

/**
 * Dá grão aos materiais compartilhados: aço com marca de laminação, concreto e
 * paredes claras com poeira e mancha. Só o relevo e o brilho vêm da fotografia,
 * a cor continua sendo a escolhida no projeto, para nada mudar de tom.
 * Superfícies grandes (piso, pátio, pista, calçada) têm material próprio, com a
 * repetição medida em metros.
 */
export default function Materiais() {
  const metal = usePbr(PBR.metal, [3, 3]);
  const concreto = usePbr(PBR.concreto, [2, 2]);

  useEffect(() => {
    const m = mats();
    aplicarPbr(m.steel, metal, PBR.metal, 0.35);
    aplicarPbr(m.darkSteel, metal, PBR.metal, 0.35);
    aplicarPbr(m.graphite, metal, PBR.metal, 0.3);
    aplicarPbr(m.concrete, concreto, PBR.concreto, 0.7);
    aplicarPbr(m.darkConcrete, concreto, PBR.concreto, 0.7);
    aplicarPbr(m.offWhite, concreto, PBR.concreto, 0.45);
    aplicarPbr(m.white, concreto, PBR.concreto, 0.3);
  }, [metal, concreto]);

  return null;
}
