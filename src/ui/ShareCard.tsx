import { useEffect, useRef, useState } from 'react';
import { TIERS, computeScore, hashSeed, levelFor, runStats, trophies, type GameState, type Tier } from '../engine';

const W = 1080;
const H = 1350;
const DISPLAY = "'Oswald', 'Arial Narrow', sans-serif";
const BODY = "'Inter', system-ui, sans-serif";

/* ------------------------------ escudo procedural ------------------------------ */

type Shape = 'shield' | 'circle' | 'diamond' | 'badge';
type Pattern = 'plain' | 'stripes' | 'hoops' | 'sash' | 'half' | 'cross';

export function crestDesign(name: string): { shape: Shape; pattern: Pattern } {
  const h = hashSeed('escudo', name);
  const shapes: Shape[] = ['shield', 'circle', 'diamond', 'badge'];
  const patterns: Pattern[] = ['plain', 'stripes', 'hoops', 'sash', 'half', 'cross'];
  return { shape: shapes[h % shapes.length], pattern: patterns[Math.floor(h / 7) % patterns.length] };
}

function shapePath(ctx: CanvasRenderingContext2D, shape: Shape, x: number, y: number, s: number): void {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
  } else if (shape === 'diamond') {
    ctx.moveTo(x + s / 2, y);
    ctx.lineTo(x + s, y + s / 2);
    ctx.lineTo(x + s / 2, y + s);
    ctx.lineTo(x, y + s / 2);
  } else if (shape === 'badge') {
    const r = s * 0.18;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + s - r, y);
    ctx.quadraticCurveTo(x + s, y, x + s, y + r);
    ctx.lineTo(x + s, y + s - r);
    ctx.quadraticCurveTo(x + s, y + s, x + s - r, y + s);
    ctx.lineTo(x + r, y + s);
    ctx.quadraticCurveTo(x, y + s, x, y + s - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x + s, y + s * 0.55);
    ctx.quadraticCurveTo(x + s, y + s * 0.9, x + s / 2, y + s);
    ctx.quadraticCurveTo(x, y + s * 0.9, x, y + s * 0.55);
  }
  ctx.closePath();
}

export function drawCrest(ctx: CanvasRenderingContext2D, name: string, short: string, colors: [string, string], x: number, y: number, s: number, stars: number): void {
  const { shape, pattern } = crestDesign(name);
  const [c1, c2] = colors;
  ctx.save();
  shapePath(ctx, shape, x, y, s);
  ctx.fillStyle = c1;
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = c2;
  const n = 5;
  if (pattern === 'stripes') for (let i = 1; i < n; i += 2) ctx.fillRect(x + (s / n) * i, y, s / n, s);
  else if (pattern === 'hoops') for (let i = 1; i < n; i += 2) ctx.fillRect(x, y + (s / n) * i, s, s / n);
  else if (pattern === 'half') ctx.fillRect(x + s / 2, y, s / 2, s);
  else if (pattern === 'cross') {
    ctx.fillRect(x + s * 0.4, y, s * 0.2, s);
    ctx.fillRect(x, y + s * 0.4, s, s * 0.2);
  } else if (pattern === 'sash') {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.2);
    ctx.lineTo(x + s * 0.2, y);
    ctx.lineTo(x + s, y + s * 0.8);
    ctx.lineTo(x + s * 0.8, y + s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // contorno e iniciais
  shapePath(ctx, shape, x, y, s);
  ctx.lineWidth = s * 0.04;
  ctx.strokeStyle = '#ffffffcc';
  ctx.stroke();
  ctx.font = `700 ${s * 0.3}px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = s * 0.05;
  ctx.strokeStyle = '#000000aa';
  ctx.strokeText(short.slice(0, 3), x + s / 2, y + s * 0.52);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(short.slice(0, 3), x + s / 2, y + s * 0.52);
  // estrelas de títulos acima do escudo
  const count = Math.min(5, stars);
  ctx.fillStyle = '#ffd23f';
  ctx.font = `${s * 0.16}px ${BODY}`;
  for (let i = 0; i < count; i++) ctx.fillText('★', x + s / 2 + (i - (count - 1) / 2) * s * 0.18, y - s * 0.12);
}

/* ------------------------------ card ------------------------------ */

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left', maxWidth?: number) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y, maxWidth);
}

export function drawCard(canvas: HTMLCanvasElement, state: GameState, url: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  const p = state.player;
  const stats = runStats(state);
  const level = levelFor(stats);
  const score = computeScore(stats);
  const trophyList = trophies(state);
  const majorStars = stats.premierTitles + stats.championsWins + stats.worldWins;

  // fundo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0e141c');
  bg.addColorStop(1, '#06090d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = p.colors[0];
  ctx.globalAlpha = 0.12;
  ctx.fillRect(0, 0, W, 420);
  ctx.globalAlpha = 1;

  // faixa de transmissão
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(0, 0, W, 64);
  ctx.fillStyle = '#e63946';
  ctx.fillRect(40, 14, 120, 36);
  text(ctx, 'AO VIVO', 100, 42, `700 24px ${DISPLAY}`, '#fff', 'center');
  text(ctx, 'DA VÁRZEA À GLÓRIA', 184, 45, `700 32px ${DISPLAY}`, '#111');
  text(ctx, `${stats.seasons} TEMPORADAS`, W - 40, 45, `700 26px ${DISPLAY}`, '#111', 'right');

  // escudo + nome
  drawCrest(ctx, p.name, p.short, p.colors, 60, 130, 230, majorStars);
  text(ctx, p.name.toUpperCase(), 330, 205, `700 72px ${DISPLAY}`, '#ffffff', 'left', W - 380);
  const first = state.history[0]?.year ?? 0;
  const last = state.history.at(-1)?.year ?? first;
  text(ctx, `${first}–${last} · alma ${stats.soul}/100 · torcida ${p.fans.toLocaleString('pt-BR')}`, 332, 255, `600 30px ${BODY}`, '#8a99ab', 'left', W - 380);

  // nível
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(330, 285, 690, 92);
  text(ctx, `NÍVEL ${level.level}`, 352, 348, `700 44px ${DISPLAY}`, '#111');
  text(ctx, level.title.toUpperCase(), 540, 348, `700 44px ${DISPLAY}`, '#111', 'left', 470);
  if (level.plastic) text(ctx, '(clube de plástico)', 352, 405, `italic 600 26px ${BODY}`, '#ff9b9b');

  // gráfico da trajetória
  const gx = 110;
  const gy = 470;
  const gw = W - 170;
  const gh = 440;
  text(ctx, 'TRAJETÓRIA', 60, 450, `700 30px ${DISPLAY}`, '#8a99ab');
  ctx.strokeStyle = '#263243';
  ctx.lineWidth = 2;
  for (let t = 1; t <= 8; t++) {
    const y = gy + ((t - 1) / 7) * gh;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + gw, y);
    ctx.stroke();
    text(ctx, TIERS[t as Tier].short, gx - 14, y + 9, `700 24px ${DISPLAY}`, t === 1 ? '#ffd23f' : '#5d6b7c', 'right');
  }
  const h = state.history;
  const n = Math.max(2, h.length);
  const px = (i: number) => gx + (i / (n - 1)) * gw;
  const py = (t: Tier) => gy + ((t - 1) / 7) * gh;
  if (h.length > 0) {
    // área sob a linha
    const grad = ctx.createLinearGradient(0, gy, 0, gy + gh);
    grad.addColorStop(0, `${p.colors[0]}88`);
    grad.addColorStop(1, `${p.colors[0]}00`);
    ctx.beginPath();
    ctx.moveTo(px(0), gy + gh);
    h.forEach((r, i) => ctx.lineTo(px(i), py(r.tier)));
    ctx.lineTo(px(h.length - 1), gy + gh);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    // linha
    ctx.beginPath();
    h.forEach((r, i) => (i === 0 ? ctx.moveTo(px(i), py(r.tier)) : ctx.lineTo(px(i), py(r.tier))));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.stroke();
    // marcadores
    h.forEach((r, i) => {
      const x = px(i);
      const y = py(r.tier);
      const color = r.position === 1 ? '#ffd23f' : r.nextTier < r.tier ? '#2ecc71' : r.nextTier > r.tier ? '#ff5c5c' : r.outcome === 'barrado_estadio' ? '#ffb020' : '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r.position === 1 ? 14 : 9, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      if (r.cups.some((c) => c.champion)) text(ctx, '🏆', x, y - 22, `30px ${BODY}`, '#fff', 'center');
    });
    text(ctx, String(h[0].year), gx, gy + gh + 44, `600 24px ${BODY}`, '#5d6b7c', 'left');
    text(ctx, String(h[h.length - 1].year), gx + gw, gy + gh + 44, `600 24px ${BODY}`, '#5d6b7c', 'right');
  }

  // números
  const cells: [string, string][] = [
    ['Acessos', String(stats.promotions)],
    ['Títulos', String(trophyList.reduce((s, t) => s + t.years.length, 0))],
    ['Melhor divisão', TIERS[stats.bestTier].name],
    ['Maior zebra', stats.biggestUpset ? `${stats.biggestUpset.score} no ${stats.biggestUpset.opponent}` : '—'],
    ['Ídolo', stats.idol ? `${stats.idol.name} (${stats.idol.goals} gols)` : '—'],
    ['Pontuação', score.toLocaleString('pt-BR')],
  ];
  const cx = 60;
  const cy = 1010;
  const cw = (W - 120 - 20) / 2;
  cells.forEach(([label, value], i) => {
    const x = cx + (i % 2) * (cw + 20);
    const y = cy + Math.floor(i / 2) * 96;
    ctx.fillStyle = '#131a22';
    ctx.fillRect(x, y, cw, 84);
    text(ctx, label.toUpperCase(), x + 20, y + 30, `600 20px ${BODY}`, '#8a99ab');
    text(ctx, value, x + 20, y + 68, `700 30px ${DISPLAY}`, '#ffffff', 'left', cw - 40);
  });

  // rodapé
  text(ctx, url.replace(/^https?:\/\//, '').split('?')[0], W / 2, H - 24, `600 22px ${BODY}`, '#5d6b7c', 'center');
}

export function ShareCard({ state }: { state: GameState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const draw = () => {
      if (alive && ref.current) {
        drawCard(ref.current, state, window.location.href);
        setReady(true);
      }
    };
    // espera as fontes para o card não sair com fonte padrão
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) {
      Promise.all([fonts.load(`700 40px Oswald`), fonts.load(`600 20px Inter`)])
        .catch(() => undefined)
        .then(draw);
    } else {
      draw();
    }
    return () => {
      alive = false;
    };
  }, [state]);

  const download = () => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${state.player.name.replace(/\s+/g, '-').toLowerCase()}-da-varzea-a-gloria.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="share">
      <canvas ref={ref} className="share-canvas" width={W} height={H} aria-label="Card da run" />
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={download} disabled={!ready}>
          Baixar card
        </button>
        <button type="button" className="btn" onClick={copy}>
          {copied ? 'Link copiado!' : 'Copiar link da run'}
        </button>
      </div>
    </div>
  );
}
