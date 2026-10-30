// PostToolUse: duzenlenen dosyayi bicimlendirir. `.rs` -> rustfmt, `.ts/.tsx` -> eslint --fix.
// Duzeltilemeyen lint hatalari cikis kodu 2 ile Claude'a geri bildirilir; CI'da `npm run lint` dusmesin.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { relative } from 'node:path';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { tool_input: toolInput = {}, cwd = process.cwd() } = JSON.parse(input || '{}');
const filePath = toolInput.file_path;
if (!filePath || !existsSync(filePath)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR || cwd;
const rel = relative(root, filePath).split('\\').join('/');
const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });

if (/^src-tauri\/src\/.*\.rs$/.test(rel)) {
  // rustfmt, src-tauri/rustfmt.toml'u dosyanin dizininden yukari arayarak bulur.
  const r = run('rustfmt', ['--edition', '2021', filePath]);
  if (r.status !== 0) {
    console.error(`rustfmt ${rel}:\n${r.stderr}`);
    process.exit(2);
  }
} else if (/\.(ts|tsx)$/.test(rel) && !rel.startsWith('src-tauri/') && !rel.startsWith('node_modules/')) {
  const r = run('npx', ['--no-install', 'eslint', '--fix', filePath]);
  if (r.status === 1) {
    console.error(`eslint ${rel}:\n${r.stdout}`);
    process.exit(2);
  }
}
