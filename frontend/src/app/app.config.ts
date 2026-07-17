import { ApplicationConfig, provideBrowserGlobalErrorListeners, LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';

// 1. IMPORTACIONES CORREGIDAS
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

// 2. REGISTRO DEL IDIOMA
registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes), 
    provideClientHydration(withEventReplay()),
    
    // 3. PROVEEDOR HTTP CORREGIDO (Se unificó en una sola línea con fetch)
    provideHttpClient(withFetch()),
    
    // 4. CONFIGURACIÓN DEL IDIOMA
    { provide: LOCALE_ID, useValue: 'es-ES' }
  ]
};
