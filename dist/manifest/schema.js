const ALLOWED_PERMISSIONS = new Set([
    'filesystem',
    'shell',
    'network',
    'secrets',
    'subprocess',
    'native'
]);
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : undefined;
}
function asStringRecord(value) {
    const record = asRecord(value);
    if (!record)
        return {};
    return Object.fromEntries(Object.entries(record).filter(([, entry]) => typeof entry === 'string'));
}
function asStringArray(value) {
    if (!Array.isArray(value))
        return undefined;
    return value.filter((entry) => typeof entry === 'string');
}
export function readPluginManifest(packageJson) {
    const findings = [];
    const dsh = asRecord(packageJson.dsh);
    const bundle = dsh?.bundle;
    const client = dsh?.client;
    const hasBundle = bundle !== undefined && bundle !== null;
    const hasClient = client !== undefined && client !== null;
    if (!hasBundle) {
        findings.push({
            code: hasClient ? 'manifest.client-only' : 'manifest.missing-bundle',
            severity: 'error',
            message: hasClient
                ? 'package.json declares dsh.client but no dsh.bundle; it is not installable as a DSH plugin.'
                : 'package.json does not declare dsh.bundle; the repository is not recognizable as an installable DSH plugin.'
        });
    }
    const id = typeof packageJson.name === 'string' ? packageJson.name : undefined;
    const version = typeof packageJson.version === 'string' ? packageJson.version : undefined;
    if (!id)
        findings.push({ code: 'package.missing-name', severity: 'error', message: 'package.json is missing a package name.' });
    if (!version)
        findings.push({ code: 'package.missing-version', severity: 'error', message: 'package.json is missing a package version.' });
    if (packageJson.private === true) {
        findings.push({ code: 'package.private', severity: 'warning', message: 'package.json is private and may not be installable from a public registry.' });
    }
    const gateRecord = asRecord(dsh?.gate);
    const permissions = asStringArray(gateRecord?.permissions);
    for (const permission of permissions ?? []) {
        if (!ALLOWED_PERMISSIONS.has(permission)) {
            findings.push({
                code: 'gate.unknown-permission',
                severity: 'error',
                message: `Unknown declared permission: ${permission}.`,
                evidence: [...ALLOWED_PERMISSIONS].sort().join(', ')
            });
        }
    }
    if (hasBundle && !gateRecord) {
        findings.push({
            code: 'gate.manifest-missing',
            severity: 'warning',
            message: 'No dsh.gate manifest is declared; compatibility and permission results will be inferred.'
        });
    }
    const hasRepository = typeof packageJson.repository === 'string' || Boolean(asRecord(packageJson.repository));
    if (!hasRepository && typeof packageJson.homepage !== 'string') {
        findings.push({ code: 'package.repository-missing', severity: 'warning', message: 'package.json has no repository or homepage field for source provenance.' });
    }
    if (id && version) {
        const gate = gateRecord
            ? {
                id: typeof gateRecord.id === 'string' ? gateRecord.id : undefined,
                compatibleWith: typeof gateRecord.compatibleWith === 'string' ? gateRecord.compatibleWith : undefined,
                permissions,
                platforms: asStringArray(gateRecord.platforms),
                requiresRestart: typeof gateRecord.requiresRestart === 'boolean' ? gateRecord.requiresRestart : undefined,
                nativeBinaries: typeof gateRecord.nativeBinaries === 'boolean' ? gateRecord.nativeBinaries : undefined
            }
            : undefined;
        return {
            manifest: {
                id,
                version,
                description: typeof packageJson.description === 'string' ? packageJson.description : undefined,
                dshBundle: hasBundle,
                dshClient: hasClient,
                gate,
                peerDependencies: asStringRecord(packageJson.peerDependencies),
                dependencies: asStringRecord(packageJson.dependencies),
                scripts: asStringRecord(packageJson.scripts),
                packageJson
            },
            findings
        };
    }
    return { findings };
}
export function allowedPermissions() {
    return [...ALLOWED_PERMISSIONS].sort();
}
//# sourceMappingURL=schema.js.map