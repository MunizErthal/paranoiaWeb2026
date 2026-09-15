/**
 * Remove qualquer caractere que não seja dígito.
 */
export function limparCep(cep: string): string {
  return cep.replace(/\D/g, '');
}

/**
 * Um CEP válido tem exatamente 8 dígitos. Não há dígito verificador —
 * a confirmação real de que o CEP existe vem da consulta ao ViaCEP.
 */
export function cepValido(cep: string): boolean {
  return limparCep(cep).length === 8;
}

/**
 * Formata um CEP como 00000-000. Retorna a entrada sem alteração
 * se não tiver 8 dígitos.
 */
export function formatarCep(cep: string): string {
  const numeros = limparCep(cep);

  if (numeros.length !== 8) {
    return cep;
  }

  return numeros.replace(/(\d{5})(\d{3})/, '$1-$2');
}
