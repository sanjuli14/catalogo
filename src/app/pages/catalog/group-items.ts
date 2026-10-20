import { translate } from '@jsverse/transloco';

import { Category, Item } from '../../core/models';

export interface ItemGroup {
  id: string;
  name: string;
  items: Item[];
}

/** "3 productos", "1 servicio" o, si el grupo mezcla ambos, "4 en total". */
export function countLabel(items: Item[]): string {
  const n = items.length;
  const one = n === 1;
  if (items.every((i) => i.kind === 'service')) {
    return translate(one ? 'group.service' : 'group.services', { n });
  }
  if (items.every((i) => i.kind === 'product')) {
    return translate(one ? 'group.product' : 'group.products', { n });
  }
  return translate('group.total', { n });
}

/** Agrupa los productos por categoría, en el orden del dueño; los que no tienen van al final. */
export function groupItems(categories: Category[], items: Item[]): ItemGroup[] {
  const groups: ItemGroup[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    items: items.filter((i) => i.category_id === c.id),
  }));
  const uncategorized = items.filter(
    (i) => !i.category_id || !categories.some((c) => c.id === i.category_id),
  );
  if (uncategorized.length) {
    groups.push({
      id: 'otros',
      name: translate(categories.length ? 'group.others' : 'group.catalog'),
      items: uncategorized,
    });
  }
  return groups.filter((g) => g.items.length);
}
