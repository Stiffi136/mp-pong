import * as esbuild from "esbuild";
import { cpSync, readFileSync } from "node:fs";

// Load .env file if present
try {
  const envFile = readFileSync(".env", "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) { continue; }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) { continue; }
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) { process.env[key] = val; }
  }
} catch { /* no .env file */ }

const wsUrl = process.env.WS_URL || "ws://localhost:8080";
const watch = process.argv.includes("--watch");

/** @type {esbuild.BuildOptions} */
const opts = {
  entryPoints: ["src/client/main.ts"],
  bundle: true,
  outfile: "dist/client/main.js",
  format: "iife",
  target: "es2022",
  define: {
    __WS_URL__: JSON.stringify(wsUrl),
  },
  minify: !watch,
  sourcemap: true,
};

// Copy index.html to dist/client/
cpSync("src/client/index.html", "dist/client/index.html");

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build(opts);
  console.log("Client built successfully.");
}
