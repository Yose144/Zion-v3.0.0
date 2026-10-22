'use client';

import ItemCard, { type ArtifactCardData } from './ItemCard';

interface ItemGridProps {
  items: ArtifactCardData[];
  emptyMessage?: string;
}

export function ItemGrid({ items, emptyMessage = 'No items found' }: ItemGridProps) {
  if (items.length === 0) {
    return (
      <div className="card p-12 text-center text-gray-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((item) => (
        <ItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}
