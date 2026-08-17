import type { LoadedTarget, LoadTargetOptions } from '../types.js';
interface ParsedGitHubReference {
    reference: string;
    ref?: string;
    packagePath?: string;
}
export declare function parseGitHubReference(value: string, options?: LoadTargetOptions): ParsedGitHubReference;
export declare function loadTarget(reference: string, refOrOptions?: string | LoadTargetOptions): Promise<LoadedTarget>;
export declare function currentFilePath(): string;
export {};
//# sourceMappingURL=target.d.ts.map