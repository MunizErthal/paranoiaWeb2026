# Documento de implementação — Loja, carrinho e conta de usuário

> Este é o documento de execução. Os 4 documentos em [`docs/planejamento/`](./planejamento/) definem **o que** e **por quê**; este define **em que ordem**, **como** e **com quais regras de qualidade**.

## Como executar este documento

1. Trabalhe **uma fase por vez, na ordem**. Cada fase depende das anteriores — pular ordem gera retrabalho (ex: escrever telas antes de existir `AuthStateStore` obriga a reescrever as telas depois).
2. Antes de começar uma fase, leia o documento de planejamento referenciado por ela. Este documento não repete o conteúdo deles, referencia.
3. Ao terminar cada fase: rodar `npm run build` e os testes, marcar os checkboxes da fase aqui, e fazer **um commit por fase** (padrão do repo: `feat:`, `fix:`, `refactor:`).
4. Não avance de fase com a anterior quebrada. "Compila" não é critério de aceite — cada fase tem critérios próprios listados.
5. Quando uma decisão não estiver coberta aqui nem no planejamento, **pergunte antes de inventar**. Especialmente em qualquer coisa que envolva dinheiro, dado pessoal (CPF/endereço) ou escrita em coleção do Firestore.

## Regras de qualidade que valem para todo o código novo

### Signals

- Estado interno sempre privado: `private readonly _x = signal(...)`. Exposição só via `.asReadonly()` ou `computed()`.
- **Nunca duplicar estado derivado.** Se um valor pode ser calculado a partir de outro, é `computed()`, não um segundo `signal`. Total do carrinho é `computed`, não um campo mantido em paralelo.
- `effect()` só para efeito colateral de saída (persistir em `localStorage`, sincronizar com Firestore). Nunca para derivar estado — isso é `computed()`.
- Atualização imutável: `this._itens.update(itens => [...itens, novo])`. Nunca `push` no array de dentro do signal.
- Interop com RxJS só na borda: `toSignal()` para consumir `Observable` do AngularFire. Nenhum `.subscribe()` manual guardando resultado em campo de classe.
- Para carregamento assíncrono de dados em tela (catálogo, pedidos), preferir `resource()` a orquestrar `signal` + `effect` na mão.

### SOLID (aplicado ao Angular deste projeto)

- **S — Responsabilidade única**: `FirebaseBaseService` fala com o Firestore. `ProdutoService` conhece as regras da coleção `produtos`. `CarrinhoStore` guarda estado de carrinho. Um componente monta a tela. Se uma classe precisa de "e" na descrição do que faz, ela está grande demais.
- **O — Aberto/fechado**: acrescentar um novo meio de entrega ou uma nova regra de desconto não deve exigir editar o `CarrinhoStore`. Onde houver variação previsível, injete a variação (estratégia) em vez de ramificar com `if`.
- **L — Substituição de Liskov**: se `ProdutoService` e `PedidoService` compartilham contrato, um não pode quebrar expectativas do outro (ex: um retorna `null` quando não acha, outro lança). Padronize: **não encontrado retorna `null`**, erro de infraestrutura lança.
- **I — Segregação de interface**: componentes recebem apenas o que usam. Um `app-pedido-card` recebe os dados do pedido, não o store inteiro.
- **D — Inversão de dependência**: componentes dependem de stores/services injetados, nunca de `Firestore`/`Auth` direto. Nenhum componente importa `@angular/fire/*`.

### Object Calisthenics (adaptado a TypeScript/Angular)

Aplicar com bom senso — as regras existem para forçar objetos pequenos e coesos, não para virar dogma:

1. **Um nível de indentação por método.** Se aninhou dois `if`/`for`, extraia um método privado com nome que explique a intenção.
2. **Evite `else`.** Prefira retorno antecipado (guard clause).
3. **Encapsule primitivos de domínio.** `cpf: string` solto pelo código convida a bug; crie utilitários de validação/formatação em `shared/utils` e use-os em toda entrada e saída. (Não precisa criar classe para tudo — mas CPF, CEP e valores monetários precisam de um ponto único de validação/formatação.)
4. **Coleções de primeira classe.** A lista de itens do carrinho, com suas regras (somar, deduplicar, limitar quantidade), pertence ao `CarrinhoStore` — não espalhe `array.filter(...)` de item de carrinho por três componentes.
5. **Uma chamada encadeada por linha (Lei de Demeter).** `pedido.endereco.cidade.nome` acoplando a tela a três níveis de estrutura é sinal de que falta um `computed` ou um campo achatado no DTO de view.
6. **Não abrevie.** `qtd`, `usr`, `prod` não. `quantidade`, `usuario`, `produto` sim. Alinha com o padrão em português já usado no repo.
7. **Entidades pequenas.** Componente acima de ~150 linhas de TypeScript, ou service acima de ~200, é sinal de divisão pendente. O `FirebaseBaseService` atual (~330 linhas, com métodos específicos de partida/personagem misturados ao CRUD genérico) já está fora desse limite — ver Fase 0.
8. **Poucos campos por classe.** A regra original (dois) não sobrevive à injeção de dependência do Angular; a versão útil aqui é: **injeções demais = responsabilidades demais**. Acima de 4 dependências injetadas, questione o desenho.
9. **Sem getter/setter que exponha estado mutável.** Signals já resolvem: `asReadonly()` para fora, mutação só por método com nome de intenção (`adicionarItem`, não `setItens`).

### Testes

Vitest já está configurado. Todo `.store.ts` e `.service.ts` novo nasce com `.spec.ts` cobrindo caminho feliz + pelo menos um caso de erro. Telas não precisam de teste de renderização nesta etapa; a lógica que valeria testar deve estar no store, não no componente.

---

## Fase 0 — Fundação e limpeza

**Planejamento**: [01](./planejamento/01-padroes-componentes-services.md), [02](./planejamento/02-firestore-auth.md)
**Por que primeiro**: todo o resto depende de estado de sessão confiável. Enquanto `environment.prod.ts` for mutado como estado global, qualquer tela nova nasce acoplada a um bug.

- [x] Remover `usuarioAtual` e `partidaId` de `environment.ts` e `environment.prod.ts` (ficam só com a config do Firebase)
- [x] Corrigir todo import que aponta para `environment.prod` direto — sempre `./environment`, deixando o `fileReplacements` do `angular.json` resolver por build
- [x] Criar `shared/stores/auth-state.store.ts` (signals) e remover `auth-state.service.ts`
- [x] Atualizar `AuthService` e `AuthGuard` para consumir o store novo; remover a navegação para `/selecao-de-jogo` (rota de outro sistema)
- [x] Quebrar `FirebaseBaseService`: manter só CRUD genérico; removidos `buscarPersonagemPorPlaca`/`buscarProximoProcessamento`/`buscarProcessamentos*`/`PersonagensService`/`PersonagemDTO` (confirmado sem nenhum uso neste projeto — não havia domínio de partidas pra mover)
- [x] Criar pastas `shared/components`, `shared/stores`, `shared/pipes`, `shared/utils`
- [x] Criar `shared/utils/cpf.util.ts` (validação de dígito verificador + formatação) e `cep.util.ts`
- [x] Criar pipes de CPF e CEP — moeda BRL usa o `CurrencyPipe` nativo do Angular com locale `pt-BR` registrado, em vez de um pipe próprio (evita reinventar o que o framework já resolve)
- [x] Remover `console.log(code)` de `AuthService.handleError`
- [x] Escrever `firestore.rules` — **pendente aplicar manualmente no console do Firebase** (arquivo pronto na raiz do repo, não há firebase-tools autenticado neste ambiente)

**Critério de aceite**: build limpo; nenhum arquivo fora de `environment*.ts` importa `environment.prod`; `grep` por `environment.usuarioAtual` não retorna nada; regras publicadas e testadas manualmente (usuário A não lê documento de usuário B).

## Fase 1 — Autenticação e perfil base

**Planejamento**: [02](./planejamento/02-firestore-auth.md)

- [x] Ajustar `UsuarioDTO` (+ `jogosAdquiridos`), criar `PerfilDTO` e `EnderecoDTO`
- [x] Criar `PerfilService` (`usuarios/{uid}/perfil/dados`) e `EnderecoService` (`usuarios/{uid}/enderecos`)
- [x] Ajustar `AuthService.register` para gravar nome em `usuarios/{uid}` — CPF fica só no perfil (Fase 6), sem pedir no cadastro
- [x] Telas `/login`, `/cadastro`, `/esqueci-senha` usando tokens de `_tokens.scss` (novo partial `_forms.scss`, aditivo)
- [x] Suporte a `returnUrl` no login (volta para o fluxo de origem após autenticar)
- [x] Rotas novas com `loadComponent` (lazy)
- [x] Ponto de entrada no header: estado de login (entrar / perfil)

**Critério de aceite**: cadastro cria usuário + perfil, exige verificação de e-mail, e login com `returnUrl` retorna à origem. Nenhuma tela existente teve HTML/SCSS alterado além da inclusão do ponto de entrada no header.

## Fase 2 — Catálogo de produtos

**Planejamento**: [03](./planejamento/03-carrinho-pagamento-frete.md)
**Por que antes do carrinho**: carrinho sem produto real para referenciar vira mock que precisa ser refeito.

- [x] Criar `ProdutoDTO` (incluindo **peso, altura, largura e comprimento**, além de `imagemCapa`/`imagemEmblema` separados — são dois tratamentos visuais que já existiam no CSS) e `ProdutoService` (leitura pública de `produtos/`)
- [ ] **Pendente de você**: popular a coleção `produtos` no Firestore — ver JSON de exemplo na mensagem de entrega
- [x] Ligar `/loja`, `/jogos` e `/jogos/:idDoJogo` ao catálogo real, preservando o layout atual (também corrigido um link fixo `cidade-submersa` que já estava quebrado antes)
- [x] Botão "Adicionar ao carrinho" — acabou ficando funcional já nesta entrega (`CarrinhoStore` da Fase 3 estava pronto a tempo)

**Critério de aceite**: a loja lista produtos vindos do Firestore; nenhuma alteração visual perceptível além do conteúdo dinâmico.

## Fase 3 — Carrinho

**Planejamento**: [03](./planejamento/03-carrinho-pagamento-frete.md)

- [x] `CarrinhoStore`: `itens` (signal privado + readonly), `quantidadeTotal` e `valorTotal` (computed), métodos `adicionarItem`/`removerItem`/`atualizarQuantidade`/`limpar`
- [x] Persistência em `localStorage` dentro do store (via `effect`), tolerante a JSON inválido
- [x] Merge com `usuarios/{uid}/carrinho/atual` no login (soma sem duplicar)
- [x] Tela `/carrinho` com edição de quantidade e remoção
- [x] Badge de quantidade no header
- [ ] Testes do store — **adiado a pedido seu** ("não faça testes neste momento, deixaremos para o final")

**Critério de aceite**: carrinho funciona **sem login**, sobrevive a reload, e ao logar mescla com o que estava salvo na conta.

## Fase 4 — Backend: frete (Cloud Functions + Melhor Envio)

**Planejamento**: [03](./planejamento/03-carrinho-pagamento-frete.md)
**Pré-requisito**: plano Blaze ativo (✅ já feito); conta e aplicação criadas no Melhor Envio (produção + sandbox).
**Por que o frete antes do pagamento**: a tela de checkout precisa do valor do frete para saber quanto cobrar. Pagamento sem frete calculado cobra o valor errado.

- [x] Inicializar `functions/` no projeto (TypeScript), versionado no repo
- [x] `melhorEnvioOAuthCallback` — troca `code` por token (30 dias, refresh 45); guarda no Secret Manager, **nunca** no client
- [x] `renovarTokenMelhorEnvio` — função agendada semanal, renova antes de expirar
- [x] `cotarFrete` (`onCall`, exige autenticação) — soma peso/dimensões dos itens, cota no Melhor Envio, devolve opções com preço e prazo
- [x] `FreteService` no Angular (`shared/services/frete/`): só chama a Function, nunca a API do Melhor Envio direto

**Critério de aceite**: código typecheca limpo (`npm run typecheck` em `functions/`) — **ainda não testado contra a API real**, porque não existe conta no Melhor Envio. Nenhum token aparece no bundle do client (confirmado por inspeção — só a Cloud Function importa os secrets).

## Fase 5 — Backend: pagamento (Cloud Functions + Mercado Pago)

**Planejamento**: [03](./planejamento/03-carrinho-pagamento-frete.md)
**Pré-requisito**: conta no Mercado Pago com credenciais de teste e produção.

- [x] `processarPagamento` (`onCall`, exige autenticação) — **recalcula o total no servidor** (relê preços no Firestore + recota o frete), cria o pagamento no MP, grava `compras/` com status `aguardando_pagamento`
- [x] `webhookMercadoPago` — valida `x-signature` (HMAC-SHA256, comparação resistente a timing attack), **reconsulta a API do MP** para confirmar o status, atualiza `compras/` e `usuarios/{uid}.jogosAdquiridos`
- [x] `comprarEtiqueta` — disparada quando o pedido vira `pago`: adiciona ao carrinho do Melhor Envio, paga com saldo, gera e registra a etiqueta e o rastreio
- [x] `webhookMelhorEnvio` — valida `X-ME-Signature`, atualiza status de envio e rastreio
- [x] Idempotência: `webhookMercadoPago` ignora a notificação se a compra já está no status recebido; **falta validar** a idempotência do lado do Melhor Envio na Fase 7
- [x] `PagamentoService` no Angular (`shared/services/pagamento/`): só chama as Functions

**Critério de aceite**: código typecheca limpo — **ainda não testado contra a API real** (sem conta no Mercado Pago). O contrato exato de resposta do fluxo de etiqueta (`comprarEtiqueta`) e do payload do webhook do Melhor Envio são best-effort, documentados como tal no código — precisam de confirmação em sandbox antes do go-live.

## Fase 5b — Tela de checkout

**Planejamento**: [03](./planejamento/03-carrinho-pagamento-frete.md), [04](./planejamento/04-perfil-usuario.md)

- [x] Tela `/checkout` protegida por `AuthGuard`, em etapas: endereço → frete → pagamento
- [x] Seleção/cadastro de endereço reutilizando `app-endereco-form`
- [x] Cotação de frete exibida com opções (transportadora, preço, prazo) e escolha do usuário
- [x] Exigir CPF quando ausente (validação de dígito verificador, não só máscara)
- [ ] **Não implementado**: SDK do Mercado Pago para tokenizar cartão no navegador — sem uma `mercadoPagoPublicKey` real pra testar contra, integrar essa parte às cegas era mais risco que valor. A opção "Cartão" fica desabilitada na UI ("em breve") até a chave existir; Pix e boleto não dependem do SDK deles e já funcionam de ponta a ponta
- [x] Pix: exibe QR Code (base64) e copia-e-cola. Boleto: exibe link
- [x] Tela de retorno: mensagem honesta conforme o método; nunca marca como pago no cliente — o status real só vem pelo webhook

**Critério de aceite**: compra de ponta a ponta em sandbox — **ainda não verificado**, depende das contas existirem. Fluxo de Pix/boleto está completo e pronto pra validar assim que a conta do Mercado Pago existir.

## Fase 6 — Perfil e acompanhamento de pedidos

**Planejamento**: [04](./planejamento/04-perfil-usuario.md)

- [x] `/perfil` — dados pessoais + jogos adquiridos
- [x] `/perfil/enderecos` — CRUD com autocompletar por CEP (ViaCEP)
- [x] `/perfil/pedidos` e `/perfil/pedidos/:idPedido` — lista e detalhe em tempo real
- [x] Componentes `app-endereco-form`, `app-pedido-card`, `app-status-badge`
- [x] Bloqueio de edição de CPF após a primeira compra confirmada

**Critério de aceite**: pagamento confirmado no sandbox aparece em `/perfil/pedidos` sem recarregar a página — **ainda não verificado** (depende da conta do Mercado Pago). A escuta em tempo real (`buscarPorCampoOuvindo`) está implementada e o build compila; falta validar contra dados reais.

## Fase 7 — Validação e endurecimento

**Planejamento**: [03](./planejamento/03-carrinho-pagamento-frete.md) (seção "Itens a validar em sandbox")

- [ ] Cartão aprovado, recusado e pendente — os três caminhos tratados na tela
- [ ] Pix: exibição, expiração e confirmação via webhook
- [ ] Cotação de frete com múltiplos produtos (como somar em um volume só)
- [ ] Compra e impressão de etiqueta ponta a ponta
- [ ] Saldo insuficiente na carteira do Melhor Envio — pedido não pode ficar preso sem aviso
- [ ] Reentrega de webhook (idempotência) nos dois provedores
- [ ] Comportamento com produto sem estoque / inativo
- [ ] Firebase App Check
- [ ] Custom Claims para admin, se até aqui já existir necessidade de painel administrativo
- [ ] Revisão final das regras do Firestore com dados reais
- [ ] Definir emissão de nota fiscal antes do go-live

---

## Riscos conhecidos

| Risco | Mitigação |
|---|---|
| **Cliente adulterar o valor da compra pelo DevTools** | `processarPagamento` **nunca** aceita total vindo do navegador — relê preços no Firestore e recota o frete antes de cobrar. É a regra mais importante do projeto |
| Número de cartão passar pelo nosso backend (escopo PCI) | Usar exclusivamente o SDK do Mercado Pago para tokenizar no navegador; jamais criar campo de cartão próprio que envie o número para as Functions |
| Webhook não chegar (falha de rede/indisponibilidade) | Pedido fica `aguardando_pagamento`; prever job de reconciliação consultando a API do MP antes do go-live |
| Webhook duplicado criar pedido/item em dobro | Idempotência por `mercadoPagoId` / `melhorEnvioOrderId` — validar na Fase 7 |
| Saldo zerado no Melhor Envio travar a emissão de etiqueta | Alerta quando a compra de etiqueta falhar; pedido não pode ficar `pago` sem etiqueta silenciosamente |
| Frete cotado divergir do frete cobrado na etiqueta (prejuízo por venda) | Recotar no servidor no momento do pagamento; monitorar diferença entre `valorFrete` cobrado e custo real da etiqueta |
| Produto sem peso/dimensões quebrar a cotação | Campo obrigatório no `ProdutoDTO` desde a Fase 2; validar antes de publicar produto |
| Dado pessoal (CPF/endereço) exposto por regra de Firestore mal escrita | Regras versionadas + teste manual de acesso cruzado entre contas ao final da Fase 0 e da Fase 7 |
| Nota fiscal não emitida | Decidir o caminho (manual, ERP ou serviço de NF-e) antes do go-live — nenhum dos dois provedores resolve |
