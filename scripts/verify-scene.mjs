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
  await page.getByRole("button", { name: /Silvia/i }).click();
  await page.getByRole("button", { name: /Time Trial/i }).click();
  await page.getByRole("button", { name: /^Start$/i }).click();

  await page.locator("canvas").waitFor({ state: "visible" });
  const countdownText = await page.locator(".race-overlay").textContent();
  const overlay = await page.locator(".status-overlay").textContent();
  const canvasBox = await page.locator("canvas").boundingBox();
  const setupVisible = await page.locator(".setup-menu").isVisible();

  await page.waitForTimeout(3800);
  const countdownHidden = await page.locator(".race-overlay").isHidden();

  if (setupVisible) {
    throw new Error("Setup menu is still visible after Start");
  }

  if (!overlay?.includes("Track: Tropical Beach")) {
    throw new Error(`Unexpected overlay text: ${overlay}`);
  }

  if (!overlay.includes("Vehicle: Silvia") || !overlay.includes("Mode: Time Trial")) {
    throw new Error(`Overlay does not include selected setup: ${overlay}`);
  }

  if (!/^[123]$/.test(countdownText ?? "")) {
    throw new Error(`Countdown overlay did not show expected value: ${countdownText}`);
  }

  if (!countdownHidden) {
    throw new Error("Countdown overlay is still visible after race start");
  }

  await page.keyboard.press("Escape");
  await page.locator(".pause-menu").waitFor({ state: "visible" });
  await page.getByRole("button", { name: /Main Menu/i }).click();
  await page.locator(".setup-menu").waitFor({ state: "visible" });
  const canvasCountAfterExit = await page.locator("canvas").count();

  if (canvasCountAfterExit !== 0) {
    throw new Error(`Canvas was not disposed after returning to setup: ${canvasCountAfterExit}`);
  }

  if (!canvasBox || canvasBox.width < 300 || canvasBox.height < 200) {
    throw new Error(`Canvas did not render at expected size: ${JSON.stringify(canvasBox)}`);
  }

  if (pageErrors.length > 0 || consoleErrors.length > 0) {
    throw new Error(
      `Browser errors detected:\n${[...pageErrors, ...consoleErrors].join("\n")}`
    );
  }

  await browser.close();

  console.log("Scene verification passed.");
}

const server = startServer();

try {
  await waitForServer(server);
  await runVerification();
} finally {
  server.kill("SIGTERM");
}
