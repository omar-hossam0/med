#!/usr/bin/env node
/**
 * Medora — run the backend (Express, :5000) and frontend (Next.js, :3000)
 * together with a single command:
 *
 *   npm run dev
 *
 * No extra dependencies (uses Node's child_process). Stops both processes
 * when either one exits or when you press Ctrl+C.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const backendDir = path.join(root, "Backend");
const isWin = process.platform === "win32";

const procs = [];
let stopping = false;

function start(name, cwd, args) {
  const child = spawn("npm", args, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  procs.push({ name, child });

  child.on("exit", (code) => {
    if (!stopping) {
      console.log(`\n[${name}] stopped (code ${code}). Shutting down the other process...`);
      shutdown();
    }
  });

  return child;
}

function killTree(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  if (isWin) {
    try {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch (_) {}
  } else {
    try {
      child.kill("SIGTERM");
    } catch (_) {}
  }
}

function shutdown() {
  if (stopping) return;
  stopping = true;
  procs.forEach(({ child }) => killTree(child));
  setTimeout(() => process.exit(0), 400);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("\n  Medora — starting backend (:5000) + frontend (:3000)\n");
start("backend", backendDir, ["run", "dev"]);
start("frontend", root, ["run", "dev:frontend"]);
