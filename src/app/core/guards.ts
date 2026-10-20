import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { Auth, homeFor } from './auth';
import { Role } from './models';

/** Deja pasar solo a usuarios con ese rol; al resto lo manda al login o a su panel. */
export function roleGuard(role: Role): CanActivateFn {
  return async () => {
    const auth = inject(Auth);
    const router = inject(Router);
    await auth.ready;

    const profile = auth.profile();
    if (!profile) return router.createUrlTree(['/login']);
    if (profile.role !== role) return router.createUrlTree([homeFor(profile.role)]);
    return true;
  };
}

/** Si ya hay sesión con perfil, el login redirige directo al panel. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  await auth.ready;

  const profile = auth.profile();
  return profile ? inject(Router).createUrlTree([homeFor(profile.role)]) : true;
};
