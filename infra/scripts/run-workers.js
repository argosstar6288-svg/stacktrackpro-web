import { spawn } from "node:child_process";

const child = spawn("npm", ["run", "workers", "--workspace", "@stacktrack/backend"], {
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
