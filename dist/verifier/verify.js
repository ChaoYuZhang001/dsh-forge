import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { VERSION } from '../version.js';
import { readPluginManifest } from '../manifest/schema.js';
import { satisfiesRange } from './semver.js';
const execFileAsync = promisify(execFile);
function addDependencyFindings(manifest, baseline, findings, checks) {
    // Cordis and schemastery are upstream libraries with their own version
    // lines; only the DSH package family can be compared with a DSH baseline.
    const dshPeers = Object.entries(manifest.peerDependencies).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'));
    if (!dshPeers.length) {
        checks.push({ id: 'dsh.peer-compatibility', status: 'not-run', summary: 'No @deepseek-ai/* peer dependency range was declared.' });
        findings.push({ code: 'dsh.peer-range-missing', severity: 'warning', message: 'No official DSH peer dependency range was declared; compatibility is not mechanically bounded.' });
        return;
    }
    let failed = false;
    for (const [name, range] of dshPeers) {
        if (!satisfiesRange(baseline, range)) {
            failed = true;
            findings.push({ code: 'dsh.peer-range-failed', severity: 'error', message: `${name}@${range} does not accept baseline ${baseline}.`, evidence: 'Prerelease DSH versions require an explicit prerelease comparator on the matching tuple.' });
        }
    }
    checks.push({ id: 'dsh.peer-compatibility', status: failed ? 'fail' : 'pass', summary: failed ? 'One or more official DSH peer ranges reject the baseline.' : `All official DSH peer ranges accept ${baseline}.` });
}
function addPermissionFindings(manifest, findings, checks) {
    const declared = new Set(manifest.gate?.permissions ?? []);
    const scripts = Object.keys(manifest.scripts);
    const inferred = [];
    if (scripts.some((script) => ['preinstall', 'install', 'postinstall'].includes(script)))
        inferred.push('install-script');
    if (manifest.packageJson.bin)
        inferred.push('subprocess');
    if (Object.keys(manifest.dependencies).some((name) => ['node-pty', 'shelljs', 'execa', 'cross-spawn'].includes(name)))
        inferred.push('subprocess');
    if (Object.keys(manifest.dependencies).some((name) => ['sharp', 'better-sqlite3', 'sqlite3', 'node-gyp'].includes(name)))
        inferred.push('native');
    const undeclared = inferred.filter((permission) => permission !== 'install-script' && !declared.has(permission));
    if (undeclared.length) {
        findings.push({ code: 'gate.permission-underdeclared', severity: 'warning', message: `The verifier inferred permission(s) not declared in dsh.gate.permissions: ${[...new Set(undeclared)].join(', ')}.` });
    }
    if (inferred.includes('install-script')) {
        findings.push({ code: 'package.install-script', severity: 'warning', message: 'The package declares an install lifecycle script; source review is required before allowing builds.' });
    }
    checks.push({ id: 'gate.permissions', status: 'pass', summary: inferred.length ? `Declared: ${[...declared].join(', ') || 'none'}; inferred for review: ${inferred.join(', ')}.` : `Declared: ${[...declared].join(', ') || 'none'}; no high-signal permissions inferred.` });
}
async function runSafePackSmoke(target) {
    if (target.target.kind !== 'local' || !target.localPath)
        return { id: 'package.pack-smoke', status: 'not-run', summary: 'Pack smoke is available only for a local target; remote source was not executed.' };
    try {
        await execFileAsync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
            cwd: target.localPath,
            maxBuffer: 1024 * 1024,
            shell: process.platform === 'win32'
        });
        return { id: 'package.pack-smoke', status: 'pass', summary: 'npm pack dry-run completed with lifecycle scripts disabled.' };
    }
    catch (error) {
        const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
        return { id: 'package.pack-smoke', status: 'fail', summary: `npm pack dry-run failed: ${message}` };
    }
}
function receiptStatus(findings) {
    if (findings.some((finding) => finding.severity === 'error'))
        return 'fail';
    if (findings.some((finding) => finding.severity === 'warning'))
        return 'warn';
    return 'pass';
}
export async function verifyTarget(target, options) {
    const checks = [];
    const { manifest, findings } = readPluginManifest(target.packageJson);
    if (manifest) {
        checks.push({ id: 'package.identity', status: 'pass', summary: `${manifest.id}@${manifest.version} identified.` });
        addDependencyFindings(manifest, options.dshVersion, findings, checks);
        if (manifest.gate?.compatibleWith) {
            const compatible = satisfiesRange(options.dshVersion, manifest.gate.compatibleWith);
            checks.push({ id: 'gate.compatibility', status: compatible ? 'pass' : 'fail', summary: compatible ? `dsh.gate.compatibleWith accepts ${options.dshVersion}.` : `dsh.gate.compatibleWith rejects ${options.dshVersion}.` });
            if (!compatible)
                findings.push({ code: 'gate.compatibility-failed', severity: 'error', message: `Declared compatibility range ${manifest.gate.compatibleWith} rejects ${options.dshVersion}.` });
        }
        else {
            checks.push({ id: 'gate.compatibility', status: 'not-run', summary: 'No explicit dsh.gate.compatibleWith range was declared.' });
        }
        if (manifest.gate?.platforms && !manifest.gate.platforms.includes(options.platform)) {
            findings.push({ code: 'gate.platform-failed', severity: 'error', message: `The current platform ${options.platform} is not declared in dsh.gate.platforms.` });
            checks.push({ id: 'gate.platform', status: 'fail', summary: `Current platform ${options.platform} is not declared.` });
        }
        else {
            checks.push({ id: 'gate.platform', status: 'pass', summary: manifest.gate?.platforms ? `Current platform ${options.platform} is declared.` : 'No platform restriction was declared.' });
        }
        addPermissionFindings(manifest, findings, checks);
    }
    else {
        checks.push({ id: 'package.identity', status: 'fail', summary: 'The package manifest could not be identified.' });
    }
    if (target.target.kind === 'github') {
        const revision = target.target.commitSha ?? target.target.ref ?? 'unknown revision';
        const packagePath = target.target.packagePath ?? 'package.json';
        checks.push({ id: 'source.provenance', status: 'pass', summary: `Source read from ${target.target.reference} at ${revision} (${packagePath}).` });
    }
    else {
        checks.push({ id: 'source.provenance', status: 'pass', summary: `Source read from a local path (${target.target.packagePath ?? 'package.json'}); commit provenance was not inferred.` });
    }
    if (options.smoke) {
        const smokeCheck = await runSafePackSmoke(target);
        checks.push(smokeCheck);
        if (smokeCheck.status === 'fail')
            findings.push({ code: 'package.pack-smoke-failed', severity: 'error', message: smokeCheck.summary });
    }
    else
        checks.push({ id: 'package.pack-smoke', status: 'not-run', summary: 'Pack smoke was not requested; use --smoke to run npm pack with scripts disabled.' });
    const receipt = {
        schemaVersion: '0.3',
        generatedAt: new Date().toISOString(),
        verifier: { name: 'dsh-gate', version: VERSION },
        target: target.target,
        baseline: { dshVersion: options.dshVersion, platform: options.platform },
        plugin: manifest ? {
            id: manifest.id,
            version: manifest.version,
            description: manifest.description,
            compatibleWith: manifest.gate?.compatibleWith,
            permissions: manifest.gate?.permissions ?? [],
            platforms: manifest.gate?.platforms,
            requiresRestart: manifest.gate?.requiresRestart,
            nativeBinaries: manifest.gate?.nativeBinaries
        } : undefined,
        status: receiptStatus(findings),
        checks,
        findings,
        notes: [
            'This alpha performs static checks and an optional npm pack dry-run; it does not execute plugin install scripts or claim a security audit.',
            'A passing receipt means the declared contract and selected smoke checks passed for this baseline, platform, and source ref.'
        ]
    };
    return receipt;
}
//# sourceMappingURL=verify.js.map