import { Pipe, PipeTransform } from '@angular/core';
import { formatarCep } from '../utils/cep.util';

@Pipe({ name: 'cep' })
export class CepPipe implements PipeTransform {
  transform(valor: string | null | undefined): string {
    if (!valor) {
      return '';
    }
    return formatarCep(valor);
  }
}
