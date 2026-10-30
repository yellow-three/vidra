// PreToolUse: uretilen ve kilit dosyalarin elle duzenlenmesini engeller.
// Cikis kodu 2 + stderr: Claude islemi yapmaz ve nedenini gorur.
import { relative } from 'node:path';

const BLOCKED = [
  [/^package-lock\.json$/, 'npm install / npm install --package-lock-only ile guncellenir'],
  [/^src-tauri\/Cargo\.lock$/, 'cargo ile guncellenir (cargo update -p ... / cargo check)'],
  [/^src-tauri\/gen\//, 'Tauri derlemesinin urettigi dosyalar'],
  [/^src-tauri\/binaries\//, 'sidecar ikilileri: npm run sidecars'],
  [/^src-tauri\/target\//, 'cargo derleme ciktisi'],
  [/^dist\//, 'vite build ciktisi'],
];

let input = '';
for await (const chunk of process.stdin) input += chunk;
const { tool_input: toolInput = {}, cwd = process.cwd() } = JSON.parse(input || '{}');
const filePath = toolInput.file_path ?? toolInput.notebook_path;
if (!filePath) process.exit(0);

const rel = relative(process.env.CLAUDE_PROJECT_DIR || cwd, filePath).split('\\').join('/');
const hit = BLOCKED.find(([re]) => re.test(rel));
if (hit) {
  console.error(`${rel} elle duzenlenmez: ${hit[1]}.`);
  process.exit(2);
}
