-- Paso 9: ícono de la app instalable.
-- PNG cuadrado de 512 px hecho a partir del logo (bucket catalog: {business_id}/logo/icon-...).
-- Se guarda aparte porque el logo puede no ser cuadrado y los sistemas piden un ícono
-- cuadrado con una URL de verdad (no generado en el navegador). null = sin logo o sin generar.

alter table public.businesses add column icon_path text;
