#!/usr/bin/env node
/**
 * tuivio-start - Launch a TUI app inside tmux with tuivio-record.
 *
 * Usage: tuivio-start [options] <command> [args...]
 */

import { execSync, execFileSync } from 'child_process';

// Parse arguments
const argv = process.argv.slice(2);
let cols = 80;
let rows = 24;
let sessionName = 'tuivio';
let command = '';
let commandArgs: string[] = [];

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if ((arg === '--cols') && argv[i + 1]) {
    cols = parseInt(argv[++i], 10);
  } else if ((arg === '--rows') && argv[i + 1]) {
    rows = parseInt(argv[++i], 10);
  } else if ((arg === '--name') && argv[i + 1]) {
    sessionName = argv[++i];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`Usage: tuivio-start [options] <command> [args...]

Launch a TUI app inside tmux with tuivio-record.

Options:
  --cols <N>       Terminal width (default: 80)
  --rows <N>       Terminal height (default: 24)
  --name <name>    tmux session name (default: tuivio)
  -h, --help       Show this help

Examples:
  tuivio-start npm start
  tuivio-start --cols 120 --rows 36 python3 app.py
  tuivio-start --name tuivio-2 npm start`);
    process.exit(0);
  } else if (!command) {
    command = arg;
  } else {
    commandArgs.push(arg);
  }
}

if (!command) {
  console.error('Error: No command specified.');
  console.error('Usage: tuivio-start [options] <command> [args...]');
  console.error('Run tuivio-start --help for more information.');
  process.exit(1);
}

// Check tmux is installed
try {
  execFileSync('which', ['tmux'], { stdio: 'pipe' });
} catch {
  console.error('Error: tmux is not installed.');
  console.error('Install it with:');
  console.error('  macOS:  brew install tmux');
  console.error('  Ubuntu: sudo apt install tmux');
  process.exit(1);
}

// Kill existing session with this name (clean restart)
try {
  execSync(`tmux kill-session -t ${sessionName} 2>/dev/null`, { stdio: 'pipe' });
} catch {
  // No existing session — that's fine
}

// Pick session name: if the base name is occupied by a non-tuivio process,
// try tuivio-2, tuivio-3, etc.
function isSessionOccupied(name: string): boolean {
  try {
    execSync(`tmux has-session -t ${name} 2>/dev/null`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

let actualSession = sessionName;
if (isSessionOccupied(actualSession)) {
  for (let n = 2; n <= 10; n++) {
    const candidate = `${sessionName}-${n}`;
    if (!isSessionOccupied(candidate)) {
      actualSession = candidate;
      break;
    }
  }
  if (isSessionOccupied(actualSession)) {
    console.error(`Error: Could not find an available session name (tried ${sessionName} through ${sessionName}-10).`);
    process.exit(1);
  }
}

// Build the inner command: tuivio-record <command> [args...]
const fullCmd = ['tuivio-record', command, ...commandArgs]
  .map(a => a.includes(' ') ? `'${a}'` : a)
  .join(' ');

// Launch tmux session
try {
  execSync(
    `tmux new-session -d -s ${actualSession} -x ${cols} -y ${rows} '${fullCmd}'`,
    { stdio: 'pipe' }
  );
} catch (err: any) {
  console.error(`Error: Failed to start tmux session.`);
  console.error(err.stderr?.toString() || err.message);
  process.exit(1);
}

// Wait briefly for the process to start, then verify
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function verify(): Promise<boolean> {
  await sleep(2000);
  try {
    const output = execSync(`tmux has-session -t ${actualSession} 2>/dev/null`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const alive = await verify();

  if (!alive) {
    console.error(`Error: Session "${actualSession}" is not running.`);
    console.error('The command may have failed to start. Check that it is correct:');
    console.error(`  ${command} ${commandArgs.join(' ')}`);
    process.exit(1);
  }

  // Also try tuivio-discover to verify recording is active
  let discoverOk = false;
  try {
    execSync('tuivio-discover --json', { stdio: 'pipe', timeout: 3000 });
    discoverOk = true;
  } catch {
    // discover may fail if tuivio-record hasn't fully initialized yet — non-fatal
  }

  console.log(`Started: ${command} ${commandArgs.join(' ')} (${actualSession} session, ${cols}x${rows})`);
  if (!discoverOk) {
    console.log('  Note:    Recording may still be initializing...');
  }
  console.log(`  Attach:  tuivio-attach`);
  console.log(`  Screen:  tmux capture-pane -t ${actualSession} -p`);
  console.log(`  Stop:    tmux kill-session -t ${actualSession}`);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
