// Probe de balanceamento (não faz parte do `npm test`). Rode com: npm run balance
import { newGame, choose, advance, runStats, levelFor, wageBill, scaled, type GameState } from '../src/engine';

type Bot = (s: GameState) => number;
const first: Bot = () => 0;
const smart: Bot = (s) => {
  if (s.phase === 'event') return s.player.cash < 0 ? 0 : 1;
  const p = s.player;
  const cost = (i: number) => s.offer[i].effects.reduce((a, e) => a + (e.type === 'add' && e.stat === 'cash' ? scaled(s, e.value, e.scale) : 0), 0);
  // projeção simples: caixa depois da carta e da folha
  let best = 0, bestScore = -1e9;
  s.offer.forEach((c, i) => {
    const str = c.effects.reduce((a, e) => a + (e.type === 'add' && e.stat === 'strength' ? e.value : 0), 0);
    const cap = (c.id.includes('arq') || c.id.includes('estadio')) ? 1 : 0;
    const money = c.kind === 'dinheiro' ? 1 : 0;
    const after = p.cash + cost(i);
    let sc = str * 2 + (c.kind === 'staff' ? 4 : 0) + cap * (p.capacity < [0,20000,12000,8000,5000,3000,1500,800,0][Math.max(1,p.tier-1)] * 1.1 ? 12 : 0);
    if (after < 0) sc -= 10 + (-after) / scaled(s, 1, true);
    sc -= str * wageBill(p.strength) * 0.075 / scaled(s, 4, true);
    if (p.cash < wageBill(p.strength) * 0.3) sc += money * 10;
    if (sc > bestScore) { bestScore = sc; best = i; }
  });
  return best;
};

function play(seed: number, bot: Bot, origin: 'pub'|'fabrica'|'youtuber') {
  let s = newGame(seed, { name: 'Teste FC', colors: ['#ff0000', '#ffffff'], origin });
  while (s.phase !== 'over') {
    if (s.phase === 'summary') s = advance(s);
    else s = choose(s, bot(s));
  }
  return s;
}

test('balance probe', () => {
  for (const [label, bot] of [['first', first], ['smart', smart]] as const) {
    for (const origin of ['pub', 'fabrica', 'youtuber'] as const) {
      const tiers: number[] = []; let bankrupt = 0; const levels: Record<number, number> = {};
      const t0 = performance.now();
      let seasons = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const s = play(seed, bot, origin);
        const st = runStats(s);
        tiers.push(st.bestTier); if (st.bankrupt) bankrupt++;
        const l = levelFor(st).level; levels[l] = (levels[l] ?? 0) + 1;
        seasons += s.history.length;
      }
      const ms = (performance.now() - t0) / seasons;
      const dist: Record<number, number> = {}; tiers.forEach(t => dist[t] = (dist[t] ?? 0) + 1);
      console.log(label, origin, 'bestTier', JSON.stringify(dist), 'bankrupt', bankrupt, 'levels', JSON.stringify(levels), `${ms.toFixed(2)}ms/temporada`);
    }
  }
  const s = play(7, smart, 'pub');
  console.log(s.history.map(r => `${r.year} T${r.tier} ${r.position}º ${r.outcome} str=${r.strength} cash=${r.finance.cashEnd} net=${r.finance.net} wages=${r.finance.wages} tix=${r.finance.tickets}`).join('\n'));
});
