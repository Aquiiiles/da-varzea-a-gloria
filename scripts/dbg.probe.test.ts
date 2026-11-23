import { applyMut, newGame } from '../src/engine/game';
import { payroll } from '../src/engine/finance';
test('dbg lazy', () => {
  const s = newGame(3, { name: 'T', colors: ['#ff0000', '#ffffff'], origin: 'pub' });
  while (s.phase !== 'over') {
    if (s.phase === 'summary') { applyMut(s, { t: 'next' }); continue; }
    if (s.office.event && s.office.eventChoice === null) applyMut(s, { t: 'event', choice: 1 });
    applyMut(s, { t: 'play' });
    const r = s.history[s.history.length - 1];
    const ages = s.player.squad.map(f => f.age).sort((a,b)=>a-b);
    console.log(s.player.squad.map(f => `${f.ovr}/${f.age}/${f.wage}/c${f.contract}`).join(' '));
    console.log(r.year, r.position, r.outcome, 'net', r.finance.net, 'cash', s.player.cash, 'folha', Math.round(payroll(s.player)), 'n', s.player.squad.length, 'ovr', (s.player.squad.reduce((a,f)=>a+f.ovr,0)/s.player.squad.length).toFixed(1), 'idades', ages.join(','), 'tix', r.finance.tickets, 'fans', s.player.fans);
  }
});
