import { expect, test } from '@playwright/test';

test('inicializa o mundo, inicia a jornada e aceita controles de teclado e mouse', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#titleScreen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Oficina do Vale' })).toBeVisible();
  await expect(page.locator('#gameCanvas')).toBeVisible();
  expect(await page.locator('#gameCanvas').evaluate(canvas => {
    const element = canvas as HTMLCanvasElement;
    return element.width > 0 && element.height > 0 && Boolean(element.getContext('2d'));
  })).toBe(true);

  await page.screenshot({
    path: testInfo.outputPath('title-screen.png'),
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

  await page.mouse.click(800, 450);
  await expect.poll(() => page.evaluate(() => window.gameApp.player.moveTarget !== null)).toBe(true);

  await page.screenshot({
    path: testInfo.outputPath('gameplay-desktop.png'),
    fullPage: true
  });

  expect(pageErrors).toEqual([]);
});

test('exibe os controles touch e processa toque em golpear, dash e joystick', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#btnStartGame')).toBeVisible();
  await page.locator('#btnStartGame').tap();
  await expect(page.locator('#titleScreen')).toBeHidden({ timeout: 2_000 });
  await expect(page.locator('#touchControls')).toBeVisible();

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
    page.evaluate(() => window.gameApp.input.virtualJoystick.state.active)
  ).toBe(true);
  await expect.poll(() =>
    page.evaluate(() => window.gameApp.input.virtualJoystick.state.dx)
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
    page.evaluate(() => window.gameApp.input.virtualJoystick.state.active)
  ).toBe(false);
  expect(pageErrors).toEqual([]);
});
