import { initials } from './clubs';
import type { Club, NationalDiv } from './types';

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
export interface PackClub {
  name: string;
  short?: string;
  colors?: [string, string];
}

export interface NamePack {
  title: string;
  divisions: Partial<Record<NationalDiv, PackClub[]>>;
  /** clubes de outros estados sem divisão (disputam vagas na Série D e a Copa Nacional) */
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
  return club;
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

/** Aplica o pacote aos clubes recém-gerados (muta). `reserved` = nomes que não podem ser usados (o clube do jogador). */
export function applyNamePack(clubs: Club[], pack: NamePack, reserved: Set<string>): void {
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
    }
  };
  for (const d of [1, 2, 3, 4] as NationalDiv[]) {
    assign(clubs.filter((c) => c.national === d), pack.divisions[d]);
  }
  assign(clubs.filter((c) => c.national === null && c.stateDiv === null), pack.pool);
}
