export { loadTarget, parseGitHubReference } from './verifier/target.js';
export { verifyTarget } from './verifier/verify.js';
export { satisfiesRange, parseVersion, compareVersions } from './verifier/semver.js';
export { allowedPermissions, readPluginManifest } from './manifest/schema.js';
export { VERSION } from './version.js';
export { renderActionSummary } from './action/report.js';
export { generateMatrix, parseMatrixConfig, readMatrixConfig, renderMatrixMarkdown, writeMatrixOutputs } from './matrix.js';
export { renderCatalogManifest, renderCatalogPage, writeCatalogOutputs } from './catalog.js';
//# sourceMappingURL=index.js.map