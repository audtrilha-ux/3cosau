import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  isDevMode,
  ENVIRONMENT_INITIALIZER,
  inject
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideServiceWorker } from '@angular/service-worker';
import { OS_CONTEXT } from './core/contracts/os-context';
import { OSContextImpl } from './core/services/os-context-impl';
import { AppRegistry } from './core/services/app-registry';
import { BUSINESS_APP_MANIFESTS } from './modules/manifests';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(), 
    provideRouter(routes), 
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    }),
    { provide: OS_CONTEXT, useExisting: OSContextImpl },
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const registry = inject(AppRegistry);
        registry.registerApps(BUSINESS_APP_MANIFESTS);
      }
    }
  ],
};

