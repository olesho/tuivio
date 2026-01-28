#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// The actual server is in dist/index.js relative to the package root
const serverPath = join(__dirname, '..', 'dist', 'index.js');

// Spawn the server with all passed arguments
const child = spawn('node', [serverPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
