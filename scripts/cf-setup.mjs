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

let databaseId = "";
if (!hasZeroId) {
  databaseId = placeholder;
  console.log(`✓ Using configured database_id (${placeholder})`);
} else {
  try {
    const rows = JSON.parse(runCapture("npx", ["wrangler", "d1", "list", "--json"]) || "[]");
    const row = rows.find((r) => r.name === dbName);
    if (row?.uuid) databaseId = row.uuid;
    if (databaseId) console.log(`✓ D1 database "${dbName}" already exists (${databaseId})`);
  } catch {
    /* list not available yet — fall through to create */
  }
}
if (!databaseId) {
  console.log(`→ Creating D1 database "${dbName}"…`);
  const out = runCapture("npx", ["wrangler", "d1", "create", dbName]);
  const m = out.match(/database_id\s*=\s*"([0-9a-f-]{36})"/i);
  databaseId = m ? m[1] : "";
  if (!databaseId) {
    console.error(`✗ Could not parse database_id from "d1 create" output.`);
    process.exit(1);
  }
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
run("npx", ["wrangler", "pages", "deploy", "dist"]);
let host = `${project}.pages.dev`;
try {
  const list = runCapture("npx", ["wrangler", "pages", "deployment", "list", "--project-name", project, "--json"]);
  const subs = [...list.matchAll(/https:\/\/(?:[0-9a-f]{6,}\.)?([a-z0-9-]+\.pages\.dev)/g)].map((m) => m[1]);
  if (subs[0]) host = subs[0];
} catch {
  /* fall back to the plain project name */
}
console.log(`\nLive: https://${host}`);