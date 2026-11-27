const { spawnSync } = require("node:child_process");
require("dotenv").config();

if (process.env.NODE_ENV === "production") {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, "run", "migrate"], {
    stdio: "inherit",
  });
  if (result.error) {
    console.error("Could not run database migrations before startup:", result.error.message);
  }
  process.exitCode = result.status === null ? 1 : result.status;
}
