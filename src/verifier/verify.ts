import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { CheckResult, Finding, LoadedTarget, PluginManifest, VerifyOptions, VerifyReceipt } from '../types.js'
import { VERSION } from '../version.js'
import { readPluginManifest } from '../manifest/schema.js'
import { satisfiesRange } from './semver.js'

const execFileAsync = promisify(execFile)

function addDependencyFindings(manifest: PluginManifest, baseline: string, findings: Finding[], checks: CheckResult[]): void {
  // Cordis and schemastery are upstream libraries with their own version
  // lines; only the DSH package family can be compared with a DSH baseline.
  const dshPeers = Object.entries(manifest.peerDependencies).filter(([name]) => name.startsWith('@deepseek-ai/dsh-'))
  if (!dshPeers.length) {
    checks.push({ id: 'dsh.peer-compatibility', status: 'not-run', summary: 'No @deepseek-ai/* peer dependency range was declared.' })
    findings.push({ code: 'dsh.peer-range-missing', severity: 'warning', message: 'No official DSH peer dependency range was declared; compatibility is not mechanically bounded.' })
    return
  }

  let failed = false
  for (const [name, range] of dshPeers) {
    if (!satisfiesRange(baseline, range)) {
      failed = true
      findings.push({ code: 'dsh.peer-range-failed', severity: 'error', message: `${name}@${range} does not accept baseline ${baseline}.`, evidence: 'Prerelease DSH versions require an explicit prerelease comparator on the matching tuple.' })
    }
  }
  checks.push({ id: 'dsh.peer-compatibility', status: failed ? 'fail' : 'pass', summary: failed ? 'One or more official DSH peer ranges reject the baseline.' : `All official DSH peer ranges accept ${baseline}.` })
}

function addPermissionFindings(manifest: PluginManifest, findings: Finding[], checks: CheckResult[]): void {
  const declared = new Set(manifest.forge?.permissions ?? [])
  const scripts = Object.keys(manifest.scripts)
  const inferred: string[] = []
  if (scripts.some((script) => ['preinstall', 'install', 'postinstall'].includes(script))) inferred.push('install-script')
  if (manifest.packageJson.bin) inferred.push('subprocess')
  if (Object.keys(manifest.dependencies).some((name) => ['node-pty', 'shelljs', 'execa', 'cross-spawn'].includes(name))) inferred.push('subprocess')
  if (Object.keys(manifest.dependencies).some((name) => ['sharp', 'better-sqlite3', 'sqlite3', 'node-gyp'].includes(name))) inferred.push('native')

  const undeclared = inferred.filter((permission) => permission !== 'install-script' && !declared.has(permission))
  if (undeclared.length) {
    findings.push({ code: 'forge.permission-underdeclared', severity: 'warning', message: `The verifier inferred permission(s) not declared in dsh.forge.permissions: ${[...new Set(undeclared)].join(', ')}.` })
  }
  if (inferred.includes('install-script')) {
    findings.push({ code: 'package.install-script', severity: 'warning', message: 'The package declares an install lifecycle script; source review is required before allowing builds.' })
  }
  checks.push({ id: 'forge.permissions', status: 'pass', summary: inferred.length ? `Declared: ${[...declared].join(', ') || 'none'}; inferred for review: ${inferred.join(', ')}.` : `Declared: ${[...declared].join(', ') || 'none'}; no high-signal permissions inferred.` })
}

async function runSafePackSmoke(target: LoadedTarget): Promise<CheckResult> {
  if (target.target.kind !== 'local' || !target.localPath) return { id: 'package.pack-smoke', status: 'not-run', summary: 'Pack smoke is available only for a local target; remote source was not executed.' }
  try {
    await execFileAsync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--dry-run', '--ignore-scripts', '--json'], {
      cwd: target.localPath,
      maxBuffer: 1024 * 1024,
      shell: process.platform === 'win32'
    })
    return { id: 'package.pack-smoke', status: 'pass', summary: 'npm pack dry-run completed with lifecycle scripts disabled.' }
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error)
    return { id: 'package.pack-smoke', status: 'fail', summary: `npm pack dry-run failed: ${message}` }
  }
}

function receiptStatus(findings: Finding[]): VerifyReceipt['status'] {
  if (findings.some((finding) => finding.severity === 'error')) return 'fail'
  if (findings.some((finding) => finding.severity === 'warning')) return 'warn'
  return 'pass'
}

export async function verifyTarget(target: LoadedTarget, options: VerifyOptions): Promise<VerifyReceipt> {
  const checks: CheckResult[] = []
  const { manifest, findings } = readPluginManifest(target.packageJson)
  if (manifest) {
    checks.push({ id: 'package.identity', status: 'pass', summary: `${manifest.id}@${manifest.version} identified.` })
    addDependencyFindings(manifest, options.dshVersion, findings, checks)
    if (manifest.forge?.compatibleWith) {
      const compatible = satisfiesRange(options.dshVersion, manifest.forge.compatibleWith)
      checks.push({ id: 'forge.compatibility', status: compatible ? 'pass' : 'fail', summary: compatible ? `dsh.forge.compatibleWith accepts ${options.dshVersion}.` : `dsh.forge.compatibleWith rejects ${options.dshVersion}.` })
      if (!compatible) findings.push({ code: 'forge.compatibility-failed', severity: 'error', message: `Declared compatibility range ${manifest.forge.compatibleWith} rejects ${options.dshVersion}.` })
    } else {
      checks.push({ id: 'forge.compatibility', status: 'not-run', summary: 'No explicit dsh.forge.compatibleWith range was declared.' })
    }
    if (manifest.forge?.platforms && !manifest.forge.platforms.includes(options.platform)) {
      findings.push({ code: 'forge.platform-failed', severity: 'error', message: `The current platform ${options.platform} is not declared in dsh.forge.platforms.` })
      checks.push({ id: 'forge.platform', status: 'fail', summary: `Current platform ${options.platform} is not declared.` })
    } else {
      checks.push({ id: 'forge.platform', status: 'pass', summary: manifest.forge?.platforms ? `Current platform ${options.platform} is declared.` : 'No platform restriction was declared.' })
    }
    addPermissionFindings(manifest, findings, checks)
  } else {
    checks.push({ id: 'package.identity', status: 'fail', summary: 'The package manifest could not be identified.' })
  }

  if (target.target.kind === 'github') checks.push({ id: 'source.provenance', status: 'pass', summary: `Source read from ${target.target.reference} at ref ${target.target.ref}.` })
  else checks.push({ id: 'source.provenance', status: 'pass', summary: 'Source read from a local path; commit provenance is not inferred by the alpha verifier.' })

  if (options.smoke) {
    const smokeCheck = await runSafePackSmoke(target)
    checks.push(smokeCheck)
    if (smokeCheck.status === 'fail') findings.push({ code: 'package.pack-smoke-failed', severity: 'error', message: smokeCheck.summary })
  } else checks.push({ id: 'package.pack-smoke', status: 'not-run', summary: 'Pack smoke was not requested; use --smoke to run npm pack with scripts disabled.' })

  const receipt: VerifyReceipt = {
    schemaVersion: '0.1',
    generatedAt: new Date().toISOString(),
    verifier: { name: 'dsh-forge', version: VERSION },
    target: target.target,
    baseline: { dshVersion: options.dshVersion, platform: options.platform },
    plugin: manifest ? { id: manifest.id, version: manifest.version, description: manifest.description } : undefined,
    status: receiptStatus(findings),
    checks,
    findings,
    notes: [
      'This alpha performs static checks and an optional npm pack dry-run; it does not execute plugin install scripts or claim a security audit.',
      'A passing receipt means the declared contract and selected smoke checks passed for this baseline, platform, and source ref.'
    ]
  }
  return receipt
}
