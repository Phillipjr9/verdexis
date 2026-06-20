const { execSync } = require('child_process');

try {
  console.log('Marking failed migration as rolled back...');
  execSync('npx prisma migrate resolve --rolled-back 20260120000000_seed_admin_treasury', {
    stdio: 'inherit',
    cwd: __dirname + '/..'
  });
  console.log('Migration resolved successfully');
  process.exit(0);
} catch (error) {
  console.error('Failed to resolve migration:', error.message);
  process.exit(1);
}
