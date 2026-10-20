-- Paso 7: variantes (tallas, colores, sabores...).
-- Un producto tiene a lo sumo un tipo de variante (variant_label: "Talla", "Sabor") y su
-- lista de opciones en variants: [{ "id", "name", "price", "is_available" }].
-- price null = el precio del producto. Van en la misma fila: se leen y guardan con él.

alter table public.items
  add column variant_label text,
  add column variants jsonb not null default '[]'::jsonb,
  add constraint items_variants_check check (jsonb_typeof(variants) = 'array');
