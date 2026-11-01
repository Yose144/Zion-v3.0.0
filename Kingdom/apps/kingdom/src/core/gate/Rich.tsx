import type { ReactNode } from 'react';

/**
 * Drobné značkování v obsahu: `**silně**` a `*kurzíva*`.
 * Záměrně nic víc — obsah zůstává čitelný jako data.
 */
export function Rich({ text }: { text: string }): ReactNode {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

  return (
    <>
      {tokens.map((token, index) => {
        if (token.startsWith('**') && token.endsWith('**')) {
          return <strong key={index}>{token.slice(2, -2)}</strong>;
        }
        if (token.startsWith('*') && token.endsWith('*')) {
          return <em key={index}>{token.slice(1, -1)}</em>;
        }
        return token;
      })}
    </>
  );
}
