import type { CompatibilityMatrix } from './types.js';
export declare function renderCatalogManifest(baseUrl: string): Record<string, unknown>;
export declare function renderCatalogPage(matrix: CompatibilityMatrix): Record<string, unknown>;
export declare function writeCatalogOutputs(matrix: CompatibilityMatrix, catalogDir: string, baseUrl: string): Promise<void>;
//# sourceMappingURL=catalog.d.ts.map