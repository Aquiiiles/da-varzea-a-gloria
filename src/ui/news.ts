import type { GameState } from '../engine';

/**
 * As notícias do jogo são frases; aqui elas ganham assunto, título e importância para o jornal.
 * A classificação é só de exibição (não muda nada no motor).
 */
export type NewsCat = 'clube' | 'mercado' | 'tecnicos' | 'competicoes' | 'premios' | 'mundo';

export const CAT_LABEL: Record<NewsCat, string> = {
  clube: 'Seu clube',
  mercado: 'Mercado',
  tecnicos: 'Técnicos',
  competicoes: 'Competições',
  premios: 'Prêmios',
  mundo: 'Mundo da bola',
};

export interface NewsItem {
  /** etiqueta (palavra em maiúsculas do começo, ex.: "ULTIMATO") */
  tag: string | null;
  title: string;
  body: string | null;
  cat: NewsCat;
  /** vale manchete */
  hot: boolean;
  season: number;
  /** é do seu clube / sua carreira */
  mine: boolean;
}

const RULES: [RegExp, NewsCat, boolean][] = [
  [/^DEMITIDO/, 'tecnicos', true],
  [/^ULTIMATO CUMPRIDO/, 'tecnicos', true],
  [/^ULTIMATO/, 'tecnicos', true],
  [/^SONDAGEM/, 'tecnicos', true],
  [/^VAZOU/, 'tecnicos', true],
  [/^DANÇA DOS TÉCNICOS/, 'tecnicos', false],
  [/^Cadeira balança/, 'tecnicos', true],
  [/^PRÊMIO/, 'premios', true],
  [/Bola de Ouro/, 'premios', true],
  [/^EXTRAORDINÁRIO/, 'clube', true],
  [/^PROTESTO/, 'clube', true],
  [/^FESTA/, 'clube', true],
  [/^MERCADO/, 'mercado', false],
  [/^(TERREMOTO|ZEBRA)/, 'competicoes', true],
  [/^CLÁSSICO/, 'competicoes', true],
  [/^OBSERVADO/, 'mercado', false],
  [/^DECISÃO/, 'competicoes', true],
];

const KEYWORDS: [RegExp, NewsCat][] = [
  [/contrata|vendid|proposta|empr[eé]st|pré-contrato|multa|assina|chega|liberad|renova contrato|dispens/i, 'mercado'],
  [/técnico|treinador|assume o|novo comandante/i, 'tecnicos'],
  [/campe[aã]o|conquista|acesso|rebaixad|cai para|sobe para|título|Libertadores|Sul-Americana|Copa|Série|Estadual|Mundial|artilh|final/i, 'competicoes'],
];

/** Etiqueta em maiúsculas no começo ("ULTIMATO: ...") e o resto. */
function split(text: string): { tag: string | null; rest: string } {
  const m = /^([A-ZÁÉÍÓÚÂÊÔÃÕÇ ]{4,30}):\s*(.+)$/.exec(text);
  return m ? { tag: m[1].trim(), rest: m[2] } : { tag: null, rest: text };
}

export function classify(text: string, season: number, world: boolean, clubName: string, coachName?: string): NewsItem {
  const { tag, rest } = split(text);
  let cat: NewsCat | null = null;
  let hot = false;
  for (const [re, c, h] of RULES) {
    if (re.test(text)) {
      cat = c;
      hot = h;
      break;
    }
  }
  if (!cat) for (const [re, c] of KEYWORDS) if (re.test(text)) {
    cat = c;
    break;
  }
  const mine = text.includes(clubName) || (!!coachName && text.includes(coachName));
  if (!cat) cat = world && !mine ? 'mundo' : 'clube';
  // título e complemento: a primeira frase vira título se o texto for longo
  let title = rest;
  let body: string | null = null;
  const cut = rest.search(/[;.] /);
  if (rest.length > 90 && cut > 20) {
    title = rest.slice(0, cut);
    body = rest.slice(cut + 2);
  }
  return { tag, title, body, cat, hot: hot || (mine && /campe[aã]o|acesso|rebaixad|rei d[oa]|conquista|sobe para/i.test(text)), season, mine };
}

/** Todas as notícias, das mais novas para as mais antigas, com temporada e assunto. */
export function allNews(state: GameState): NewsItem[] {
  const club = state.player.name;
  const coach = state.career?.name;
  const tags = state.newsSeasons ?? [];
  const out: NewsItem[] = [];
  // do clube / carreira
  state.news.forEach((t, i) => out.push(classify(t, tags[i] ?? 0, false, club, coach)));
  // do mundo da bola (no fim de cada temporada)
  // (frases com dois fatos separados por ";" viram duas notícias)
  for (const r of state.history) {
    for (const t of r.worldNews) {
      const { tag, rest } = split(t);
      const parts = tag ? [t] : rest.split(/;\s+/).filter((x) => x.length > 12);
      for (const part of parts.length > 0 ? parts : [t]) out.push(classify(part.charAt(0).toUpperCase() + part.slice(1), r.season, true, club, coach));
    }
  }
  // mais novas primeiro: por temporada e, dentro dela, a ordem em que saíram (o mundo depois do clube)
  return out.map((n, i) => ({ n, i })).sort((a, b) => b.n.season - a.n.season || b.i - a.i).map((x) => x.n);
}
