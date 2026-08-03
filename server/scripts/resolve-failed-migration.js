import { execSync, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cwd = path.resolve(__dirname, '..');

const run = (command, timeoutMs = 30000) => {
  console.log(`Running: ${command}`);
  try {
    return execSync(command, { 
      stdio: 'pipe', 
      cwd,
      timeout: timeoutMs 
    }).toString();
  } catch (error) {
    if (error.killed) {
      console.warn(`Command timed out after ${timeoutMs}ms`);
      throw error;
    }
    throw error;
  }
};

try {
  console.log('Checking for failed Prisma migrations...');
  const statusOutput = run('npx prisma migrate status --schema prisma/schema.prisma', 40000);
  
  const failedMigrations = [...statusOutput.matchAll(/The `([^`]+)` migration [^\n]* failed/gi)]
    .map((match) => match[1]);

  if (failedMigrations.length === 0) {
    console.log('✓ No failed migrations detected.');
    process.exit(0);
  }

  for (const migrationName of [...new Set(failedMigrations)]) {
    console.log(`Resolving failed migration: ${migrationName}`);
    run(`npx prisma migrate resolve --rolled-back ${migrationName}`, 20000);
  }

  console.log('✓ Failed migrations resolved successfully.');
  process.exit(0);
} catch (error) {
  if (error.code === 'ETIMEDOUT' || error.killed) {
    console.warn('Timeout during migration check - database may be unreachable');
    console.warn('Proceeding with startup (migrations may already be applied)');
    process.exit(0);
  }
  console.error('Failed to resolve migration:', error.message);
  // Don't fail hard - let the app start anyway
  process.exit(0);
}
