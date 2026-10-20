import { Injectable, inject } from '@angular/core';

import { resizeImage } from './image';
import { Business, Category, Item } from './models';
import { Supabase } from './supabase';

const BUCKET = 'catalog';
const EXTENSIONS: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

export type BusinessPatch = Partial<Omit<Business, 'id' | 'status' | 'created_at' | 'updated_at'>>;
export type ItemInput = Omit<Item, 'id' | 'created_at'>;

/** Acceso a las tablas y al Storage. Lanza el error de Supabase si algo falla. */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly supabase = inject(Supabase).client;

  async getBusiness(id: string): Promise<Business> {
    const { data, error } = await this.supabase
      .from('businesses')
      .select('*')
      .eq('id', id)
      .single<Business>();
    if (error) throw error;
    return data;
  }

  /** null si no existe o si el visitante no puede verlo (no está activo y no es su dueño). */
  async getBusinessBySlug(slug: string): Promise<Business | null> {
    const { data, error } = await this.supabase
      .from('businesses')
      .select('*')
      .eq('slug', slug)
      .maybeSingle<Business>();
    if (error) throw error;
    return data;
  }

  async updateBusiness(id: string, patch: BusinessPatch): Promise<Business> {
    const { data, error } = await this.supabase
      .from('businesses')
      .update(patch)
      .eq('id', id)
      .select()
      .single<Business>();
    if (error) throw error;
    return data;
  }

  async listCategories(businessId: string): Promise<Category[]> {
    const { data, error } = await this.supabase
      .from('categories')
      .select('id, business_id, name, position')
      .eq('business_id', businessId)
      .order('position')
      .order('created_at');
    if (error) throw error;
    return data;
  }

  async createCategory(businessId: string, name: string, position: number): Promise<Category> {
    const { data, error } = await this.supabase
      .from('categories')
      .insert({ business_id: businessId, name, position })
      .select('id, business_id, name, position')
      .single<Category>();
    if (error) throw error;
    return data;
  }

  async renameCategory(id: string, name: string): Promise<void> {
    const { error } = await this.supabase.from('categories').update({ name }).eq('id', id);
    if (error) throw error;
  }

  async deleteCategory(id: string): Promise<void> {
    const { error } = await this.supabase.from('categories').delete().eq('id', id);
    if (error) throw error;
  }

  async listItems(businessId: string): Promise<Item[]> {
    const { data, error } = await this.supabase
      .from('items')
      .select('*')
      .eq('business_id', businessId)
      .order('position')
      .order('created_at');
    if (error) throw error;
    return data;
  }

  async getItem(id: string): Promise<Item> {
    const { data, error } = await this.supabase
      .from('items')
      .select('*')
      .eq('id', id)
      .single<Item>();
    if (error) throw error;
    return data;
  }

  async createItem(input: ItemInput): Promise<void> {
    const { error } = await this.supabase.from('items').insert(input);
    if (error) throw error;
  }

  async updateItem(id: string, patch: Partial<ItemInput>): Promise<void> {
    const { error } = await this.supabase.from('items').update(patch).eq('id', id);
    if (error) throw error;
  }

  /** Borra el producto y sus fotos. */
  async deleteItem(item: Item): Promise<void> {
    const { error } = await this.supabase.from('items').delete().eq('id', item.id);
    if (error) throw error;
    await this.removeImages(item.photos);
  }

  /**
   * Guarda el orden mostrado: cada fila queda con position = su índice en la lista.
   * Solo actualiza las filas que cambian (al intercambiar dos, son dos peticiones).
   */
  async savePositions<T extends { id: string; position: number }>(
    table: 'categories' | 'items',
    rows: T[],
  ): Promise<T[]> {
    const results = await Promise.all(
      rows
        .map((row, position) => ({ row, position }))
        .filter(({ row, position }) => row.position !== position)
        .map(({ row, position }) =>
          this.supabase.from(table).update({ position }).eq('id', row.id),
        ),
    );
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;
    return rows.map((row, position) => ({ ...row, position }));
  }

  /** Sube una imagen reducida a {businessId}/{folder}/... y devuelve su ruta en el bucket. */
  async uploadImage(businessId: string, folder: 'logo' | 'items', file: File): Promise<string> {
    const isLogo = folder === 'logo';
    const blob = await resizeImage(file, isLogo ? 512 : 1600, isLogo);
    const extension = EXTENSIONS[blob.type] ?? 'png';
    const path = `${businessId}/${folder}/${crypto.randomUUID()}.${extension}`;

    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: blob.type, cacheControl: '31536000' });
    if (error) throw error;
    return path;
  }

  /** Sube el ícono PNG ya preparado (sin reducir ni convertir) y devuelve su ruta. */
  async uploadIcon(businessId: string, icon: Blob): Promise<string> {
    const path = `${businessId}/logo/icon-${crypto.randomUUID()}.png`;
    const { error } = await this.supabase.storage
      .from(BUCKET)
      .upload(path, icon, { contentType: 'image/png', cacheControl: '31536000' });
    if (error) throw error;
    return path;
  }

  async removeImages(paths: string[]): Promise<void> {
    if (!paths.length) return;
    await this.supabase.storage.from(BUCKET).remove(paths);
  }

  imageUrl(path: string): string {
    return this.supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
}
