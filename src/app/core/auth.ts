import { Injectable, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';

import { Profile, Role } from './models';
import { Supabase } from './supabase';

/** Ruta de inicio de cada rol después del login. */
export function homeFor(role: Role): string {
  return role === 'superadmin' ? '/superadmin' : '/admin';
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly supabase = inject(Supabase).client;

  readonly session = signal<Session | null>(null);
  /** null si no hay sesión o si el usuario no tiene perfil asignado. */
  readonly profile = signal<Profile | null>(null);
  /** Se resuelve cuando ya se sabe si hay sesión y se cargó su perfil. */
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.supabase.auth
      .getSession()
      .then(({ data }) => this.setSession(data.session));

    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      // Supabase recomienda no llamar a su API dentro de este callback.
      setTimeout(() => this.setSession(session));
    });
  }

  /** Devuelve un mensaje de error, o null si entró bien. */
  async signIn(email: string, password: string): Promise<string | null> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      switch (error.code) {
        case 'invalid_credentials':
          return 'Correo o contraseña incorrectos.';
        case 'email_not_confirmed':
          return 'Tu correo todavía no está confirmado.';
        default:
          return `No se pudo iniciar sesión: ${error.message}`;
      }
    }
    await this.setSession(data.session);
    return null;
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this.session.set(null);
    this.profile.set(null);
  }

  private async setSession(session: Session | null): Promise<void> {
    this.session.set(session);
    if (!session) {
      this.profile.set(null);
      return;
    }
    if (this.profile()?.user_id === session.user.id) return;

    const { data } = await this.supabase
      .from('profiles')
      .select('user_id, role, business_id')
      .eq('user_id', session.user.id)
      .maybeSingle<Profile>();
    this.profile.set(data);
  }
}
