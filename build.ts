import { watch } from "fs";
import { cp, mkdir, rm } from "fs/promises";
import { join } from "path";

const isWatch = process.argv.includes("--watch");
const outdir = "./dist";

async function build() {
  const startTime = performance.now();

  // Clean and create dist directory
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  // Bundle popup and background (ESM)
  const mainResult = await Bun.build({
    entrypoints: ["./src/popup.ts", "./src/background.ts"],
    outdir,
    target: "browser",
    format: "esm",
    minify: !isWatch,
    sourcemap: isWatch ? "inline" : "none",
  });

  // Bundle content script (IIFE for isolated world)
  const contentResult = await Bun.build({
    entrypoints: ["./src/content.ts"],
    outdir,
    target: "browser",
    format: "iife",
    minify: !isWatch,
    sourcemap: isWatch ? "inline" : "none",
  });

  // Bundle injected script (IIFE for main world)
  const injectedResult = await Bun.build({
    entrypoints: ["./src/injected.ts"],
    outdir,
    target: "browser",
    format: "iife",
    minify: !isWatch,
    sourcemap: isWatch ? "inline" : "none",
  });

  const allLogs = [...mainResult.logs, ...contentResult.logs, ...injectedResult.logs];
  if (!mainResult.success || !contentResult.success || !injectedResult.success) {
    console.error("Build failed:");
    for (const log of allLogs) {
      console.error(log);
    }
    process.exit(1);
  }

  // Copy static files
  await cp("./src/popup.html", join(outdir, "popup.html"));
  await cp("./src/popup.css", join(outdir, "popup.css"));
  await cp("./manifest.json", join(outdir, "manifest.json"));

  // Copy assets
  await mkdir(join(outdir, "assets"), { recursive: true });
  await cp("./assets/icon.png", join(outdir, "assets/icon.png"));
  await cp("./assets/logo.png", join(outdir, "assets/logo.png"));

  const elapsed = (performance.now() - startTime).toFixed(2);
  console.log(`Build completed in ${elapsed}ms`);
}

// Initial build
await build();

if (isWatch) {
  console.log("Watching for changes...");

  const dirsToWatch = ["./src", "./assets"];

  for (const dir of dirsToWatch) {
    watch(dir, { recursive: true }, async (event, filename) => {
      if (filename) {
        console.log(`\nFile changed: ${filename}`);
        await build();
      }
    });
  }

  // Watch manifest.json
  watch("./manifest.json", async () => {
    console.log("\nmanifest.json changed");
    await build();
  });

  // Keep the process running
  process.on("SIGINT", () => {
    console.log("\nStopping watch mode...");
    process.exit(0);
  });

  await new Promise(() => {}); // Keep alive
}
