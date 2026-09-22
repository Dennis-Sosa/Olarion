import { mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const directory = mkdtempSync(join(process.cwd(), ".runtime-check-"));
let server;
try {
  execFileSync(join(process.cwd(), "node_modules/.bin/tsc"), ["-p", "tsconfig.server.json", "--noEmit", "false", "--outDir", directory], {stdio: "inherit"});
  const {default: app} = await import(pathToFileURL(join(directory, "api/index.js")).href);
  await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/health`);
  const payload = await response.json();
  if (response.status !== 200 || payload.prompt_version !== "audit-2.0.0") throw new Error("Compiled API smoke test failed");
  console.log("Compiled Node ESM entry point and health endpoint passed.");
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(directory, {recursive: true, force: true});
}
