// Renders site/profile.html (the whole profile as one panel, with the animated 3D hero)
// into site/profile.webp, a seamless loop. Only the hero moves, so the file stays small.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = fileURLToPath(new URL("../site/", import.meta.url));
const FPS = Number(process.env.FPS || 10), SCALE = 1.6;
const TYPES = { ".html": "text/html", ".json": "application/json" };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, "") || "profile.html";
  try { const b = await readFile(join(SITE, p)); res.writeHead(200, { "Content-Type": TYPES[extname(p)] || "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const dir = await mkdtemp(join(tmpdir(), "profile-"));
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: SCALE });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`http://localhost:${server.address().port}/profile.html`);
  await page.waitForFunction(() => window.__b && window.__b.ready, null, { timeout: 30000 });
  const loop = await page.evaluate(() => window.__b.loop), n = Math.round(loop * FPS);
  const height = await page.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
  const shot = (path) => page.screenshot({ path, fullPage: true, clip: { x: 0, y: 0, width: 1000, height } });
  if (process.env.STILL) { await shot(join(SITE, "profile.png")); console.log("still"); }
  else {
    for (let i = 0; i < n; i++) {
      await page.evaluate((t) => window.__b.at(t), i / FPS);
      await shot(join(dir, `f${String(i).padStart(4, "0")}.png`));
    }
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%04d.png"),
      "-c:v", "libwebp_anim", "-loop", "0", "-quality", "86", "-compression_level", "6", join(SITE, "profile.webp")]);
    console.log(`wrote profile.webp (${n} frames)`);
  }
} finally { await browser.close(); server.close(); await rm(dir, { recursive: true, force: true }); }
