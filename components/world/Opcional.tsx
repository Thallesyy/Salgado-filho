"use client";

import { Component, Suspense, type ReactNode } from "react";

/** Se uma parte baixada falhar (rede, memória), ela some e o resto da cena segue. */
class Guarda extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() {
    return { erro: true };
  }
  componentDidCatch(e: unknown) {
    console.warn("[poa] uma parte opcional da cena não carregou", e);
  }
  render() {
    return this.state.erro ? null : this.props.children;
  }
}

/**
 * Envolve o que depende de download (modelos, pessoas). Enquanto carrega, não
 * aparece e não segura o resto: o aeroporto desenhado por código surge na hora.
 */
export default function Opcional({ children }: { children: ReactNode }) {
  return (
    <Guarda>
      <Suspense fallback={null}>{children}</Suspense>
    </Guarda>
  );
}
