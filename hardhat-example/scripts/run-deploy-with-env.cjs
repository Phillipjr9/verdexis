const fs = require("fs");
const cp = require("child_process");
const path = require("path");

const env = { ...process.env };
const envPath = path.resolve(__dirname, "..", ".env");
const text = fs.readFileSync(envPath, "utf8");
for (const line of text.split(/\r?\n/)) {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
}

const key = env.MAINNET_PRIVATE_KEY || "";
const url = env.MAINNET_RPC_URL || "";
const normalized = key.startsWith("0x") ? key.slice(2) : key;
if (!(key.startsWith("0x") && /^[0-9a-fA-F]+$/.test(normalized) && normalized.length === 64)) {
  console.error("INVALID_KEY");
  process.exit(2);
}
if (!/^https?:\/\//.test(url)) {
  console.error("INVALID_URL");
  process.exit(3);
}

const result = cp.spawnSync("npx hardhat run scripts/deploy-my-token.ts --network mainnet", {
  shell: true,
  stdio: "inherit",
  env,
  cwd: path.resolve(__dirname, ".."),
});
if (result.error) {
  console.error(result.error);
  process.exit(1);
}
process.exit(result.status);
