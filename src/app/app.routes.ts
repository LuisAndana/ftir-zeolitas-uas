import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { DashboardComponent } from './modules/dashboard/pages/dashboard/dashboard';

export const routes: Routes = [
  // Ruta por defecto
  {
    path: '',
    redirectTo: 'welcome',
    pathMatch: 'full'
  },

  // Página de bienvenida (sin protección)
  {
    path: 'welcome',
    loadComponent: () =>
      import('./modules/auth/pages/welcome/welcome')
        .then(m => m.WelcomeComponent)
  },

  // Página de registro (sin protección)
  {
    path: 'register',
    loadComponent: () =>
      import('./modules/auth/pages/register/register')
        .then(m => m.Register)
  },

  // Dashboard y sus sub-rutas (PROTEGIDAS con AuthGuard)
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard],
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
            .then(m => m.BusquedaComponent)
      },
      {
        path: 'comparacion',
        loadComponent: () =>
          import('./modules/similitud/pages/comparacion/comparacion')
            .then(m => m.Comparacion)
      },
      {
        // ✅ PARÁMETROS CORRECTOS: queryId, referenceId, method
        path: 'comparacion-espectros/:queryId/:referenceId/:method',
        loadComponent: () =>
          import('./modules/analysis/pages/spectrum-comparison/spectrum-comparison.component')
            .then(m => m.SpectrumComparisonComponent)
      },
      // ✅ NUEVA RUTA: Biblioteca Dataset
      {
        path: 'biblioteca-dataset',
        loadComponent: () =>
          import('./modules/similitud/pages/biblioteca-dataset/biblioteca-dataset.component')
            .then(m => m.BibliotecaDatasetComponent)
      },
      {
        path: '',
        redirectTo: 'cargar',
        pathMatch: 'full'
      }
    ]
  },

  // Ruta comodín (redirigir a welcome)
  {
    path: '**',
    redirectTo: 'welcome'
  }
];