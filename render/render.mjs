// Renders frames of scene/index.html to JPEGs with headless Chrome.
// Works locally and inside GitHub Actions. Shardable: --start/--end frame indices.
//
//   node render/render.mjs --start 0 --end 71 --out frames
//   node render/render.mjs --probe 2,20,40,55 --out .probe
//
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

const FPS = Number(arg('fps', 24));
const OUT = path.resolve(ROOT, arg('out', 'frames'));
const START = Number(arg('start', 0));
const END = Number(arg('end', -1));
const PROBE = arg('probe', null);
const CHROME = arg('chrome', process.env.CHROME_PATH || undefined);

fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript',
  '.json':'application/json', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? '/scene/index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){
    res.writeHead(404); return res.end('nf');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await puppeteer.launch({
  headless: true,
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu-sandbox',
         '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--hide-scrollbars', '--force-color-profile=srgb'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[page error]', e.message));
  await page.goto(`http://127.0.0.1:${port}/scene/index.html`, { waitUntil: 'load' });
  await page.waitForFunction('window.__READY === true', { timeout: 60000 });

  const meta = await page.evaluate(() => window.META);
  const total = Math.round(meta.DUR * meta.FPS);

  const times = PROBE
    ? PROBE.split(',').map(Number)
    : Array.from({ length: (END < 0 ? total - 1 : END) - START + 1 }, (_, k) => START + k);

  const t0 = Date.now();
  for (let k = 0; k < times.length; k++){
    const frame = PROBE ? k : times[k];
    const dataUrl = await page.evaluate(t => window.renderAt(t), times[k] / (PROBE ? 1 : FPS));
    const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    fs.writeFileSync(path.join(OUT, `f_${String(frame).padStart(5, '0')}.jpg`), buf);
    if (k % 20 === 0){
      const fps = (k + 1) / ((Date.now() - t0) / 1000);
      console.log(`frame ${frame}/${times.length} ${fps.toFixed(2)} fps`);
    }
  }
  const dt = (Date.now() - t0) / 1000;
  console.log(`done ${times.length} frames in ${dt.toFixed(1)}s (${(times.length/dt).toFixed(2)} fps) -> ${OUT}`);
} finally {
  await browser.close();
  server.close();
}
