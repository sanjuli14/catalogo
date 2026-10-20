import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home/home').then((m) => m.Home) },
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  { path: 'admin', loadComponent: () => import('./pages/admin/admin').then((m) => m.Admin) },
  {
    path: 'superadmin',
    loadComponent: () => import('./pages/superadmin/superadmin').then((m) => m.Superadmin),
  },
  // Debe ir al final: cualquier otro segmento es el slug de un negocio (/mi-tienda).
  { path: ':slug', loadComponent: () => import('./pages/catalog/catalog').then((m) => m.Catalog) },
];
