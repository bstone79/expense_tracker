import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = process.cwd();
const envCandidates = [
  path.join(projectRoot, ".env.local"),
  path.join(projectRoot, "src", ".env.local"),
];

function parseEnvFile(contents) {
  const result = {};
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key) {
      result[key] = value;
    }
  }
  return result;
}

const envPath = envCandidates.find((candidate) => existsSync(candidate));
if (!envPath) {
  // eslint-disable-next-line no-console
  console.error("Missing .env.local. Create one at project root or src/.env.local.");
  process.exit(1);
}

const parsedEnv = parseEnvFile(readFileSync(envPath, "utf8"));
const child = spawn("node", ["backend/server.js"], {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    ...parsedEnv,
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
