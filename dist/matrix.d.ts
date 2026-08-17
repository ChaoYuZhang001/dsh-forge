import type { CompatibilityMatrix, MatrixConfig } from './types.js';
export declare function parseMatrixConfig(value: unknown): MatrixConfig;
export declare function readMatrixConfig(filePath: string): Promise<MatrixConfig>;
export declare function generateMatrix(config: MatrixConfig, options?: {
    concurrency?: number;
}): Promise<CompatibilityMatrix>;
export declare function renderMatrixMarkdown(matrix: CompatibilityMatrix): string;
export declare function writeMatrixOutputs(matrix: CompatibilityMatrix, jsonPath: string, markdownPath: string): Promise<void>;
//# sourceMappingURL=matrix.d.ts.map