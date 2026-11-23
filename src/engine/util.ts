export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Erro de regra de jogo (ação inválida). A UI e o assistente tratam; erros de programação não. */
export class ActionError extends Error {}
