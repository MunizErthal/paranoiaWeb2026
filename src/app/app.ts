import { AfterViewInit, ChangeDetectorRef, Component, DestroyRef, ElementRef, HostListener, Signal, computed, effect, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStateStore } from '../shared/stores/auth-state.store';
import { CarrinhoStore } from '../shared/stores/carrinho.store';
import { CarrinhoDrawerStore } from '../shared/stores/carrinho-drawer.store';
import { CarrinhoDrawer } from '../shared/components/carrinho-drawer/carrinho-drawer';
import { AuthService } from '../shared/services/firebase/auth.service';

type NavigationItem = {
  id: string;
  label: string;
  route: string;
};

/** Precisa bater com o breakpoint mobile do app.scss (47.9375rem = 767px).
 *  Acima disso a barra e o menu somem via CSS — este media query só existe
 *  para fechar o menu caso o aparelho gire ou a janela seja redimensionada
 *  com ele aberto, evitando deixar o scroll da página travado. */
const MOBILE_MEDIA_QUERY = '(max-width: 47.9375rem)';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, CarrinhoDrawer],
  templateUrl: './app.html',
  styleUrls: ['./app.scss', './glitch.scss']
})
export class App implements AfterViewInit {
  animateOnLoad = false;
  isScrolled = false;
  protected readonly title = signal('Paranoia Jogos');
  protected readonly selectedPage = signal('inicio');
  protected readonly navigationItems: NavigationItem[] = [
    { id: 'inicio', label: 'Início', route: '/' },
    { id: 'jogos', label: 'Jogos', route: '/jogos' },
    { id: 'sobre', label: 'Sobre', route: '/sobre' },
    { id: 'loja', label: 'Loja', route: '/loja' },
    { id: 'contato', label: 'Contato', route: '/contato' }
  ];

  /** Gaveta de navegação do mobile. No desktop o botão que a abre está
   *  `display: none`, então este estado nunca sai de `false` lá. */
  protected readonly menuAberto = signal(false);
  protected readonly menuPainel = viewChild<ElementRef<HTMLElement>>('menuPainel');
  private gatilhoDoMenu: HTMLElement | null = null;

  protected readonly estaAutenticado: Signal<boolean>;
  protected readonly iniciais: Signal<string>;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private destroyRef: DestroyRef,
    private authState: AuthStateStore,
    private authService: AuthService,
    protected readonly carrinhoStore: CarrinhoStore,
    protected readonly carrinhoDrawer: CarrinhoDrawerStore
  ) {
    this.estaAutenticado = this.authState.estaAutenticado;
    this.iniciais = computed(() => {
      const usuario = this.authState.usuario();
      const fonte = usuario?.nome?.trim() || usuario?.email || '';
      return fonte.charAt(0).toUpperCase() || '?';
    });
    this.updateSelectedPage(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => {
        this.updateSelectedPage(event.urlAfterRedirects);
        this.fecharMenu();
      });

    // Mesma mecânica da gaveta do carrinho: foco vai para o painel ao abrir
    // e volta para o botão que o abriu ao fechar, com o scroll da página
    // travado enquanto o menu cobre a tela.
    effect(() => {
      if (this.menuAberto()) {
        document.body.style.overflow = 'hidden';
        queueMicrotask(() => this.menuPainel()?.nativeElement.focus());
      } else {
        document.body.style.overflow = '';
        this.gatilhoDoMenu?.focus?.();
        this.gatilhoDoMenu = null;
      }
    });

    this.destroyRef.onDestroy(() => {
      document.body.style.overflow = '';
    });
  }

  protected alternarMenu(evento: Event): void {
    if (this.menuAberto()) {
      this.fecharMenu();
      return;
    }

    // Menu e carrinho disputam o mesmo travamento de scroll — só um por vez.
    this.carrinhoDrawer.fechar();
    this.gatilhoDoMenu = evento.currentTarget as HTMLElement;
    this.menuAberto.set(true);
  }

  protected fecharMenu(): void {
    if (this.menuAberto()) {
      this.menuAberto.set(false);
    }
  }

  protected abrirCarrinho(): void {
    this.fecharMenu();
    this.carrinhoDrawer.alternar();
  }

  protected async sairPeloMenu(): Promise<void> {
    this.fecharMenu();
    await this.sair();
  }

  async sair(): Promise<void> {
    await this.authService.logout();
    this.router.navigateByUrl('/');
  }

  private updateSelectedPage(url: string): void {
    const route = url.split(/[?#]/)[0];
    const selectedPage = this.navigationItems.find((item) =>
      item.route === '/' ? route === '/' : route === item.route || route.startsWith(`${item.route}/`)
    )?.id ?? 'inicio';

    this.selectedPage.set(selectedPage);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.fecharMenu();
  }

  // Girar o aparelho para paisagem pode cruzar o breakpoint e esconder a
  // gaveta por CSS; sem isto o scroll ficaria travado sem nada na tela.
  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.menuAberto() && !window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
      this.fecharMenu();
    }
  }

  // Escurece o menu fixo (sticky) assim que a página rola um pouco.
  @HostListener('window:scroll')
  onWindowScroll(): void {
    const isScrolled = window.scrollY > 8;
    if (isScrolled !== this.isScrolled) {
      this.isScrolled = isScrolled;
      this.cdr.detectChanges();
    }
  }

  ngAfterViewInit(): void {
    // ativa a animação no próximo tick para evitar ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      this.animateOnLoad = true;
      this.cdr.detectChanges();
      setTimeout(() => {
        this.animateOnLoad = false;
        this.cdr.detectChanges();
      }, 3500);
    }, 0);
  }
}
