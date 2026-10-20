import { Injectable, inject, signal } from '@angular/core';
import { Session } from '@supabase/supabase-js';

import { Profile, Role } from './models';
import { Supabase } from './supabase';

export interface BusinessDraft {
  name: string;
  slug: string;
}

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
  /** true si no se pudo leer el perfil (por ejemplo, sin conexión): no significa "sin negocio". */
  readonly profileError = signal(false);
  /** Se resuelve cuando ya se sabe si hay sesión y se cargó su perfil. */
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.supabase.auth.getSession().then(({ data }) => this.setSession(data.session));

    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      // Supabase recomienda no llamar a su API dentro de este callback.
      setTimeout(() => this.setSession(session));
    });
  }

  /** Devuelve un mensaje de error, o null si entró bien. */
  async signIn(email: string, password: string, captchaToken?: string): Promise<string | null> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken },
    });
    if (error) {
      switch (error.code) {
        case 'invalid_credentials':
          return 'Correo o contraseña incorrectos.';
        case 'email_not_confirmed':
          return 'Tu correo todavía no está confirmado.';
        case 'captcha_failed':
          return 'No pudimos verificar que eres una persona. Inténtalo de nuevo.';
        default:
          return `No se pudo iniciar sesión: ${error.message}`;
      }
    }
    await this.setSession(data.session);
    return null;
  }

  /**
   * Crea la cuenta del dueño. El negocio va en los metadatos para poder terminar el registro
   * después de confirmar el correo. Devuelve true si ya quedó con sesión iniciada.
   */
  async signUp(
    email: string,
    password: string,
    business: BusinessDraft,
    captchaToken?: string,
  ): Promise<boolean> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        data: { business_name: business.name, business_slug: business.slug },
        emailRedirectTo: `${location.origin}/registro`,
        captchaToken,
      },
    });
    if (error) throw error;
    // Si el correo ya existe, Supabase devuelve un usuario sin identidades en vez de un error.
    if (data.user?.identities?.length === 0) throw { code: 'user_already_exists' };
    if (data.session) await this.setSession(data.session);
    return data.session !== null;
  }

  async slugAvailable(slug: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('slug_available', { candidate: slug });
    if (error) throw error;
    return data as boolean;
  }

  /** Crea el negocio (pendiente de aprobación) del usuario con sesión y lo hace su dueño. */
  async registerBusiness(business: BusinessDraft): Promise<void> {
    const { error } = await this.supabase.rpc('register_business', {
      business_name: business.name,
      business_slug: business.slug,
    });
    if (error) throw error;
    await this.loadProfile(this.session()!.user.id);
  }

  /** Envía el correo para elegir una contraseña nueva. Supabase exige el captcha también aquí. */
  async sendPasswordReset(email: string, captchaToken?: string): Promise<void> {
    const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/definir-contrasena`,
      captchaToken,
    });
    if (error) throw error;
  }

  /** Cambia la contraseña del usuario con sesión (al volver del correo de invitación o recuperación). */
  async updatePassword(password: string): Promise<void> {
    const { error } = await this.supabase.auth.updateUser({ password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this.session.set(null);
    this.profile.set(null);
    this.profileError.set(false);
  }

  private async setSession(session: Session | null): Promise<void> {
    if (!session) {
      this.session.set(null);
      this.profile.set(null);
      return;
    }
    // Primero el perfil y después la sesión: así nunca se ve "con sesión pero sin perfil"
    // mientras el perfil todavía está cargando.
    if (this.profile()?.user_id !== session.user.id) await this.loadProfile(session.user.id);
    this.session.set(session);
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('user_id, role, business_id')
      .eq('user_id', userId)
      .maybeSingle<Profile>();
    this.profileError.set(error !== null);
    this.profile.set(data);
  }
}
