-- Paso 6: ofertas y destacados.
--   * compare_at_price: precio anterior, que se muestra tachado junto al precio de oferta.
--   * is_pinned: el producto va arriba del catálogo, en "Destacados".
-- La etiqueta "Nuevo" no necesita columna: sale de created_at (agregados hace poco).

alter table public.items
  add column compare_at_price numeric(12, 2),
  add column is_pinned boolean not null default false,
  -- Solo tiene sentido tachar un precio mayor que el actual.
  add constraint items_compare_at_price_check
    check (compare_at_price is null or (price is not null and compare_at_price > price));
