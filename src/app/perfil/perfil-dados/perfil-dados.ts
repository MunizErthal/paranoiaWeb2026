import { Component, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AuthStateStore } from '../../../shared/stores/auth-state.store';
import { UsuarioService } from '../../../shared/services/firebase/usuario.service';
import { PerfilService } from '../../../shared/services/firebase/perfil.service';
import { PedidoService } from '../../../shared/services/firebase/pedido.service';
import { ToastService } from '../../../shared/services/toast/toast.service';
import { cpfValido } from '../../../shared/utils/cpf.util';
import { CpfPipe } from '../../../shared/pipes/cpf.pipe';

@Component({
  selector: 'app-perfil-dados',
  standalone: true,
  imports: [RouterLink, CpfPipe],
  templateUrl: './perfil-dados.html',
  styleUrl: './perfil-dados.scss'
})
export class PerfilDados {
  private readonly authState = inject(AuthStateStore);
  private readonly usuarioService = inject(UsuarioService);
  private readonly perfilService = inject(PerfilService);
  private readonly pedidoService = inject(PedidoService);
  private readonly toast = inject(ToastService);

  private readonly uid = this.authState.usuario()!.id;

  readonly usuario = toSignal(this.usuarioService.buscarPorId(this.uid), { initialValue: null });
  readonly perfil = toSignal(this.perfilService.buscar(this.uid), { initialValue: null });
  readonly pedidos = toSignal(this.pedidoService.listarDoUsuarioOuvindo(this.uid), { initialValue: [] });

  readonly cpfBloqueado = computed(() =>
    this.pedidos().some(pedido => pedido.status !== 'aguardando_pagamento')
  );

  readonly editando = signal(false);
  readonly salvando = signal(false);

  readonly nome = signal('');
  readonly telefone = signal('');
  readonly dataNascimento = signal('');
  readonly cpf = signal('');
  readonly erroCpf = signal<string | null>(null);

  iniciarEdicao(): void {
    this.nome.set(this.usuario()?.nome ?? '');
    this.telefone.set(this.perfil()?.telefone ?? '');
    this.dataNascimento.set(this.perfil()?.dataNascimento ?? '');
    this.cpf.set(this.perfil()?.cpf ?? '');
    this.editando.set(true);
  }

  async salvar(): Promise<void> {
    if (this.cpf() && !this.cpfBloqueado() && !cpfValido(this.cpf())) {
      this.erroCpf.set('CPF inválido.');
      return;
    }
    this.erroCpf.set(null);

    this.salvando.set(true);
    try {
      await this.usuarioService.atualizarUsuario(this.uid, { nome: this.nome() });

      const dadosPerfil: { telefone: string; dataNascimento: string; cpf?: string } = {
        telefone: this.telefone(),
        dataNascimento: this.dataNascimento()
      };
      if (!this.cpfBloqueado()) {
        dadosPerfil.cpf = this.cpf();
      }

      await new Promise<void>((resolve, reject) => {
        this.perfilService.salvar(this.uid, dadosPerfil).subscribe({ next: () => resolve(), error: reject });
      });

      this.toast.showSuccess('Dados atualizados.');
      this.editando.set(false);
    } catch {
      this.toast.showError('Não foi possível salvar seus dados.');
    } finally {
      this.salvando.set(false);
    }
  }
}
