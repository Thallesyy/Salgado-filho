/**
 * Textos do documentário, em português.
 * Os números vêm das fontes listadas em REFERENCES (conferidas em setembro de 2026).
 * Nada aqui é inventado: onde um dado não pôde ser confirmado, o texto ficou qualitativo.
 */

export type Stat = { value: number; decimals?: number; prefix?: string; suffix?: string; label: string };

export type Card = {
  /** janela de progresso: [início da entrada, fim da entrada, início da saída, fim da saída] */
  at: [number, number, number, number];
  layout: "left" | "right" | "bottom-left" | "bottom-right" | "center" | "chapter";
  kicker?: string;
  title?: string;
  body?: string;
  stats?: Stat[];
  chips?: string[];
  steps?: string[];
  note?: string;
  /** foto real mostrada junto do texto */
  photo?: string;
  /** ilustração gerada por IA, marcada como tal */
  ilustracao?: string;
};

export const CARDS: Card[] = [
  /* 01 Chegada ----------------------------------------------------------- */
  {
    at: [-1, -1, 0.02, 0.036],
    layout: "center",
    kicker: "Porto Alegre · Rio Grande do Sul · Brasil",
    title: "Salgado Filho",
    body: "Um documentário interativo sobre o portal aéreo do sul do Brasil. Role a página para viajar.",
  },
  {
    at: [0.032, 0.042, 0.056, 0.066],
    layout: "left",
    kicker: "Onde fica",
    title: "A nove quilômetros do centro",
    body: "O Aeroporto Internacional Salgado Filho (IATA POA, ICAO SBPA) fica na zona norte de Porto Alegre, a 9 metros acima do nível do mar e a cerca de 9 km do centro histórico. Desde 2013, o Aeromóvel liga o terminal ao metrô da cidade.",
    note: "29°59′41″S · 51°10′16″O",
    photo: "aeromovel",
  },
  {
    at: [0.062, 0.072, 0.084, 0.094],
    layout: "right",
    kicker: "História",
    title: "Um século olhando para o céu",
    body: "Os primeiros voos saíram do campo de São João em 31 de maio de 1923. A Varig instalou sua base aqui em 1932, o primeiro terminal de passageiros abriu em 1940 e, em 1951, o aeroporto recebeu o nome de Joaquim Pedro Salgado Filho, senador e primeiro ministro da Aeronáutica do Brasil.",
    photo: "varig-1930",
  },
  {
    at: [0.09, 0.098, 0.108, 0.116],
    layout: "bottom-left",
    kicker: "Passageiros em 2025",
    stats: [
      { value: 7.51, decimals: 2, suffix: " mi", label: "passageiros" },
      { value: 67313, label: "pousos e decolagens" },
      { value: 33792, suffix: " t", label: "carga" },
    ],
    body: "O movimento de 2025 passou os 7,48 milhões de 2023, completando a recuperação depois da enchente.",
  },
  {
    at: [0.108, 0.114, 0.124, 0.132],
    layout: "right",
    kicker: "Para o Rio Grande do Sul",
    title: "A porta de entrada do estado",
    body: "É o aeroporto mais movimentado do estado mais ao sul do Brasil e liga a indústria, o agronegócio e o turismo gaúcho a São Paulo, Buenos Aires, Lisboa e além. Quando ele fechou, em 2024, o estado inteiro sentiu.",
    photo: "fachada",
  },

  /* 02 O Terminal -------------------------------------------------------- */
  {
    at: [0.132, 0.14, 0.152, 0.16],
    layout: "chapter",
    kicker: "Capítulo 02",
    title: "O Terminal",
  },
  {
    at: [0.158, 0.166, 0.184, 0.192],
    layout: "left",
    kicker: "Check-in",
    title: "Da calçada ao portão",
    steps: ["Check-in pelo celular, no totem ou no balcão", "Despacho das malas com a companhia aérea", "Inspeção de segurança", "Chamada no portão de embarque"],
    body: "Em abril de 2019 a Fraport entregou uma nova área de check-in e um novo controle de acesso doméstico, dentro da ampliação do terminal.",
    photo: "checkin",
  },
  {
    at: [0.19, 0.198, 0.214, 0.222],
    layout: "right",
    kicker: "Companhias",
    title: "Quem voa de POA",
    chips: ["LATAM Brasil", "GOL", "Azul", "Aerolíneas Argentinas", "Copa Airlines", "TAP Air Portugal", "LATAM Chile", "LATAM Peru"],
    body: "A Azul trata Porto Alegre como base de operações. A malha muda conforme a temporada.",
  },
  {
    at: [0.222, 0.23, 0.246, 0.256],
    layout: "bottom-left",
    kicker: "Infraestrutura",
    stats: [
      { value: 37600, suffix: " m²", label: "Terminal 1, aberto em 11/09/2001" },
      { value: 1050, label: "vagas no edifício-garagem de 2019" },
      { value: 3.8, decimals: 1, suffix: " km²", label: "área total do sítio" },
    ],
    photo: "garagem",
  },

  /* 03 Segurança e portões ----------------------------------------------- */
  {
    at: [0.262, 0.27, 0.282, 0.29],
    layout: "chapter",
    kicker: "Capítulo 03",
    title: "Embarque",
  },
  {
    at: [0.29, 0.298, 0.314, 0.322],
    layout: "left",
    kicker: "Portões",
    stats: [{ value: 16, label: "portões com ponte de embarque" }],
    body: "Seis pontes novas chegaram com a ampliação do píer, em abril de 2019, na primeira leva de obras da Fraport.",
    photo: "pier",
  },
  {
    at: [0.322, 0.33, 0.346, 0.354],
    layout: "right",
    kicker: "Operação",
    title: "Uma coreografia no pátio",
    body: "O aeroporto é operado pela Fraport Brasil desde janeiro de 2018, numa concessão de 25 anos. Cada escala é um balé de tratores, esteiras, caminhões de combustível e de comissaria.",
    stats: [{ value: 184, label: "pousos e decolagens por dia, média de 2025" }],
    photo: "patio",
  },
  {
    at: [0.354, 0.362, 0.378, 0.388],
    layout: "bottom-right",
    kicker: "Capacidade",
    title: "Preparado para aviões maiores",
    body: "A pista mais longa permite que aeronaves mais pesadas e de maior alcance operem em POA. Em 2025, a Fraport anunciou mais posições para aeronaves de grande porte.",
    ilustracao: "torre-noite",
  },

  /* 04 A bordo ----------------------------------------------------------- */
  {
    at: [0.394, 0.402, 0.414, 0.422],
    layout: "chapter",
    kicker: "Capítulo 04",
    title: "A Bordo",
  },
  {
    at: [0.424, 0.432, 0.446, 0.454],
    layout: "left",
    kicker: "Voos domésticos",
    title: "Principais destinos",
    chips: ["São Paulo (GRU e CGH)", "Rio de Janeiro (GIG)", "Brasília", "Belo Horizonte", "Curitiba", "Florianópolis", "Recife", "Foz do Iguaçu"],
  },
  {
    at: [0.456, 0.464, 0.476, 0.484],
    layout: "right",
    kicker: "Voos internacionais",
    title: "Depois da fronteira",
    chips: ["Buenos Aires", "Santiago", "Lima", "Cidade do Panamá", "Lisboa", "Montevidéu", "Punta del Este (temporada)", "Bariloche (temporada)"],
    ilustracao: "cabine-janela",
  },
  {
    at: [0.484, 0.49, 0.5, 0.508],
    layout: "bottom-left",
    kicker: "Pico de fim de ano, 18/12/2025 a 05/01/2026",
    stats: [
      { value: 364871, label: "passageiros em voos domésticos" },
      { value: 20058, label: "passageiros em voos internacionais" },
    ],
  },

  /* 05 Decolagem --------------------------------------------------------- */
  {
    at: [0.514, 0.522, 0.536, 0.544],
    layout: "chapter",
    kicker: "Capítulo 05",
    title: "Decolagem",
  },
  {
    at: [0.548, 0.556, 0.578, 0.586],
    layout: "left",
    kicker: "Pista 11/29",
    stats: [
      { value: 3200, suffix: " m", label: "de pista asfaltada, antes eram 2.280 m" },
      { value: 600, prefix: "R$ ", suffix: " mi", label: "previstos para as obras da pista" },
    ],
    body: "A ampliação foi entregue em maio de 2022. Depois da enchente de 2024, as equipes fresaram e refizeram 1.400 metros de pavimento antes da volta dos voos.",
    photo: "pista",
  },
  {
    at: [0.588, 0.596, 0.61, 0.618],
    layout: "right",
    kicker: "Modernização",
    title: "Um programa de R$ 1,8 bilhão",
    steps: ["2019: ampliação do terminal, novo píer e pontes", "2019: edifício-garagem com 1.050 vagas", "2021: terminal de cargas internacional", "2022: pista ampliada para 3.200 metros"],
    ilustracao: "aviao-decolagem",
  },
  {
    at: [0.63, 0.636, 0.674, 0.684],
    layout: "bottom-left",
    kicker: "Impacto econômico",
    title: "Quando a pista ficou submersa",
    body: "A enchente fechou o aeroporto em 3 de maio de 2024. O movimento caiu 48% no ano enquanto os voos iam para a Base Aérea de Canoas. A operação voltou em parte no dia 21 de outubro e por completo em 16 de dezembro, com R$ 426 milhões de apoio federal na retomada.",
    photo: "enchente-aeroporto",
  },

  /* 06 Sobre Porto Alegre ------------------------------------------------ */
  {
    at: [0.696, 0.704, 0.716, 0.724],
    layout: "chapter",
    kicker: "Capítulo 06",
    title: "Sobre Porto Alegre",
  },
  {
    at: [0.726, 0.734, 0.756, 0.764],
    layout: "right",
    kicker: "Turismo",
    title: "O pôr do sol do Guaíba",
    body: "O pôr do sol na orla, a Usina do Gasômetro, o centro histórico, o Beira-Rio e, a poucas horas dali, a Serra Gaúcha. Para a maior parte de quem visita o Rio Grande do Sul, a viagem começa em POA.",
    photo: "guaiba",
  },
  {
    at: [0.766, 0.774, 0.794, 0.802],
    layout: "left",
    kicker: "Conexões regionais",
    title: "Um centro para o Sul",
    chips: ["Pelotas", "Santa Maria", "Santo Ângelo", "Uruguaiana", "Florianópolis", "Montevidéu", "Buenos Aires"],
    body: "Voos curtos ligam o interior gaúcho e a região do Prata à malha aérea nacional.",
  },
  {
    at: [0.806, 0.814, 0.838, 0.848],
    layout: "right",
    kicker: "Futuro",
    title: "O que vem pela frente",
    steps: ["Mais posições para aeronaves de grande porte, anunciadas em 2025", "Crescimento da carga internacional", "Concessão que segue até a década de 2040"],
  },

  /* 07 Portal do Sul ----------------------------------------------------- */
  {
    at: [0.862, 0.874, 0.9, 0.912],
    layout: "chapter",
    kicker: "Capítulo 07",
    title: "O Portal do Sul",
  },
  {
    at: [0.95, 0.965, 2, 2],
    layout: "center",
    kicker: "Desde 1923",
    title: "Porto Alegre olha para o céu daqui.",
    body: "Continue rolando para ver a linha do tempo, os números, as imagens e as fontes.",
  },
];

/** Etiquetas fixadas em pontos do mundo 3D. */
export const CALLOUTS = [
  { id: "tower", label: "Torre de controle", pos: [-160, 52, -40], at: [0.0, 0.01, 0.05, 0.07] },
  { id: "t1", label: "Terminal 1, de 2001", pos: [40, 24, 10], at: [0.012, 0.022, 0.06, 0.075] },
  { id: "fids", label: "Painel de voos", pos: [0, 12.2, -12], at: [0.19, 0.2, 0.225, 0.235] },
  { id: "checkin", label: "Ilhas de check-in", pos: [-22, 9.6, -2], at: [0.16, 0.17, 0.19, 0.2] },
  { id: "security", label: "Inspeção de segurança", pos: [0, 9.2, -19], at: [0.255, 0.262, 0.28, 0.288] },
  { id: "widebody", label: "Aeronave de grande porte", pos: [-70, 20, -110], at: [0.322, 0.332, 0.366, 0.376] },
  { id: "bridge", label: "Ponte de embarque", pos: [12, 9, -52], at: [0.372, 0.38, 0.4, 0.41] },
  { id: "rwy", label: "Pista 29, 3.200 metros", pos: [-300, 4, -420], at: [0.6, 0.608, 0.64, 0.65] },
  { id: "gremio", label: "Arena do Grêmio", pos: [-2310, 70, -2220], at: [0.694, 0.7, 0.712, 0.72] },
  { id: "gasometro", label: "Usina do Gasômetro", pos: [-6750, 140, 4440], at: [0.735, 0.742, 0.758, 0.766] },
  { id: "centro", label: "Centro Histórico", pos: [-6000, 120, 4800], at: [0.742, 0.75, 0.766, 0.774] },
  { id: "guaiba", label: "Lago Guaíba", pos: [-9800, 10, 5200], at: [0.75, 0.758, 0.774, 0.782] },
  { id: "beirario", label: "Estádio Beira-Rio", pos: [-6240, 60, 7920], at: [0.764, 0.772, 0.786, 0.794] },
  { id: "poa", label: "Aeroporto Salgado Filho", pos: [-300, 60, -300], at: [0.94, 0.955, 1.5, 1.5] },
] as const;

export const TIMELINE: { year: string; date?: string; title: string; text: string; photo?: string }[] = [
  { year: "1923", date: "31 de maio", title: "Primeiros voos", text: "Aviões começam a operar no campo de pouso de São João, na zona norte de Porto Alegre." },
  { year: "1927", title: "Nasce a Varig", text: "A companhia pioneira da aviação brasileira é fundada em Porto Alegre.", photo: "varig-1930" },
  { year: "1932", title: "A Varig se instala", text: "A empresa estabelece sua base de operações no campo de São João." },
  { year: "1940", title: "Primeiro terminal", text: "O aeroporto ganha seu primeiro terminal de passageiros." },
  {
    year: "1951",
    date: "12 de outubro",
    title: "Salgado Filho",
    text: "O aeroporto passa a levar o nome de Joaquim Pedro Salgado Filho, primeiro ministro da Aeronáutica do Brasil. A denominação foi confirmada por lei federal em 21 de julho de 1953.",
  },
  { year: "1974", title: "Infraero", text: "A estatal assume a operação e administra POA até 2017." },
  { year: "2001", date: "11 de setembro", title: "Terminal 1", text: "Abre o novo terminal de passageiros, com 37.600 m².", photo: "fachada" },
  { year: "2010", date: "4 de dezembro", title: "Terminal 2 reformado", text: "O terminal antigo reabre reformado e é fechado para passageiros em 15 de setembro de 2019." },
  { year: "2013", date: "10 de agosto", title: "Aeromóvel", text: "Um veículo elevado passa a ligar o aeroporto à estação do Trensurb.", photo: "aeromovel" },
  { year: "2018", date: "janeiro", title: "Fraport Brasil", text: "Começa a concessão de 25 anos, com um programa de investimentos de R$ 1,8 bilhão." },
  { year: "2019", date: "abril", title: "O novo píer", text: "Entram em operação a nova área de check-in, o controle de acesso doméstico e seis pontes de embarque.", photo: "pier" },
  { year: "2021", date: "julho", title: "Carga internacional", text: "Começa a operar o Terminal de Cargas Internacional." },
  { year: "2022", date: "maio", title: "3.200 metros", text: "É entregue a ampliação da pista, que permite a operação de aeronaves maiores.", photo: "pista" },
  {
    year: "2024",
    date: "3 de maio",
    title: "A enchente",
    text: "A cheia histórica fecha o aeroporto. Os voos vão para a Base Aérea de Canoas, e POA reabre parcialmente em 21 de outubro e por completo em 16 de dezembro.",
    photo: "enchente-aeroporto",
  },
  { year: "2025", title: "Retomada", text: "São 7,51 milhões de passageiros, acima do movimento anterior à enchente.", photo: "garagem" },
];

export const STATS_SERIES = {
  years: [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
  passengers: [8012114, 8292608, 8314013, 3476011, 4803176, 6600103, 7480641, 3867012, 7513020],
  movements: [79473, 80990, 77709, 37913, 49278, 66402, 72639, 34992, 67313],
  cargo: [19051, 36973, 30501, 19645, 25447, 26709, 38840, 11532, 33792],
};

export const STAT_ANNOTATIONS: Record<number, string> = {
  2020: "Pandemia de covid-19",
  2024: "Aeroporto fechado pela enchente, de maio a outubro",
};

export const GALLERY_SHOTS = [
  { p: 0.004, title: "Calçada de embarque", caption: "O Terminal 1 visto da via de acesso" },
  { p: 0.205, title: "Saguão de check-in", caption: "O painel de voos acima do saguão" },
  { p: 0.358, title: "Sala de embarque", caption: "O pátio do outro lado do vidro" },
  { p: 0.49, title: "Cabine", caption: "A bordo, antes de fechar a porta" },
  { p: 0.64, title: "Corrida de decolagem", caption: "Pista 29, potência máxima" },
  { p: 0.748, title: "Hora dourada", caption: "O Guaíba e o centro histórico" },
  { p: 0.884, title: "Do lado de fora", caption: "Deixando a cabine ao pôr do sol" },
  { p: 1.0, title: "Anoitecer em POA", caption: "O Salgado Filho visto de cima" },
];

export const REFERENCES = [
  {
    title: "Salgado Filho Porto Alegre International Airport",
    publisher: "Wikipédia",
    url: "https://en.wikipedia.org/wiki/Salgado_Filho_Porto_Alegre_International_Airport",
    used: "História, áreas do terminal, portões, movimento de 2017 a 2025, companhias e destinos",
  },
  {
    title: "Sobre o aeroporto",
    publisher: "Porto Alegre Airport, Fraport Brasil",
    url: "https://portoalegre-airport.com.br/en/about-the-airport",
    used: "Obras de 2019, terminal de cargas, entrega da pista e reabertura",
  },
  {
    title: "Fortaleza and Porto Alegre International Airports",
    publisher: "Fraport AG",
    url: "https://www.fraport.com/en/business-areas/international-activities/fortaleza-and-porto-alegre-international-airports.html",
    used: "Visão geral da concessão",
  },
  {
    title: "Fraport entrega obras e anuncia construção de terminal de cargas",
    publisher: "Jornal do Comércio, novembro de 2019",
    url: "https://www.jornaldocomercio.com/_conteudo/economia/2019/11/712775-fraport-entrega-obras-e-anuncia-construcao-de-terminal-de-cargas-no-aeroporto-de-porto-alegre.html",
    used: "Programa de R$ 1,8 bilhão, R$ 600 milhões da pista, garagem de 1.050 vagas e pista original de 2.280 m",
  },
  {
    title: "Aeroporto Salgado Filho supera níveis pré-enchente",
    publisher: "Ministério de Portos e Aeroportos, 2026",
    url: "https://www.gov.br/portos-e-aeroportos/pt-br/assuntos/noticias/2026/05/aeroporto-salgado-filho-supera-niveis-pre-enchente-e-consolida-retomada-com-crescimento-no-fluxo-de-passageiros",
    used: "Retomada em 2025 e refazimento do pavimento da pista",
  },
  {
    title: "Salgado Filho registra salto expressivo em passageiros no fim de ano de 2025",
    publisher: "Jornal do Comércio, janeiro de 2026",
    url: "https://www.jornaldocomercio.com/economia/2026/01/1231627-aeroporto-salgado-filho-registra-salto-expressivo-em-passageiros-e-voos-no-fim-de-ano-de-2025.html",
    used: "Movimento no pico de fim de ano",
  },
  {
    title: "Porto Alegre’s airport to resume handling commercial flights",
    publisher: "MercoPress, outubro de 2024",
    url: "https://en.mercopress.com/2024/10/19/porto-alegre-s-airport-to-resume-handling-commercial-flights-next-week",
    used: "Fechamento pela enchente, reabertura e apoio federal",
  },
  {
    title: "Porto Alegre military base to serve commercial flights after floods",
    publisher: "FlightGlobal, 2024",
    url: "https://www.flightglobal.com/air-transport/porto-alegre-military-base-to-serve-commercial-flights-after-floods-force-civil-airports-closure/158452.article",
    used: "Operação na Base Aérea de Canoas",
  },
  {
    title: "Aeroporto de Porto Alegre ampliará posições para aeronaves de grande porte",
    publisher: "Panrotas, fevereiro de 2025",
    url: "https://www.panrotas.com.br/aviacao/aeroportos/2025/02/porto-alegre-airport-ampliara-posicoes-para-aeronaves-de-grande-porte_214910.html",
    used: "Novas posições para aeronaves de grande porte",
  },
];

/** Voos ilustrativos do painel de partidas dentro do terminal 3D. */
export const BOARD_FLIGHTS = [
  ["LA", "São Paulo GRU"],
  ["G3", "Rio de Janeiro"],
  ["AD", "Campinas"],
  ["TP", "Lisboa"],
  ["AR", "Buenos Aires"],
  ["CM", "Cidade do Panamá"],
  ["LA", "Santiago"],
  ["AD", "Recife"],
  ["G3", "Brasília"],
  ["LA", "Lima"],
  ["AD", "Belo Horizonte"],
  ["G3", "Florianópolis"],
  ["AD", "Curitiba"],
  ["G3", "Foz do Iguaçu"],
] as const;
