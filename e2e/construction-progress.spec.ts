import { expect, test, type Page } from '@playwright/test';

async function startAtFixedCamera(page: Page): Promise<void> {
  await page.locator('#btnStartGame').click();
  await page.evaluate(() => {
    const app = window.gameApp;
    app.loop.stop();
    app.clock.setSimulatedHour(12);
    app.services.renderer.camera.recenter(0, 0);
    app.render();
  });
}

async function sampleFrame(page: Page, points: [number, number][]): Promise<number[][]> {
  return page.evaluate(coordinates => {
    const app = window.gameApp;
    const { ctx, width, height, dpr, effectsRenderer } = app.services.renderer;
    effectsRenderer.particles = [];
    effectsRenderer.floatingTexts = [];
    app.render();
    return coordinates.map(([x, y]) => Array.from(
      ctx.getImageData(Math.floor((width / 2 + x) * dpr), Math.floor((height / 2 + y) * dpr), 1, 1).data
    ));
  }, points);
}

test('monta a fornalha em etapas e restaura a obra parcial ao carregar', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'A câmera fixa mantém os pontos de amostragem na tela.');
  await page.goto('/');
  await startAtFixedCamera(page);
  const points: [number, number][] = [[-21, 225], [-16, 218], [2, 187]];
  const empty = await sampleFrame(page, points);

  await page.evaluate(() => {
    const { services, state, player } = window.gameApp;
    state.storage.coins = 12;
    services.buildingSystem.interactWithBlueprint('furnace', state, player);
  });
  expect(await sampleFrame(page, points)).toEqual(empty);
  await page.evaluate(() => { window.gameApp.clock.worldTime += .35; });
  const animating = await sampleFrame(page, points);
  await page.evaluate(() => { window.gameApp.clock.worldTime += .4; });
  const base = await sampleFrame(page, points);
  expect(animating[0]).not.toEqual(empty[0]);
  expect(animating[0]).not.toEqual(base[0]);
  expect(base[0]).not.toEqual(empty[0]);
  expect(base.slice(1)).toEqual(empty.slice(1));

  const built = await page.evaluate(() => {
    const { services, state, player } = window.gameApp;
    Object.assign(state.storage, { stone: 12, planks: 8 });
    return services.buildingSystem.interactWithBlueprint('furnace', state, player).completed;
  });
  expect(built).toBe(false);
  await sampleFrame(page, points);
  await page.evaluate(() => { window.gameApp.clock.worldTime += .75; });
  const walls = await sampleFrame(page, points);
  expect(walls[1]).not.toEqual(empty[1]);
  expect(walls[2]).toEqual(empty[2]);

  await page.reload();
  await expect(page.locator('#btnStartLabel')).toHaveText('Continuar jornada');
  await startAtFixedCamera(page);
  expect((await sampleFrame(page, points))[1]).toEqual(walls[1]);

  const production = await page.evaluate(() => {
    const app = window.gameApp;
    const { services, state, player } = app;
    player.x = 0;
    player.y = 216;
    state.storage.ironOre = 2;
    const tickFurnace = () => {
      services.machineSystem.update(state, player, app.getStats(), .1);
      return state.machines.furnace.progress;
    };
    const before = tickFurnace();
    state.storage.coins = 28;
    const result = services.buildingSystem.interactWithBlueprint('furnace', state, player);
    const after = tickFurnace();
    player.y = 0;
    return { before, completed: result.completed, after };
  });
  expect(production.before).toBe(0);
  expect(production.completed).toBe(true);
  expect(production.after).toBeGreaterThan(0);
  await sampleFrame(page, points);
  await page.evaluate(() => { window.gameApp.clock.worldTime += .75; });
  expect((await sampleFrame(page, points))[2]).not.toEqual(empty[2]);
});

test('estende as tábuas das três pontes a partir da margem acessível', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'A câmera fixa mantém os pontos de amostragem na tela.');
  await page.goto('/');
  await startAtFixedCamera(page);
  const points: [number, number][] = [[495, 0], [-495, 0], [0, -315], [655, 0], [-665, 0], [0, -385]];
  const partialWalkable = await page.evaluate(() => {
    const { services, state, player } = window.gameApp;
    for (const [id, coins] of [['eastBridge', 25], ['westBridge', 200], ['northBridge', 80]] as const) {
      state.storage.coins = coins;
      services.buildingSystem.interactWithBlueprint(id, state, player);
    }
    return services.worldSystem.isPointWalkable(state, 575, 0);
  });
  expect(partialWalkable).toBe(false);
  await sampleFrame(page, points);
  await page.evaluate(() => { window.gameApp.clock.worldTime += .75; });
  const partial = await sampleFrame(page, points);
  expect(partial.slice(0, 3)).toEqual(Array(3).fill([194, 138, 76, 255]));
  for (const pixel of partial.slice(3)) {
    expect(pixel).not.toEqual([194, 138, 76, 255]);
    expect(pixel).not.toEqual([143, 90, 44, 255]);
  }

  const completedWalkable = await page.evaluate(() => {
    const { services, state, player } = window.gameApp;
    Object.assign(state.storage, { coins: 10, stone: 8, planks: 10 });
    services.buildingSystem.interactWithBlueprint('eastBridge', state, player);
    return services.worldSystem.isPointWalkable(state, 575, 0);
  });
  expect(completedWalkable).toBe(true);
  await sampleFrame(page, points);
  await page.evaluate(() => { window.gameApp.clock.worldTime += .75; });
  expect((await sampleFrame(page, points))[3]).toEqual([194, 138, 76, 255]);
});
