# 05 — Alternativas à Nuvemshop: pagamento e frete

> **DECISÃO TOMADA: Mercado Pago + Melhor Envio.** Os documentos 01–04 e o [IMPLEMENTACAO.md](../IMPLEMENTACAO.md) já foram reescritos de acordo. Este documento fica como registro do porquê da escolha.
>
> Pesquisado em 14/09/2026 em fontes oficiais. Taxas mudam; confirmar no painel de cada serviço antes de fechar.

## Por que a Nuvemshop não serve bem para este caso

Recapitulando o que a pesquisa revelou (o antigo MD 03, que descrevia a integração com a Nuvemshop, foi substituído pelo [03 — Carrinho, pagamento e frete](./03-carrinho-pagamento-frete.md); a pesquisa original está em [docs/research](../research/nuvemshop-checkout-handoff.md)):

| Problema | Impacto |
|---|---|
| Checkout sempre roda no ambiente deles | O contrário do que você pediu desde o começo ("operação inteira dentro do próprio site") |
| Não existe API para criar/popular carrinho | Obriga o truque de links `/comprar/{variante}` — não é contrato de API, é artigo de suporte |
| Catálogo precisa existir duplicado lá dentro | Sincronização Firestore → Nuvemshop, uma engrenagem inteira só para manter dois catálogos iguais |
| Não existe cálculo de frete isolado | Não dá para mostrar o frete na sua tela antes do checkout |
| Plano mínimo R$ 69/mês | Custo fixo antes da primeira venda |

O ponto central: a Nuvemshop é uma **plataforma de loja completa**. Você já tem a loja — quer só as peças que faltam. Pagar por uma plataforma inteira para usar 20% dela, e ainda ceder o controle do checkout, é o pior dos dois mundos.

## A troca de raciocínio

Em vez de uma plataforma monolítica, dois serviços especializados, cada um com API de verdade:

```
Pagamento  →  gateway (checkout transparente no seu site)
Frete/etiqueta  →  plataforma de logística (cotação por CEP + etiqueta pronta)
Catálogo, carrinho, conta, pedidos  →  continuam 100% seus, no Firestore
```

Isso atende os 7 requisitos **e elimina** as duas maiores complexidades do plano anterior (sincronização de catálogo e handoff de carrinho).

---

## Opções de pagamento

| Serviço | Pix | Cartão crédito | Boleto | Checkout no seu site? | Observação |
|---|---|---|---|---|---|
| **Mercado Pago** | **0,99%** (na hora) | 4,98% na hora · 4,48% D+14 · **3,99% D+30** | R$ 3,49 | ✅ Checkout Transparente / Bricks | Maior confiança do comprador brasileiro; melhor ferramental de e-commerce |
| **Asaas** | R$ 0,99 → **R$ 1,99** fixo | 1,99% + R$ 0,49 → **2,99% + R$ 0,49** | R$ 0,99 → R$ 1,99 | ✅ via API | Mais barato em ticket alto; voltado a cobranças/SaaS, não a varejo |
| **Pagar.me** (Stone) | não publicado | não publicado | não publicado | ✅ | Taxas só por contato comercial — inviável comparar às cegas |
| **PagBank** | competitivo | competitivo | — | ✅ | Alternativa sólida; Pix gratuito em algumas modalidades |
| Stripe | — | — | — | ✅ | Excelente API, mas **não é brasileiro** (requisito 7) |

### Mercado Pago em detalhe

- **Checkout Transparente (Checkout API / Bricks)**: o cliente paga sem sair do site, com a UI que você desenhar.
- **PCI**: os dados do cartão são tokenizados pelo SDK JavaScript deles, direto no navegador do comprador — **não passam pelo seu servidor nem pelas Cloud Functions**. Isso reduz drasticamente seu escopo de compliance. Condição: usar o SDK corretamente e nunca trafegar número de cartão pelo seu backend.
- **Webhooks** com validação de autenticidade via header `x-signature` (HMAC-SHA256 sobre `id` + `request-id` + `timestamp`, com secret do painel). É exatamente o mecanismo seguro que o [MD 02](./02-firestore-auth.md) exige para nunca confiar no navegador do comprador.
- Meios: cartão de crédito, Pix, boleto, débito virtual Caixa, saldo em conta.
- Sem mensalidade, sem setup. Você escolhe o prazo de recebimento e a taxa varia conforme ele.

### Asaas em detalhe

Mais barato em ticket médio alto, porque **Pix e boleto são valor fixo**, não percentual:

- Num pedido de R$ 200: Pix custa R$ 1,99 (Asaas) contra R$ 1,98 (MP) — empate.
- Num pedido de R$ 500: Pix custa R$ 1,99 (Asaas) contra R$ 4,95 (MP) — Asaas ganha.
- Cartão: 2,99% + R$ 0,49 (Asaas) contra 3,99% D+30 (MP) — Asaas ganha em qualquer ticket.

O contra é qualitativo: o Asaas é uma conta digital PJ com régua de cobrança, pensada para serviços e recorrência. O Mercado Pago é pensado para varejo — carteira com cartão salvo, one-click, proteção ao comprador, e a marca que o brasileiro já confia na hora de digitar o cartão. Para **primeira compra de um produto físico de uma marca pequena**, essa confiança tem valor real de conversão.

---

## Opções de frete e etiqueta

| Serviço | Custo para integrar | Modelo | Etiqueta pronta | API/Webhook |
|---|---|---|---|---|
| **Melhor Envio** | **Grátis** — sem mensalidade nem taxa de API | Paga só a etiqueta comprada | ✅ Imprime e cola | ✅ OAuth2 + webhook assinado |
| **SuperFrete** | Grátis | Paga por envio | ✅ | ✅ · +160 transportadoras, app mobile melhor |
| **Frenet** | Grátis | Paga por envio | ✅ | ✅ |
| Correios direto | Contrato próprio | Contrato + volume | ✅ | API própria, mais burocrática |

### Melhor Envio em detalhe

Atende exatamente os requisitos 2 e 3:

- **Cotação por CEP**: endpoint de cálculo de frete recebe CEP de origem/destino + dimensões/peso e devolve as opções (Correios PAC/SEDEX, Jadlog, Loggi, etc.) com preço e prazo. É isso que a tela de checkout vai consumir quando o usuário escolher o endereço do perfil.
- **Etiqueta**: você compra pela API, imprime, cola e posta. Sem contrato com os Correios, sem volume mínimo.
- **Desconto**: tarifas negociadas por eles, divulgadas como até 80% abaixo do balcão (o desconto real varia por modalidade/rota — tratar como faixa de marketing, não garantia).
- **Custo de integração: zero.** Sem mensalidade, sem taxa de API. Você paga só o frete das etiquetas que comprar — e esse custo é normalmente repassado ao cliente no checkout.
- **OAuth2**, token de 30 dias com refresh de 45.
- **Sandbox** (`sandbox.melhorenvio.com.br`) com saldo fictício de R$ 10.000 para testar tudo sem gastar.
- **Webhook** com header `X-ME-Signature` (HMAC-SHA256 com o secret da aplicação), 5 tentativas com intervalo de 15 min. Hoje o evento disponível é atualização de etiqueta — suficiente para alimentar status de envio e rastreio no perfil do usuário.
- Ressalva: compra de etiqueta comercial (NF-e) da Azul Cargo não está disponível via API — irrelevante se você usar Correios/Jadlog.

---

## Recomendação

**Mercado Pago (Checkout Transparente) + Melhor Envio.**

Por quê, requisito a requisito:

| Requisito | Como fica atendido |
|---|---|
| 1. Gateway completo | Mercado Pago: cartão, Pix, boleto, parcelamento, antifraude, disputa |
| 2. Frete por endereço | Melhor Envio: cotação por CEP direto na sua tela de checkout, antes de pagar |
| 3. Etiqueta pronta | Melhor Envio: compra pela API, imprime, cola, posta |
| 4. Integração com o site | Ambos com API REST e OAuth. O endereço do perfil no Firestore alimenta a cotação e depois a etiqueta — sem digitar nada duas vezes |
| 5. Webhooks | Ambos, com assinatura HMAC-SHA256 validável |
| 6. Custo | **Zero fixo.** Sem mensalidade nos dois. Paga-se por venda e por etiqueta |
| 7. Brasileiro | Mercado Pago (Mercado Livre) e Melhor Envio, ambos nacionais, BRL, consolidados |

### Comparação de custo — 30 vendas/mês × R$ 200 (50% Pix, 40% cartão, 10% boleto)

| | Nuvemshop (Essencial) | **MP + Melhor Envio** | Asaas + Melhor Envio |
|---|---|---|---|
| Mensalidade | R$ 69,00 | **R$ 0** | R$ 0 |
| Pix (15 vendas, R$ 3.000) | R$ 29,70 | R$ 29,70 | R$ 29,85 |
| Cartão (12 vendas, R$ 2.400) | R$ 104,76 | R$ 95,76 | R$ 77,64 |
| Boleto (3 vendas) | R$ 7,17 | R$ 10,47 | R$ 5,97 |
| **Total/mês** | **R$ 210,63** | **R$ 135,93** | **R$ 113,46** |
| % do faturamento | 3,5% | **2,3%** | 1,9% |

Economia de ~R$ 75/mês contra a Nuvemshop, **sem custo fixo antes da primeira venda** — e o frete ainda sai mais barato que o balcão dos Correios. O Asaas é ~R$ 22/mês mais barato que o Mercado Pago, diferença que eu não trocaria pela confiança da marca MP no momento de digitar o cartão. Se o ticket médio subir bem acima de R$ 200, vale reavaliar.

## O que isso simplifica na arquitetura

Comparado ao plano da Nuvemshop, **desaparecem**:

- ❌ Sincronização de catálogo Firestore → plataforma (o Firestore volta a ser fonte única de verdade, de fato)
- ❌ Guardar `nuvemshopProductId`/`variantId` em cada produto
- ❌ Cloud Function `sincronizarProdutoNuvemshop`
- ❌ O truque de links `/comprar/{variante}` e o risco de multi-item não funcionar
- ❌ Mensalidade e a dependência do plano Essencial para ter domínio próprio
- ❌ Redirecionar o cliente para fora do site

**Permanecem** (já planejados, sem mudança): Cloud Functions para webhooks e segredos, coleções `produtos`/`compras`/`enderecos`, carrinho em signals, perfil, regras do Firestore.

**Entram**:
- Cloud Function `cotarFrete` (proxy autenticado para o Melhor Envio)
- Cloud Function `processarPagamento` (cria o pagamento no MP a partir do token do cartão gerado no navegador)
- Cloud Function `comprarEtiqueta` (dispara a etiqueta após o pagamento aprovado)
- Dois webhooks: `webhookMercadoPago` (status de pagamento) e `webhookMelhorEnvio` (status de envio/rastreio)
- Tela de checkout de verdade — agora ela é sua: endereço → frete → pagamento, tudo na mesma página

O checkout passa a ser **mais trabalho de front-end** (você desenha o fluxo inteiro) e **menos trabalho de integração** (duas APIs REST diretas, sem gambiarra).

## Pontos honestos de atenção

1. **Nota fiscal não está resolvida por nenhuma das opções** — nem pela Nuvemshop. Venda de produto físico no Brasil exige NF-e. Opções: emitir manualmente no portal da prefeitura/SEFAZ no começo, ou integrar depois um ERP (Bling, Tiny) ou serviço de NF-e. Vale decidir antes do go-live, não é bloqueio para começar a construir.
2. **Você assume o desenho do checkout.** Conversão de e-commerce mora nessa tela. A vantagem é o controle total; a responsabilidade também.
3. **Antifraude**: o Mercado Pago já traz análise de risco, mas chargeback existe. Vale ativar as regras deles e não prometer envio imediato antes do pagamento aprovado — o fluxo via webhook já cobre isso.
4. **Dimensões e peso dos produtos** viram campo obrigatório no `ProdutoDTO` — sem isso não há cotação de frete. Detalhe pequeno que muda o modelo de dados.
5. **Duas contas para criar** (Mercado Pago e Melhor Envio) em vez de uma. Ambas gratuitas, ambas com sandbox.

## Decisão

- [x] **Mercado Pago** como gateway de pagamento
- [x] **Melhor Envio** como plataforma de frete e etiquetas
- [x] Documentos reescritos: [03](./03-carrinho-pagamento-frete.md) (novo), [01](./01-padroes-componentes-services.md), [02](./02-firestore-auth.md), [04](./04-perfil-usuario.md) e [IMPLEMENTACAO.md](../IMPLEMENTACAO.md)
- [ ] Pendente antes do go-live: definir a emissão de nota fiscal

---

### Fontes

- [Mercado Pago — Checkout API/Transparente (Orders)](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-orders/overview)
- [Mercado Pago — Checkout Pro vs Transparente](https://www.mercadopago.com.br/blog/checkout-pro-vs-transparente)
- [Mercado Pago — Quanto custa vender online](https://www.mercadopago.com.br/blog/quanto-custa-vender-on-line-com-mercado-pago)
- [Mercado Pago — Webhooks e assinatura secreta](https://www.mercadopago.com.br/developers/pt/news/2024/01/11/Webhooks-Notifications-Simulator-and-Secret-Signature)
- [Melhor Envio — Introdução à API](https://docs.melhorenvio.com.br/reference/introducao-api-melhor-envio)
- [Melhor Envio — Cálculo de fretes](https://docs.melhorenvio.com.br/reference/calculo-de-fretes-por-produtos)
- [Melhor Envio — Webhooks](https://docs.melhorenvio.com.br/docs/webhooks)
- [Melhor Envio vs SuperFrete](https://melhorenvio.com.br/blog/frete-e-logistica/melhor-envio-superfrete/)
- [Asaas — Preços e taxas](https://www.asaas.com/precos-e-taxas)
- [Asaas — API de pagamentos](https://www.asaas.com/api-de-pagamentos)
