import { Routes } from '@angular/router';

import { guestGuard, roleGuard } from './core/guards';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then((m) => m.Home) },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'registro',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
  },
  {
    path: 'admin',
    canActivate: [roleGuard('tenant_admin')],
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
    loadChildren: () => import('./pages/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: 'superadmin',
    canActivate: [roleGuard('superadmin')],
    loadComponent: () => import('./pages/superadmin/superadmin').then((m) => m.Superadmin),
  },
  // Debe ir al final: cualquier otro segmento es el slug de un negocio (/mi-tienda).
  { path: ':slug', loadComponent: () => import('./pages/catalog/catalog').then((m) => m.Catalog) },
];
