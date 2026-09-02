import { ChangeDetectionStrategy, Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DesktopShellComponent } from './shell/desktop/desktop.shell';
import { CentralComponent } from './central/central.component';
import { PwaService } from './core/services/pwa.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DesktopShellComponent, CentralComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (viewMode() === 'CENTRAL') {
      <app-central (openTerminal)="viewMode.set('OS')"></app-central>
    } @else {
      <app-desktop-shell (openCentral)="viewMode.set('CENTRAL')"></app-desktop-shell>
    }
  `,
})
export class App implements OnInit {
  private pwa = inject(PwaService);

  ngOnInit() {
    this.pwa.init();
  }

  viewMode = signal<'OS' | 'CENTRAL'>('OS');
}
