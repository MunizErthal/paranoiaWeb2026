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
	{ path: '**', redirectTo: '' }
];
