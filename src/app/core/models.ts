// Tipos de las tablas de Supabase (supabase/migrations).

export type Role = 'superadmin' | 'tenant_admin';
export type BusinessStatus = 'active' | 'suspended';
export type ItemKind = 'product' | 'service';

export interface Profile {
  user_id: string;
  role: Role;
  business_id: string | null;
}

export interface Business {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_path: string | null;
  primary_color: string;
  secondary_color: string;
  currency: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  schedule: string | null;
  socials: Partial<Record<'instagram' | 'facebook' | 'tiktok' | 'x' | 'website', string>>;
  status: BusinessStatus;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  position: number;
}

export interface Item {
  id: string;
  business_id: string;
  category_id: string | null;
  kind: ItemKind;
  name: string;
  description: string | null;
  price: number | null;
  photos: string[];
  is_available: boolean;
  is_visible: boolean;
  position: number;
}
