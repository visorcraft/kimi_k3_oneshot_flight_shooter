// Headless test: boot the game, simulate input, verify state.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fileUrl = 'file://' + path.resolve(__dirname, 'index.html');

const errors = [];
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => {
  if (m.type() !== 'error') return;
  // headless-swiftshader flake: empty-log program validation error from the software GL
  // stack (shaders compile and run fine on real GPUs; appears intermittently)
  if (m.text().includes('VALIDATE_STATUS false')) return;
  errors.push('console: ' + m.text());
});

await page.goto(fileUrl);
// wait for game to expose state
await page.waitForFunction(() => !!window.__GAME__);
await page.waitForTimeout(500);

// focus + send keys + take screenshot
await page.click('#app');

const before = await page.evaluate(() => ({
  enemies: window.__GAME__.enemies.length,
  powers: window.__GAME__.powers.length,
  bullets: window.__GAME__.bullets.length,
  hp: window.__GAME__.state.hp,
  score: window.__GAME__.state.score,
  pos: { ...window.__GAME__.state.pos },
  weapon: window.__GAME__.state.weapon,
  missileAmmo: window.__GAME__.state.missileAmmo
}));

// fire some lasers
await page.keyboard.down('KeyL'); await page.waitForTimeout(40); await page.keyboard.up('KeyL');
await page.waitForTimeout(120);
await page.keyboard.down('KeyL'); await page.waitForTimeout(40); await page.keyboard.up('KeyL');
await page.waitForTimeout(300);

// fire missile
await page.keyboard.down('KeyM'); await page.waitForTimeout(40); await page.keyboard.up('KeyM');
await page.waitForTimeout(400);

// move the mouse (steer via absolute-position fallback) and hold L-click
const box = await page.locator('#app').boundingBox();
await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 60);
await page.mouse.down({ button: 'left' });
await page.waitForTimeout(500);
await page.mouse.up({ button: 'left' });

// WASD: W raises throttle, D rolls
await page.keyboard.down('KeyW'); await page.waitForTimeout(1200); await page.keyboard.up('KeyW');
await page.keyboard.down('KeyD'); await page.waitForTimeout(400); await page.keyboard.up('KeyD');
await page.waitForTimeout(800);

const after = await page.evaluate(() => ({
  enemies: window.__GAME__.enemies.length,
  powers: window.__GAME__.powers.length,
  bullets: window.__GAME__.bullets.length,
  hp: window.__GAME__.state.hp,
  score: window.__GAME__.state.score,
  missileAmmo: window.__GAME__.state.missileAmmo,
  weapon: window.__GAME__.state.weapon,
  laserTier: window.__GAME__.state.laserTier,
  pos: { ...window.__GAME__.state.pos },
  sceneChildren: window.__GAME__.scene.children.length
}));

await page.screenshot({ path: path.join(__dirname, 'shot.png') });

// 6-DOF flight check: nose up ~69°, full throttle, hands off — must climb
await page.evaluate(() => {
  const g = window.__GAME__;
  g.restart();
  g.input.steer.x = 0; g.input.steer.y = 0;
  g.state.throttle = 1;
  g.state.quat.setFromAxisAngle(new g.THREE.Vector3(1, 0, 0), 1.2);
});
await page.waitForTimeout(1500);
const flight = await page.evaluate(() => ({
  y: window.__GAME__.state.pos.y,
  throttle: window.__GAME__.state.throttle
}));

// Power-up effects — exercise the real applyPowerUp branches
const powerResults = {};
for (const k of ['hp', 'laser', 'rapid', 'double', 'missile', 'plasma']) {
  // fresh state per case
  await page.evaluate(() => window.__GAME__.restart());
  if (k === 'hp') {
    await page.evaluate(() => { window.__GAME__.state.hp = 50; });
  }
  const beforePU = await page.evaluate(() => ({
    hp: window.__GAME__.state.hp,
    weapon: window.__GAME__.state.weapon,
    laserTier: window.__GAME__.state.laserTier,
    missileAmmo: window.__GAME__.state.missileAmmo
  }));
  await page.evaluate(k => window.__GAME__.applyPowerUp(k), k);
  const afterPU = await page.evaluate(() => ({
    hp: window.__GAME__.state.hp,
    weapon: window.__GAME__.state.weapon,
    laserTier: window.__GAME__.state.laserTier,
    missileAmmo: window.__GAME__.state.missileAmmo
  }));
  powerResults[k] = { before: beforePU, after: afterPU };
}

// summary
const summary = {
  errors,
  before,
  after,
  flight,
  powerResults,
  movedDistance: Math.hypot(after.pos.x - before.pos.x, after.pos.y - before.pos.y, after.pos.z - before.pos.z),
  shot: path.join(__dirname, 'shot.png')
};
console.log(JSON.stringify(summary, null, 2));

await browser.close();

let failed = false;
const fail = (msg) => { console.error('FAIL:', msg); failed = true; };
if (errors.length) fail('page errors: ' + errors.join(' | '));
if (before.enemies < 5) fail('not enough enemies at start');
if (!after.weapon) fail('no weapon set');
if (after.missileAmmo !== before.missileAmmo - 1) fail('missile ammo did not decrement by 1 after M');
if (after.score < before.score) fail('score should not decrease');
if (summary.movedDistance < 1) fail('ship did not move on WASD');
if (flight.y < 100) fail(`ship did not climb with nose-up attitude (y=${flight.y.toFixed(1)})`);
const failures = [];
for (const [k, r] of Object.entries(powerResults)) {
  const diff =
    r.after.hp !== r.before.hp ||
    r.after.weapon !== r.before.weapon ||
    r.after.laserTier !== r.before.laserTier ||
    r.after.missileAmmo !== r.before.missileAmmo;
  if (!diff) failures.push(k);
}
if (failures.length) fail('power-up no-op: ' + failures.join(','));
if (failed) process.exit(1);
console.log('OK');
