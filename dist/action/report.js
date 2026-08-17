import { realpathSync } from 'node:fs';
import { appendFile, readFile } from 'node:fs/promises';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
function markdownCell(value) {
    return value.replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
}
export function renderActionSummary(receipt) {
    const plugin = receipt.plugin ? `${receipt.plugin.id}@${receipt.plugin.version}` : 'unknown plugin';
    const lines = [
        '### DSH Forge Receipt',
        '',
        '| Field | Value |',
        '| --- | --- |',
        `| Status | **${receipt.status.toUpperCase()}** |`,
        `| Verifier | ${markdownCell(`${receipt.verifier.name}@${receipt.verifier.version}`)} |`,
        `| Plugin | ${markdownCell(plugin)} |`,
        `| DSH baseline | ${markdownCell(receipt.baseline.dshVersion)} |`,
        `| Platform | ${markdownCell(receipt.baseline.platform)} |`,
        `| Source | ${markdownCell(receipt.target.reference)} |`,
        `| Package path | ${markdownCell(receipt.target.packagePath ?? 'package.json')} |`,
        '',
        '#### Checks',
        '',
        '| Check | Status | Summary |',
        '| --- | --- | --- |'
    ];
    if (receipt.target.commitSha)
        lines.splice(11, 0, `| Commit | \`${receipt.target.commitSha}\` |`);
    for (const check of receipt.checks) {
        lines.push(`| ${markdownCell(check.id)} | ${check.status.toUpperCase()} | ${markdownCell(check.summary)} |`);
    }
    if (receipt.findings.length) {
        lines.push('', '#### Findings', '', '| Severity | Code | Message |', '| --- | --- | --- |');
        for (const finding of receipt.findings) {
            lines.push(`| ${finding.severity.toUpperCase()} | ${markdownCell(finding.code)} | ${markdownCell(finding.message)} |`);
        }
    }
    lines.push('', '> Static verification only. A passing Receipt is not a security audit.', '');
    return lines.join('\n');
}
async function report(receiptPath) {
    const value = JSON.parse(await readFile(receiptPath, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Receipt must be a JSON object.');
    const receipt = value;
    if (!['pass', 'warn', 'fail'].includes(receipt.status))
        throw new Error('Receipt has an invalid status.');
    if (process.env.GITHUB_STEP_SUMMARY) {
        await appendFile(process.env.GITHUB_STEP_SUMMARY, renderActionSummary(receipt), 'utf8');
    }
    if (process.env.GITHUB_OUTPUT) {
        await appendFile(process.env.GITHUB_OUTPUT, `status=${receipt.status}\n`, 'utf8');
    }
}
async function main() {
    const receiptPath = process.argv[2];
    if (!receiptPath)
        throw new Error('Usage: report <receipt.json>');
    await report(receiptPath);
}
if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
    await main();
}
//# sourceMappingURL=report.js.map