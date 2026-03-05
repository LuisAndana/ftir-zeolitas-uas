import { Routes } from '@angular/router';
import { DashboardComponent } from './modules/dashboard/pages/dashboard/dashboard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'welcome',
    pathMatch: 'full'
  },

  {
    path: 'welcome',
    loadComponent: () =>
      import('./modules/auth/pages/welcome/welcome')
        .then(m => m.WelcomeComponent)
  },

  {
    path: 'register',
    loadComponent: () =>
      import('./modules/auth/pages/register/register')
        .then(m => m.Register)
  },

  // Dashboard y sus sub-rutas
  {
    path: 'dashboard',
    component: DashboardComponent,
    children: [
      {
        path: 'cargar',
        loadComponent: () =>
          import('./modules/espectros/pages/cargar-espectro/cargar-espectro')
            .then(m => m.CargarEspectro)
      },
      {
        path: 'grafica',
        loadComponent: () =>
          import('./modules/espectros/pages/grafica-espectro/grafica-espectro')
            .then(m => m.GraficaEspectro)
      },
      {
        path: 'busqueda',
        loadComponent: () =>
          import('./modules/similitud/pages/busqueda/busqueda')
            .then(m => m.Busqueda)
      },
      {
        path: 'comparacion',
        loadComponent: () =>
          import('./modules/similitud/pages/comparacion/comparacion')
            .then(m => m.Comparacion)
      },
      {
        path: 'biblioteca',
        loadComponent: () =>
          import('./modules/biblioteca/pages/listado/listado')
            .then(m => m.Listado)
      },
      {
        path: '',
        redirectTo: 'cargar',
        pathMatch: 'full'
      }
    ]
  },

  // Ruta comodín
  {
    path: '**',
    redirectTo: 'welcome'
  }
];
