import { spawn } from "node:child_process";
const children = [
  spawn(process.execPath, ["server/start.js"], {
    stdio: "inherit",
    env: { ...process.env, SEED_DEMO: "1" },
  }),
  spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", ...process.argv.slice(2)],
    { stdio: "inherit" },
  ),
];
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    for (const child of children) child.kill();
    process.exit();
  });
for (const child of children)
  child.on("exit", (code) => {
    for (const other of children) if (other !== child) other.kill();
    process.exit(code || 0);
  });
