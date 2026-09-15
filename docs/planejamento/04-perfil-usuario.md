# 04 — Perfil do usuário: pedidos, envio e edição de dados

> Documento de planejamento. Telas de perfil: dados pessoais, endereços, acompanhamento de compras e status de envio. Depende das coleções e do fluxo definidos em [02](./02-firestore-auth.md) e [03](./03-carrinho-pagamento-frete.md).

## Rotas

```
/perfil                       → dados pessoais + resumo (jogos adquiridos, atalho pra pedidos)
/perfil/enderecos             → lista/gerencia endereços
/perfil/pedidos                → lista de compras
/perfil/pedidos/:idPedido      → detalhe de um pedido (status, itens, rastreio)
```

Todas protegidas por `AuthGuard` (já existe).

## `/perfil` — dados pessoais

- Exibe e permite editar: nome, foto (campos já existentes em `UsuarioDTO`), telefone, data de nascimento, CPF (`PerfilDTO`).
- CPF: se ainda não preenchido, pode ser adicionado aqui a qualquer momento (não só no checkout). Se já preenchido, recomenda-se **não permitir edição livre** depois da primeira compra confirmada — CPF associado a um pedido pago tem implicação fiscal; alterar retroativamente pode gerar inconsistência entre o que está no Firestore, o que foi enviado ao Mercado Pago e o que consta na nota fiscal. Regra proposta: campo fica bloqueado pra edição direta assim que existir pelo menos uma compra com `status != 'aguardando_pagamento'`; qualquer correção depois disso é tratada manualmente (fora do escopo do site).
- Seção "Jogos adquiridos": lista simples vinda de `usuarios/{uid}.jogosAdquiridos` — nome do jogo + data da compra, com link pro pedido correspondente (`compraId`) em `/perfil/pedidos/:id`.
- Ação de desativar conta: reaproveita `UsuarioService.desativarUsuario` (já existe) — soft delete, mantém histórico de pedidos íntegro. Exclusão definitiva de dados pessoais (direito de exclusão da LGPD) fica registrada como requisito futuro, não implementado nesta etapa.

## `/perfil/enderecos`

- CRUD sobre `usuarios/{uid}/enderecos/{id}` (ver `EnderecoDTO` no MD 02).
- Autocompletar por CEP usando a API pública do ViaCEP (gratuita, sem necessidade de conta) — preenche logradouro/bairro/cidade/estado, usuário só confirma número/complemento.
- Um endereço pode ser marcado como padrão (`padrao: true`); ao marcar um novo como padrão, desmarca o anterior (transação simples no `EnderecoService`).
- Endereço é reaproveitado em `/checkout` (MD 03) — a tela de checkout lista os endereços existentes ou permite cadastrar um novo sem sair do fluxo de compra.

## `/perfil/pedidos` — lista

- Query em `compras/` filtrando por `usuarioId == uid`, ordenado por `criadoEm desc`.
- Usa `buscarTodosOuvindo` (já existe no `FirebaseBaseService`) pra manter a lista **em tempo real** — quando os webhooks do Mercado Pago (pagamento) ou do Melhor Envio (envio) atualizarem o status de um pedido (MD 03), a tela reflete sem precisar recarregar.
- Cada item da lista mostra: data, valor total, status (badge colorido usando os tokens de cor já existentes), miniatura dos produtos.

## `/perfil/pedidos/:idPedido` — detalhe

- Dados completos do pedido: itens (nome, quantidade, preço unitário), endereço de entrega usado, valor total.
- Status com linha do tempo: Aguardando pagamento → Pago → Etiqueta gerada → Enviado → Entregue (ou Cancelado/Recusado). Cada etapa vem do campo `status` em `compras/{id}`, atualizado só pelas Cloud Functions de webhook — a tela é sempre somente leitura em relação ao status.
- Detalhe do pagamento: método usado (Pix, cartão, boleto). Se o pedido ficou em `aguardando_pagamento` via Pix ou boleto, reexibir o QR Code / link do boleto enquanto ainda for válido, para o cliente conseguir concluir.
- Código de rastreio (`envio.codigoRastreio`), quando presente, exibido junto com a transportadora (`envio.servico`) e copiável. O Melhor Envio devolve a transportadora do envio, então dá para montar o link de rastreio correto por transportadora — confirmar os formatos no sandbox antes de linkar.
- A URL da etiqueta (`envio.urlEtiqueta`) **nunca** é exposta ao comprador — é documento operacional da loja.

## Componentes reutilizáveis desta etapa

Seguindo o padrão do [MD 01](./01-padroes-componentes-services.md), ficam em `shared/components/`:

- `app-endereco-form` — formulário de endereço com CEP autocompletado, usado tanto em `/perfil/enderecos` quanto em `/checkout`.
- `app-pedido-card` — resumo de um pedido pra lista.
- `app-status-badge` — badge colorido de status (pedido, envio), reutilizável.

## Checklist desta etapa

- [ ] Criar `EnderecoService` (CRUD sobre `usuarios/{uid}/enderecos`)
- [ ] Integrar autocompletar de CEP (ViaCEP) no `app-endereco-form`
- [ ] Telas `/perfil`, `/perfil/enderecos`, `/perfil/pedidos`, `/perfil/pedidos/:id`
- [ ] Regra de bloqueio de edição de CPF após primeira compra confirmada
- [ ] Componentes `app-endereco-form`, `app-pedido-card`, `app-status-badge`
- [ ] Mapear os links de rastreio por transportadora (Correios, Jadlog, Loggi) a partir do que o Melhor Envio devolve
- [ ] Garantir que `envio.urlEtiqueta` não vaza para a tela do comprador
