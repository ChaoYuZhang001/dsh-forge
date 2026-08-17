#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { generateMatrix, readMatrixConfig, writeMatrixOutputs } from '../matrix.js';
import { writeCatalogOutputs } from '../catalog.js';
import { loadTarget } from '../verifier/target.js';
import { verifyTarget } from '../verifier/verify.js';
import { VERSION } from '../version.js';
function usage() {
    return `dsh-gate ${VERSION}

Usage:
  dsh-gate verify <local-path-or-github-url> [options]
  dsh-gate matrix [config-path] [options]

Options:
  --dsh-version <version>  DSH baseline (default: 0.1.0-rc.7)
  --platform <platform>     Platform tuple (default: current Node platform/arch)
  --ref <git-ref>           GitHub branch, tag, or commit (default: repository default)
  --path <package-path>      Plugin directory or package.json path inside a monorepo
  --smoke                   Run npm pack --dry-run with lifecycle scripts disabled
  --json <path>             Write the complete JSON Receipt to a file
  --markdown <path>         Write a Markdown compatibility matrix
  --catalog-dir <path>      Write Desktop Catalog Provider files
  --base-url <url>          Public base URL used in the Catalog manifest
  --concurrency <number>    Maximum concurrent matrix verifications (default: 4)
  --version                 Print the DSH Gate version
  --help                    Show this help
`;
}
function currentPlatform() {
    const platform = process.platform === 'darwin' ? 'darwin' : process.platform;
    const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'x64' : process.arch;
    return `${platform}-${arch}`;
}
function optionValue(args, name, fallback) {
    const index = args.indexOf(name);
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
function hasOption(args, name) {
    return args.includes(name);
}
function printReceipt(receipt) {
    const icon = receipt.status === 'pass' ? 'PASS' : receipt.status === 'warn' ? 'WARN' : 'FAIL';
    console.log(`[${icon}] ${receipt.plugin ? `${receipt.plugin.id}@${receipt.plugin.version}` : 'unknown plugin'}`);
    console.log(`DSH: ${receipt.baseline.dshVersion}`);
    console.log(`Platform: ${receipt.baseline.platform}`);
    for (const check of receipt.checks)
        console.log(`  ${check.status.toUpperCase().padEnd(7)} ${check.id}: ${check.summary}`);
    for (const finding of receipt.findings)
        console.log(`  ${finding.severity.toUpperCase().padEnd(7)} ${finding.code}: ${finding.message}`);
    console.log(`Receipt status: ${receipt.status}`);
}
async function runMatrix(args) {
    const configPath = args[1] && !args[1].startsWith('--') ? args[1] : 'matrix-targets.json';
    const matrix = await generateMatrix(await readMatrixConfig(configPath), {
        concurrency: Number(optionValue(args, '--concurrency', '4'))
    });
    const jsonPath = optionValue(args, '--json', 'catalog/matrix.json');
    const markdownPath = optionValue(args, '--markdown', 'catalog/matrix.md');
    const catalogDir = optionValue(args, '--catalog-dir', 'catalog');
    const baseUrl = optionValue(args, '--base-url', 'https://chaoyuzhang001.github.io/dsh-gate');
    await writeMatrixOutputs(matrix, jsonPath, markdownPath);
    await writeCatalogOutputs(matrix, catalogDir, baseUrl);
    console.log(`Matrix: ${jsonPath}`);
    console.log(`Markdown: ${markdownPath}`);
    console.log(`Catalog: ${catalogDir}`);
    console.log(`Counts: ${matrix.counts.pass} pass / ${matrix.counts.warn} warn / ${matrix.counts.fail} fail / ${matrix.counts.error} error`);
    if (matrix.counts.fail > 0 || matrix.counts.error > 0)
        process.exitCode = 1;
}
async function main() {
    const args = process.argv.slice(2);
    if (hasOption(args, '--version')) {
        console.log(VERSION);
        return;
    }
    if (!args.length || hasOption(args, '--help')) {
        console.log(usage());
        return;
    }
    if (args[0] === 'matrix') {
        try {
            await runMatrix(args);
        }
        catch (error) {
            console.error(`dsh-gate: ${error instanceof Error ? error.message : String(error)}`);
            process.exitCode = 1;
        }
        return;
    }
    if (args[0] !== 'verify' || !args[1] || args[1].startsWith('--')) {
        console.error(usage());
        process.exitCode = 2;
        return;
    }
    try {
        const target = await loadTarget(args[1], {
            ref: optionValue(args, '--ref', '') || undefined,
            packagePath: optionValue(args, '--path', '') || undefined
        });
        const receipt = await verifyTarget(target, {
            dshVersion: optionValue(args, '--dsh-version', '0.1.0-rc.7'),
            platform: optionValue(args, '--platform', currentPlatform()),
            smoke: hasOption(args, '--smoke')
        });
        printReceipt(receipt);
        const jsonPath = optionValue(args, '--json', '');
        if (jsonPath) {
            await mkdir(path.dirname(path.resolve(jsonPath)), { recursive: true });
            await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
            console.log(`JSON Receipt: ${jsonPath}`);
        }
        if (receipt.status === 'fail')
            process.exitCode = 1;
    }
    catch (error) {
        console.error(`dsh-gate: ${error instanceof Error ? error.message : String(error)}`);
        process.exitCode = 1;
    }
}
await main();
//# sourceMappingURL=main.js.map