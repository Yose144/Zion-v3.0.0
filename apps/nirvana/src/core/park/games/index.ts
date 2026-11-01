import { createBreakout } from './breakout';
import { createPong } from './pong';
import { createSnake } from './snake';
import { createTetris } from './tetris';
import type { CanvasGameId, ParkGameDefinition } from './types';

export const PARK_GAMES: ParkGameDefinition[] = [
  {
    id: 'pong',
    title: { cs: 'Pong', en: 'Pong' },
    hint: {
      cs: 'Pohyblivý pruh dole · hraj na 7 bodů · myš, šipky nebo paprsek ve VR',
      en: 'Paddle at the bottom · first to 7 · mouse, arrows or the VR ray',
    },
    create: createPong,
  },
  {
    id: 'breakout',
    title: { cs: 'Breakout', en: 'Breakout' },
    hint: {
      cs: 'Rozbij zeď · tři životy · myš, šipky nebo paprsek ve VR',
      en: 'Break the wall · three lives · mouse, arrows or the VR ray',
    },
    create: createBreakout,
  },
  {
    id: 'tetris',
    title: { cs: 'Tetris', en: 'Tetris' },
    hint: {
      cs: 'Skládej řádky · ← → posun, ↑ otočit, mezerník hodit · 100 za řádek',
      en: 'Clear lines · ← → move, ↑ rotate, space drop · 100 per line',
    },
    create: createTetris,
  },
  {
    id: 'snake',
    title: { cs: 'Snake', en: 'Snake' },
    hint: {
      cs: 'Šipky nebo WASD · jablko za 25 · do zdi ani do sebe nejezdi',
      en: 'Arrows or WASD · apple is 25 · do not hit the wall or yourself',
    },
    create: createSnake,
  },
];

export function gameById(id: CanvasGameId): ParkGameDefinition {
  return PARK_GAMES.find((game) => game.id === id) ?? PARK_GAMES[0]!;
}

export type { CanvasGameId, ParkGameDefinition, ParkGameHandle, ParkGameId } from './types';
