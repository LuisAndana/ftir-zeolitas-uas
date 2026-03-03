import { Routes } from '@angular/router';

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

  // Ruta comodín
  {
    path: '**',
    redirectTo: 'welcome'
  }
];