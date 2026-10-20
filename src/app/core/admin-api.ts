import { Injectable, inject } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { BusinessStatus } from './models';
import { Supabase } from './supabase';

export interface AdminBusiness {
  id: string;
  slug: string;
  name: string;
  status: BusinessStatus;
  logo_path: string | null;
  created_at: string;
  owners: { user_id: string; email: string }[];
}

/** Lo que agrega un dueño: a un negocio existente (businessId) o a uno nuevo (name + slug). */
export type OwnerInvite = { email: string } & (
  { businessId: string } | { name: string; slug: string }
);

/** Acciones del superadmin. Lanza el error de Supabase si algo falla. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly supabase = inject(Supabase).client;

  async listBusinesses(): Promise<AdminBusiness[]> {
    const { data, error } = await this.supabase.rpc('admin_list_businesses');
    if (error) throw error;
    return data as AdminBusiness[];
  }

  async setStatus(id: string, status: BusinessStatus): Promise<void> {
    const { error } = await this.supabase.from('businesses').update({ status }).eq('id', id);
    if (error) throw error;
  }

  /** Negocio sin dueño todavía. Activo: lo crea el superadmin. */
  async createBusiness(name: string, slug: string): Promise<void> {
    const { error } = await this.supabase
      .from('businesses')
      .insert({ name, slug, status: 'active' });
    if (error) throw error;
  }

  /** Borra el negocio (y en cascada sus categorías y productos) y sus imágenes. */
  async deleteBusiness(id: string): Promise<void> {
    const bucket = this.supabase.storage.from('catalog');
    const folders = await Promise.all(
      ['logo', 'items'].map(async (folder) => {
        const { data } = await bucket.list(`${id}/${folder}`, { limit: 1000 });
        return (data ?? []).map((file) => `${id}/${folder}/${file.name}`);
      }),
    );
    const { error } = await this.supabase.from('businesses').delete().eq('id', id);
    if (error) throw error;
    const paths = folders.flat();
    if (paths.length) await bucket.remove(paths);
  }

  /**
   * Agrega un dueño (Edge Function invite-owner). Devuelve true si se le envió una invitación
   * por correo, o false si ya tenía cuenta y solo se le asignó el negocio.
   */
  async inviteOwner(invite: OwnerInvite): Promise<boolean> {
    const { data, error } = await this.supabase.functions.invoke('invite-owner', {
      body: { ...invite, redirectTo: `${location.origin}/definir-contrasena` },
    });
    if (error instanceof FunctionsHttpError) {
      // La función responde { error, code }: se reenvía para que errorMessage lo traduzca.
      const body = await error.context.json().catch(() => ({}));
      throw { code: body.code, message: body.error ?? error.message };
    }
    if (error) throw error;
    return data.invited as boolean;
  }

  /** Quita a un dueño de su negocio (su cuenta sigue existiendo). */
  async removeOwner(userId: string): Promise<void> {
    const { error } = await this.supabase.from('profiles').delete().eq('user_id', userId);
    if (error) throw error;
  }
}
