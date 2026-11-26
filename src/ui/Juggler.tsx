/**
 * Jogador batendo embaixadinha (SVG + CSS). Fica no fundo da tela inicial.
 * Com "reduzir movimento" ligado, ele para na pose com a bola no alto.
 */
export function Juggler({ className = '' }: { className?: string }) {
  return (
    <svg className={`juggler ${className}`} viewBox="0 0 220 300" role="img" aria-label="Jogador fazendo embaixadinha">
      {/* sombra da bola no chão */}
      <ellipse className="jg-shadow" cx="170" cy="250" rx="14" ry="3" />
      <ellipse className="jg-ground" cx="110" cy="250" rx="70" ry="4" />
      {/* perna de apoio */}
      <g className="jg-body">
        <path className="jg-limb jg-shorts-leg" d="M98 136 L95 188" />
        <path className="jg-limb" d="M95 188 L93 242" />
        <path className="jg-boot" d="M91 244 L109 246" />
        {/* braço de trás */}
        <path className="jg-limb jg-arm jg-arm-back" d="M99 70 L80 98 L74 122" />
        {/* tronco (camisa) e cabeça */}
        <path className="jg-shirt" d="M100 60 L98 132" />
        <text className="jg-number" x="99" y="104">10</text>
        <path className="jg-shorts" d="M88 126 L110 126 L112 150 L86 150 Z" />
        <circle className="jg-head" cx="103" cy="38" r="15" />
        {/* braço da frente */}
        <path className="jg-limb jg-arm jg-arm-front" d="M101 70 L124 96 L132 116" />
      </g>
      {/* perna que bate na bola: coxa gira no quadril, canela no joelho */}
      <g className="jg-kick">
        <path className="jg-limb jg-shorts-leg" d="M98 136 L101 188" />
        <g className="jg-shin">
          <path className="jg-limb" d="M101 188 L99 240" />
          <path className="jg-boot" d="M97 242 L115 244" />
        </g>
      </g>
      {/* bola */}
      <g className="jg-ball">
        <g className="jg-spin">
          <circle cx="0" cy="0" r="11" className="jg-ball-fill" />
          <path className="jg-ball-mark" d="M0 -5 L4.8 -1.5 L3 4 L-3 4 L-4.8 -1.5 Z" />
          <path className="jg-ball-line" d="M0 -5 L0 -11 M4.8 -1.5 L10.4 -3.4 M3 4 L6.5 8.9 M-3 4 L-6.5 8.9 M-4.8 -1.5 L-10.4 -3.4" />
        </g>
      </g>
    </svg>
  );
}
