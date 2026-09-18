/**
 * Fotos reais do aeroporto e da cidade, com licença livre.
 * Os arquivos ficam em /public/fotos (versão grande e versão "-sm").
 * Os créditos aparecem no rodapé da página, como exige cada licença.
 */

export type Photo = {
  key: string;
  alt: string;
  legenda: string;
  autor: string;
  licenca: string;
  licencaUrl: string;
  fonte: string;
  w: number;
  h: number;
};

export const PHOTOS: Record<string, Photo> = {
  fachada: {
    key: "fachada",
    alt: "Letreiro do Aeroporto Internacional Salgado Filho na fachada do Terminal 1",
    legenda: "A fachada do Terminal 1, em Porto Alegre",
    autor: "Andre Oliveira",
    licenca: "CC BY 2.0",
    licencaUrl: "https://creativecommons.org/licenses/by/2.0",
    fonte: "https://commons.wikimedia.org/wiki/File:AeroportoSalgadoFilho.jpg",
    w: 1024,
    h: 768,
  },
  checkin: {
    key: "checkin",
    alt: "Saguão de check-in do Salgado Filho com passageiros e escadas rolantes",
    legenda: "O saguão de check-in em movimento",
    autor: "Yeuxpapilon",
    licenca: "CC BY-SA 4.0",
    licencaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fonte: "https://commons.wikimedia.org/wiki/File:Check_in_area_Aeroporto_Salgado_Filho_Porto_Aelgre.jpg",
    w: 1400,
    h: 1050,
  },
  pier: {
    key: "pier",
    alt: "Píer de embarque do Terminal 1 com vista para o pátio",
    legenda: "O píer entregue na ampliação de 2019",
    autor: "Boaventuravinicius",
    licenca: "CC BY-SA 3.0",
    licencaUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    fonte: "https://commons.wikimedia.org/wiki/File:Aeroporto_Salgado_Filho_em_novembro_de_2019.jpg",
    w: 1400,
    h: 617,
  },
  corredor: {
    key: "corredor",
    alt: "Corredor do terminal com clarabóia curva",
    legenda: "A clarabóia curva sobre o corredor do terminal",
    autor: "Pedro Belleza",
    licenca: "CC BY 2.0",
    licencaUrl: "https://creativecommons.org/licenses/by/2.0",
    fonte: "https://commons.wikimedia.org/wiki/File:Aeroporto_Salgado_Filho_-_Porto_Alegre_(5821277195).jpg",
    w: 612,
    h: 612,
  },
  patio: {
    key: "patio",
    alt: "Avião ATR 72 no pátio do Salgado Filho com passageiros embarcando a pé",
    legenda: "Embarque a pé no pátio, com luz de fim de tarde",
    autor: "Mike Peel",
    licenca: "CC BY-SA 4.0",
    licencaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fonte: "https://commons.wikimedia.org/wiki/File:ATR_72_at_Salgado_Filho_International_Airport_2017_001.jpg",
    w: 1400,
    h: 1050,
  },
  pista: {
    key: "pista",
    alt: "Pista e pátio do Salgado Filho vistos do solo, com o terminal ao fundo",
    legenda: "A pista 11/29 vista do pátio, em janeiro de 2025",
    autor: "Yeuxpapilon",
    licenca: "CC BY 4.0",
    licencaUrl: "https://creativecommons.org/licenses/by/4.0",
    fonte: "https://commons.wikimedia.org/wiki/File:Aeroporto_Salgado_Filho_de_Porto_Alegre,_janeiro_de_2025.jpg",
    w: 1400,
    h: 1050,
  },
  garagem: {
    key: "garagem",
    alt: "Edifício-garagem do aeroporto iluminado ao entardecer",
    legenda: "O edifício-garagem entregue em 2019",
    autor: "Yeuxpapilon",
    licenca: "CC BY-SA 4.0",
    licencaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fonte: "https://commons.wikimedia.org/wiki/File:Aeroporto_Salgado_Filho_de_Porto_Alegre.jpg",
    w: 1400,
    h: 912,
  },
  aeromovel: {
    key: "aeromovel",
    alt: "Aeromóvel sobre a via elevada que liga o aeroporto ao metrô",
    legenda: "O Aeromóvel, que liga o terminal ao metrô desde 2013",
    autor: "Eugenio Hansen, OFS",
    licenca: "CC BY-SA 3.0",
    licencaUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    fonte: "https://commons.wikimedia.org/wiki/File:Aeromovel_00.JPG",
    w: 1400,
    h: 995,
  },
  estrutura: {
    key: "estrutura",
    alt: "Estrutura metálica azul do terminal vista de baixo",
    legenda: "A estrutura metálica do terminal",
    autor: "Eugenio Hansen, OFS",
    licenca: "CC BY-SA 3.0",
    licencaUrl: "https://creativecommons.org/licenses/by-sa/3.0",
    fonte: "https://commons.wikimedia.org/wiki/File:Salgado_Filho_International_Airport_05.JPG",
    w: 1400,
    h: 1050,
  },
  "enchente-aeroporto": {
    key: "enchente-aeroporto",
    alt: "Vista aérea do aeroporto alagado em maio de 2024, com avião parado na água",
    legenda: "O aeroporto tomado pela água em maio de 2024",
    autor: "Giulian Serafim / PMPA",
    licenca: "Atribuição",
    licencaUrl: "https://commons.wikimedia.org/wiki/Template:Attribution",
    fonte: "https://commons.wikimedia.org/wiki/File:IBPA_135307_-_Sobrevoo_sobre_%C3%A1reas_alagadas_de_Porto_Alegre._-_2024-05-17_-_Giulian_Serafim-PMPA.jpg",
    w: 1400,
    h: 934,
  },
  "enchente-cidade": {
    key: "enchente-cidade",
    alt: "Bairro de Porto Alegre alagado visto de cima em maio de 2024",
    legenda: "Bairros alagados na cheia de 2024",
    autor: "Giulian Serafim / PMPA",
    licenca: "Atribuição",
    licencaUrl: "https://commons.wikimedia.org/wiki/Template:Attribution",
    fonte: "https://commons.wikimedia.org/wiki/File:IBPA_135320_-_Sobrevoo_sobre_%C3%A1reas_alagadas_de_Porto_Alegre._-_2024-05-17_-_Giulian_Serafim-PMPA.jpg",
    w: 1400,
    h: 934,
  },
  "varig-1930": {
    key: "varig-1930",
    alt: "Hangar da Varig no campo de São João em 1930, com biplano em frente",
    legenda: "O galpão da Varig no campo de São João, por volta de 1930",
    autor: "Autor desconhecido",
    licenca: "Domínio público",
    licencaUrl: "https://commons.wikimedia.org/wiki/Commons:Licensing",
    fonte: "https://commons.wikimedia.org/wiki/File:Porto_Alegre_Aeroporto_S%C3%A3o_Jo%C3%A3o_Galp%C3%A3o_Varig_1930.jpg",
    w: 800,
    h: 600,
  },
  guaiba: {
    key: "guaiba",
    alt: "Pôr do sol alaranjado sobre o Guaíba",
    legenda: "O pôr do sol no Guaíba, cartão-postal da cidade",
    autor: "Glauco Umbelino",
    licenca: "CC BY 2.0",
    licencaUrl: "https://creativecommons.org/licenses/by/2.0",
    fonte: "https://commons.wikimedia.org/wiki/File:P%C3%B4r-do-sol_no_rio_Gua%C3%ADba_-_Porto_Alegre-RS_(2541839888).jpg",
    w: 1400,
    h: 1050,
  },
  gasometro: {
    key: "gasometro",
    alt: "Usina do Gasômetro à beira do Guaíba",
    legenda: "A Usina do Gasômetro, na orla do Guaíba",
    autor: "Heylenny",
    licenca: "CC BY-SA 4.0",
    licencaUrl: "https://creativecommons.org/licenses/by-sa/4.0",
    fonte: "https://commons.wikimedia.org/wiki/File:Usina_do_Gas%C3%B4metro_in_2025_(retouched).jpg",
    w: 1400,
    h: 1050,
  },
};

export const photoList = Object.values(PHOTOS);
export const src = (key: string, small = false) => `/fotos/${key}${small ? "-sm" : ""}.jpg`;

/**
 * Imagens ilustrativas geradas por IA, guardadas em /public/ilustracoes.
 * Elas não retratam o Salgado Filho: aparecem sempre com selo de ilustração,
 * separadas das fotografias reais, que levam crédito de autor e licença.
 */
export type Ilustracao = { key: string; titulo: string; alt: string; legenda: string; w: number; h: number; prompt: string };

export const ILUSTRACOES: Ilustracao[] = [
  {
    key: "aviao-decolagem",
    titulo: "Decolagem ao entardecer",
    alt: "Avião comercial decolando ao pôr do sol, de perfil, com o terminal iluminado ao fundo",
    legenda: "A rotação, no momento em que o trem de pouso deixa a pista",
    w: 1376,
    h: 604,
    prompt:
      "Fotografia de perfil lateral de um avião comercial branco de corredor único no momento da rotação, contraluz de pôr do sol, silhueta com borda de luz dourada, terminal desfocado ao fundo, teleobjetiva 400mm, sem texto e sem logotipos, proporção 16:9",
  },
  {
    key: "cabine-janela",
    titulo: "Janela da cabine",
    alt: "Vista da janela de um avião, com a asa e as luzes de uma cidade ao pôr do sol",
    legenda: "A vista de quem viaja na janela, sobre a cidade ao anoitecer",
    w: 1376,
    h: 768,
    prompt:
      "Fotografia do interior da cabine de um avião comercial, vista de um assento na janela, asa visível e cidade ao fundo sob luz de pôr do sol, profundidade de campo rasa, sem logotipos, proporção 16:9",
  },
  {
    key: "torre-noite",
    titulo: "Torre de controle",
    alt: "Torre de controle iluminada na hora azul, com luzes azuis de pista em primeiro plano",
    legenda: "A torre de controle na hora azul, com as luzes de taxiway acesas",
    w: 1376,
    h: 768,
    prompt:
      "Fotografia de uma torre de controle de aeroporto à noite, vidro iluminado por dentro, luzes azuis de taxiway em primeiro plano desfocadas, céu de hora azul, estilo documental, sem texto, proporção 16:9",
  },
];

export const ILUSTRACAO = Object.fromEntries(ILUSTRACOES.map((i) => [i.key, i])) as Record<string, Ilustracao>;
export const srcIlustracao = (key: string, small = false) => `/ilustracoes/${key}${small ? "-sm" : ""}.jpg`;
