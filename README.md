# Salgado Filho, um documentário interativo em 3D

Um filme controlado pela rolagem da página sobre o Aeroporto Internacional Salgado Filho
(POA, SBPA). A viagem começa acima da via de embarque, atravessa o Terminal 1, passa pela
inspeção de segurança, embarca pela ponte, decola da pista 29, sobrevoa Porto Alegre no pôr
do sol sobre o Guaíba e termina com a vista aérea do aeroporto ao anoitecer. O epílogo traz
linha do tempo, seção sobre a enchente de 2024, gráfico interativo, galeria e fontes.

**Tecnologias:** Next.js 15 (App Router), TypeScript, Tailwind CSS 4, React Three Fiber,
Three.js, drei, postprocessing, GSAP ScrollTrigger, Framer Motion e Web Audio.

## Como rodar

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
```

O arquivo `.npmrc` usa `legacy-peer-deps` porque o `@react-three/fiber` declara dependências
opcionais de React Native.

## Como funciona

- **Um número comanda tudo.** O GSAP ScrollTrigger transforma a rolagem em `journey.progress`
  (de 0 a 1), com inércia. Câmera, avião, sol, névoa, cor, som e tipografia são funções desse
  número (`lib/world.ts`, `lib/director.ts`, `lib/soundscape.ts`), então rolar para trás
  rebobina o filme inteiro.
- **Coreografia da câmera e do avião** (`lib/track.ts`, `lib/world.ts`): curvas de Hermite com
  tangentes proporcionais ao tempo, para a velocidade não dar solavancos entre as chaves. A
  câmera troca do espaço do mundo para o espaço do avião na porta L1, com chaves sobrepostas
  para não haver emenda, e volta ao mundo quando sai da aeronave. A inclinação nas curvas vem
  da curvatura da trajetória.
- **Desenho por código, com recursos CC0 onde fazem diferença.** As marcações da pista, o
  granilite do piso, a sinalização, o painel de voos, a pintura do avião (com recorte real na
  porta aberta) e as nuvens são pintados em canvas durante a execução (`lib/textures.ts`). Por
  cima disso entram recursos em domínio público: móveis e objetos do Poly Haven
  (`public/modelos`, `components/world/Props.tsx`), relevo e brilho fotografados de concreto,
  asfalto e metal do ambientCG (`public/texturas`, `lib/pbr.ts`) e oito pessoas animadas da
  Quaternius (`public/modelos/pessoas`, `components/world/Pessoas.tsx`).
- **Pessoas com animação assada.** Cada personagem tem a caminhada, a pose parada, a sentada e
  a de balcão gravadas numa textura no carregamento. A placa de vídeo lê a pose de cada pessoa
  e mistura dois quadros vizinhos, então a multidão inteira sai em uma chamada de desenho por
  modelo e a cadência acompanha a distância andada. Terreno, água, iluminação pública e janelas dos prédios são
  shaders (`components/world/Ground.tsx`, `City.tsx`), com a geografia compartilhada entre
  GLSL e TypeScript (`lib/geo.ts`) para nenhum prédio nascer dentro do Guaíba.
- **Renderização:** reflexo real no piso do terminal (desenhado só quando o piso aparece),
  mapa de ambiente refeito a partir do céu conforme a luz muda, sombras do sol que acompanham
  a câmera, milhares de luzes do aeroporto como pontos em HDR, multidões instanciadas e nuvens
  tingidas pelo pôr do sol.
- **Luz do saguão:** dentro do terminal o céu deixa de iluminar direto. Um mapa de ambiente de
  interior (forro claro, fileiras de luminárias, vidraças com a cor do céu) substitui o do céu,
  e uma oclusão ambiente calculada só com a profundidade assenta bancos, pessoas e avião no chão.
- **Pós-processamento** (`components/experience/effects.ts`): motion blur próprio, que
  reconstrói a posição de cada pixel pela profundidade e trata a cabine como presa à câmera,
  além de profundidade de campo, bloom com limiar adaptativo, tone mapping ACES, granulação,
  vinheta, tarja cinematográfica e um passe que limpa valores inválidos.
- **Galeria de quadros:** enquanto a tela de abertura está no ar, o filme é renderizado em oito
  momentos e salvo em JPEG, o que também compila todos os shaders antes de a viagem começar.

## Qualidade e modo seguro

`lib/gpu.ts` escolhe o nível pela placa de vídeo: alto, médio, baixo ou seguro. Dá para forçar
com `?q=alto` na forma `?q=high|medium|low|safe`. O `PerformanceMonitor` do drei também reduz
a qualidade sozinho se os quadros caírem.

O **modo seguro** entra automaticamente no driver aberto da NVIDIA (nouveau, que o Chrome
mostra como `ANGLE (Mesa, NVD9, ...)`), em renderização por software e depois de qualquer perda
de contexto WebGL (fica guardado no navegador). Nele o desenho vai direto para a tela, sem
pós-processamento, sem sombras, sem reflexo e sem mapa de ambiente, com uma cidade mais leve.
As imagens da galeria passam a ser capturadas do próprio quadro durante a viagem.

## Fotos e conteúdo

- As fotografias em `public/fotos` vêm do Wikimedia Commons, com licença livre. Autor, licença
  e link de origem estão em `lib/photos.ts` e aparecem no rodapé do site e nas legendas.
- Os textos e os números estão em `lib/content.ts` e foram conferidos em setembro de 2026 nas
  fontes listadas na própria página (Wikipédia, Fraport Brasil, Fraport AG, Jornal do Comércio,
  Ministério de Portos e Aeroportos, MercoPress, FlightGlobal e Panrotas).
- Os ambientes 3D são reconstruções artísticas, não levantamentos técnicos. Pinturas de
  aeronaves, nomes de lojas e o painel de voos são ilustrativos, e o site avisa isso.
- Para acrescentar imagens geradas por IA, coloque os arquivos listados em `ILUSTRACOES`
  (`lib/photos.ts`) dentro de `public/ilustracoes`. Sem eles, nada quebra.

## Atalhos de desenvolvimento (só fora de produção)

- `?autostart` pula a capa, e `?autostart&p=0.62` abre direto em um ponto da viagem.
- `?nocapture` pula a captura das imagens, `?fx=off` desliga o pós-processamento e `?dpr=1`
  fixa a resolução.
- `?raf` usa temporizador no lugar do quadro do navegador, útil em navegador oculto.
- `window.__poa.shoot([{ p, name }])` salva quadros via `POST /api/shot`, desativado em produção.
