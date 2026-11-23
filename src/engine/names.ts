import {
  CITY_ADJ, CITY_AVOID, CITY_FEM, CITY_MASC, CLUB_PREFIX, CLUB_SUFFIX, FIRST_NAMES, LAST_NAMES, NEIGHBORHOODS, NICKNAMES, REGIONAL, SHORT_PREFIX, TUPI_A, TUPI_B, VARZEA_PREFIX,
} from '../data/names';
import type { Rng } from './rng';

/** Um nome de boleiro brasileiro, no formato mais comum em cada caso. */
function rawPersonName(rng: Rng): string {
  const r = rng.next();
  const first = () => rng.pick(FIRST_NAMES);
  const last = () => rng.pick(LAST_NAMES);
  if (r < 0.34) return `${first()} ${last()}`;
  if (r < 0.5) return rng.pick(NICKNAMES);
  if (r < 0.6) {
    let a = first();
    let b = first();
    while (b === a) b = first();
    return `${a} ${b}`; // "João Pedro", "Kaio Jorge"
  }
  if (r < 0.7) return `${first()} ${rng.pick(REGIONAL)}`; // "Gabriel Baiano"
  if (r < 0.8) return `${rng.pick(SHORT_PREFIX)} ${last()}`; // "Zé Ribeiro"
  if (r < 0.9) return `${rng.pick(NICKNAMES)} ${last()}`; // "Tiquinho Soares"
  return last(); // "Fagundes"
}

/**
 * Gera um nome único em relação a `taken` (o conjunto é atualizado).
 * Sem `taken`, só gera o nome.
 */
export function personName(rng: Rng, taken?: Set<string>): string {
  for (let i = 0; i < 12; i++) {
    const n = rawPersonName(rng);
    if (!taken || !taken.has(n)) {
      taken?.add(n);
      return n;
    }
  }
  // fallback garantido: nome completo com dois sobrenomes
  const n = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)} ${rng.pick(LAST_NAMES)}`;
  taken?.add(n);
  return n;
}

export function cityName(rng: Rng): string {
  for (let i = 0; i < 10; i++) {
    let name: string;
    if (rng.chance(0.55)) {
      const fem = rng.chance(CITY_FEM.length / (CITY_FEM.length + CITY_MASC.length));
      const [m, f] = rng.pick(CITY_ADJ);
      name = fem ? `${rng.pick(CITY_FEM)} ${f}` : `${rng.pick(CITY_MASC)} ${m}`;
    } else {
      name = `${rng.pick(TUPI_A)}${rng.pick(TUPI_B)}`;
    }
    if (!CITY_AVOID.includes(name)) return name;
  }
  return `${rng.pick(TUPI_A)}${rng.pick(TUPI_B)}`;
}

/** Clube profissional: "Esporte Clube Vila Serena", "Itaporã Futebol Clube", "Operário de Pedra Alta". */
export function proClubName(rng: Rng): string {
  const city = cityName(rng);
  const r = rng.next();
  if (r < 0.45) return `${rng.pick(CLUB_PREFIX)} ${city}`;
  if (r < 0.8) return `${city} ${rng.pick(CLUB_SUFFIX)}`;
  return `${rng.pick(['Operário', 'Ferroviário', 'Independente', 'Comercial', 'União', 'América', 'Atlético', 'Esportivo'])} de ${city}`;
}

/** Time de várzea: "Unidos do Jardim Primavera". */
export function varzeaClubName(rng: Rng): string {
  return `${rng.pick(VARZEA_PREFIX)} ${rng.pick(NEIGHBORHOODS)}`;
}

export function uniqueName(gen: () => string, taken: Set<string>): string {
  for (let i = 0; i < 60; i++) {
    const n = gen();
    if (!taken.has(n)) {
      taken.add(n);
      return n;
    }
  }
  const n = `${gen()} ${taken.size}`;
  taken.add(n);
  return n;
}
