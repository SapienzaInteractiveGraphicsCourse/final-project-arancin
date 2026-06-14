import { spawn } from "node:child_process";
import { chromium } from "playwright-core";

const HOST = "127.0.0.1";
const PORT = "4177";
const BASE_URL = `http://${HOST}:${PORT}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(process, timeoutMs = 12000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (process.exitCode !== null) {
      throw new Error(`Dev server exited early with code ${process.exitCode}`);
    }

    try {
      const response = await fetch(BASE_URL);
      if (response.ok) {
        return;
      }
    } catch {
      await wait(250);
    }
  }

  throw new Error(`Timed out waiting for ${BASE_URL}`);
}

function startServer() {
  const child = spawn(
    "bun",
    ["x", "vite", "--host", HOST, "--port", PORT, "--strictPort"],
    {
      stdio: "pipe",
      env: {
        ...process.env,
        BROWSER: "none"
      }
    }
  );

  child.stdout.on("data", (data) => {
    process.stdout.write(data);
  });
  child.stderr.on("data", (data) => {
    process.stderr.write(data);
  });

  return child;
}

async function runVerification() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? "/usr/bin/chromium"
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 }
  });
  const pageErrors = [];
  const consoleErrors = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(BASE_URL, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: /Tropical Beach/i }).click();
  await page.getByRole("button", { name: /^Next$/i }).click();
  await page.getByRole("button", { name: /Silvia/i }).click();
  await page.getByRole("button", { name: /^Next$/i }).click();
  await page.getByRole("button", { name: /Time Trial/i }).click();
  await page.getByRole("button", { name: /^Start$/i }).click();

  const rendererCanvas = page.locator("canvas").first();
  await rendererCanvas.waitFor({ state: "visible" });
  await page.locator(".pre-race-color-picker").waitFor({ state: "visible" });
  await page.keyboard.press("KeyR");
  await page.waitForTimeout(150);
  if (await page.locator(".race-overlay").isVisible()) {
    throw new Error("Restart key started countdown before color confirmation");
  }
  await page.getByRole("button", { name: /Electric Blue/i }).click();
  await page.getByRole("button", { name: /Start Race/i }).click();
  await page.locator(".race-overlay").waitFor({ state: "visible" });
  const countdownText = await page.locator(".race-overlay").textContent();
  const raceHud = await page.locator(".race-hud").textContent();
  const canvasBox = await rendererCanvas.boundingBox();
  const minimapBox = await page.locator(".race-minimap").boundingBox();
  const minimapHasPixels = await page.locator(".race-minimap").evaluate((canvas) => {
    const context = canvas.getContext("2d");
    const sample = context.getImageData(
      Math.floor(canvas.width * 0.5),
      Math.floor(canvas.height * 0.5),
      1,
      1
    ).data;

    return sample[3] > 0;
  });
  const setupVisible = await page.locator(".setup-menu").isVisible();

  await page.locator(".race-overlay").waitFor({ state: "hidden", timeout: 25000 });

  if (setupVisible) {
    throw new Error("Setup menu is still visible after Start");
  }

  if (!raceHud?.includes("Solo") || !raceHud.includes("Lap 1/1")) {
    throw new Error(`Race HUD does not include expected Time Trial state: ${raceHud}`);
  }

  for (const field of ["speed", "checkpoint", "track", "position", "gap"]) {
    const fieldCount = await page.locator(`[data-hud-field="${field}"]`).count();
    if (fieldCount !== 1) {
      throw new Error(`Race HUD is missing stable ${field} field`);
    }
  }

  if (!/^(Ready\?|[123]|GO!)$/.test(countdownText ?? "")) {
    throw new Error(`Countdown overlay did not show expected value: ${countdownText}`);
  }

  await page.keyboard.press("Escape");
  await page.locator(".pause-menu").waitFor({ state: "visible" });
  await page.getByRole("button", { name: /Main Menu/i }).click();
  await page.locator(".setup-menu").waitFor({ state: "visible" });
  const canvasCountAfterExit = await page.locator("canvas").count();

  if (canvasCountAfterExit !== 0) {
    throw new Error(`Canvas was not disposed after returning to setup: ${canvasCountAfterExit}`);
  }

  await page.getByRole("button", { name: /Race/i }).click();
  await page.getByRole("button", { name: /^Start$/i }).click();
  await page.locator("canvas").first().waitFor({ state: "visible" });
  await page.getByRole("button", { name: /Start Race/i }).click();
  await page.locator(".race-overlay").waitFor({ state: "visible" });
  const raceModeHud = await page.locator(".race-hud").textContent();

  if (!raceModeHud?.includes("Pos 1/2") || !raceModeHud.includes("Lap 1/3")) {
    throw new Error(`Race HUD does not include expected race state: ${raceModeHud}`);
  }

  if (!canvasBox || canvasBox.width < 300 || canvasBox.height < 200) {
    throw new Error(`Canvas did not render at expected size: ${JSON.stringify(canvasBox)}`);
  }

  if (!minimapBox || minimapBox.width < 100 || minimapBox.height < 100 || !minimapHasPixels) {
    throw new Error(`Minimap did not render at expected size: ${JSON.stringify(minimapBox)}`);
  }

  if (pageErrors.length > 0 || consoleErrors.length > 0) {
    throw new Error(
      `Browser errors detected:\n${[...pageErrors, ...consoleErrors].join("\n")}`
    );
  }

  await verifyTrackPreview(page, /Vegas Neon/i);
  await verifyTrackPreview(page, /Monaco Formula 1/i);

  await browser.close();

  console.log("Scene verification passed.");
}

async function verifyTrackPreview(page, trackNamePattern) {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: trackNamePattern }).click();
  await page.getByRole("button", { name: /^Next$/i }).click();
  await page.getByRole("button", { name: /^Next$/i }).click();
  await page.getByRole("button", { name: /^Start$/i }).click();

  const rendererCanvas = page.locator("canvas").first();
  await rendererCanvas.waitFor({ state: "visible", timeout: 25000 });
  await page.locator(".pre-race-color-picker").waitFor({ state: "visible", timeout: 25000 });

  const canvasBox = await rendererCanvas.boundingBox();
  if (!canvasBox || canvasBox.width < 300 || canvasBox.height < 200) {
    throw new Error(`Track preview canvas did not render at expected size: ${JSON.stringify(canvasBox)}`);
  }
}

const server = startServer();

try {
  await waitForServer(server);
  await runVerification();
} finally {
  server.kill("SIGTERM");
}
