import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { VERSION } from './version.js';
import { loadTarget } from './verifier/target.js';
import { verifyTarget } from './verifier/verify.js';
const MAX_CONCURRENCY = 4;
function asObject(value, label) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${label} must be an object.`);
    return value;
}
function asString(value, label) {
    if (typeof value !== 'string' || !value.trim())
        throw new Error(`${label} must be a non-empty string.`);
    return value;
}
function asOptionalString(value, label) {
    if (value === undefined)
        return undefined;
    return asString(value, label);
}
function asStringArray(value, label) {
    if (value === undefined)
        return undefined;
    if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string' || !entry.trim()))
        throw new Error(`${label} must be an array of non-empty strings.`);
    return [...new Set(value)];
}
function parseTarget(value, index) {
    const record = asObject(value, `targets[${index}]`);
    return {
        id: asString(record.id, `targets[${index}].id`),
        target: asString(record.target, `targets[${index}].target`),
        displayName: asOptionalString(record.displayName, `targets[${index}].displayName`),
        ref: asOptionalString(record.ref, `targets[${index}].ref`),
        packagePath: asOptionalString(record.packagePath, `targets[${index}].packagePath`),
        categories: asStringArray(record.categories, `targets[${index}].categories`)
    };
}
export function parseMatrixConfig(value) {
    const record = asObject(value, 'matrix config');
    if (record.schemaVersion !== '0.1')
        throw new Error('matrix config schemaVersion must be 0.1.');
    const baseline = asObject(record.baseline, 'baseline');
    if (!Array.isArray(record.targets) || record.targets.length === 0)
        throw new Error('matrix config must contain at least one target.');
    const targets = record.targets.map(parseTarget).sort((left, right) => left.id.localeCompare(right.id));
    const ids = new Set();
    for (const target of targets) {
        if (ids.has(target.id))
            throw new Error(`Duplicate matrix target id: ${target.id}`);
        ids.add(target.id);
    }
    return {
        schemaVersion: '0.1',
        baseline: {
            dshVersion: asString(baseline.dshVersion, 'baseline.dshVersion'),
            platform: asString(baseline.platform, 'baseline.platform')
        },
        targets
    };
}
export async function readMatrixConfig(filePath) {
    return parseMatrixConfig(JSON.parse(await readFile(filePath, 'utf8')));
}
function matrixTimestamp() {
    const epoch = process.env.SOURCE_DATE_EPOCH;
    if (epoch !== undefined && /^\d+$/.test(epoch))
        return new Date(Number(epoch) * 1000).toISOString();
    return new Date().toISOString();
}
function repositoryFromTarget(target) {
    return target.kind === 'github' ? target.reference : undefined;
}
function entryFromReceipt(target, receipt, timestamp) {
    const normalizedReceipt = { ...receipt, generatedAt: timestamp };
    return {
        id: target.id,
        displayName: target.displayName ?? target.id,
        target: target.target,
        repository: repositoryFromTarget(receipt.target),
        requestedRef: target.ref,
        packagePath: receipt.target.packagePath,
        categories: [...new Set(target.categories ?? [])].sort(),
        status: receipt.status,
        receipt: normalizedReceipt
    };
}
async function verifyMatrixTarget(target, config, timestamp) {
    try {
        const loaded = await loadTarget(target.target, { ref: target.ref, packagePath: target.packagePath });
        const receipt = await verifyTarget(loaded, {
            dshVersion: config.baseline.dshVersion,
            platform: config.baseline.platform,
            smoke: false
        });
        return entryFromReceipt(target, receipt, timestamp);
    }
    catch (cause) {
        return {
            id: target.id,
            displayName: target.displayName ?? target.id,
            target: target.target,
            requestedRef: target.ref,
            packagePath: target.packagePath,
            categories: [...new Set(target.categories ?? [])].sort(),
            status: 'error',
            error: cause instanceof Error ? cause.message : String(cause)
        };
    }
}
export async function generateMatrix(config, options = {}) {
    const timestamp = matrixTimestamp();
    const concurrency = Math.max(1, Math.min(MAX_CONCURRENCY, Math.floor(options.concurrency ?? MAX_CONCURRENCY)));
    const entries = [];
    for (let offset = 0; offset < config.targets.length; offset += concurrency) {
        const batch = config.targets.slice(offset, offset + concurrency);
        entries.push(...await Promise.all(batch.map(target => verifyMatrixTarget(target, config, timestamp))));
    }
    entries.sort((left, right) => left.id.localeCompare(right.id));
    const counts = { pass: 0, warn: 0, fail: 0, error: 0 };
    for (const entry of entries)
        counts[entry.status] += 1;
    return {
        schemaVersion: '0.1',
        generatedAt: timestamp,
        generator: { name: 'dsh-gate', version: VERSION },
        baseline: config.baseline,
        counts,
        entries
    };
}
function markdownCell(value) {
    return value.replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
}
function commitFor(entry) {
    return entry.receipt?.target.commitSha?.slice(0, 12) ?? 'unresolved';
}
export function renderMatrixMarkdown(matrix) {
    const lines = [
        '# DSH Gate Compatibility Matrix',
        '',
        `Generated: ${matrix.generatedAt}<br>`,
        `Baseline: DSH ${matrix.baseline.dshVersion} on ${matrix.baseline.platform}<br>`,
        `Counts: ${matrix.counts.pass} pass / ${matrix.counts.warn} warn / ${matrix.counts.fail} fail / ${matrix.counts.error} error`,
        '',
        '> Static compatibility and permission evidence. This matrix is not a security audit or an endorsement of any plugin.',
        '',
        '| Target | Status | Plugin | Commit | Package path | Findings |',
        '| --- | --- | --- | --- | --- | --- |'
    ];
    for (const entry of matrix.entries) {
        const receipt = entry.receipt;
        const plugin = receipt?.plugin ? `${receipt.plugin.id}@${receipt.plugin.version}` : 'unresolved';
        const findings = receipt?.findings.length ?? 0;
        const reference = receipt?.target.reference ?? entry.target;
        lines.push(`| [${markdownCell(entry.displayName)}](${markdownCell(reference)}) | **${entry.status.toUpperCase()}** | ${markdownCell(plugin)} | \`${commitFor(entry)}\` | ${markdownCell(entry.packagePath ?? 'unknown')} | ${findings} |`);
        if (entry.error)
            lines.push(`|  |  |  |  |  | ${markdownCell(entry.error)} |`);
    }
    return `${lines.join('\n')}\n`;
}
export async function writeMatrixOutputs(matrix, jsonPath, markdownPath) {
    await mkdir(path.dirname(path.resolve(jsonPath)), { recursive: true });
    await mkdir(path.dirname(path.resolve(markdownPath)), { recursive: true });
    await writeFile(jsonPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
    await writeFile(markdownPath, renderMatrixMarkdown(matrix), 'utf8');
}
//# sourceMappingURL=matrix.js.map