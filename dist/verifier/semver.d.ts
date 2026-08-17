export interface Version {
    major: number;
    minor: number;
    patch: number;
    prerelease: string[];
}
export declare function parseVersion(input: string): Version | undefined;
export declare function compareVersions(left: Version, right: Version): number;
/**
 * Deliberately small semver support for the first verifier. In particular,
 * prerelease DSH versions require an explicit comparator on the same
 * major.minor.patch tuple, matching node-semver's prerelease rule.
 */
export declare function satisfiesRange(versionText: string, range: string): boolean;
//# sourceMappingURL=semver.d.ts.map