import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const notices = ['Bundled JavaScript dependency licenses\n'];
for (const [path, entry] of Object.entries(lock.packages).sort()) {
  if (!path || entry.dev) continue;
  const pkg = JSON.parse(readFileSync(`${path}/package.json`, 'utf8'));
  if (!['MIT', 'BSD-3-Clause', 'ISC', 'Apache-2.0', '0BSD'].includes(pkg.license)) {
    throw new Error(`Review license before bundling: ${pkg.name}: ${pkg.license}`);
  }
  const licenses = readdirSync(path).filter(name => /^licen[cs]e(?:\.|$)/i.test(name));
  if (!licenses.length) throw new Error(`Missing license text: ${pkg.name}`);
  notices.push(`\n${pkg.name} ${pkg.version} (${pkg.license})\n`);
  for (const file of licenses.sort()) notices.push(readFileSync(`${path}/${file}`, 'utf8').trim() + '\n');
}
writeFileSync('src/wagtail_table/static/wagtail_table/THIRD_PARTY_LICENSES.txt', notices.join('\n'));
