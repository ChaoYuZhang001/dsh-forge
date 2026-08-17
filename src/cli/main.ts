#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { loadTarget } from '../verifier/target.js'
import { verifyTarget } from '../verifier/verify.js'
import { VERSION } from '../version.js'

function usage(): string {
  return `dsh-forge ${VERSION}

Usage:
  dsh-forge verify <local-path-or-github-url> [options]

Options:
  --dsh-version <version>  DSH baseline (default: 0.1.0-rc.7)
  --platform <platform>     Platform tuple (default: current Node platform/arch)
  --ref <git-ref>           GitHub branch, tag, or commit (default: repository default)
  --path <package-path>      Plugin directory or package.json path inside a monorepo
  --smoke                   Run npm pack --dry-run with lifecycle scripts disabled
  --json <path>             Write the complete JSON Receipt to a file
  --version                 Print the DSH Forge version
  --help                    Show this help
`
}

function currentPlatform(): string {
  const platform = process.platform === 'darwin' ? 'darwin' : process.platform
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'x64' : process.arch
  return `${platform}-${arch}`
}

function optionValue(args: string[], name: string, fallback: string): string {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

function hasOption(args: string[], name: string): boolean {
  return args.includes(name)
}

function printReceipt(receipt: Awaited<ReturnType<typeof verifyTarget>>): void {
  const icon = receipt.status === 'pass' ? 'PASS' : receipt.status === 'warn' ? 'WARN' : 'FAIL'
  console.log(`[${icon}] ${receipt.plugin ? `${receipt.plugin.id}@${receipt.plugin.version}` : 'unknown plugin'}`)
  console.log(`DSH: ${receipt.baseline.dshVersion}`)
  console.log(`Platform: ${receipt.baseline.platform}`)
  for (const check of receipt.checks) console.log(`  ${check.status.toUpperCase().padEnd(7)} ${check.id}: ${check.summary}`)
  for (const finding of receipt.findings) console.log(`  ${finding.severity.toUpperCase().padEnd(7)} ${finding.code}: ${finding.message}`)
  console.log(`Receipt status: ${receipt.status}`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (hasOption(args, '--version')) {
    console.log(VERSION)
    return
  }
  if (!args.length || hasOption(args, '--help')) {
    console.log(usage())
    return
  }
  if (args[0] !== 'verify' || !args[1] || args[1].startsWith('--')) {
    console.error(usage())
    process.exitCode = 2
    return
  }

  try {
    const target = await loadTarget(args[1], {
      ref: optionValue(args, '--ref', '') || undefined,
      packagePath: optionValue(args, '--path', '') || undefined
    })
    const receipt = await verifyTarget(target, {
      dshVersion: optionValue(args, '--dsh-version', '0.1.0-rc.7'),
      platform: optionValue(args, '--platform', currentPlatform()),
      smoke: hasOption(args, '--smoke')
    })
    printReceipt(receipt)
    const jsonPath = optionValue(args, '--json', '')
    if (jsonPath) {
      await mkdir(path.dirname(path.resolve(jsonPath)), { recursive: true })
      await writeFile(jsonPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
      console.log(`JSON Receipt: ${jsonPath}`)
    }
    if (receipt.status === 'fail') process.exitCode = 1
  } catch (error) {
    console.error(`dsh-forge: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

await main()
