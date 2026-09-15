/**
 * Remove qualquer caractere que não seja dígito.
 */
export function limparCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

/**
 * Valida um CPF pelo algoritmo oficial de dígito verificador.
 * Rejeita sequências de dígito repetido (ex: 111.111.111-11), que passariam
 * no cálculo mas não são CPFs válidos.
 */
export function cpfValido(cpf: string): boolean {
  const numeros = limparCpf(cpf);

  if (numeros.length !== 11 || /^(\d)\1{10}$/.test(numeros)) {
    return false;
  }

  const digitoVerificador = (base: string, multiplicadorInicial: number): number => {
    const soma = base
      .split('')
      .reduce((total, digito, indice) => total + Number(digito) * (multiplicadorInicial - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const primeiroDigito = digitoVerificador(numeros.slice(0, 9), 10);
  const segundoDigito = digitoVerificador(numeros.slice(0, 10), 11);

  return primeiroDigito === Number(numeros[9]) && segundoDigito === Number(numeros[10]);
}

/**
 * Formata um CPF como 000.000.000-00. Retorna a entrada sem alteração
 * se não tiver 11 dígitos (ex: enquanto o usuário ainda está digitando).
 */
export function formatarCpf(cpf: string): string {
  const numeros = limparCpf(cpf);

  if (numeros.length !== 11) {
    return cpf;
  }

  return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}
