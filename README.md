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
- A run fica na URL: `?s=<seed>&n=<nome>&k=<cor1>-<cor2>&o=<p|f|y>&a=<log de ações>`. Cada ação do escritório vira um token curto (`b3` compra, `s1042` vende, `j` joga a temporada...).

## Como se joga

A cada temporada você abre o **Escritório do Presidente**:

- **Painel:** evento da temporada, oportunidades (propostas opcionais), alertas e orçamento previsto.
- **Elenco:** jogadores com overall, potencial (faixa lida pelo olheiro), idade, salário, contrato e valor. Venda, dispense ou renove no último ano.
- **Base:** garotos que surgem todo ano (mais e melhores com a base investida) e a peneira (1 por temporada).
- **Mercado:** 8 jogadores por janela, com taxa à vista e salário na folha.
- **Estádio:** ampliações (ficam prontas no fim da temporada e contam na vistoria do acesso), preço do ingresso e estrutura (CT, base, departamento médico).
- **Clube:** comissão técnica, patrocínios, empréstimos e identidade.

O botão **Assistente decide** faz uma gestão conservadora por você, e **Rápido** deixa o assistente gerir e jogar até algo decisivo acontecer.

## Deploy (GitHub Pages)

O workflow `.github/workflows/pages.yml` roda os testes, faz o build e publica `dist/` no GitHub Pages a cada push na `main` (ou manualmente pela aba Actions). No repositório, a opção *Settings → Pages → Source* precisa estar em **GitHub Actions**.
