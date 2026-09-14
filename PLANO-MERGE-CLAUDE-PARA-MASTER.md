# Plano de alterações — trazer o melhor da branch `claude` para a `master`

**Base:** `master` (`145d880`) permanece como referência visual.
**Fonte:** `claude` (`ad7f1e7`, commit único "Refatoração feita pelo claude").
**Regra-mestra:** o que não estiver listado abaixo **não muda** — fica exatamente como está na `master`.

---

## 0. Estrutura de arquivos e organização (OBS 3)

Hoje a `master` tem todo o CSS espalhado entre `styles.scss` (global), `app.scss`, `page.scss`, `glitch.scss` e os SCSS de cada página, com valores mágicos repetidos (`#9d43ff`, `rgba(247,242,255,0.76)`, `0.7vw`...). A branch `claude` resolveu isso com uma camada de tokens.

**O que farei:** criar `src/styles/` com três parciais, importados na ordem certa por `styles.scss`:

```
src/
  styles.scss            → só @use dos parciais (ponto de entrada)
  styles/
    _tokens.scss         → variáveis CSS (cor, tipografia, espaço, forma, movimento)
    _base.scss           → reset mínimo + scrollbar + focus + .sr-only
    _components.scss     → primitivas reutilizadas: .tag, .link-back, .link-action, .u-evidence
```

**Importante — o que NÃO vou fazer:** não vou trazer o `_base.scss` completo da branch `claude`. Ele reescreve `body`, `h1`, `p`, `a`, `img` do site inteiro e mudaria a aparência da `master` em todas as páginas. Vou trazer só a parte que é neutra ou explicitamente pedida (scrollbar, focus ring, `.sr-only`, `box-sizing`).

Os tokens entram como **variáveis disponíveis**, sem reescrever nada por conta própria. As páginas da `master` continuam com o CSS delas; vou apenas substituir valores repetidos por tokens onde for seguro, para o código ficar organizado sem mudar o resultado visual.

---

## 1. Os 4 tópicos (benefícios) — imagem 1

**Hoje na master:** `.benefits` é um flex com `max-width: 35vw`, `min-width: 15vw` por item, ícone e texto lado a lado, com `style="margin-right: 0vw"` inline em dois `<article>`.

**Como vai ficar:** a grade da branch `claude` — 4 colunas iguais dentro de uma moldura única com linha divisória de 1px entre as células, cantos arredondados, fundo `--surface-1`.

**A diferença que você pediu:** o ícone fica **centralizado acima do texto**, e o texto também centralizado (na `claude` estava alinhado à esquerda, com ícone em cima).

- Arquivo: `src/app/home/home.html` (troca `.benefits/.benefit` por a estrutura `<ul class="trust__list">`), `src/app/home/home.scss`.
- Remove os `style="margin-right: 0vw !important"` inline.
- Responsivo: 1 coluna no celular → 2 colunas ≥480px → 4 colunas ≥960px.
- Mantenho os mesmos 4 textos e os mesmos ícones (`delivery/credit/shield/human.png`) e o `drop-shadow` roxo do ícone.

---

## 2. Canto roxo no quadro de contato + seta no Instagram — imagem 2

**Hoje na master:** `.contact-page__aside` tem `border-left: 2px solid #9d43ff` e `width: 17vw`. O link do Instagram usa o caractere `↗`.

**Como vai ficar:**
- Entra a primitiva `.u-evidence` (marca de recorte de prova): dois cantos em L roxos — superior-esquerdo e inferior-direito — desenhados com `::before`/`::after`, exatamente como nas setas vermelhas da imagem.
- O `border-left` roxo sai (o canto substitui).
- O `↗` do Instagram vira o **ícone SVG** da branch `claude` (traço que acompanha a cor do texto), com `<span class="sr-only">(abre em nova aba)</span>`.
- `width: 17vw` sai e vira largura fluida — isso é parte da responsividade (OBS 2).

- Arquivos: `src/app/contato/contato.html`, `src/app/contato/contato.scss`, `src/styles/_components.scss`.

---

## 3. Botão "VOLTAR AOS CASOS" — imagem 3

**Hoje na master:** `<a class="back-link"><a>&#60;</a>&nbsp;&nbsp;...Voltar</a>` — um `<a>` dentro de outro `<a>`, que o navegador desmonta (o link quebra), com `font-size: 0.8vw`.

**Como vai ficar:** a `.link-back` da branch `claude` — um único link, ícone de seta em SVG, texto "Voltar aos casos" em caixa alta, altura mínima de toque (44px), e a seta desliza 3px para a esquerda no hover.

- Arquivos: `src/app/jogos/jogo-detalhe.html`, `src/styles/_components.scss`, remoção da `.back-link` de `src/styles.scss`.

---

## 4. Menu fixo e escurecido ao rolar — imagem 4

**Hoje na master:** `.main-navigation` é `position: absolute; bottom: 0.25vw` dentro de `.logo-container` — ao rolar, some.

**Como vai ficar:** mantenho **exatamente** o visual atual do menu (mesma fonte, `letter-spacing`, sublinhado branco animado no hover/ativo, mesmo espaçamento). Muda só o comportamento:

- O menu sai de dentro do `.logo-container` e vira uma faixa própria logo abaixo do cabeçalho, com `position: sticky; top: 0`.
- Enquanto está no topo da página: fundo transparente, como hoje.
- Ao descer o scroll: ganha fundo escuro translúcido (`rgba(16, 8, 25, 0.86)`) + `backdrop-filter: blur(14px)` + borda inferior de 1px, com transição suave.
- O escurecimento será controlado por uma classe (`.is-scrolled`) aplicada via listener de scroll em `app.ts`, para a transição ser gradual.

- Arquivos: `src/app/app.html`, `src/app/app.scss`, `src/app/app.ts`.

---

## 5. Tela de jogos

### 5.A — Card do jogo — imagem 5

**Mantém-se da master:** layout do card (capa à esquerda em `20vw`, detalhes à direita), tamanhos de fonte, tags, `dl` de metadados, borda `#2B1C49`, fundo, `box-shadow` interno.

**O que entra da branch `claude`:**
1. **Hover:** a borda passa a `--accent` (`#9d43ff`) e a sombra sobe para `--shadow-2`, com transição de 200ms. Também no `:focus-visible` (teclado).
2. **Linha de separação:** `border-top: 1px solid var(--line)` acima do bloco de metadados (Jogadores / Idade / Duração), com respiro acima — é a linha das setas vermelhas na imagem 5.
3. **Texto "Abrir o caso":** entra abaixo dos metadados, com o estilo `.link-action` (roxo, caixa alta, `font-weight` 600).

- Arquivos: `src/app/jogos/jogos.html`, `src/app/jogos/jogos.scss`.

### 5.B — Página do jogo: modelo híbrido — imagem 6

Esta é a montagem que você fez. O comportamento tem dois estados:

**Estado inicial (ao abrir a página):**
- Botão `← VOLTAR AOS CASOS` no topo (item 3).
- Hero: a arte de capa ocupando toda a largura do conteúdo, com o degradê escuro embaixo (como está hoje na `master`), e **sobre a imagem**:
  - `A CIDADE SUBMERSA` (título)
  - tags `Investigativo` / `Narrativo`
  - ficha técnica com ícones: `2-6 Jogadores`, `14+ Idade`, `60-90 min Duração`
  - subtítulo: *"Segredos sombrios vêm à tona quando o passado nunca ficou para trás."*
- O resto da página (caixa de compra, galeria, "Sobre o jogo") começa abaixo da dobra.

**Ao descer o scroll:**
- As **tags** e a **ficha técnica** somem da imagem com animação (`opacity` + deslocamento vertical de ~8px, 420ms).
- Ficam sobre a imagem **apenas o título e o subtítulo**.
- As mesmas informações **reaparecem abaixo do hero**, com animação de entrada, na coluna esquerda: primeiro as tags, depois a ficha técnica dentro de um bloco com linhas horizontais acima e abaixo.

**Layout abaixo do hero (duas colunas em desktop, ≥1024px):**

| Coluna esquerda | Coluna direita (fixa ao rolar) |
|---|---|
| Tags (animadas) | Preço `R$ 189,90` grande |
| Ficha técnica (animada, entre linhas) | `ou 6x de R$ 31,65 sem juros` |
| Galeria de 3 miniaturas | Botão `ADICIONAR AO CARRINHO` (largura total) |
| Bloco `SOBRE O JOGO` | `Envio para todo o Brasil. Compra 100% segura.` |
| | Acordeão: O que vem na caixa / Como jogar / Avaliações (128) |

Detalhes que vêm da branch `claude` e entram aqui:
- A caixa de compra fica `position: sticky` na coluna direita e ganha os cantos `.u-evidence` roxos (como na imagem 6).
- O botão de compra deixa de ter `font-size: 0.7vw` (≈9px em tela de 1280) e passa a ser o maior alvo da página, com o ícone de carrinho em SVG.
- Os três "pontinhos" (`.game-detail__dots`) saem: sugeriam um carrossel que não existe.
- A galeria passa a ter três imagens reais do jogo com proporção fixa (hoje uma delas é o fundo do site esticado a 83px de altura).
- O `+` fixo do acordeão vira uma seta desenhada que gira ao abrir.

Em telas abaixo de 1024px, tudo empilha em uma coluna, na ordem: hero → tags → ficha → caixa de compra → galeria → sobre o jogo.

- Arquivos: `src/app/jogos/jogo-detalhe.html`, `src/app/jogos/jogo-detalhe.scss`, `src/app/jogos/jogo-detalhe.ts` (lógica do scroll com `IntersectionObserver`, não listener de scroll — mais barato e não trava a rolagem).

---

## 6. Cor da barra de rolagem — imagem 7

Entra em `src/styles/_base.scss`:

```scss
:root {
  color-scheme: dark;
  scrollbar-color: var(--accent-solid) var(--c-void);  /* Firefox */
  scrollbar-width: thin;
}
::-webkit-scrollbar { width: 10px; }
::-webkit-scrollbar-track { background: var(--c-void); }
::-webkit-scrollbar-thumb { background: var(--accent-solid); border: 2px solid var(--c-void); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--accent-solid-hover); }
```

---

## 7. Rodapé e a linha da seção anterior — imagem 8

**"Receba novos casos" (newsletter): fica exatamente como está na `master`.** Mesmo título, mesmo texto com `<br class="newsletter-break">`, mesmo campo de e-mail colado ao botão `→` com gradiente roxo, mesmo fundo com a textura. **A única mudança é a borda.**

**O que muda:**
1. **A linha:** `border-bottom: 1px solid var(--line)` no final da seção newsletter — é ela que dá a sensação de "fim de página" na imagem 8.
2. **Rodapé:** fundo sólido `--c-void` (`#0c0714`), o preto-arroxeado da imagem, em vez de transparente.
3. Tamanhos em `vw` (`font-size: 1vw`, `0.7vw`, `width: 20vw`, `1.5vw`) saem e viram `rem`/tokens — em monitor pequeno o copyright ficava com ~9px e em ultrawide ficava gigante.
4. A citação e o copyright passam a usar `--text-muted` e `--text-subtle`.

**Pergunta em aberto:** na `master`, a logo do rodapé é uma segunda pilha de 17 `<div class="strip">` com a animação de glitch; na `claude` virou uma imagem única (`logo.png`). Como não foi apontado, **vou manter a pilha de strips da `master`** — só ajustando o tamanho para `rem`. Se preferir a imagem única (mais leve), me avise.

---

## OBS 2 — Responsividade com foco em mobile

Depois das alterações acima, passo por todas as páginas convertendo o dimensionamento. O problema central da `master` é que quase tudo é medido em `vw`: `font-size: 0.8vw`, `width: 17vw`, `height: 18vw`, `min-height: 55vw`. Isso faz o texto encolher junto com a janela (ilegível em notebook) e ignora o zoom do navegador.

**Estratégia:**
- Tipografia em `clamp()` com base em `rem` — cresce com a tela mas nunca fica abaixo do mínimo legível, e respeita o zoom.
- Breakpoints consistentes: `30rem` (480px), `48rem` (768px), `64rem` (1024px). A `master` hoje mistura `600px` e `700px` e `701px`.
- Larguras fluidas (`min()`, `max-width` + `margin-inline: auto`) no lugar de `width: 100vw` / `width: 17vw`.
- Alvos de toque de no mínimo 44px em links de menu, botões e itens do acordeão.
- `scrollbar-gutter: stable` no `html` para eliminar o overflow horizontal causado por `width: 100vw` com barra de rolagem visível.
- Páginas a revisar: home, jogos, jogo-detalhe, loja, sobre, contato, cabeçalho/menu/newsletter/rodapé.

---

## Arquivos tocados (resumo)

| Arquivo | Motivo |
|---|---|
| `src/styles.scss` | vira ponto de entrada dos parciais |
| `src/styles/_tokens.scss` | **novo** — variáveis |
| `src/styles/_base.scss` | **novo** — reset mínimo, scrollbar (item 6), focus, `.sr-only` |
| `src/styles/_components.scss` | **novo** — `.tag`, `.link-back` (3), `.link-action` (5A), `.u-evidence` (2, 5B) |
| `src/app/app.html` / `.scss` / `.ts` | menu fixo + escurecido (4), borda da newsletter e rodapé (7) |
| `src/app/home/home.html` / `.scss` | 4 tópicos (1) + responsividade |
| `src/app/jogos/jogos.html` / `.scss` | hover, linha, "Abrir o caso" (5A) |
| `src/app/jogos/jogo-detalhe.html` / `.scss` / `.ts` | modelo híbrido + animação de scroll (5B) |
| `src/app/contato/contato.html` / `.scss` | cantos roxos + seta do Instagram (2) |
| `src/app/loja/loja.scss`, `src/app/sobre/sobre.scss`, `src/app/page.scss` | **só** responsividade (OBS 2) |

**Não serão tocados:** `glitch.scss`, `app.routes.ts`, `main.ts`, `index.html`, `angular.json`, `package.json`, textos e imagens que não foram citados.

---

## Uma limitação a registrar

Esta sessão consegue ler e gravar arquivos na sua pasta, mas **não consegue rodar comandos na sua máquina** (`git`, `npm`, `ng build`). Consequências:

- Li a branch `claude` lendo os objetos do `.git` diretamente — funcionou, tenho os arquivos dos dois branches.
- **Você está na `master` e eu vou escrever por cima dos arquivos dela.** Recomendo criar uma branch antes (`git checkout -b merge-visual`) para poder comparar e voltar atrás.
- A validação final (`ng serve` e olhar no navegador, inclusive no modo mobile) precisa ser feita por você. Faço a revisão de código e a conferência de consistência do meu lado.

---

**Confere com o que você tinha em mente?** Se algum item estiver diferente do esperado — especialmente o 5.B, que é a montagem — me diga antes de eu começar a escrever.
