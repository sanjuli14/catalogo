import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'productos' },
  {
    path: 'productos',
    loadComponent: () => import('./items/items').then((m) => m.Items),
  },
  {
    path: 'productos/nuevo',
    loadComponent: () => import('./items/item-form').then((m) => m.ItemForm),
  },
  {
    path: 'productos/:id',
    loadComponent: () => import('./items/item-form').then((m) => m.ItemForm),
  },
  {
    path: 'categorias',
    loadComponent: () => import('./categories/categories').then((m) => m.Categories),
  },
  {
    path: 'estadisticas',
    loadComponent: () => import('./stats/stats').then((m) => m.Stats),
  },
  {
    path: 'compartir',
    loadComponent: () => import('./share/share').then((m) => m.Share),
  },
  {
    path: 'negocio',
    loadComponent: () =>
      import('./business-settings/business-settings').then((m) => m.BusinessSettings),
  },
];
