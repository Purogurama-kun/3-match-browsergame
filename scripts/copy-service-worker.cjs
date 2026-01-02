const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const readFile = (relativePath) => {
    const fullPath = path.join(ROOT, relativePath);
    if (!fs.existsSync(fullPath)) {
        throw new Error(`Missing file: ${fullPath}`);
    }
    return fs.readFileSync(fullPath, 'utf8');
};

const workerSource = readFile(path.join('dist', 'service-worker.js'));
const manifestSource = readFile(path.join('dist', 'precache-manifest.js'));

const manifestMatch = manifestSource.match(/export const PRECACHE_URLS = \[[\s\S]*?\];/);
if (!manifestMatch) {
    throw new Error('Failed to locate PRECACHE_URLS declaration in dist/precache-manifest.js');
}
const constDeclaration = manifestMatch[0].replace(/^export const/, 'const');

const inlinedWorker = workerSource.replace(
    "import { PRECACHE_URLS } from './precache-manifest.js';\n",
    `${constDeclaration}\n`
);

const targetPath = path.join(ROOT, 'service-worker.js');
fs.writeFileSync(targetPath, inlinedWorker);

console.log('Updated service-worker.js at project root with inlined precache list.');
