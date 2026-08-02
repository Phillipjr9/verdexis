const { execSync } = require('child_process');
const path = require('path');

const cwd = path.resolve(__dirname, '..');

const run = (command) => {
  console.log(`Running: ${command}`);
  return execSync(command, { stdio: 'pipe', cwd }).toString();
};

try {
  console.log('Checking for failed Prisma migrations...');
  const statusOutput = run('npx prisma migrate status --schema prisma/schema.prisma');
  const failedMigrations = [...statusOutput.matchAll(/The `([^`]+)` migration [^\n]* failed/gi)]
    .map((match) => match[1]);

  if (failedMigrations.length === 0) {
    console.log('No failed migrations detected.');
    process.exit(0);
  }

  for (const migrationName of [...new Set(failedMigrations)]) {
    console.log(`Resolving failed migration: ${migrationName}`);
    run(`npx prisma migrate resolve --rolled-back ${migrationName}`);
  }

  console.log('Failed migrations resolved successfully.');
  process.exit(0);
} catch (error) {
  console.error('Failed to resolve migration:', error.message);
  process.exit(1);
}
