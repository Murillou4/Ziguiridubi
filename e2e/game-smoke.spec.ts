import { expect, test } from '@playwright/test';

test('inicializa o mundo, inicia a jornada e aceita controles de teclado e mouse', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Fluxo de mouse/desktop.');

  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ziguiridubi' })).toBeVisible();
  await expect(page.locator('#gameCanvas')).toBeVisible();
  expect(await page.locator('#gameCanvas').evaluate(canvas => {
    const element = canvas as HTMLCanvasElement;
    return element.width > 0 && element.height > 0 && Boolean(element.getContext('2d'));
  })).toBe(true);

  await page.screenshot({
    path: testInfo.outputPath('title-screen-desktop.png'),
    fullPage: true
  });

  await page.locator('#btnStartGame').click();
  await expect(page.locator('#titleScreen')).toBeHidden({ timeout: 2_000 });
  await expect(page.locator('#hudLayer')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.gameApp?.isPlaying ?? false)).toBe(true);

  const initialX = await page.evaluate(() => window.gameApp.player.x);
  await page.keyboard.down('d');
  await page.waitForTimeout(260);
  await page.keyboard.up('d');
  await expect.poll(() => page.evaluate(() => window.gameApp.player.x)).toBeGreaterThan(initialX);

  await page.keyboard.press('1');
  await expect(page.locator('#modalMerchant')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#modalMerchant')).toBeHidden();

  const canvasBounds = await page.locator('#gameCanvas').boundingBox();
  expect(canvasBounds).not.toBeNull();
  const target = await page.evaluate(() => {
    const { player, services } = window.gameApp;
    const { camera, width, height } = services.renderer;
    return services.worldSystem.nodes
      .filter(node => node.islandId === 'hub' && Math.hypot(node.x - player.x, node.y - player.y) > 220)
      .map(node => ({
        id: node.id,
        x: width / 2 + (node.x - camera.x) * camera.zoom,
        y: height / 2 + (node.y - camera.y) * camera.zoom
      }))
      .find(point => point.x > 180 && point.x < width - 180 && point.y > 140 && point.y < height - 140);
  });
  expect(target).toBeDefined();
  await page.mouse.click(canvasBounds!.x + target!.x, canvasBounds!.y + target!.y);
  await expect.poll(() => page.evaluate(() => window.gameApp.player.moveTarget?.autoHitNode?.id)).toBe(target!.id);

  await page.screenshot({
    path: testInfo.outputPath('gameplay-desktop.png'),
    fullPage: true
  });

  expect(pageErrors).toEqual([]);
});

test('troca de painel pela barra de atalhos com outro painel aberto', async ({ page, isMobile }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#btnStartGame').click();
  await expect(page.locator('#titleScreen')).toBeHidden();

  const dock = page.locator('#hudDock');
  const dockBefore = await dock.boundingBox();
  expect(dockBefore).not.toBeNull();

  for (const modalId of ['modalMerchant', 'modalWorkshop', 'modalProjects', 'modalTransfer', 'modalMerchant']) {
    const button = dock.locator(`[aria-controls="${modalId}"]`);
    if (isMobile) await button.tap();
    else await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(dock.locator('[aria-expanded="true"]')).toHaveCount(1);
    await expect(page.locator('[data-modal-backdrop]:visible')).toHaveCount(1);
    const panel = page.locator(`#${modalId} > .vale-panel`);
    await expect(panel).toBeVisible();
    const panelBounds = await panel.boundingBox();
    expect(panelBounds!.y + panelBounds!.height).toBeLessThan(dockBefore!.y);
    expect(await dock.boundingBox()).toEqual(dockBefore);
  }

  const merchant = dock.locator('#btnOpenMerchant');
  await expect(page.locator('#modalMerchant [data-close-modal]')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dock.locator('#btnOpenTransfer')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#modalMerchant')).toBeHidden();
  await expect(merchant).toBeFocused();
  await expect(merchant).toHaveAttribute('aria-expanded', 'false');
});

test('exibe os controles touch e processa toque em golpear, dash e joystick', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'Fluxo de controles touch/mobile.');

  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#btnStartGame')).toBeVisible();
  await page.locator('#btnStartGame').tap();
  await expect(page.locator('#titleScreen')).toBeHidden({ timeout: 2_000 });
  await expect(page.locator('#touchControls')).toBeVisible();

  const topHudBounds = await page.locator('#hudLayer > div').first().evaluate(row => {
    const childBounds = Array.from(row.children).map(child => child.getBoundingClientRect());
    return {
      maxRight: Math.max(...childBounds.map(rect => rect.right)),
      viewportWidth: window.innerWidth
    };
  });
  expect(topHudBounds.maxRight).toBeLessThanOrEqual(topHudBounds.viewportWidth + 1);

  await page.locator('#touchBtnHit').tap();
  await expect.poll(() => page.evaluate(() => window.gameApp.player.swingTimer)).toBeGreaterThan(0);

  await page.locator('#touchBtnDash').tap();
  await expect.poll(() => page.evaluate(() => window.gameApp.player.dashTimer)).toBeGreaterThan(0);

  const joystick = page.locator('#touchJoystickZone');
  await joystick.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const start = new Touch({
      identifier: 71,
      target: element,
      clientX: centerX,
      clientY: centerY
    });
    const move = new Touch({
      identifier: 71,
      target: element,
      clientX: centerX + 28,
      clientY: centerY
    });

    element.dispatchEvent(new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [start],
      changedTouches: [start]
    }));
    element.dispatchEvent(new TouchEvent('touchmove', {
      bubbles: true,
      cancelable: true,
      touches: [move],
      changedTouches: [move]
    }));
  });

  await expect.poll(() =>
    page.evaluate(() => window.gameApp.services.input.virtualJoystick.state.active)
  ).toBe(true);
  await expect.poll(() =>
    page.evaluate(() => window.gameApp.services.input.virtualJoystick.state.dx)
  ).toBeGreaterThan(0.5);

  await joystick.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const touch = new Touch({
      identifier: 71,
      target: element,
      clientX: centerX + 28,
      clientY: centerY
    });
    element.dispatchEvent(new TouchEvent('touchend', {
      bubbles: true,
      changedTouches: [touch],
      touches: []
    }));
  });

  await expect.poll(() =>
    page.evaluate(() => window.gameApp.services.input.virtualJoystick.state.active)
  ).toBe(false);

  await page.screenshot({
    path: testInfo.outputPath('gameplay-mobile.png'),
    fullPage: true
  });

  await page.locator('#btnOpenWorkshop').tap();
  await expect(page.locator('#modalWorkshop')).toBeVisible();
  const workshopPanel = await page.locator('#modalWorkshop > .vale-panel').boundingBox();
  const viewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  expect(workshopPanel).not.toBeNull();
  expect(workshopPanel!.x).toBeGreaterThanOrEqual(0);
  expect(workshopPanel!.y).toBeGreaterThanOrEqual(0);
  expect(workshopPanel!.x + workshopPanel!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(workshopPanel!.y + workshopPanel!.height).toBeLessThanOrEqual(viewport.height + 1);

  const upgradeListMetrics = await page.locator('#upgradeList').evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight
  }));
  expect(upgradeListMetrics.clientHeight).toBeGreaterThan(0);
  expect(upgradeListMetrics.scrollWidth).toBeLessThanOrEqual(upgradeListMetrics.clientWidth + 1);

  await page.locator('#modalWorkshop [data-close-modal]').tap();
  await expect(page.locator('#modalWorkshop')).toBeHidden();

  expect(pageErrors).toEqual([]);
});


test('atualiza custos e disponibilidade de upgrades enquanto os drones entregam recursos', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Fluxo de upgrades desktop.');

  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#btnStartGame').click();
  await expect.poll(() => page.evaluate(() => window.gameApp?.isPlaying ?? false)).toBe(true);

  await page.evaluate(() => {
    const app = window.gameApp;
    app.state.upgrades.toolPower = 1;
    app.state.storage.planks = 12;
    app.state.storage.stone = 9;
    app.state.storage.coins = 55;
  });

  await page.locator('#btnOpenWorkshop').click();
  await expect(page.locator('#modalWorkshop')).toBeVisible();

  const stoneCost = page.locator('#upgradeList [data-upgrade-resource][data-resource="stone"]').first();
  const buyUpgrade = page.locator('#upgradeList [data-buy-upg="toolPower"]');
  await expect(stoneCost).toContainText('9/10');
  await expect(buyUpgrade).toBeDisabled();

  // Simula a chegada de um drone minerador ao armazém com uma unidade de pedra.
  await page.evaluate(() => {
    const drones = window.gameApp.services.droneSystem.drones as any[];
    drones.push({
      kind: 'miner',
      x: 95,
      y: -25,
      state: 'return',
      targetNode: null,
      cargo: ['stone'],
      workTimer: 0,
      bobPhase: 0
    });
  });

  await expect.poll(() => page.evaluate(() => window.gameApp.state.storage.stone)).toBe(10);
  await expect(stoneCost).toContainText('10/10', { timeout: 2_000 });
  await expect(buyUpgrade).toBeEnabled();

  // Ao gastar ou perder estoque, o estado visual do botão também precisa acompanhar.
  await page.evaluate(() => { window.gameApp.state.storage.stone = 9; });
  await expect(stoneCost).toContainText('9/10', { timeout: 2_000 });
  await expect(buyUpgrade).toBeDisabled();

  expect(pageErrors).toEqual([]);
});


test('mantém a bancada utilizável em celular compacto, tablet e desktop', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Matriz de tamanhos de viewport.');

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#btnStartGame').click();
  await expect.poll(() => page.evaluate(() => window.gameApp?.isPlaying ?? false)).toBe(true);
  await page.locator('#btnOpenWorkshop').click();
  await expect(page.locator('#modalWorkshop')).toBeVisible();

  const viewports = [
    { width: 320, height: 568 },
    { width: 375, height: 667 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 }
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    const panel = await page.locator('#modalWorkshop > .vale-panel').boundingBox();
    const list = await page.locator('#upgradeList').evaluate(element => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight
    }));

    expect(panel, `Painel ausente em ${viewport.width}x${viewport.height}`).not.toBeNull();
    expect(panel!.x, `Painel ultrapassou a lateral esquerda em ${viewport.width}px`).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width, `Painel ultrapassou a lateral direita em ${viewport.width}px`).toBeLessThanOrEqual(viewport.width + 1);
    expect(panel!.y, `Painel ultrapassou o topo em ${viewport.height}px`).toBeGreaterThanOrEqual(0);
    expect(panel!.y + panel!.height, `Painel ultrapassou a base em ${viewport.height}px`).toBeLessThanOrEqual(viewport.height + 1);
    expect(list.clientHeight).toBeGreaterThan(0);
    expect(list.scrollWidth, `Conteúdo horizontalmente cortado em ${viewport.width}px`).toBeLessThanOrEqual(list.clientWidth + 1);
  }
});


test('mantém todos os modais dentro da viewport compacta e com conteúdo rolável', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Auditoria de todos os modais em viewport compacta.');

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.locator('#btnStartGame').click();
  await expect.poll(() => page.evaluate(() => window.gameApp?.isPlaying ?? false)).toBe(true);
  await page.setViewportSize({ width: 320, height: 568 });

  const modalIds = [
    'modalMerchant',
    'modalWorkshop',
    'modalProjects',
    'modalAirship',
    'modalTransfer',
    'modalHowToPlay',
    'modalSettings'
  ];

  for (const modalId of modalIds) {
    await page.evaluate(id => {
      const app = window.gameApp;
      app.services.ui.openModal(id, () => app.state, () => app.player, () => app.getStats());
    }, modalId);

    const modal = page.locator(`#${modalId}`);
    await expect(modal).toBeVisible();
    await page.waitForTimeout(220);

    const panel = await modal.locator(':scope > .vale-panel').boundingBox();
    expect(panel, `${modalId}: painel ausente`).not.toBeNull();
    expect(panel!.x, `${modalId}: excedeu a margem esquerda`).toBeGreaterThanOrEqual(0);
    expect(panel!.y, `${modalId}: excedeu a margem superior`).toBeGreaterThanOrEqual(0);
    expect(panel!.x + panel!.width, `${modalId}: excedeu a margem direita`).toBeLessThanOrEqual(321);
    expect(panel!.y + panel!.height, `${modalId}: excedeu a margem inferior`).toBeLessThanOrEqual(569);

    const content = await modal.locator(':scope > .vale-panel > .p-5').first().evaluate(element => ({
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY
    }));
    expect(content.clientHeight, `${modalId}: área de conteúdo sem altura útil`).toBeGreaterThan(0);
    expect(content.overflowY, `${modalId}: conteúdo sem rolagem`).toMatch(/auto|scroll/);

    await page.evaluate(() => window.gameApp.services.ui.closeAllModals());
  }
});
