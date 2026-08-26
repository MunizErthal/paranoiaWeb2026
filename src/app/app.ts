import { AfterViewInit, ChangeDetectorRef, Component, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

type NavigationItem = {
  id: string;
  label: string;
  route: string;
};

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrls: ['./app.scss', './glitch.scss']
})
export class App implements AfterViewInit {
  animateOnLoad = false;
  protected readonly title = signal('Paranoia Jogos');
  protected readonly selectedPage = signal('inicio');
  protected readonly navigationItems: NavigationItem[] = [
    { id: 'inicio', label: 'Início', route: '/' },
    { id: 'jogos', label: 'Jogos', route: '/jogos' },
    { id: 'sobre', label: 'Sobre', route: '/sobre' },
    { id: 'loja', label: 'Loja', route: '/loja' },
    { id: 'contato', label: 'Contato', route: '/contato' }
  ];

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private destroyRef: DestroyRef
  ) {
    this.updateSelectedPage(this.router.url);
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => this.updateSelectedPage(event.urlAfterRedirects));
  }

  private updateSelectedPage(url: string): void {
    const route = url.split(/[?#]/)[0];
    const selectedPage = this.navigationItems.find((item) =>
      item.route === '/' ? route === '/' : route === item.route || route.startsWith(`${item.route}/`)
    )?.id ?? 'inicio';

    this.selectedPage.set(selectedPage);
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