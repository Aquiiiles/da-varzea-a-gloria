// Probe de balanceamento (não faz parte do `npm test`). Rode com: npm run balance
import { applyMut, newGame } from '../src/engine/game';
import { runStats, levelFor, TIERS, squadStrength, type GameState, type Origin } from '../src/engine';

type Bot = 'auto' | 'lazy';

function play(seed: number, bot: Bot, origin: Origin): GameState {
  const s = newGame(seed, { name: 'Teste FC', colors: ['#ff0000', '#ffffff'], origin });
  while (s.phase !== 'over') {
    if (s.phase === 'summary') { applyMut(s, { t: 'next' }); continue; }
    if (bot === 'auto') applyMut(s, { t: 'auto' });
    else if (s.office.event && s.office.eventChoice === null) applyMut(s, { t: 'event', choice: 1 });
    applyMut(s, { t: 'play' });
  }
  return s;
}

test('balance probe', () => {
  const N = Number(process.env.N ?? 40);
  for (const bot of ['lazy', 'auto'] as const) {
    for (const origin of ['pub', 'fabrica', 'youtuber'] as const) {
      const dist: Record<number, number> = {}; const levels: Record<number, number> = {}; const reachA: number[] = [];
      let bankrupt = 0; let seasons = 0; const t0 = performance.now();
      for (let seed = 1; seed <= N; seed++) {
        const s = play(seed, bot, origin);
        const st = runStats(s);
        dist[st.bestTier] = (dist[st.bestTier] ?? 0) + 1;
        const firstA = s.history.findIndex((r) => r.tier === 1);
        if (firstA >= 0) reachA.push(firstA + 1);
        const l = levelFor(st).level; levels[l] = (levels[l] ?? 0) + 1;
        if (st.bankrupt) bankrupt++;
        seasons += s.history.length;
      }
      console.log(bot.padEnd(5), origin.padEnd(9), 'melhorDiv', JSON.stringify(dist), 'falências', bankrupt, 'níveis', JSON.stringify(levels), `${((performance.now() - t0) / seasons).toFixed(1)}ms/temp`, 'chega à A na temporada (mediana)', reachA.sort((a, b) => a - b)[Math.floor(reachA.length / 2)] ?? '-');
    }
  }
  const s = play(Number(process.env.SEED ?? 7), 'auto', 'pub');
  console.log(s.history.map(r => `${r.year} ${TIERS[r.tier].short.padEnd(3)} ${r.outcome.padEnd(15)} XI=${r.strength} caixa=${r.finance.cashEnd} saldo=${r.finance.net} folha=${r.finance.wages} ingr=${r.finance.tickets} tv=${r.finance.tv} pat=${r.finance.sponsors} prêmios=${r.finance.prizes} com=${r.finance.commerce}`).join('\n'));
  console.log('final: elenco', s.player.squad.length, 'base', s.player.youth.length, 'estádio', s.player.capacity, 'inst', JSON.stringify(s.player.facilities), 'staff', JSON.stringify(s.player.staff), 'força', squadStrength(s.player.squad));
});
