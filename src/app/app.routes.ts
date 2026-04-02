import { Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { DashboardComponent } from './modules/dashboard/pages/dashboard/dashboard';

export const routes: Routes = [
  // Ruta por defecto
  {
    path: '',
    redirectTo: 'welcome',
    pathMatch: 'full'
  },

  // Página de bienvenida
  {
    path: 'welcome',
    loadComponent: () =>
      import('./modules/auth/pages/welcome/welcome').then(m => m.WelcomeComponent)
  },

  // Registro
  {
    path: 'register',
    loadComponent: () =>
      import('./modules/auth/pages/register/register').then(m => m.Register)
  },

  // Verificación de correo (enlace enviado por email)
  {
    path: 'verify-email',
    loadComponent: () =>
      import('./modules/auth/pages/verify-email/verify-email')
        .then(m => m.VerifyEmailComponent)
  },

  // Dashboard y sub-rutas (protegidas con AuthGuard)
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
        path: 'comparacion-espectros/:queryId/:referenceId/:method',
        loadComponent: () =>
          import('./modules/analysis/pages/spectrum-comparison/spectrum-comparison.component')
            .then(m => m.SpectrumComparisonComponent)
      },
      {
        path: 'biblioteca-dataset',
        loadComponent: () =>
          import('./modules/similitud/pages/biblioteca-dataset/biblioteca-dataset.component')
            .then(m => m.BibliotecaDatasetComponent)
      },
      // Panel de administración (solo administradores)
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./modules/admin/pages/panel/admin-panel')
            .then(m => m.AdminPanelComponent)
      },
      {
        path: '',
        redirectTo: 'cargar',
        pathMatch: 'full'
      }
    ]
  },

  // Wildcard
  {
    path: '**',
    redirectTo: 'welcome'
  }
];
