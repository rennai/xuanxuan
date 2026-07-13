// 截图脚本：用 puppeteer-core + 已装的 Chrome for Testing 连 Vite dev server，
// 截登录界面 + 主界面（连 mock server 登录后）两张图，存到 doc/upgrade/screenshots/。
// 用法：先启动 `pnpm dev` 和 `pnpm mock`，再 `node mock-server/screenshot.mjs`
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// mock-server/ 在 xxc/ 下，doc/upgrade/screenshots/ 在仓库根
const SHOTS_DIR = path.resolve(__dirname, '../../doc/upgrade/screenshots');
const DEV_URL = 'http://127.0.0.1:5173/';

// agent-browser 已下载的 Chrome for Testing
const CHROME_PATH = '/Users/pangbin/.agent-browser/browsers/chrome-148.0.7778.97/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME_PATH,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({width: 1280, height: 800});

  // --- 登录界面截图 ---
  await page.goto(DEV_URL, {waitUntil: 'networkidle0', timeout: 30000});
  await sleep(3000);
  // 清 storage 确保在登录界面
  await page.evaluate(() => { try{localStorage.clear();sessionStorage.clear();}catch(e){} });
  await page.goto(DEV_URL, {waitUntil: 'networkidle0'});
  await sleep(3000);
  await page.screenshot({path: path.join(SHOTS_DIR, '01-login.png'), fullPage: false});
  console.log('[shot] saved 01-login.png');

  // --- 主界面截图（连 mock server 登录） ---
  // 填登录表单
  const serverInput = await page.$('input[type=text], input:not([type])');
  // 找服务器/账号/密码三个输入框
  const inputs = await page.$$('input');
  console.log('[shot] found inputs:', inputs.length);
  // 按 placeholder 顺序填：服务器、账号、密码
  for (const inp of inputs) {
    const ph = await page.evaluate(el => el.placeholder, inp);
    const type = await page.evaluate(el => el.type, inp);
    console.log('[shot] input placeholder:', ph, 'type:', type);
  }
  // 用 placeholder 定位
  const serverField = await page.$('input[placeholder]') ? (await page.$$('input[placeholder]'))[0] : null;
  const fields = await page.$$('input[type=text], input:not([type])[placeholder]');
  if (fields.length >= 3) {
    await fields[0].type('http://127.0.0.1:11443');
    await fields[1].type('admin');
    const pwd = await page.$('input[type=password]');
    if (pwd) await pwd.type('admin');
  } else {
    // 回退：按顺序填所有 text input
    console.log('[shot] fallback fill');
  }

  await sleep(500);
  // 点登录按钮
  const btns = await page.$$('button');
  for (const b of btns) {
    const txt = await page.evaluate(el => el.textContent.trim(), b);
    if (txt.includes('登') || txt.toLowerCase().includes('login')) {
      await b.click();
      console.log('[shot] clicked login button:', txt);
      break;
    }
  }
  await sleep(6000);
  await page.screenshot({path: path.join(SHOTS_DIR, '02-main.png'), fullPage: false});
  console.log('[shot] saved 02-main.png');

  // 输出主界面状态确认
  const url = page.url();
  const appKids = await page.evaluate(() => document.getElementById('appContainer')?.childElementCount);
  console.log('[shot] final url:', url, 'appContainer children:', appKids);
} finally {
  await browser.close();
}
