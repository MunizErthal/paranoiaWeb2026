import { Routes } from '@angular/router';
import { AuthGuard } from '../shared/guards/auth.guard';
import { Contato } from './contato/contato';
import { Home } from './home/home';
import { Jogos } from './jogos/jogos';
import { JogoDetalhe } from './jogos/jogo-detalhe';
import { Loja } from './loja/loja';
import { Sobre } from './sobre/sobre';

export const routes: Routes = [
	{ path: '', component: Home },
	{ path: 'jogos', component: Jogos },
	{ path: 'jogos/:idDoJogo', component: JogoDetalhe },
	{ path: 'sobre', component: Sobre },
	{ path: 'loja', component: Loja },
	{ path: 'contato', component: Contato },
	{ path: 'login', loadComponent: () => import('./login/login').then(m => m.Login) },
	{ path: 'cadastro', loadComponent: () => import('./cadastro/cadastro').then(m => m.Cadastro) },
	{ path: 'esqueci-senha', loadComponent: () => import('./esqueci-senha/esqueci-senha').then(m => m.EsqueciSenha) },
	{ path: 'carrinho', loadComponent: () => import('./carrinho/carrinho').then(m => m.Carrinho) },
	{ path: 'checkout', loadComponent: () => import('./checkout/checkout').then(m => m.Checkout), canActivate: [AuthGuard] },
	{
		path: 'perfil',
		loadComponent: () => import('./perfil/perfil').then(m => m.Perfil),
		canActivate: [AuthGuard],
		children: [
			{ path: '', loadComponent: () => import('./perfil/perfil-dados/perfil-dados').then(m => m.PerfilDados) },
			{ path: 'meus-jogos', loadComponent: () => import('./perfil/meus-jogos/meus-jogos').then(m => m.MeusJogos) },
			{ path: 'medalhas', loadComponent: () => import('./perfil/painel-medalhas/painel-medalhas').then(m => m.PainelMedalhas) },
			{ path: 'enderecos', loadComponent: () => import('./perfil/enderecos/enderecos').then(m => m.Enderecos) },
			{ path: 'cartoes', loadComponent: () => import('./perfil/cartoes/cartoes').then(m => m.Cartoes) },
			{ path: 'pedidos', loadComponent: () => import('./perfil/pedidos/pedidos').then(m => m.Pedidos) },
			{ path: 'pedidos/:idPedido', loadComponent: () => import('./perfil/pedidos/pedido-detalhe/pedido-detalhe').then(m => m.PedidoDetalhe) }
		]
	},
	{ path: '**', redirectTo: '' }
];
