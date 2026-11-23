import { useEffect, useRef } from 'react';
import { drawCrest } from './ShareCard';

/** Escudo procedural (mesmo desenho do card final), em tamanho pequeno. */
export function Crest({ name, short, colors, size = 40, stars = 0 }: { name: string; short: string; colors: [string, string]; size?: number; stars?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const scale = 2; // nitidez em telas retina
    const pad = stars > 0 ? size * 0.25 : size * 0.06;
    c.width = size * scale;
    c.height = (size + pad) * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, size, size + pad);
    const inner = size * 0.88;
    drawCrest(ctx, name, short, colors, (size - inner) / 2, pad, inner, stars);
  }, [name, short, colors, size, stars]);
  return <canvas ref={ref} className="crest" style={{ width: size, height: size + (stars > 0 ? size * 0.25 : size * 0.06) }} aria-hidden="true" />;
}
