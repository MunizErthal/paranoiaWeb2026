# 06 — Cupons de desconto

## Contexto

Foi criada a coleção `cupons` no Firestore (documento de exemplo `PARANOIA30`: 30% de desconto, `tipoDeDesconto: "PORCENTAGEM"`, `criterios: [{produto: "TODOS"}]`). Este documento planeja o campo de cupom no carrinho/checkout, como a maioria das lojas faz, para o cliente aplicar o código e ver o desconto refletido até o pagamento.

Decisões confirmadas com o dono do produto:
- `criterios[]` é a lista de produtos-alvo do desconto único (`descontoEmPercent`, no nível raiz do documento). `{produto: "TODOS"}` = carrinho inteiro; senão, só os produtos listados.
- `tipoDeDesconto` suporta 3 valores nesta versão: `PORCENTAGEM`, `FRETE` (frete grátis) e `VALOR_FIXO` (desconto em R$).
- Regras extras: validade (`validoDe`/`validoAte`), valor mínimo de carrinho, e limite de usos.

Regra inegociável do projeto (ver `docs/IMPLEMENTACAO.md`, confirmada em `functions/src/pagamento/processar-pagamento.ts`): **o valor cobrado nunca vem do cliente**. O front só usa o cupom para exibir o desconto antes do pagamento; a Cloud Function `processarPagamento` relê o cupom do Firestore e recalcula tudo — o cliente manda só o **nome do cupom**, nunca o valor do desconto.

## Modelo de dados

`CupomDTO` (espelhado nos dois projetos TS — Angular e Functions não compartilham build, ver header de `functions/src/types.ts`):

```ts
type TipoDeDesconto = 'PORCENTAGEM' | 'FRETE' | 'VALOR_FIXO';

interface CriterioCupomDTO {
  produto: string; // produtoId, ou "TODOS"
}

interface CupomDTO {
  id: string;
  nome: string;               // código, ex: "PARANOIA30" — sempre normalizado p/ maiúsculas
  tipoDeDesconto: TipoDeDesconto;
  descontoEmPercent?: number; // usado quando PORCENTAGEM
  valorFixo?: number;         // usado quando VALOR_FIXO
  criterios: CriterioCupomDTO[];
  ativo: boolean;
  validoDe?: string;          // ISO date, opcional
  validoAte?: string;         // ISO date, opcional
  valorMinimoCarrinho?: number;
  limiteDeUsos?: number;
  usosTotais: number;         // contador, só incrementado pela Cloud Function
  criadoEm: string;
}
```

## Lógica de desconto (pura, duplicada propositalmente nos dois projetos)

Novo par de arquivos espelhados:
- `src/shared/utils/cupom.util.ts` (Angular)
- `functions/src/cupons/cupom.util.ts` (Functions)

Cada um exporta:
- `itensElegiveis(cupom, itens)` — filtra itens do carrinho cujo `produtoId` está em `criterios`, ou todos se houver `{produto: "TODOS"}`.
- `calcularDesconto(cupom, itens, valorFrete)` — dispatcher por `tipoDeDesconto` usando um mapa de estratégias (não `if/else`), seguindo o princípio Open/Closed já documentado em `docs/IMPLEMENTACAO.md`:
  - `PORCENTAGEM`: soma `precoUnit * quantidade` dos itens elegíveis × `descontoEmPercent/100`.
  - `VALOR_FIXO`: `Math.min(valorFixo, valorProdutosElegiveis)` (nunca desconta mais que o elegível).
  - `FRETE`: retorna o `valorFrete` recebido (zera o frete).
  - Retorna `{ valorDescontoProdutos, valorDescontoFrete }`.
- `validarCupom(cupom, { valorProdutos, agora })` — retorna `{ valido: boolean; motivo?: string }` checando `ativo`, janela `validoDe/validoAte`, `valorMinimoCarrinho`, e `usosTotais < limiteDeUsos` (quando definidos).

Isso mantém a mesma forma dos dois lados, fácil de comparar visualmente — igual ao padrão já usado para DTOs em `functions/src/types.ts`.

## Cliente (Angular)

1. **`src/shared/models/cupom.dto.ts`** — DTOs acima.
2. **`src/shared/services/firebase/cupom.service.ts`** — só leitura, igual `ProdutoService`:
   ```ts
   buscarPorNome(nome: string): Observable<CupomDTO | null> {
     return this.baseService
       .buscarPorCampo<CupomDTO>('cupons', 'nome', nome.trim().toUpperCase())
       .pipe(map(cupons => cupons[0] ?? null));
   }
   ```
3. **`src/shared/utils/cupom.util.ts`** — funções puras descritas acima.
4. **`CarrinhoStore`** (`src/shared/stores/carrinho.store.ts`) ganha o cupom aplicado, seguindo o mesmo padrão de `_itens`/`valorTotal`:
   - `_cupom = signal<CupomDTO | null>(...)`, persistido em `localStorage` (chave nova `cupomAplicado`) via o `effect()` já existente (ou um segundo `effect()`).
   - `readonly cupom = this._cupom.asReadonly()`
   - `readonly valorDesconto = computed(() => this._cupom() ? calcularDesconto(this._cupom()!, this._itens(), 0).valorDescontoProdutos : 0)` — só a parte de produto/valor fixo; o desconto de frete depende do frete escolhido, que só existe no checkout.
   - `aplicarCupom(cupom: CupomDTO): void` / `removerCupom(): void`
   - `limpar()` também zera o cupom (fim de compra).
5. **`checkout.ts`** — novos `computed`:
   ```ts
   readonly valorDescontoProdutos = computed(() => this.carrinhoStore.valorDesconto());
   readonly valorDescontoFrete = computed(() => {
     const cupom = this.carrinhoStore.cupom();
     return cupom?.tipoDeDesconto === 'FRETE' ? (this.freteSelecionado()?.preco ?? 0) : 0;
   });
   readonly valorTotal = computed(() =>
     Math.max(0, this.valorProdutos() + (this.freteSelecionado()?.preco ?? 0)
       - this.valorDescontoProdutos() - this.valorDescontoFrete())
   );
   ```
   E em `finalizarCompra()`, incluir `cupomNome: this.carrinhoStore.cupom()?.nome` no payload de `pagamentoService.processar(...)` (nunca um valor de desconto).
6. **UI** — adicionar campo "Cupom de desconto" (input + botão aplicar/remover + linha de desconto no resumo) em:
   - `src/app/carrinho/carrinho.ts` + `.html` (página do carrinho)
   - `src/shared/components/carrinho-drawer/carrinho-drawer.ts` + `.html` (drawer do header, que já duplica a lógica de itens da página)
   - `src/app/checkout/checkout.ts` + `.html` — só exibição do cupom já aplicado + linha(s) de desconto no resumo (aplicar acontece no carrinho, antes do checkout).

   Fluxo de aplicar (mesmo em carrinho e drawer): `cupomService.buscarPorNome(codigo)` → se `null`, `toast.showError('Cupom não encontrado.')`; se achou, `validarCupom(cupom, { valorProdutos: carrinhoStore.valorTotal(), agora: new Date() })` → se inválido, `toast.showError(motivo)`; se válido, `carrinhoStore.aplicarCupom(cupom)` + `toast.showSuccess('Cupom aplicado!')`. Reusa `ToastService` já existente, sem pipe de moeda novo (usa `CurrencyPipe` nativo já usado em todo o projeto).

## Servidor (Cloud Functions) — fonte da verdade

1. **`functions/src/types.ts`** — adicionar `CupomDTO`/`CriterioCupomDTO`/`TipoDeDesconto` (espelhando o DTO do Angular) e estender `CompraDTO` com `cupomAplicado?: { id: string; nome: string; tipoDeDesconto: TipoDeDesconto; valorDescontoProdutos: number; valorDescontoFrete: number } | null`.
2. **`functions/src/cupons/cupom.util.ts`** — `itensElegiveis`/`calcularDesconto`/`validarCupom`, espelhando o util do Angular (mesma forma, tipos do lado Functions).
3. **`functions/src/pagamento/processar-pagamento.ts`**:
   - `EntradaProcessarPagamento` ganha `cupomNome?: string`.
   - Depois de calcular `valorProdutos` e `freteConfirmado` (linhas ~55-83 atuais), se `entrada.cupomNome` vier preenchido:
     - Busca `db.collection('cupons').where('nome', '==', entrada.cupomNome.trim().toUpperCase()).limit(1).get()`.
     - Se não achar ou `validarCupom(...)` reprovar → `throw new HttpsError('failed-precondition', motivo)` (mesmo padrão do frete indisponível, linha ~76-81).
     - Se validar, `calcularDesconto(cupom, itensComProduto, freteConfirmado.preco)` → `valorDescontoProdutos`/`valorDescontoFrete`.
   - `valorTotal = Math.max(0, valorProdutos + freteConfirmado.preco - valorDescontoProdutos - valorDescontoFrete)`.
   - Grava `cupomAplicado` na `CompraDTO` (ou `null`).
   - Após criar a compra com sucesso, incrementa o contador de uso do cupom: `cupomRef.update({ usosTotais: FieldValue.increment(1) })`. **Limitação aceita**: isso não é uma transação atômica fim-a-fim com a criação do pagamento (mesmo padrão de simplicidade do restante da function — não há reserva/estorno de uso). Numa race extrema no último uso disponível, dois pedidos simultâneos poderiam passar. Aceitável para o volume da loja hoje; registrado aqui, não é bloqueante.
4. **`firestore.rules`** — novo bloco, mesmo padrão de `produtos`:
   ```
   match /cupons/{cupomId} {
     allow read: if true;   // validação/preview no client
     allow write: if false; // só Cloud Function (Admin SDK)
   }
   ```

## Fora de escopo (não implementar agora)

- Painel de administração para criar/editar cupons (continuam sendo criados manualmente no console do Firebase, como o documento de exemplo já mostra).
- Limite de uso *por usuário* (só limite total, via `limiteDeUsos`/`usosTotais`).
- Cupons combináveis (mais de um cupom por pedido) — só um cupom ativo por vez no carrinho.

## Verificação (quando for implementado)

- `npm run build` (Angular) e `npm run build` dentro de `functions/` para garantir que os DTOs novos compilam nos dois projetos.
- Testar manualmente com `npm start`: aplicar `PARANOIA30` no carrinho (produto qualquer, já que é `TODOS`), conferir desconto de 30% no resumo do carrinho, no drawer e no checkout; tentar um código inexistente e ver o erro; seguir até `finalizarCompra()` e conferir no documento gerado em `compras/` que `valorTotal` já sai com o desconto aplicado e `cupomAplicado` preenchido.
- Aplicar a regra nova do `firestore.rules` manualmente no console do Firebase (mesma ressalva já documentada no topo do arquivo — não há CI/firebase-tools configurado neste ambiente).
