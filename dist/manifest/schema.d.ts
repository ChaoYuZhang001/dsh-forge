import type { PluginManifest, Finding } from '../types.js';
export declare function readPluginManifest(packageJson: Record<string, unknown>): {
    manifest?: PluginManifest;
    findings: Finding[];
};
export declare function allowedPermissions(): string[];
//# sourceMappingURL=schema.d.ts.map