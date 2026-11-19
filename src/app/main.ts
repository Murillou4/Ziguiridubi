import { createGame } from './createGame.ts';

declare global {
  interface Window {
    gameApp: ReturnType<typeof createGame>;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = createGame('gameCanvas');
  app.init();
  window.gameApp = app;
});
