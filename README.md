# Da Várzea à Glória

Simulador de carreira de clube de futebol no navegador. Você funda um clube de bairro na 8ª divisão e, como dono, tenta chegar à Premier, à Copa dos Campeões e ao Mundial em 25 temporadas.

## Rodar

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes do motor (Vitest)
npm run build      # typecheck + build de produção
npm run balance    # probe de balanceamento com bots (não roda no npm test)
```

## Arquitetura

- `src/engine/`: motor puro (sem React, sem DOM, sem `Math.random`). Determinístico: a mesma seed com as mesmas escolhas gera sempre a mesma run, e `replay(seed, fundação, escolhas)` reconstrói o estado. Feito para rodar também num servidor.
- `src/data/`: dados de jogo (pirâmide, cartas, eventos, nomes fictícios).
- `src/ui/`: interface React.
- A run fica na URL: `?s=<seed>&n=<nome>&k=<cor1>-<cor2>&o=<p|f|y>&c=<escolhas>`.

## Deploy (GitHub Pages)

O workflow `.github/workflows/pages.yml` roda os testes, faz o build e publica `dist/` no GitHub Pages a cada push na `main` (ou manualmente pela aba Actions). No repositório, a opção *Settings → Pages → Source* precisa estar em **GitHub Actions**.
