import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(__dirname, '..', 'site');
const htmlFiles = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.html')) htmlFiles.push(full);
  }
};
walk(site);

const missing = new Map();
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const raw = match[1];
    if (/^(https?:|mailto:|tel:|#|data:)/.test(raw)) continue;
    const clean = raw.split('#')[0].split('?')[0];
    if (!clean) continue;
    const target = clean.startsWith('/')
      ? path.join(site, clean)
      : path.resolve(path.dirname(file), clean);
    let candidate = target;
    if (clean.endsWith('/')) candidate = path.join(target, 'index.html');
    if (!fs.existsSync(candidate) && !fs.existsSync(target)) {
      if (!missing.has(raw)) missing.set(raw, []);
      missing.get(raw).push(path.relative(site, file));
    }
  }
}

if (missing.size) {
  for (const [href, from] of missing) {
    console.log(`MISSING ${href}`);
    for (const f of from.slice(0, 3)) console.log(`  from ${f}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Links OK across ${htmlFiles.length} HTML files`);
}
