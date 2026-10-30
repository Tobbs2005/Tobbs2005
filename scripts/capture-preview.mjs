// Renders site/index.html?preview frame by frame and encodes a seamless looping site/preview.webp.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = fileURLToPath(new URL("../site/", import.meta.url));
const FPS = Number(process.env.FPS || 12), W = 960, H = 540;
const TYPES = { ".html": "text/html", ".json": "application/json", ".webp": "image/webp" };
const PAGES = (process.env.PAGES || "index.html").split(",");

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "");
  if (!p || p.endsWith("/")) p += "index.html";
  try { const b = await readFile(join(SITE, p)); res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });

try {
  for (const pagePath of PAGES) {
    const dir = await mkdtemp(join(tmpdir(), "pv-"));
    const page = await browser.newPage({ viewport: { width: W, height: H } });
    page.on("pageerror", (e) => console.error("page error:", e.message));
    await page.goto(`http://localhost:${port}/${pagePath}?preview`);
    await page.waitForFunction(() => window.__preview && window.__preview.ready, null, { timeout: 30000 });
    const loop = await page.evaluate(() => window.__preview.loop);
    const n = Math.round(loop * FPS);
    for (let i = 0; i < n; i++) {
      if (i) await page.evaluate((dt) => window.__preview.step(dt), 1 / FPS);
      await page.screenshot({ path: join(dir, `f${String(i).padStart(4, "0")}.png`) });
    }
    const out = join(SITE, pagePath.replace(/index\.html$/, ""), "preview.webp");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%04d.png"),
      "-vf", "scale=800:-1:flags=lanczos", "-c:v", "libwebp_anim", "-loop", "0", "-quality", "82",
      "-compression_level", "6", out]);
    console.log(`wrote ${out} (${n} frames)`);
    await page.close(); await rm(dir, { recursive: true, force: true });
  }
} finally {
  await browser.close(); server.close();
}
