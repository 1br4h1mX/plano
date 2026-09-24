import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tomlPath = join(root, "wrangler.toml");

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: root, stdio: "inherit", shell: true, ...opts });

const runCapture = (cmd, args) =>
  execFileSync(cmd, args, { cwd: root, shell: true, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

const toml = readFileSync(tomlPath, "utf8");
const nameMatch = toml.match(/\bname\s*=\s*"([^"]+)"/) || toml.match(/\bname\s*=\s*'([^']+)'/);
const dbMatch = toml.match(/database_name\s*=\s*"?([A-Za-z0-9_-]+)"?/);
const idMatch = toml.match(/database_id\s*=\s*"([^"]+)"/);
if (!nameMatch || !dbMatch || !idMatch) {
  console.error("Could not read project name / D1 binding from wrangler.toml.");
  process.exit(1);
}
const project = nameMatch[1];
const dbName = dbMatch[1];
const placeholder = idMatch[1];

const hasZeroId = /^0{8}(-0{4}){3}-0{12}$/.test(placeholder);

try {
  const who = runCapture("npx", ["wrangler", "whoami"]);
  if (/not authenticated/i.test(who)) throw new Error("not authenticated");
  console.log(`✓ Authenticated to Cloudflare (project "${project}", database "${dbName}")`);
} catch {
  console.error("✗ Not authenticated. Please run once:  npx wrangler login");
  process.exit(1);
}

let databaseId = placeholder;
try {
  const info = JSON.parse(runCapture("npx", ["wrangler", "d1", "info", dbName, "--json"]));
  databaseId = info?.result?.database_id || info?.database_id || "";
  if (!databaseId) throw new Error("no id");
  console.log(`✓ D1 database "${dbName}" already exists (${databaseId})`);
} catch {
  if (!hasZeroId) {
    console.error(`✗ D1 database "${dbName}" not found, but wrangler.toml holds a custom id — check the id.`);
    process.exit(1);
  }
  console.log(`→ Creating D1 database "${dbName}"…`);
  run("npx", ["wrangler", "d1", "create", dbName]);
  const info = JSON.parse(runCapture("npx", ["wrangler", "d1", "info", dbName, "--json"]));
  databaseId = info?.result?.database_id || info?.database_id || "";
  if (!databaseId) throw new Error("create returned no id");
}
if (!/^[0-9a-f-]{36}$/i.test(databaseId)) {
  console.error(`✗ Unrecognized database_id returned: "${databaseId}"`);
  process.exit(1);
}

if (databaseId !== placeholder) {
  writeFileSync(tomlPath, toml.replace(idMatch[0], `database_id = "${databaseId}"`));
  console.log(`✓ Pinned database_id in wrangler.toml`);
}

run("npx", ["wrangler", "d1", "migrations", "apply", dbName, "--remote"]);
run("npm", ["run", "build"]);

try {
  run("npx", ["wrangler", "pages", "project", "create", project, "--production-branch", "main"]);
} catch {
  console.log(`→ Pages project "${project}" already exists, deploying to it.`);
}
run("npx", ["wrangler", "deploy"]);

console.log(`\nLive: https://${project}.pages.dev`);