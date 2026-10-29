import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceNames = ['backend', 'frontend', 'cli'];
const bundle = path.join(root, 'bundle');
const frontend = path.join(root, 'frontend');
const output = path.join(frontend, 'dist', 'snip-frontend', 'browser');
const trailer = 'Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>';

function run(command, args, cwd = root, allowed = [0]) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NG_CLI_ANALYTICS: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) throw result.error;
  if (!allowed.includes(result.status)) {
    throw new Error(`${command} ${args.join(' ')} failed (${result.status}):\n${result.stdout}${result.stderr}`);
  }
  return result;
}

function git(args, cwd = root, allowed = [0]) {
  return run('git', args, cwd, allowed);
}

function npm(args) {
  // npm.cmd requires cmd.exe on Windows; arguments here are fixed, not user input.
  const result = process.platform === 'win32'
    ? run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], frontend)
    : run('npm', args, frontend);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
}

function commitIfChanged(cwd, message) {
  const diff = git(['diff', '--cached', '--quiet'], cwd, [0, 1]);
  if (diff.status === 0) {
    console.log(`${path.basename(cwd)}: unchanged, nothing to commit`);
    return;
  }
  console.log(git(['commit', '-m', message, '-m', trailer], cwd).stdout.trim());
}

function build() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--push')) {
    throw new Error('Usage: node scripts/build-bundle.mjs [--push]');
  }
  if (git(['branch', '--show-current']).stdout.trim() !== 'main') {
    throw new Error('Run this script from a main branch checkout');
  }
  if (git(['diff', '--cached', '--name-only']).stdout.trim()) {
    throw new Error('Commit or unstage existing staged changes before building');
  }
  const mainChanges = git(['status', '--porcelain', '--ignore-submodules=all']).stdout.trim();
  if (mainChanges) throw new Error(`Superproject has uncommitted changes:\n${mainChanges}`);

  git(['submodule', 'update', '--init', ...sourceNames, 'bundle']);
  for (const name of [...sourceNames, 'bundle']) {
    const changes = git(['status', '--porcelain'], path.join(root, name)).stdout.trim();
    if (changes) throw new Error(`${name} has uncommitted changes:\n${changes}`);
  }
  git(['submodule', 'update', '--init', '--remote', ...sourceNames]);
  npm(['install', '--no-fund']);
  npm(['run', 'build', '--', '--configuration=production']);
  if (!existsSync(path.join(output, 'index.html'))) {
    throw new Error(`Required Angular build output is missing: ${path.join(output, 'index.html')}`);
  }
  // A package-manager rewrite must not be silently included in a source release.
  const frontendChanges = git(['status', '--porcelain'], frontend).stdout.trim();
  if (frontendChanges) throw new Error(`Frontend changed during build; review and commit it first:\n${frontendChanges}`);

  copyFileSync(path.join(root, 'backend', 'server.js'), path.join(bundle, 'server.js'));
  copyFileSync(path.join(root, 'cli', 'cli.js'), path.join(bundle, 'cli.js'));
  const publicDir = path.join(bundle, 'public');
  rmSync(publicDir, { recursive: true, force: true });
  cpSync(output, publicDir, { recursive: true });
  const files = {
    '.env': 'PUBLIC_DIR=./public\n',
    'package.json': `${JSON.stringify({
      name: 'snip-bundle',
      version: '1.0.0',
      private: true,
      scripts: { start: 'bun server.js' },
      bin: { snip: './cli.js' },
    }, null, 2)}\n`,
    'Dockerfile': 'FROM oven/bun:1-alpine\nWORKDIR /app\nCOPY . .\nENV PORT=3000\nEXPOSE 3000\nCMD ["bun", "server.js"]\n',
    '.dockerignore': '.git\nnode_modules\nnpm-debug.log\n',
    'railway.json': `${JSON.stringify({
      $schema: 'https://railway.app/railway.schema.json',
      build: { builder: 'DOCKERFILE', dockerfilePath: 'Dockerfile' },
    }, null, 2)}\n`,
  };
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(bundle, name), content);
  }
  for (const name of ['server.js', 'cli.js']) {
    if (!readFileSync(path.join(bundle, name)).equals(
      readFileSync(path.join(root, name === 'server.js' ? 'backend' : 'cli', name))
    )) throw new Error(`Generated ${name} does not match source`);
  }
  git(['add', '--all', '--', 'server.js', 'cli.js', 'public', 'package.json',
    'Dockerfile', '.dockerignore', 'railway.json'], bundle);
  git(['add', '--force', '--', '.env'], bundle);
  commitIfChanged(bundle, 'Generate Snip release bundle');
  git(['add', '--', ...sourceNames, 'bundle']);
  commitIfChanged(root, 'Bump source and bundle submodules');

  if (args.includes('--push')) {
    // Push even after a no-op rebuild: a previous local-only run may be unpushed.
    git(['push', 'origin', 'HEAD:bundle'], bundle);
    git(['push', 'origin', 'HEAD:main']);
    console.log('Pushed bundle and main');
  } else {
    console.log('Local build complete; nothing pushed (use --push to publish)');
  }
}

try {
  build();
} catch (error) {
  console.error(`Build bundle failed: ${error.message}`);
  process.exitCode = 1;
}
