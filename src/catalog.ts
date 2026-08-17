import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CompatibilityMatrix, CompatibilityMatrixEntry } from './types.js'

const PERMISSION_CAPABILITIES: Record<string, string> = {
  filesystem: 'dsh.permission.filesystem',
  shell: 'dsh.permission.shell',
  network: 'dsh.permission.network',
  secrets: 'dsh.permission.secrets',
  subprocess: 'dsh.permission.subprocess',
  native: 'dsh.permission.native'
}

function repositoryParts(url: string): { name: string; url: string } | undefined {
  try {
    const parsed = new URL(url)
    const [owner] = parsed.pathname.split('/').filter(Boolean)
    return owner ? { name: owner, url: `https://github.com/${owner}` } : undefined
  } catch {
    return undefined
  }
}

function repositoryPath(entry: CompatibilityMatrixEntry): { url: string; subdirectory?: string } | undefined {
  const repository = entry.receipt?.target.reference ?? entry.repository
  if (!repository) return undefined
  const packagePath = entry.receipt?.target.packagePath
  const subdirectory = packagePath && packagePath !== 'package.json' ? packagePath.replace(/\/package\.json$/u, '') : undefined
  return subdirectory ? { url: repository, subdirectory } : { url: repository }
}

function safeCategories(entry: CompatibilityMatrixEntry): string[] {
  const declared = (entry.categories ?? []).filter(category => /^[a-z0-9][a-z0-9._:-]*$/u.test(category))
  return [...new Set([...declared, `verification.${entry.status}`])].sort()
}

function catalogItem(matrix: CompatibilityMatrix, entry: CompatibilityMatrixEntry): Record<string, unknown> | undefined {
  if (!entry.receipt?.plugin) return undefined
  const plugin = entry.receipt.plugin
  const repository = repositoryPath(entry)
  const publisher = repository ? repositoryParts(repository.url) : undefined
  const findingSummary = entry.receipt.findings.length === 0
    ? 'No findings were emitted for the selected baseline.'
    : `${entry.receipt.findings.length} finding(s) require review before installation.`
  const item: Record<string, unknown> = {
    id: entry.id,
    name: plugin.id,
    displayName: entry.displayName,
    summary: `DSH Gate ${entry.status.toUpperCase()}: ${plugin.description ?? plugin.id}`,
    description: `Static DSH Gate result for DSH ${matrix.baseline.dshVersion} on ${matrix.baseline.platform}. ${findingSummary} A passing or warning result is not a security audit.`,
    latestVersion: plugin.version,
    categories: safeCategories(entry),
    keywords: ['deepseek-harness', 'dsh-gate', entry.status],
    capabilities: {
      required: plugin.permissions.map(permission => PERMISSION_CAPABILITIES[permission]).filter(Boolean).sort()
    },
    compatibility: {
      apiVersion: matrix.baseline.dshVersion,
      hosts: ['deepseek-harness']
    },
    updatedAt: matrix.generatedAt
  }
  if (repository) item.repository = repository
  if (/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(plugin.id)) {
    item.package = { registry: 'npm', name: plugin.id }
  }
  if (publisher) item.publisher = publisher
  if (entry.receipt.target.license) item.license = entry.receipt.target.license
  return item
}

export function renderCatalogManifest(baseUrl: string): Record<string, unknown> {
  const normalized = baseUrl.replace(/\/+$/u, '')
  return {
    manifestVersion: '1.0.0',
    providerId: 'io.github.chaoyuzhang001.dsh-gate',
    name: 'DSH Gate Verified',
    description: 'Static compatibility and permission evidence for DeepSeek Harness plugins.',
    homepage: 'https://github.com/ChaoYuZhang001/dsh-gate',
    attribution: {
      name: 'DSH Gate contributors',
      url: 'https://github.com/ChaoYuZhang001/dsh-gate',
      notice: 'Directory entries are generated from public verification Receipts; inclusion is not an endorsement.'
    },
    transport: {
      kind: 'https-json',
      endpoint: `${normalized}/v1/plugins`,
      method: 'GET'
    },
    query: {
      supported: [],
      defaultLimit: 20,
      maxLimit: 100,
      sorts: []
    }
  }
}

export function renderCatalogPage(matrix: CompatibilityMatrix): Record<string, unknown> {
  const items = matrix.entries.map(entry => catalogItem(matrix, entry)).filter((item): item is Record<string, unknown> => item !== undefined)
  if (items.length > 20) throw new Error('Static Catalog output supports at most 20 entries; split or deploy a query-aware provider before publishing more.')
  return {
    schemaVersion: '1.0.0',
    generatedAt: matrix.generatedAt,
    revision: `dsh-gate-${matrix.generator.version}`,
    items,
    page: {}
  }
}

export async function writeCatalogOutputs(matrix: CompatibilityMatrix, catalogDir: string, baseUrl: string): Promise<void> {
  const root = path.resolve(catalogDir)
  await mkdir(path.join(root, 'v1'), { recursive: true })
  await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(renderCatalogManifest(baseUrl), null, 2)}\n`, 'utf8')
  await writeFile(path.join(root, 'v1', 'plugins'), `${JSON.stringify(renderCatalogPage(matrix), null, 2)}\n`, 'utf8')
}
