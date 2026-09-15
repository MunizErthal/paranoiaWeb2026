# 01 — Padrões de componentes, services, signals e shared files

> Documento de planejamento. Define as regras que todo código novo (loja, carrinho, autenticação, perfil) deve seguir. **Não altera** nada do design/HTML/CSS já existente — só organiza o que vem daqui pra frente.

## Princípio geral

O site institucional atual (Home, Jogos, Sobre, Loja, Contato) **não é tocado** neste esforço, exceto para adicionar novos pontos de entrada (ex: ícone de carrinho no header, botão "Comprar" na página de detalhe do jogo). Todo o resto é tela nova, sob rotas novas.

## Estrutura de pastas

```
src/
  app/
    <feature>/<feature>.ts|.html|.scss     ← páginas roteadas (já é o padrão do repo)
    login/
    cadastro/
    perfil/
      perfil.ts                            ← visão geral
      enderecos/
      pedidos/
        pedidos.ts                         ← lista
        pedido-detalhe.ts                  ← detalhe de um pedido
    carrinho/
    checkout/
  shared/
    components/        ← NOVO — componentes reutilizáveis de UI (não são página)
    guards/             ← já existe
    models/             ← já existe (DTOs)
    pipes/              ← NOVO — ex: moeda BRL, máscara de CPF
    services/
      firebase/          ← já existe (base + domínio)
      pagamento/          ← NOVO — client das Cloud Functions de pagamento (Mercado Pago)
      frete/              ← NOVO — client das Cloud Functions de frete (Melhor Envio)
      toast/              ← já existe
    stores/             ← NOVO — estado em signals, compartilhado entre componentes
    utils/               ← NOVO — funções puras (validação de CPF, formatação, etc)
```

Nomenclatura segue o que já está estabelecido no repo: nomes de domínio em português (`usuario.dto.ts`, `carrinho.store.ts`), sufixos técnicos em inglês (`.service.ts`, `.guard.ts`, `.dto.ts`, `.store.ts`).

## Camadas e responsabilidade

1. **`FirebaseBaseService`** (já existe) — único ponto que fala com o SDK do Firestore. Continua assim; nenhum service de domínio deve importar `@angular/fire/firestore` diretamente.
2. **Services de domínio** (`UsuarioService`, `ProdutoService`, `PedidoService`, `EnderecoService`) — regras de uma coleção específica, sempre por cima do `FirebaseBaseService`. Não guardam estado, só fazem I/O (padrão já usado em `UsuarioService`/`PersonagensService`).
3. **Stores (signals)** — guardam estado observável pela UI (usuário logado, carrinho, etc). Não fazem I/O diretamente — chamam os services de domínio.
4. **Componentes** — só leem signals dos stores e chamam métodos deles. Não conhecem Firestore.

## Padrão de Signal Store

Novo padrão pra todo estado compartilhado (substituirá o uso de `BehaviorSubject` em serviços de estado, como o `AuthStateService` atual — ver [02-firestore-auth.md](./02-firestore-auth.md)).

```ts
@Injectable({ providedIn: 'root' })
export class CarrinhoStore {
  private readonly _itens = signal<ItemCarrinho[]>(this.carregarDoLocalStorage());

  readonly itens = this._itens.asReadonly();
  readonly quantidadeTotal = computed(() =>
    this._itens().reduce((soma, i) => soma + i.quantidade, 0)
  );
  readonly valorTotal = computed(() =>
    this._itens().reduce((soma, i) => soma + i.precoUnit * i.quantidade, 0)
  );

  adicionarItem(item: ItemCarrinho): void { /* ... */ }
  removerItem(produtoId: string): void { /* ... */ }
  atualizarQuantidade(produtoId: string, quantidade: number): void { /* ... */ }
  limpar(): void { /* ... */ }
}
```

Regras:
- Estado interno é sempre um `signal` privado; só se expõe via `.asReadonly()` ou `computed()`.
- Nada de estado em `environment.ts`/`environment.prod.ts` — isso é bug hoje (ver MD 02) e não deve se repetir.
- Quando precisar consumir algo que só existe como `Observable` (ex: `authState(auth)` do AngularFire, ou `Firestore` `collectionData`), usar `toSignal()` de `@angular/core/rxjs-interop` — não fazer `subscribe()` manual guardando em variável de classe.
- Persistência em `localStorage` fica dentro do próprio store (ex: `CarrinhoStore` salva/lê o carrinho), nunca espalhada pelos componentes.

RxJS não é abolido: services de domínio continuam retornando `Observable` (como já fazem), porque é assim que o `FirebaseBaseService` funciona hoje. A conversão pra signal acontece na borda (no store), não no service de dados.

## Padrão de componentes

- Standalone (já é o padrão do repo, sem NgModules).
- APIs baseadas em signal para inputs/outputs em componentes novos: `input()` / `output()` em vez de `@Input()`/`@Output()`.
- `ChangeDetectionStrategy.OnPush` em todo componente novo. (O `App` root atual usa `ChangeDetectorRef.detectChanges()` manual — é um padrão anterior aos signals; não replicar em código novo. Signals disparam CD automaticamente com OnPush.)
- Componente de página (`src/app/<feature>`) fica fino: monta a view, delega tudo pra stores/services.
- Peças reutilizáveis entre páginas (cartão de produto, formulário de endereço, badge de status de pedido, input com máscara de CPF/CEP) vão para `src/shared/components/`.

## Design e estilo

- Nenhum valor "mágico" fora de `src/styles/_tokens.scss`. Toda tela nova usa as variáveis já definidas (cor, espaçamento, tipografia, sombra, movimento).
- Antes de estilizar um componente novo, checar `_components.scss`/`_base.scss` — se já existe um padrão equivalente (botão, card, input), reaproveitar em vez de recriar.
- Peças novas que não têm equivalente hoje (ex: badge de status de pedido, stepper de checkout) seguem a linguagem visual documentada em `_tokens.scss` (cantos retos, superfícies opacas, aberração cromática usada com parcimônia).

## Rotas novas propostas

```ts
{ path: 'login', component: Login },
{ path: 'cadastro', component: Cadastro },
{ path: 'esqueci-senha', component: EsqueciSenha },
{ path: 'carrinho', component: Carrinho },                                  // pública, sem guard
{ path: 'checkout', component: Checkout, canActivate: [AuthGuard] },
{ path: 'perfil', component: Perfil, canActivate: [AuthGuard] },
{ path: 'perfil/enderecos', component: Enderecos, canActivate: [AuthGuard] },
{ path: 'perfil/pedidos', component: Pedidos, canActivate: [AuthGuard] },
{ path: 'perfil/pedidos/:idPedido', component: PedidoDetalhe, canActivate: [AuthGuard] },
```

Recomendo carregar essas rotas com `loadComponent` (lazy) em vez de import eager como hoje — mantém o bundle inicial do site institucional leve, já que loja/carrinho/perfil só carregam quando o visitante realmente entra nessas áreas.

## Feedback ao usuário

Continua usando o `ToastService` já existente (`showError`/`showSuccess`/`showInfo`) para qualquer resultado de ação (login, cadastro, adicionar ao carrinho, erro de checkout etc). Nenhum novo mecanismo de notificação é necessário.

## Testes

O projeto já tem Vitest configurado. Todo `.store.ts` e `.service.ts` novo deve vir com `.spec.ts` cobrindo pelo menos: caminho feliz, e um caso de erro (ex: Firestore indisponível, dado inválido).

## Checklist desta etapa

- [ ] Criar pastas `shared/components`, `shared/stores`, `shared/pipes`, `shared/utils`
- [ ] Definir lazy loading das rotas novas em `app.routes.ts`
- [ ] Criar pipes utilitários: moeda BRL, máscara de CPF, máscara de CEP
- [ ] Criar util de validação de CPF (dígito verificador)
- [ ] Documentar (neste arquivo ou num `README` em `shared/`) qualquer novo componente reutilizável conforme for criado
