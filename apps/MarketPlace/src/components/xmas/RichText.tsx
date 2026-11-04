'use client';

import { Fragment } from 'react';

/**
 * Vykreslí **tučný** inline markdown v krátkých odstavcích.
 *
 * Texty vánoční edice žijí v `data/christmasProducts.ts` jako prostý string
 * s hvězdičkami — kdyby se zvýrazňování řešilo zvlášť v každé komponentě,
 * rozejdou se pravidla i vzhled.
 */
export default function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="text-white font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
