import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--nf-display" });
const sans = Inter_Tight({ subsets: ["latin"], variable: "--nf-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--nf-mono" });

export const metadata: Metadata = {
  title: "Salgado Filho, um documentário interativo sobre o aeroporto de Porto Alegre",
  description:
    "Documentário interativo em 3D sobre o Aeroporto Internacional Salgado Filho, da calçada de embarque ao voo ao pôr do sol sobre o Guaíba.",
  openGraph: {
    title: "Salgado Filho, documentário interativo",
    description: "Uma viagem em 3D pelo aeroporto de Porto Alegre, controlada pela rolagem da página.",
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = { themeColor: "#07080a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        {process.env.NODE_ENV !== "production" && (
          // dev-only: ?raf drives frames from timers (for headless / hidden preview panes)
          <script
            dangerouslySetInnerHTML={{
              __html: `if(location.search.indexOf('raf')>-1){var __l=0;window.requestAnimationFrame=function(cb){var n=performance.now();var d=Math.max(0,16-(n-__l));__l=n+d;return setTimeout(function(){cb(performance.now())},d)};window.cancelAnimationFrame=function(i){clearTimeout(i)};}`,
            }}
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
