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

  // ✨ NUEVO: Dashboard y sus sub-rutas
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
        path: 'busqueda',
        loadComponent: () =>
          import('./modules/similitud/pages/busqueda/busqueda')
            .then(m => m.Busqueda)
      },
      {
        path: 'biblioteca',
        loadComponent: () =>
          import('./modules/biblioteca/pages/listado/listado')
            .then(m => m.Listado)
//      },
//      {
//        path: 'perfil',
//        loadComponent: () =>
//          import('./modules/perfil/pages/perfil/perfil')
//            .then(m => m.PerfilComponent)
//      },
//      {
//        path: 'preferencias',
//        loadComponent: () =>
//          import('./modules/perfil/pages/preferencias/preferencias')
//            .then(m => m.PreferenciasComponent)
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