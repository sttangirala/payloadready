// Development launcher: Vite dev server for the renderer + Electron pointed at it.
import { spawn } from 'node:child_process';
import { createServer } from 'vite';

await import('./build-electron.mjs');
const server = await createServer({ configFile: 'vite.config.ts' });
await server.listen();
const url = 'http://localhost:5183';
const electronPath = (await import('electron')).default;
const child = spawn(electronPath, ['.', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, ST_WORK_HUB_DEV_URL: url },
});
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
