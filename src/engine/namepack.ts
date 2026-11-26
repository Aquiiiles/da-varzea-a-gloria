import { initials } from './clubs';
import { calibrate, refreshStrength } from './aisquad';
import { makeFootballer, marketWage, personName, round1 } from './footballers';
import type { Rng } from './rng';
import type { Club, Footballer, NationalDiv, Position } from './types';

/**
 * Pacote de nomes ("option file"): troca os nomes fictícios dos clubes nacionais por outros,
 * escolhidos pelo jogador. O jogo publicado só tem nomes fictícios; o pacote é importado
 * pelo jogador e fica só no navegador dele.
 *
 * Em cada divisão, os nomes vão do maior para o menor: o primeiro da lista vira o clube mais
 * forte daquela divisão, e assim por diante. Os clubes que só disputam o Estadual e a Várzea continuam fictícios
 * (os do nosso estado que estão numa série nacional também recebem nome do pacote e jogam o nosso Estadual).
 * Só muda nomes, siglas e cores: não usa sorteio, então a run e o replay não mudam.
 */
/** Jogador real do pacote. A nota é relativa: o elenco é ajustado para a força do clube no jogo. */
export interface PackPlayer {
  name: string;
  pos: Position;
  /** ano de nascimento */
  born: number;
  /** nota relativa (ex.: 60 a 90); só a diferença entre os jogadores do clube importa */
  rating: number;
}

export interface PackClub {
  name: string;
  short?: string;
  colors?: [string, string];
  /** técnico do clube */
  coach?: string;
  /** elenco (pode ser parcial: o jogo completa com jogadores gerados) */
  squad?: PackPlayer[];
}

/** Para montar elencos reais: sorteio próprio, ids e nomes já usados. */
export interface PackSquadContext {
  rng: Rng;
  nextId: () => number;
  /** ano da 1ª temporada (para a idade) */
  year: number;
  names: Set<string>;
  /** nomes reais já usados no pacote (dois jogadores reais com o mesmo nome ganham a sigla do clube) */
  real?: Set<string>;
  /** ids dos jogadores reais */
  realIds?: Set<number>;
}

export interface NamePack {
  title: string;
  divisions: Partial<Record<NationalDiv, PackClub[]>>;
  /** clubes de outros estados sem divisão (disputam vagas na Série D e a Copa do Brasil) */
  pool?: PackClub[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_NAME = 32;

function parseClub(raw: unknown): PackClub | null {
  if (typeof raw === 'string') raw = { name: raw };
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== 'string') return null;
  const name = o.name.trim().slice(0, MAX_NAME);
  if (!name) return null;
  const club: PackClub = { name };
  if (typeof o.short === 'string' && o.short.trim()) club.short = o.short.trim().slice(0, 4).toUpperCase();
  if (Array.isArray(o.colors) && o.colors.length === 2 && o.colors.every((c) => typeof c === 'string' && HEX.test(c))) {
    club.colors = [o.colors[0] as string, o.colors[1] as string];
  }
  const coach = o.coach ?? o.tecnico;
  if (typeof coach === 'string' && coach.trim()) club.coach = coach.trim().slice(0, MAX_NAME);
  const squad = o.squad ?? o.elenco;
  if (Array.isArray(squad)) {
    const list = squad.map(parsePlayer).filter((x): x is PackPlayer => x !== null).slice(0, 40);
    if (list.length > 0) club.squad = list;
  }
  return club;
}

const POSITIONS: Position[] = ['GOL', 'DEF', 'MEI', 'ATA'];

/** Jogador: objeto { name, pos, born, rating } ou texto "Nome;POS;ano;nota". */
export function parsePlayer(raw: unknown): PackPlayer | null {
  let o: Record<string, unknown>;
  if (typeof raw === 'string') {
    const [name, pos, born, rating] = raw.split(';').map((x) => x.trim());
    o = { name, pos, born: Number(born), rating: Number(rating) };
  } else if (raw && typeof raw === 'object') o = raw as Record<string, unknown>;
  else return null;
  const name = typeof o.name === 'string' ? o.name.trim().slice(0, MAX_NAME) : '';
  const pos = typeof o.pos === 'string' ? (o.pos.toUpperCase() as Position) : null;
  const born = Number(o.born);
  const rating = Number(o.rating);
  if (!name || !pos || !POSITIONS.includes(pos) || !Number.isInteger(born) || born < 1960 || born > 2015 || !Number.isFinite(rating) || rating < 1 || rating > 99) return null;
  return { name, pos, born, rating: Math.round(rating) };
}

const WANT: Record<Position, number> = { GOL: 2, DEF: 7, MEI: 7, ATA: 4 };
const SQUAD_TARGET = 20;

/**
 * Troca o elenco gerado pelo elenco real. A força do clube no jogo não muda: as notas são deslocadas para
 * o time titular bater com a força que o clube já tinha (o pacote define quem é melhor que quem, não o nível).
 * Elenco parcial: completa com os gerados que faltam em cada posição.
 */
function realSquad(club: Club, list: PackPlayer[], ctx: PackSquadContext): void {
  const target = club.strength;
  const real: Footballer[] = list.map((pl) => {
    const age = Math.max(16, Math.min(42, ctx.year - pl.born));
    const f = makeFootballer(ctx.rng, { id: ctx.nextId(), pos: pl.pos, ovr: pl.rating, age, scout: 3, season: 1, contract: ctx.rng.int(1, 4) });
    const real = (ctx.real ??= new Set());
    f.name = real.has(pl.name) ? `${pl.name} (${club.short})` : pl.name;
    real.add(f.name);
    (ctx.realIds ??= new Set()).add(f.id);
    ctx.names.add(f.name);
    return f;
  });
  const count: Record<Position, number> = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 };
  for (const f of real) count[f.pos]++;
  const fill: Footballer[] = [];
  const spare = club.squad.slice().sort((a, b) => b.ovr - a.ovr || a.id - b.id);
  for (const f of spare) {
    if (real.length + fill.length >= SQUAD_TARGET) break;
    if (count[f.pos] < WANT[f.pos]) {
      count[f.pos]++;
      fill.push(f);
    }
  }
  // os gerados que completam o elenco ficam abaixo dos reais
  const realMean = real.reduce((s, f) => s + f.ovr, 0) / Math.max(1, real.length);
  for (const f of fill) f.ovr = Math.round(realMean - 4 + (f.ovr - target) * 0.5);
  club.squad = [...real, ...fill];
  calibrate(club.squad, target);
  // salário de acordo com o nível final (a nota do pacote era relativa)
  for (const f of real) f.wage = round1(marketWage(f.ovr) * ctx.rng.float(0.9, 1.2));
  refreshStrength(club);
}

function parseList(raw: unknown): PackClub[] {
  return Array.isArray(raw) ? raw.map(parseClub).filter((c): c is PackClub => c !== null).slice(0, 200) : [];
}

/** Valida um pacote vindo de um arquivo JSON. Devolve o pacote ou uma mensagem de erro. */
export function parseNamePack(raw: unknown): NamePack | string {
  if (!raw || typeof raw !== 'object') return 'Arquivo inválido: esperado um objeto JSON.';
  const o = raw as Record<string, unknown>;
  const divs = (o.divisions ?? o.divisoes) as Record<string, unknown> | undefined;
  if (!divs || typeof divs !== 'object') return 'Arquivo inválido: falta "divisions" com as listas das Séries 1 a 4.';
  const pack: NamePack = { title: typeof o.title === 'string' && o.title.trim() ? o.title.trim().slice(0, 60) : 'Pacote de nomes', divisions: {} };
  let total = 0;
  for (const d of [1, 2, 3, 4] as NationalDiv[]) {
    const list = parseList(divs[String(d)]);
    if (list.length > 0) {
      pack.divisions[d] = list;
      total += list.length;
    }
  }
  const pool = parseList(o.pool);
  if (pool.length > 0) {
    pack.pool = pool;
    total += pool.length;
  }
  if (total === 0) return 'O pacote não tem nenhum clube.';
  return pack;
}

/** Quantos clubes o pacote renomeia. */
export function packSize(pack: NamePack): number {
  return Object.values(pack.divisions).reduce((s, l) => s + (l?.length ?? 0), 0) + (pack.pool?.length ?? 0);
}

/**
 * Aplica o pacote aos clubes recém-gerados (muta). `reserved` = nomes que não podem ser usados (o clube do jogador).
 * Com `squads`, os clubes que têm elenco no pacote recebem os jogadores e o técnico reais.
 */
export function applyNamePack(clubs: Club[], pack: NamePack, reserved: Set<string>, squads?: PackSquadContext): void {
  const used = new Set([...reserved].map((n) => n.toLowerCase()));
  const assign = (targets: Club[], names: PackClub[] | undefined) => {
    if (!names) return;
    const sorted = [...targets].sort((a, b) => b.strength - a.strength || a.id.localeCompare(b.id));
    let i = 0;
    for (const club of sorted) {
      while (i < names.length && used.has(names[i].name.toLowerCase())) i++;
      if (i >= names.length) return;
      const n = names[i++];
      used.add(n.name.toLowerCase());
      club.name = n.name;
      club.short = n.short ?? initials(n.name);
      if (n.colors) club.colors = n.colors;
      if (n.coach) club.coachName = n.coach;
      if (n.squad && squads) realSquad(club, n.squad, squads);
    }
  };
  for (const d of [1, 2, 3, 4] as NationalDiv[]) {
    assign(clubs.filter((c) => c.national === d), pack.divisions[d]);
  }
  assign(clubs.filter((c) => c.national === null && c.stateDiv === null), pack.pool);
  // jogador gerado com o nome de um jogador real ganha outro nome
  const real = squads?.real;
  if (real && real.size > 0) {
    const ids = squads!.realIds!;
    for (const c of clubs) {
      for (const f of c.squad) {
        if (!ids.has(f.id) && real.has(f.name)) {
          f.name = personName(squads!.rng, squads!.names);
          squads!.names.add(f.name);
        }
      }
    }
  }
}
