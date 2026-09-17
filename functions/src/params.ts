import { defineString } from 'firebase-functions/params';

/**
 * Troca entre sandbox e produção sem alterar código — mudar o valor
 * padrão (ou definir a variável no ambiente de deploy) quando a loja
 * estiver pronta para operar de verdade.
 */
export const melhorEnvioBaseUrl = defineString('MELHORENVIO_BASE_URL', {
  default: 'https://sandbox.melhorenvio.com.br'
});

export const melhorEnvioUserAgent = defineString('MELHORENVIO_USER_AGENT', {
  default: 'Paranoia Jogos (contato@paranoiajogos.com.br)'
});

/** CEP de onde os produtos são enviados. Preencher antes de usar cotarFrete/comprarEtiqueta. */
export const lojaCepOrigem = defineString('LOJA_CEP_ORIGEM', { default: '' });

/** Endereço completo da loja (remetente) — o Melhor Envio exige nome +
 *  endereço completo pra gerar etiqueta, o CEP sozinho não basta. */
export const lojaNome = defineString('LOJA_NOME', { default: 'Paranoia Jogos' });
export const lojaEndereco = defineString('LOJA_ENDERECO', { default: '' });
export const lojaNumero = defineString('LOJA_NUMERO', { default: '' });
export const lojaComplemento = defineString('LOJA_COMPLEMENTO', { default: '' });
export const lojaBairro = defineString('LOJA_BAIRRO', { default: '' });
export const lojaCidade = defineString('LOJA_CIDADE', { default: '' });
export const lojaEstado = defineString('LOJA_ESTADO', { default: '' });
