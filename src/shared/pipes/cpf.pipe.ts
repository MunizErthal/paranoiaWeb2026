import { Pipe, PipeTransform } from '@angular/core';
import { formatarCpf } from '../utils/cpf.util';

@Pipe({ name: 'cpf' })
export class CpfPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    if (!valor) {
      return '';
    }
    return formatarCpf(valor);
  }
}
