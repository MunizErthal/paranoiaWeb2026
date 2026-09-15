/** Duplicado de src/shared/utils/cpf.util.ts — ver nota em types.ts. */
export function limparCpf(cpf: string): string {
  return (cpf ?? '').replace(/\D/g, '');
}

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
