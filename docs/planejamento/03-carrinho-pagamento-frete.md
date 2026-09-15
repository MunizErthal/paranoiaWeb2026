# 03 — Carrinho, pagamento (Mercado Pago) e frete (Melhor Envio)

> **Documento mais importante do planejamento.** Define o carrinho, o checkout completo dentro do próprio site, o pagamento via Mercado Pago e o frete/etiqueta via Melhor Envio.
>
> A escolha por essas duas plataformas (no lugar da Nuvemshop) está justificada em [05 — Alternativas](./05-alternativas-pagamento-frete.md).

## Princípio da arquitetura

Nada de plataforma de loja intermediária. O site é a loja:

```
Catálogo, carrinho, conta, pedidos  →  Firestore (fonte única de verdade)
Pagamento                            →  Mercado Pago (Checkout Transparente, dentro do site)
Frete e etiqueta                     →  Melhor Envio (cotação por CEP + etiqueta pronta)
Segredos e webhooks                  →  Cloud Functions (Firebase, plano Blaze já ativo)
```

O comprador nunca sai do site. Nenhum catálogo duplicado em lugar nenhum.

## Por que Cloud Functions são obrigatórias

Um Angular SPA é só arquivo estático — não recebe webhook e não pode guardar segredo (o access token do Mercado Pago e do Melhor Envio ficariam expostos a qualquer visitante no bundle). As Cloud Functions existem para três coisas:

1. Guardar segredos e falar com as APIs do MP e do Melhor Envio.
2. Receber webhooks e escrever no Firestore.
3. **Calcular o valor da compra do lado do servidor** — ver a seção de segurança.

Plano Blaze já está ativo. Custo: pay-as-you-go, sem mensalidade, com camada gratuita generosa (2M invocações, 400K GB-s, 200K CPU-s, 5 GB de saída por mês). No volume esperado, a conta realista é **R$ 0**.

## Custos

### Mercado Pago

| Meio | Taxa | Recebimento |
|---|---|---|
| **Pix** | **0,99%** | na hora |
| **Boleto** | R$ 3,49 | compensação |
| Cartão de crédito | **3,99%** | 30 dias |
| Cartão de crédito | 4,48% | 14 dias |
| Cartão de crédito | 4,98% | na hora |

Sem mensalidade, sem taxa de adesão. O prazo de recebimento é escolhido por você e define a taxa.

### Melhor Envio

**Integração 100% gratuita** — sem mensalidade e sem taxa de API. Você paga apenas a etiqueta que comprar, com tarifas negociadas por eles (divulgadas como até 80% abaixo do balcão dos Correios; o desconto real varia por modalidade e rota). O custo do frete é repassado ao cliente no checkout.

A conta funciona com **saldo pré-pago** (carteira) — é dele que sai o valor da etiqueta quando a compra é automática. Manter saldo é pré-requisito operacional para o fluxo automático funcionar.

### Simulação — 30 vendas/mês × R$ 200 (50% Pix, 40% cartão, 10% boleto)

| Componente | Custo |
|---|---|
| Mensalidade | R$ 0 |
| Pix (15 vendas, R$ 3.000 × 0,99%) | R$ 29,70 |
| Cartão D+30 (12 vendas, R$ 2.400 × 3,99%) | R$ 95,76 |
| Boleto (3 × R$ 3,49) | R$ 10,47 |
| **Total/mês** | **R$ 135,93 — 2,3% do faturamento** |

Frete não entra nessa conta: é custo repassado ao comprador.

## Estrutura de dados no Firestore

```
produtos/{produtoId}
  nome, descricao, preco, imagens[], estoque, ativo
  peso: number            // kg — OBRIGATÓRIO para cotar frete
  altura, largura, comprimento: number   // cm — OBRIGATÓRIOS
  criadoEm, atualizadoEm

compras/{compraId}
  usuarioId: string
  itens: { produtoId, nome, precoUnit, quantidade }[]
  valorProdutos: number
  valorFrete: number
  valorTotal: number
  status: 'aguardando_pagamento' | 'pago' | 'etiqueta_gerada' | 'enviado' | 'entregue' | 'cancelado' | 'recusado'
  pagamento: {
    mercadoPagoId: string
    metodo: 'pix' | 'cartao' | 'boleto'
    status: string
  }
  envio: {
    melhorEnvioOrderId?: string
    servico: string          // "PAC", "SEDEX", "Jadlog .Package"
    prazoDias: number
    codigoRastreio?: string
    urlEtiqueta?: string
  }
  enderecoEntrega: EnderecoDTO
  criadoEm, atualizadoEm

usuarios/{uid}
  jogosAdquiridos: { produtoId, nome, dataCompra, compraId }[]

usuarios/{uid}/carrinho/atual
  itens: ItemCarrinho[]
  atualizadoEm
```

`produtos` e `compras` são **somente leitura para o cliente** — toda escrita vem de Cloud Function com Admin SDK (regras no [MD 02](./02-firestore-auth.md)).

Peso e dimensões são campos novos e obrigatórios: sem eles não existe cotação de frete.

## CarrinhoStore (signals)

Conforme o padrão do [MD 01](./01-padroes-componentes-services.md):

- Carrinho vive em `localStorage` desde o primeiro item, **sem exigir login**.
- Ao logar, faz merge com `usuarios/{uid}/carrinho/atual` (soma sem duplicar) e grava nos dois lugares.
- Limpa após pedido criado com sucesso.
- O store guarda `produtoId` e `quantidade` como verdade; **preço exibido é sempre relido do Firestore**, nunca confiado ao que estava salvo no navegador.

## Fluxo completo de compra

### 1. Montagem do carrinho
Visitante navega, adiciona itens, ajusta quantidade em `/carrinho`. Sem login.

### 2. Início do checkout
"Finalizar compra" → se não logado, vai para `/login?returnUrl=/checkout`, faz o merge do carrinho e volta.

### 3. Endereço e frete (`/checkout`, etapa 1)
- Usuário escolhe um endereço salvo do perfil (`usuarios/{uid}/enderecos`) ou cadastra um novo ali mesmo.
- O app chama `cotarFrete` (Cloud Function) com os itens do carrinho + CEP de destino.
- A função soma peso e dimensões dos produtos, chama o Melhor Envio e devolve as opções (PAC, SEDEX, Jadlog…) com preço e prazo.
- Usuário escolhe o serviço. O total da tela passa a ser produtos + frete.

### 4. Dados fiscais
Se o CPF ainda não estiver no perfil, é exigido aqui (com validação de dígito verificador, não só máscara).

### 5. Pagamento (`/checkout`, etapa 2)
- O SDK JavaScript do Mercado Pago renderiza o formulário de pagamento no site (Checkout Transparente / Bricks).
- **Cartão**: o SDK tokeniza os dados no navegador do comprador e devolve um token. O número do cartão nunca passa pelo nosso front, backend ou Firestore.
- **Pix**: a função devolve QR Code e código copia-e-cola para exibir na tela.
- **Boleto**: a função devolve o link do boleto.
- O app envia para `processarPagamento` (Cloud Function): token (se cartão), itens do carrinho, endereço e opção de frete escolhida — **nunca o valor total**.

### 6. Criação do pedido
`processarPagamento`:
1. Relê os preços dos produtos no Firestore.
2. Reconfere a cotação de frete no Melhor Envio.
3. Calcula o total **do lado do servidor**.
4. Cria o pagamento no Mercado Pago com esse total.
5. Grava `compras/{id}` com status `aguardando_pagamento`.
6. Devolve ao app o que precisa ser exibido (QR do Pix, link do boleto, ou resultado do cartão).

### 7. Confirmação (assíncrona)
O Mercado Pago dispara webhook quando o status muda. `webhookMercadoPago`:
1. Valida a assinatura `x-signature`.
2. Consulta a API do MP para confirmar o status real (nunca confia só no corpo da notificação).
3. Se aprovado: atualiza `compras/{id}` para `pago` e adiciona os itens em `usuarios/{uid}.jogosAdquiridos`.
4. Dispara a compra da etiqueta.

### 8. Etiqueta
`comprarEtiqueta` (acionada pelo pagamento aprovado):
1. Adiciona o envio ao carrinho do Melhor Envio (`/me/cart`).
2. Paga com o saldo da carteira (`/me/shipment/checkout`).
3. Gera a etiqueta (`/me/shipment/generate`).
4. Obtém o PDF para impressão (`/me/shipment/print`).
5. Grava `envio.codigoRastreio` e `envio.urlEtiqueta` em `compras/{id}`, muda status para `etiqueta_gerada`.

Você recebe a etiqueta pronta: imprime, cola, posta.

### 9. Acompanhamento
`webhookMelhorEnvio` recebe atualizações de etiqueta (header `X-ME-Signature`, HMAC-SHA256, com 5 tentativas em intervalos de 15 min) e atualiza o status de envio. A tela `/perfil/pedidos` ([MD 04](./04-perfil-usuario.md)) escuta `compras/` em tempo real e reflete tudo sem recarregar.

## Cloud Functions

| Função | Trigger | Responsabilidade |
|---|---|---|
| `cotarFrete` | HTTPS `onCall` (autenticado) | Soma peso/dimensões dos itens, cota no Melhor Envio, devolve opções |
| `processarPagamento` | HTTPS `onCall` (autenticado) | **Recalcula o total no servidor**, cria pagamento no MP, grava `compras/` |
| `webhookMercadoPago` | HTTPS | Valida `x-signature`, confirma status na API do MP, atualiza `compras/` e `jogosAdquiridos`, dispara etiqueta |
| `comprarEtiqueta` | Chamada interna / Firestore trigger em `compras/{id}` quando vira `pago` | Compra, gera e registra a etiqueta no Melhor Envio |
| `webhookMelhorEnvio` | HTTPS | Valida `X-ME-Signature`, atualiza status de envio e rastreio |
| `melhorEnvioOAuthCallback` | HTTPS | Troca `code` por token (validade 30 dias, refresh 45), guarda no Secret Manager |
| `renovarTokenMelhorEnvio` | Agendada (semanal) | Renova o token antes de expirar |

No Angular, dois services finos em `shared/services/`: `pagamento/` e `frete/` — ambos só chamam Cloud Functions, nunca as APIs externas diretamente.

## Segurança

### A regra mais importante: o valor nunca vem do navegador

`processarPagamento` **jamais** aceita um total enviado pelo cliente. Ele relê preços no Firestore e recotar o frete antes de cobrar. Sem isso, qualquer pessoa com o DevTools aberto compra o jogo por R$ 1,00.

### Dados de cartão

Tokenizados pelo SDK do Mercado Pago **no navegador do comprador**. Nunca passam pelo nosso front, backend, logs ou Firestore. Isso mantém o escopo de PCI no mínimo. Condição: usar o SDK oficial e nunca construir um campo de cartão próprio que envie o número para as nossas Functions.

### Webhooks

Ambos assinam as notificações e as duas assinaturas **devem ser validadas antes de qualquer escrita**:
- Mercado Pago: header `x-signature` — HMAC-SHA256 sobre o template `id:[data.id];request-id:[x-request-id];ts:[ts];` com o secret do painel. Responder HTTP 200/201 em até 22 segundos.
- Melhor Envio: header `X-ME-Signature` — HMAC-SHA256 do corpo da requisição com o secret da aplicação.

Além da assinatura, o webhook do MP deve **reconsultar a API** para confirmar o status antes de marcar como pago.

### Segredos

Access tokens do Mercado Pago e do Melhor Envio vivem apenas no Secret Manager / config das Functions. No front só pode existir a **public key** do Mercado Pago (é pública por natureza, usada pelo SDK para tokenizar).

### Escrita no Firestore

Cliente nunca escreve em `compras/` nem em `produtos/`. Toda transição de status vem de Cloud Function.

## Itens a validar em sandbox

Ambos têm ambiente de teste gratuito — o Melhor Envio com saldo fictício de R$ 10.000 em `sandbox.melhorenvio.com.br`, o Mercado Pago com credenciais e cartões de teste.

1. Fluxo completo de cartão aprovado, recusado e pendente.
2. Fluxo de Pix: exibição do QR, expiração, e confirmação via webhook.
3. Cotação de frete com múltiplos produtos (somatório de peso/dimensões e como embalar em um volume só).
4. Compra e impressão da etiqueta ponta a ponta.
5. Comportamento quando o saldo da carteira do Melhor Envio é insuficiente — o pedido não pode ficar preso sem aviso.
6. Reentrega de webhook (idempotência): receber a mesma notificação duas vezes não pode duplicar pedido nem duplicar item em `jogosAdquiridos`.

## Checklist

- [x] Plano Blaze ativo no Firebase
- [ ] Criar conta no Mercado Pago (produção + credenciais de teste)
- [ ] Criar conta e aplicação no Melhor Envio (produção + sandbox)
- [ ] Adicionar `peso`, `altura`, `largura`, `comprimento` ao `ProdutoDTO`
- [ ] `CarrinhoStore` com persistência e merge no login
- [ ] Cloud Functions: `cotarFrete`, `processarPagamento`, `comprarEtiqueta`, `webhookMercadoPago`, `webhookMelhorEnvio`, `melhorEnvioOAuthCallback`, `renovarTokenMelhorEnvio`
- [ ] Services Angular: `shared/services/pagamento/`, `shared/services/frete/`
- [ ] Telas `/carrinho` e `/checkout` (endereço → frete → pagamento)
- [ ] Validar os 6 itens de sandbox acima
- [ ] Definir emissão de nota fiscal antes do go-live (ver [MD 05](./05-alternativas-pagamento-frete.md))
