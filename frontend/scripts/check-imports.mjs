import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

// All tracked files (Linux-like, exact casing from Git)
const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .map(f => f.replace(/\\/g, '/'));
const fileSet = new Set(files);
const lowerMap = new Map(files.map(f => [f.toLowerCase(), f]));

// Only source files
const srcFiles = files.filter(f => /^src\/.*\.(jsx?|tsx?)$/.test(f));

// Extract import specifiers (static, dynamic, require)
const importRe = /(?:import\s+(?:[^'"]+\s+from\s+)?|require\()\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;
const EXT = ['.js', '.jsx', '.ts', '.tsx'];

let issues = 0;

for (const rel of srcFiles) {
  const abs = path.join(root, rel);
  let code = '';
  try { code = readFileSync(abs, 'utf8'); } catch { continue; }

  let m;
  while ((m = importRe.exec(code)) !== null) {
    const spec = (m[1] || m[2]);
    if (!spec) continue;

    // Resolve only relative or "@/..." (alias to src/)
    let target;
    if (spec.startsWith('@/')) {
      target = path.posix.normalize(spec.replace(/^@\//, 'src/'));
    } else if (spec.startsWith('./') || spec.startsWith('../')) {
      target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
    } else {
      continue; // skip bare module imports
    }

    const hasExt = /\.(js|jsx|ts|tsx)$/.test(target);
    const candidates = [];

    if (hasExt) {
      candidates.push(target);
    } else {
      for (const e of EXT) candidates.push(target + e);
      for (const e of EXT) candidates.push(target.replace(/\/+$/,'') + '/index' + e);
    }

    // exact match?
    if (candidates.some(c => fileSet.has(c))) continue;

    // case mismatch?
    const cm = candidates.find(c => lowerMap.has(c.toLowerCase()));
    if (cm) {
      console.log(`CASE_MISMATCH ${rel} -> ${cm}  (actual: ${lowerMap.get(cm.toLowerCase())})`);
      issues++; continue;
    }

    console.log(`MISSING ${rel} -> ${target}`);
    issues++;
  }
}

process.exit(issues ? 1 : 0);
