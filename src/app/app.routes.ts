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
  {
    // El superadmin administra cualquier negocio con el mismo panel del dueño.
    path: 'superadmin/negocios/:businessId',
    canActivate: [roleGuard('superadmin')],
    loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin),
    loadChildren: () => import('./pages/admin/admin.routes').then((m) => m.adminRoutes),
  },
  {
    path: 'recuperar',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    // Sin guard: llega con la sesión del enlace del correo (invitación o recuperación).
    path: 'definir-contrasena',
    loadComponent: () => import('./pages/set-password/set-password').then((m) => m.SetPassword),
  },
  // Después de las rutas fijas: cualquier otro segmento es el slug de un negocio (/mi-tienda).
  { path: ':slug', loadComponent: () => import('./pages/catalog/catalog').then((m) => m.Catalog) },
  {
    // Página propia de cada producto o servicio, con enlace para compartir.
    path: ':slug/:itemId',
    loadComponent: () => import('./pages/catalog/product').then((m) => m.Product),
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
