// Exploration probe: push the game to its limits and log issues.
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fileUrl = 'file://' + path.resolve(__dirname, 'index.html');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => {
  if (m.type() !== 'error') return;
  // headless-swiftshader flake: empty-log program validation error from the software GL stack
  if (m.text().includes('VALIDATE_STATUS false')) return;
  errors.push('console: ' + m.text());
});

await page.goto(fileUrl);
await page.waitForFunction(() => !!window.__GAME__);
await page.waitForTimeout(500);

// Issue 1: World edge.
await page.evaluate(() => {
  const g = window.__GAME__;
  g.state.pos.set(4900, 60, 0);
  g.state.vel.set(200, 0, 0);
  g.state.throttle = 1;
});
await page.waitForTimeout(2000);
console.log('EDGE STATE:', JSON.stringify(await page.evaluate(() => {
  const g = window.__GAME__;
  return { pos: g.state.pos.toArray(), msg: document.getElementById('msg').textContent };
})));

// Issue 2: Pick an existing enemy, park it ahead, hover, fire, time the hit.
await page.evaluate(() => window.__GAME__.restart());
await page.waitForTimeout(300);
// keep first enemy, drop the rest
await page.evaluate(() => {
  const g = window.__GAME__;
  for (let i = g.enemies.length - 1; i > 0; i--) { g.scene.remove(g.enemies[i].group); g.enemies.splice(i, 1); }
  // park the enemy at fixed spot, ship facing it (-z), hovering at zero throttle
  g.enemies[0].group.position.set(0, 60, -120);
  g.enemies[0].hp = 9999;
  g.state.pos.set(0, 60, 0);
  g.state.vel.set(0, 0, 0);
  g.state.throttle = 0;
  g.state.quat.identity(); // facing -z
  g.input.steer.x = 0; g.input.steer.y = 0;
});
await page.evaluate(() => { window.__GAME__.state.weapon = 'laser'; window.__GAME__.state.fireRate = 0.05; });
await page.mouse.move(640, 400);
await page.mouse.down({ button: 'left' });
await page.waitForTimeout(2500);
console.log('LASER vs 120u ENEMY:', JSON.stringify(await page.evaluate(() => {
  const g = window.__GAME__;
  return { enemyHp: g.enemies[0]?.hp, bullets: g.bullets.length, fireRate: g.state.fireRate };
})));
await page.mouse.up({ button: 'left' });

// Issue 3: Altitude ceiling — nose up hard, full throttle, must clamp at 800
await page.evaluate(() => {
  const g = window.__GAME__;
  g.state.pos.set(0, 700, 0);
  g.state.vel.set(0, 0, 0);
  g.state.throttle = 1;
  g.input.steer.x = 0; g.input.steer.y = 0;
  g.state.quat.setFromAxisAngle(new g.THREE.Vector3(1, 0, 0), 1.3); // nose up ~74°
});
await page.waitForTimeout(3000);
console.log('ALTITUDE LIMIT:', JSON.stringify(await page.evaluate(() => ({ y: window.__GAME__.state.pos.y, velY: window.__GAME__.state.vel.y }))));

// Issue 4: Power-up pickup range — restart, log first power location
await page.evaluate(() => window.__GAME__.restart());
await page.waitForTimeout(200);
const powerInfo = await page.evaluate(() => {
  const g = window.__GAME__;
  if (!g.powers.length) return null;
  const p = g.powers[0];
  return { kind: p.kind, pos: p.group.position.toArray() };
});
console.log('FIRST POWER UP:', JSON.stringify(powerInfo));

// Issue 5: Screenshots — level cruise, steep climb, world edge
await page.evaluate(() => window.__GAME__.restart());
await page.waitForTimeout(500);
await page.mouse.move(640, 400);
await page.keyboard.down('KeyW'); await page.waitForTimeout(3000); await page.keyboard.up('KeyW');
await page.screenshot({ path: path.join(__dirname, 'probe_flying.png') });

// steep climb shot (contrails + attitude should be visible)
await page.evaluate(() => {
  const g = window.__GAME__;
  g.input.steer.x = 0; g.input.steer.y = 0;
  g.state.throttle = 1;
  g.state.quat.setFromAxisAngle(new g.THREE.Vector3(1, 0, 0), 0.5);
});
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(__dirname, 'probe_climb.png') });

await page.evaluate(() => {
  const g = window.__GAME__;
  g.state.pos.set(4800, 60, 4800);
  g.state.vel.set(0, 0, 0);
  g.state.quat.identity();
});
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(__dirname, 'probe_edge.png') });

if (errors.length) console.log('ERRORS:', errors);
await browser.close();
