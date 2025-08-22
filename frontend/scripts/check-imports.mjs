import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const FIX = process.argv.includes('--fix');
const root = process.cwd();
const ASSET_RE = /\.(css|png|jpe?g|gif|svg|webp|ico|bmp|avif|woff2?|ttf|eot)$/i;

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .map(f => f.replace(/\\/g, '/'));
const fileSet = new Set(files);
const lowerMap = new Map(files.map(f => [f.toLowerCase(), f]));
const EXT = ['.js', '.jsx', '.ts', '.tsx'];

const isInSrc = f => /^src\/.*\.(jsx?|tsx?)$/.test(f);
const srcFiles = files.filter(isInSrc);

const importRe = /(?:import\s+(?:[^'"]+\s+from\s+)?|require\()\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

let issues = 0, fixed = 0;

for (const rel of srcFiles) {
  const abs = path.join(root, rel);
  let code = '';
  try { code = readFileSync(abs, 'utf8'); } catch { continue; }

  let mutated = code;
  let m;
  while ((m = importRe.exec(code)) !== null) {
    const spec = (m[1] || m[2]);
    if (!spec) continue;

    const useAlias = spec.startsWith('@/');

    // Resolve to a repo path (posix)
    let target;
    if (useAlias) {
      target = path.posix.normalize(spec.replace(/^@\//, 'src/'));
    } else if (spec.startsWith('./') || spec.startsWith('../')) {
      target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec));
    } else {
      continue; // skip package imports
    }

    if (ASSET_RE.test(target)) continue;

    const hasExt = /\.(js|jsx|ts|tsx)$/.test(target);
    const base = target.replace(/\/+$/,'');
    const candidates = [];

    if (hasExt) {
      candidates.push(target);
    } else {
      for (const e of EXT) candidates.push(base + e);
      for (const e of EXT) candidates.push(base + '/index' + e);
    }

    // Exact exists?
    let exact = candidates.find(c => fileSet.has(c));
    if (exact) {
      // optionally normalize to include extension explicitly
      continue;
    }

    // Case mismatch?
    const cm = candidates.find(c => lowerMap.has(c.toLowerCase()));
    if (cm) {
      const actual = lowerMap.get(cm.toLowerCase()); // canonical path from git
      issues++;
      if (FIX) {
        const newSpec = useAlias
          ? actual.replace(/^src\//, '@/')
          : path.posix.relative(path.posix.dirname(rel), actual) || './' + path.posix.basename(actual);

        // Replace only this import occurrence (keep quote style)
        const q = code[m.index] === "'" ? "'" : '"';
        const needle = new RegExp(`(['"])${escapeReg(spec)}\\1`, 'g');
        mutated = mutated.replace(needle, `$1${newSpec}$1`);
        fixed++;
        issues--;
        continue;
      } else {
        console.log(`CASE_MISMATCH ${rel} -> ${cm} (actual: ${actual})`);
        continue;
      }
    }

    // Missing: try a unique real path among candidates (case-sensitive)
    const realMatches = candidates.filter(c => fileSet.has(c));
    if (realMatches.length === 1) {
      const actual = realMatches[0];
      issues++;
      if (FIX) {
        const newSpec = useAlias
          ? actual.replace(/^src\//, '@/')
          : path.posix.relative(path.posix.dirname(rel), actual) || './' + path.posix.basename(actual);

        const needle = new RegExp(`(['"])${escapeReg(spec)}\\1`, 'g');
        mutated = mutated.replace(needle, `$1${newSpec}$1`);
        fixed++;
        issues--;
      } else {
        console.log(`MISSING (unique) ${rel} -> ${target}  (use: ${actual})`);
      }
      continue;
    }

    // Still missing or ambiguous
    issues++;
    console.log(`MISSING ${rel} -> ${target}  (tried: ${candidates.join(', ')})`);
  }

  if (mutated !== code && FIX) writeFileSync(abs, mutated, 'utf8');
}

if (issues) {
  console.log(`\nDone. ${fixed} auto-fixed, ${issues} remaining. Review the lines above.`);
  process.exit(1);
} else {
  console.log(`\nAll good. ${fixed} auto-fixed, 0 remaining.`);
  process.exit(0);
}

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}