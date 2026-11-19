import type { createGame } from '../src/app/createGame.ts';

declare global {
  interface Window {
    gameApp: ReturnType<typeof createGame>;
  }
}

export {};
