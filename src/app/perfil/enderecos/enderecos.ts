import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthStateStore } from '../../../shared/stores/auth-state.store';
import { EnderecoService } from '../../../shared/services/firebase/endereco.service';
import { ToastService } from '../../../shared/services/toast/toast.service';
import { EnderecoForm } from '../../../shared/components/endereco-form/endereco-form';
import { EnderecoDTO } from '../../../shared/models/endereco.dto';

@Component({
  selector: 'app-enderecos',
  standalone: true,
  imports: [EnderecoForm],
  templateUrl: './enderecos.html',
  styleUrl: './enderecos.scss'
})
export class Enderecos {
  private readonly authState = inject(AuthStateStore);
  private readonly enderecoService = inject(EnderecoService);
  private readonly toast = inject(ToastService);

  private readonly uid = this.authState.usuario()!.id;

  readonly enderecos = toSignal(this.enderecoService.listar(this.uid), { initialValue: [] as EnderecoDTO[] });
  readonly mostrarForm = signal(false);
  readonly enderecoEmEdicao = signal<EnderecoDTO | null>(null);

  novoEndereco(): void {
    this.enderecoEmEdicao.set(null);
    this.mostrarForm.set(true);
  }

  editar(endereco: EnderecoDTO): void {
    this.enderecoEmEdicao.set(endereco);
    this.mostrarForm.set(true);
  }

  salvar(dados: Omit<EnderecoDTO, 'id' | 'padrao'>): void {
    const emEdicao = this.enderecoEmEdicao();

    if (emEdicao) {
      this.enderecoService.atualizar(this.uid, emEdicao.id, dados).subscribe({
        next: () => this.mostrarForm.set(false),
        error: () => this.toast.showError('Não foi possível atualizar o endereço.')
      });
      return;
    }

    const primeiroEndereco = this.enderecos().length === 0;
    this.enderecoService.criar(this.uid, { ...dados, padrao: primeiroEndereco }).subscribe({
      next: () => this.mostrarForm.set(false),
      error: () => this.toast.showError('Não foi possível salvar o endereço.')
    });
  }

  remover(endereco: EnderecoDTO): void {
    this.enderecoService.remover(this.uid, endereco.id).subscribe({
      error: () => this.toast.showError('Não foi possível remover o endereço.')
    });
  }

  async marcarComoPadrao(endereco: EnderecoDTO): Promise<void> {
    try {
      await this.enderecoService.marcarComoPadrao(this.uid, endereco.id);
    } catch {
      this.toast.showError('Não foi possível atualizar o endereço padrão.');
    }
  }
}
