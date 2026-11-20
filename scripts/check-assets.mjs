import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const directory = 'src/wagtail_table/static/wagtail_table';
const files = ['table.js', 'table.css', 'THIRD_PARTY_LICENSES.txt'];
const before = files.map(file => readFileSync(`${directory}/${file}`));
execFileSync('npm', ['run', 'build'], { stdio: 'inherit' });
for (const [index, file] of files.entries()) {
  if (!before[index].equals(readFileSync(`${directory}/${file}`))) {
    throw new Error(`${file} is stale. Run npm run build and commit generated assets.`);
  }
}
