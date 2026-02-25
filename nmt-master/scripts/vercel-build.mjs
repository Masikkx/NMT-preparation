import { spawnSync } from 'node:child_process';

const run = (command) => {
  const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

if (process.env.DIRECT_URL) {
  console.log('DIRECT_URL detected. Running prisma migrate deploy...');
  run('npx prisma migrate deploy');
} else {
  console.log('DIRECT_URL is not set. Skipping prisma migrate deploy for this build.');
}

run('npx prisma generate');
run('npx next build');
