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

## Modos de jogo

- **Técnico**: você começa sem nome, aos 35 anos, com 3 propostas de times pequenos. Escala o time (esquema), cuida da base e das transferências dentro da **verba** e do **teto da folha** que a diretoria libera. A diretoria (paciente, imediatista ou mão de vaca) cobra as metas e tem uma barra de **confiança**: zerou, você é demitido e escolhe outro clube. A **reputação** decide quem te procura; a cada janela podem chegar propostas de outros clubes. A carreira vai até os 70 anos. Estádio, finanças e estrutura ficam com a diretoria.
- **Presidente**: você funda um time na Várzea e cuida de tudo (elenco, estádio, finanças, técnico) por 50 temporadas.

## Arquitetura

- `src/engine/`: motor puro (sem React, sem DOM, sem `Math.random`). Determinístico: a mesma seed com as mesmas escolhas gera sempre a mesma run, e `replay(seed, fundação, escolhas)` reconstrói o estado. Feito para rodar também num servidor.
- `src/data/`: dados de jogo (pirâmide, cartas, eventos, nomes fictícios).
- `src/ui/`: interface React.
- A run fica na URL: `?s=<seed>&n=<nome>&k=<cor1>-<cor2>&o=<p|f|y>&a=<log de ações>`. Cada ação do escritório vira um token curto (`b3` compra, `s1042` vende, `j` joga a temporada...).

## Como se joga

A cada temporada você abre o **Escritório do Presidente** (abas em grade, nada escondido):

- **Início:** evento, metas, torcedômetro, propostas recebidas, oportunidades, alertas e identidade do clube.
- **Elenco:** jogadores com overall, potencial (faixa lida pelo olheiro), idade, salário, contrato, valor e a intenção de cada um para o fim da temporada. Renovar, convencer, vender, liberar ou emprestar.
- **Base:** garotos que surgem todo ano, empréstimos e a peneira.
- **Mercado:** a janela, a busca de qualquer jogador do mundo e o elenco de qualquer clube, com negociação (taxa, salário e anos; contraproposta; o jogador decide).
- **Comissão:** o técnico (esquema tático que define o time titular, estilo, moral, contrato e pedidos), os técnicos disponíveis, os diretores (delegar áreas) e o staff.
- **Estrutura:** estádio (obras para a vistoria do acesso), CT, base, departamento médico e comércio local.
- **Finanças:** caixa, orçamento previsto, preço do ingresso, patrocínios e banco.
- **Notícias** do mundo da bola e **Troféus** (sala de troféus, conquistas e recordes).

Durante a temporada há **cansaço** (quem joga muito rende menos) e **lesões** (departamento médico com data de volta). No modo técnico você escolhe a **escalação** (ou deixa no automático, com rodízio) a qualquer momento, e em julho abre a **janela do meio do ano** para contratar e vender. Cada decisão vale só para os jogos seguintes.

Depois de jogos marcantes (goleada, clássico, zebra, eliminação, título, sequência boa ou ruim) aparece a **entrevista pós-jogo**, e antes de jogo decisivo, a **coletiva**: 1 ou 2 perguntas, respostas humildes, confiantes ou polêmicas que mexem na torcida, na diretoria, na reputação e no vestiário (dá para pular). A **base** disputa a Copa de Juniores (Sub-20), o Estadual Sub-17 e, nas Séries A e B, o Brasileiro Sub-20: quem se destaca ganha potencial e pode pedir para subir.

Depois de jogar a temporada, você acompanha o **calendário**: avança por **próximo jogo**, **semana**, **mês** ou **até o fim**, com tabela parcial, últimos resultados e próximos jogos. Os jogos ao vivo aparecem na data em que acontecem.

Todo jogo de todos os clubes gera **autores dos gols, assistências e notas**. No fim da temporada há a **cerimônia de prêmios**: de cada liga (craque, artilheiro, seleção, técnico e revelação) e gerais (**Bola de Ouro**, **Chuteira de Ouro**, time da temporada, técnico da temporada e revelação do ano). Os prêmios do seu clube vão para a sala de troféus.

O botão **Assistente decide** faz uma gestão conservadora por você, e **Rápido** deixa o assistente gerir e jogar até algo decisivo acontecer.

O calendário é o brasileiro: **Estadual** no 1º semestre e **série nacional** no 2º (Séries A e B em pontos corridos, Série C com quadrangulares, Série D com grupos e mata-mata). As vagas na Série D saem do Estadual. Há ainda a **Copa do Estado**, a **Copa Nacional** (o pequeno joga em casa nas fases iniciais), a **Copa Continental** (top 6 da Série A e campeão da Copa Nacional), a **Copa Sul** e o **Mundial de Clubes**. Finais, playoff, última rodada decisiva, zebra na copa e clássico são mostrados **ao vivo**, com narração.

Também há: técnicos com estilo (ofensivo, retranqueiro, formador, motivador, estrategista), comércio local, torcedômetro, metas da temporada, histórico do clássico, conquistas, **desafio do dia** (mesma seed para todo mundo) e **card final** em PNG 1080x1350.

## Pacote de nomes

O jogo só traz nomes fictícios. Na tela inicial, em **Nomes dos clubes**, dá para importar um arquivo `.json` que troca os nomes, siglas e cores dos clubes das Séries A a D (e dos clubes sem divisão de outros estados). O pacote fica só no navegador de quem importou e não muda nenhum resultado: carreiras salvas e links continuam iguais, só com outros nomes.

```json
{
  "title": "Meu pacote",
  "divisions": {
    "1": [{ "name": "Clube Maior", "short": "CMA", "colors": ["#c8102e", "#ffffff"] }, "Outro Clube"],
    "2": [], "3": [], "4": []
  },
  "pool": ["Clube Sem Divisão"]
}
```

Em cada divisão, a ordem importa: o primeiro nome vai para o clube mais forte. Clubes do nosso estado que estão numa série nacional também recebem nome do pacote (e jogam o Estadual); Estadual, Estadual Série B e Várzea continuam fictícios.

## Deploy (GitHub Pages)

O workflow `.github/workflows/pages.yml` roda os testes, faz o build e publica `dist/` no GitHub Pages a cada push na `main` (ou manualmente pela aba Actions). No repositório, a opção *Settings → Pages → Source* precisa estar em **GitHub Actions**.
