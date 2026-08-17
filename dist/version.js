import { readFileSync } from 'node:fs';
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
if (!packageJson || typeof packageJson !== 'object' || Array.isArray(packageJson) || typeof packageJson.version !== 'string') {
    throw new Error('package.json does not contain a valid version.');
}
export const VERSION = packageJson.version;
//# sourceMappingURL=version.js.map