import type { BlockStat, MatchChange } from '../../engine';

const BLOCK = 5;

/** Blocos de 5 minutos já jogados até o minuto atual. */
export function playedBlocks(stats: BlockStat[], minute: number, finished: boolean): BlockStat[] {
  return finished ? stats : stats.filter((_, b) => b * BLOCK + BLOCK <= minute);
}

function sum(list: BlockStat[], f: (s: BlockStat) => number): number {
  return list.reduce((x, s) => x + f(s), 0);
}

/** Leitura curta do momento do jogo (últimos 15 minutos). */
export function momentum(played: BlockStat[]): { text: string; tone: 'good' | 'bad' | '' } {
  const last = played.slice(-3);
  if (last.length === 0) return { text: 'Começo de jogo, times se estudando.', tone: '' };
  const p = sum(last, (s) => s.flow) / last.length;
  if (p >= 0.62) return { text: 'Seu time está em cima: pressão total.', tone: 'good' };
  if (p >= 0.54) return { text: 'Seu time está melhor no jogo.', tone: 'good' };
  if (p <= 0.38) return { text: 'O adversário está sufocando seu time.', tone: 'bad' };
  if (p <= 0.46) return { text: 'O adversário está melhor no jogo.', tone: 'bad' };
  return { text: 'Jogo equilibrado.', tone: '' };
}

/** Efeito de uma mexida: a pressão no bloco em que ela vale contra o bloco anterior. */
export function changeEffect(stats: BlockStat[] | null, minute: number): string {
  if (!stats) return '';
  const b = Math.floor(minute / BLOCK);
  const before = stats[b - 1];
  const after = stats[b];
  if (!before || !after) return '';
  const d = after.press - before.press;
  if (d >= 0.03) return 'O time cresce com a mudança.';
  if (d <= -0.03) return 'O time perde força com a mudança.';
  return 'Pouca mudança no jogo.';
}

/** Texto de uma mexida para a narração. */
export function changeText(c: MatchChange): string {
  const parts: string[] = [];
  if (c.ins.length > 0) parts.push(`Substituição: entra ${c.ins.join(', ')}${c.outs.length > 0 ? `, sai ${c.outs.join(', ')}` : ''}.`);
  if (c.tactic) parts.push(`Estratégia: ${c.tactic}.`);
  return parts.length > 0 ? parts.join(' ') : 'Ajuste no time.';
}

/** Painel ao vivo: posse, finalizações, chutes no gol e o gráfico de pressão a cada 5 minutos. */
export function LiveStats({ stats, minute, finished, myName, oppName, changes }: { stats: BlockStat[]; minute: number; finished: boolean; myName: string; oppName: string; changes: MatchChange[] }) {
  const played = playedBlocks(stats, minute, finished);
  const poss = played.length > 0 ? Math.round(sum(played, (s) => s.poss) / played.length) : 50;
  const shots: [number, number] = [sum(played, (s) => s.shots[0]), sum(played, (s) => s.shots[1])];
  const target: [number, number] = [sum(played, (s) => s.onTarget[0]), sum(played, (s) => s.onTarget[1])];
  const mo = momentum(played);
  const marks = new Set(changes.map((c) => Math.floor(c.minute / BLOCK)));
  return (
    <section className="panel live-stats" aria-label="Estatísticas ao vivo">
      <div className="ls-head">
        <b>{myName}</b>
        <span className="kicker">Estatísticas</span>
        <b>{oppName}</b>
      </div>
      <div className="ls-row">
        <span>{poss}%</span>
        <div className="ls-poss" role="img" aria-label={`Posse de bola: ${poss}% a ${100 - poss}%`}>
          <i style={{ width: `${poss}%` }} />
        </div>
        <span>{100 - poss}%</span>
      </div>
      <dl className="ls-nums">
        <div>
          <dd>{shots[0]}</dd>
          <dt>Finalizações</dt>
          <dd>{shots[1]}</dd>
        </div>
        <div>
          <dd>{target[0]}</dd>
          <dt>No gol</dt>
          <dd>{target[1]}</dd>
        </div>
      </dl>
      <div className="ls-press" role="img" aria-label="Pressão a cada 5 minutos: para cima é o seu time, para baixo o adversário">
        {stats.map((s, b) => {
          const shown = b < played.length;
          const v = (s.flow - 0.5) * 2;
          const h = Math.min(100, Math.round(Math.abs(v) * 130) + 8);
          return (
            <span key={b} className={`lp${b === 8 ? ' lp-half' : ''}${marks.has(b) ? ' lp-change' : ''}`}>
              {shown && <i className={v >= 0 ? 'up' : 'down'} style={{ height: `${h / 2}%` }} />}
            </span>
          );
        })}
      </div>
      <p className={`ls-moment ${mo.tone}`}>{mo.text}</p>
    </section>
  );
}
