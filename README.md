# Da Várzea à Glória

Simulador de carreira de clube de futebol brasileiro no navegador. Você funda um time de bairro na Várzea e, como dono, tenta subir pelo Estadual e pelas Séries D, C e B até a Série A, a Copa Continental e o Mundial em 50 temporadas. Nomes de clubes, jogadores e competições são fictícios.

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
- **Elenco:** jogadores com overall, potencial (faixa lida pelo olheiro), idade, salário, contrato e valor. Contratos renovam sozinhos; você só marca quem não quer manter. Venda, dispense, empreste jovens e aceite propostas de outros clubes.
- **Base:** garotos que surgem todo ano (mais e melhores com a base investida) e a peneira (1 por temporada).
- **Mercado:** 12 jogadores por janela (promessas, prontos, veteranos e sem clube), com filtros, taxa à vista e salário na folha.
- **Estádio:** ampliações (ficam prontas no fim da temporada e contam na vistoria do acesso), preço do ingresso e estrutura (CT, base, departamento médico).
- **Clube:** comissão técnica, patrocínios, empréstimos e identidade.
- **Troféus:** sala de troféus e recordes do clube.

A carreira é salva automaticamente no navegador (até 5 em andamento); runs terminadas vão para o Hall da fama.

O botão **Assistente decide** faz uma gestão conservadora por você, e **Rápido** deixa o assistente gerir e jogar até algo decisivo acontecer. Na aba Clube dá para **delegar** áreas (contratos, base, mercado, estádio) a diretores que cuidam delas sozinhos.

O calendário é o brasileiro: **Estadual** no 1º semestre e **série nacional** no 2º (Séries A e B em pontos corridos, Série C com quadrangulares, Série D com grupos e mata-mata). As vagas na Série D saem do Estadual. Há ainda a **Copa do Estado**, a **Copa Nacional** (o pequeno joga em casa nas fases iniciais), a **Copa Continental** (top 6 da Série A e campeão da Copa Nacional), a **Copa Sul** e o **Mundial de Clubes**. Finais, playoff, última rodada decisiva, zebra na copa e clássico são mostrados **ao vivo**, com narração.

Também há: técnicos com estilo (ofensivo, retranqueiro, formador, motivador, estrategista), comércio local, torcedômetro, metas da temporada, histórico do clássico, conquistas, **desafio do dia** (mesma seed para todo mundo) e **card final** em PNG 1080x1350.

## Deploy (GitHub Pages)

O workflow `.github/workflows/pages.yml` roda os testes, faz o build e publica `dist/` no GitHub Pages a cada push na `main` (ou manualmente pela aba Actions). No repositório, a opção *Settings → Pages → Source* precisa estar em **GitHub Actions**.
