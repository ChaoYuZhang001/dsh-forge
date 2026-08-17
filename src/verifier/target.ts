import { access, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LoadedTarget, LoadTargetOptions, VerifyReceipt } from '../types.js'
import { VERSION } from '../version.js'

type JsonObject = Record<string, unknown>

interface ParsedGitHubReference {
  reference: string
  ref?: string
  packagePath?: string
}

interface GitHubRepositoryMetadata extends JsonObject {
  id: number
  default_branch: string
  archived: boolean
  license: { spdx_id?: string | null } | null
}

interface GitHubContentsPayload {
  content: string
  sha?: string
}

interface GitHubTreePayload {
  truncated?: boolean
  tree?: Array<{ path?: string; type?: string; sha?: string }>
}

const DISCOVERY_ROOTS = new Set(['packages', 'plugins', 'apps'])
const MAX_DISCOVERY_PACKAGES = 100
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

function isHttpTarget(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function parseJsonObject(raw: string, label: string): JsonObject {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} is not a JSON object.`)
  return value as JsonObject
}

function decodePathParts(parts: string[]): string {
  return parts.map((part) => decodeURIComponent(part)).join('/')
}

function normalizePackagePath(value?: string): string | undefined {
  if (!value) return undefined
  if (value.startsWith('/')) throw new Error('Package path must be relative to the target directory.')
  if (value.includes('\\')) throw new Error('Package path must use forward slashes.')
  const segments = value.split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.' || segment === '..')) throw new Error('Package path cannot contain . or .. segments.')
  if (!segments.length) return 'package.json'
  const normalized = segments.join('/')
  return normalized.endsWith('/package.json') || normalized === 'package.json' ? normalized : `${normalized}/package.json`
}

export function parseGitHubReference(value: string, options: LoadTargetOptions = {}): ParsedGitHubReference {
  const url = new URL(value)
  if (url.hostname !== 'github.com' && url.hostname !== 'raw.githubusercontent.com') {
    throw new Error('Only GitHub repository URLs are supported for remote verification.')
  }

  const parts = url.pathname.split('/').filter(Boolean)
  const owner = parts[0]
  const repository = parts[1]?.replace(/\.git$/, '')
  if (!owner || !repository) throw new Error('GitHub target must look like https://github.com/owner/repository.')

  let embeddedRef: string | undefined
  let embeddedPath: string | undefined
  if (url.hostname === 'raw.githubusercontent.com') {
    embeddedRef = parts[2] ? decodeURIComponent(parts[2]) : undefined
    embeddedPath = parts.length > 3 ? decodePathParts(parts.slice(3)) : undefined
  } else if (parts[2]) {
    if (parts[2] !== 'tree') throw new Error('GitHub target paths must use /tree/<ref>/<package-path>.')
    embeddedRef = parts[3] ? decodeURIComponent(parts[3]) : undefined
    embeddedPath = parts.length > 4 ? decodePathParts(parts.slice(4)) : undefined
  }

  return {
    reference: `https://github.com/${owner}/${repository}`,
    ref: options.ref ?? embeddedRef,
    packagePath: normalizePackagePath(options.packagePath ?? embeddedPath)
  }
}

function isPluginCandidate(packageJson: JsonObject): boolean {
  const dsh = packageJson.dsh
  if (dsh && typeof dsh === 'object' && !Array.isArray(dsh)) {
    const record = dsh as JsonObject
    if ((record.bundle !== undefined && record.bundle !== null) || (record.client !== undefined && record.client !== null)) return true
  }
  const peerDependencies = packageJson.peerDependencies
  return Boolean(peerDependencies && typeof peerDependencies === 'object' && !Array.isArray(peerDependencies) && Object.keys(peerDependencies).some((name) => name.startsWith('@deepseek-ai/dsh-')))
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'user-agent': `dsh-gate/${VERSION}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28'
  }
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  return headers
}

function retryDelay(response: Response | undefined, attempt: number): number {
  const retryAfterHeader = response?.headers.get('retry-after')
  const retryAfter = retryAfterHeader === null || retryAfterHeader === undefined ? Number.NaN : Number(retryAfterHeader)
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return Math.min(retryAfter * 1000, 2000)
  return 250 * (attempt + 1)
}

async function fetchWithRetry(url: string, headers: Record<string, string>): Promise<Response> {
  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    let response: Response | undefined
    try {
      response = await fetch(url, { headers, signal: controller.signal })
      if (!RETRYABLE_STATUS.has(response.status) || attempt === 2) return response
      await response.arrayBuffer()
    } catch (error) {
      lastError = error
      if (attempt === 2) break
    } finally {
      clearTimeout(timeout)
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)))
  }
  throw new Error(`GitHub request failed after 3 attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

async function optionalApiObject<T extends JsonObject>(url: string, headers: Record<string, string>): Promise<T | undefined> {
  const response = await fetchWithRetry(url, headers)
  if (!response.ok) return undefined
  const value: unknown = await response.json()
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  return value as T
}

function repositoryParts(reference: string): { owner: string; repository: string } {
  const url = new URL(reference)
  const [owner, repository] = url.pathname.split('/').filter(Boolean)
  if (!owner || !repository) throw new Error(`Invalid GitHub repository reference: ${reference}`)
  return { owner, repository }
}

function apiRepositoryPath(owner: string, repository: string): string {
  return `${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`
}

function encodedContentPath(packagePath: string): string {
  return packagePath.split('/').map(encodeURIComponent).join('/')
}

async function fetchRawPackageAt(
  owner: string,
  repository: string,
  ref: string,
  packagePath: string,
  headers: Record<string, string>
): Promise<JsonObject> {
  const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/${encodeURIComponent(ref)}/${encodedContentPath(packagePath)}`
  const response = await fetchWithRetry(rawUrl, headers)
  if (!response.ok) throw new Error(`Could not read raw ${packagePath} (HTTP ${response.status}).`)
  return parseJsonObject(await response.text(), `Remote ${packagePath}`)
}

async function fetchRemotePackageAt(
  owner: string,
  repository: string,
  ref: string,
  packagePath: string,
  headers: Record<string, string>
): Promise<{ packageJson: JsonObject; blobSha?: string }> {
  const repoPath = apiRepositoryPath(owner, repository)
  const apiUrl = `https://api.github.com/repos/${repoPath}/contents/${encodedContentPath(packagePath)}?ref=${encodeURIComponent(ref)}`
  const apiResponse = await fetchWithRetry(apiUrl, headers)
  if (apiResponse.ok) {
    const payload: unknown = await apiResponse.json()
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('GitHub contents response is not an object.')
    const content = (payload as GitHubContentsPayload).content
    if (typeof content !== 'string') throw new Error(`GitHub contents response did not include ${packagePath} content.`)
    const raw = Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf8')
    return { packageJson: parseJsonObject(raw, `Remote ${packagePath}`), blobSha: (payload as GitHubContentsPayload).sha }
  }

  try {
    return { packageJson: await fetchRawPackageAt(owner, repository, ref, packagePath, headers) }
  } catch (error) {
    throw new Error(`Could not read ${packagePath} (API HTTP ${apiResponse.status}; ${error instanceof Error ? error.message : String(error)}).`)
  }
}

async function discoverRemotePackage(
  owner: string,
  repository: string,
  ref: string,
  headers: Record<string, string>
): Promise<{ packagePath: string; packageJson: JsonObject; blobSha?: string } | undefined> {
  const repoPath = apiRepositoryPath(owner, repository)
  const treeUrl = `https://api.github.com/repos/${repoPath}/git/trees/${encodeURIComponent(ref)}?recursive=1`
  const response = await fetchWithRetry(treeUrl, headers)
  if (!response.ok) throw new Error(`Could not discover monorepo packages (GitHub tree HTTP ${response.status}); use --path to select a package.`)
  const payload = (await response.json()) as GitHubTreePayload
  if (payload.truncated) throw new Error('GitHub returned a truncated repository tree; use --path to select a package.')

  const entries = (payload.tree ?? [])
    .filter((entry) => entry.type === 'blob' && typeof entry.path === 'string')
    .filter((entry) => {
      const segments = entry.path!.split('/')
      return segments.length >= 3 && DISCOVERY_ROOTS.has(segments[0]) && segments.at(-1) === 'package.json'
    })
    .sort((left, right) => left.path!.localeCompare(right.path!))

  if (entries.length > MAX_DISCOVERY_PACKAGES) throw new Error(`Monorepo discovery found more than ${MAX_DISCOVERY_PACKAGES} package.json files; use --path to select a package.`)

  const candidates: Array<{ packagePath: string; packageJson: JsonObject; blobSha?: string }> = []
  for (let offset = 0; offset < entries.length; offset += 8) {
    const batch = entries.slice(offset, offset + 8)
    const loaded = await Promise.all(batch.map(async (entry) => {
      try {
        const packageJson = await fetchRawPackageAt(owner, repository, ref, entry.path!, headers)
        return isPluginCandidate(packageJson) ? { packagePath: entry.path!, packageJson, blobSha: entry.sha } : undefined
      } catch {
        return undefined
      }
    }))
    for (const candidate of loaded) {
      if (candidate) candidates.push(candidate)
    }
    if (candidates.length > 1) {
      throw new Error(`Multiple DSH plugin packages found: ${candidates.map((candidate) => candidate.packagePath).join(', ')}. Use --path to select one.`)
    }
  }

  return candidates[0]
}

async function loadRemoteTarget(reference: string, options: LoadTargetOptions): Promise<LoadedTarget> {
  const parsed = parseGitHubReference(reference, options)
  const { owner, repository } = repositoryParts(parsed.reference)
  const repoPath = apiRepositoryPath(owner, repository)
  const headers = githubHeaders()
  const metadata = await optionalApiObject<GitHubRepositoryMetadata>(`https://api.github.com/repos/${repoPath}`, headers)
  const requestedRef = parsed.ref ?? metadata?.default_branch ?? 'main'
  const commit = await optionalApiObject<{ sha: string }>(`https://api.github.com/repos/${repoPath}/commits/${encodeURIComponent(requestedRef)}`, headers)
  const resolvedRef = commit?.sha ?? requestedRef

  let selectedPath = parsed.packagePath ?? 'package.json'
  let selected: { packageJson: JsonObject; blobSha?: string } | undefined
  try {
    selected = await fetchRemotePackageAt(owner, repository, resolvedRef, selectedPath, headers)
  } catch (error) {
    if (parsed.packagePath) throw error
  }

  if (!parsed.packagePath && (!selected || !isPluginCandidate(selected.packageJson))) {
    const discovered = await discoverRemotePackage(owner, repository, resolvedRef, headers)
    if (discovered) {
      selectedPath = discovered.packagePath
      selected = discovered
    }
  }
  if (!selected) throw new Error(`No package.json could be loaded from ${parsed.reference}.`)

  const target: VerifyReceipt['target'] = {
    kind: 'github',
    reference: parsed.reference,
    ref: requestedRef,
    packagePath: selectedPath,
    commitSha: commit?.sha,
    packageBlobSha: selected.blobSha,
    repositoryId: metadata?.id,
    license: metadata ? metadata.license?.spdx_id ?? null : undefined,
    archived: metadata?.archived
  }
  return { target, packageJson: selected.packageJson }
}

async function readLocalPackage(packagePath: string): Promise<JsonObject> {
  return parseJsonObject(await readFile(packagePath, 'utf8'), packagePath)
}

async function discoverLocalPackageFiles(directory: string, depth = 0): Promise<string[]> {
  if (depth > 4) return []
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }

  const found: string[] = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const child = path.join(directory, entry.name)
    try {
      await access(path.join(child, 'package.json'))
      found.push(path.join(child, 'package.json'))
    } catch {
      // Continue into workspace grouping directories.
    }
    found.push(...await discoverLocalPackageFiles(child, depth + 1))
    if (found.length > MAX_DISCOVERY_PACKAGES) break
  }
  return found
}

async function discoverLocalPackage(rootDirectory: string): Promise<{ packagePath: string; packageJson: JsonObject } | undefined> {
  const packageFiles: string[] = []
  for (const rootName of DISCOVERY_ROOTS) packageFiles.push(...await discoverLocalPackageFiles(path.join(rootDirectory, rootName)))
  const uniqueFiles = [...new Set(packageFiles)].sort()
  if (uniqueFiles.length > MAX_DISCOVERY_PACKAGES) throw new Error(`Monorepo discovery found more than ${MAX_DISCOVERY_PACKAGES} package.json files; use --path to select a package.`)

  const candidates: Array<{ packagePath: string; packageJson: JsonObject }> = []
  for (const file of uniqueFiles) {
    try {
      const packageJson = await readLocalPackage(file)
      if (isPluginCandidate(packageJson)) candidates.push({ packagePath: path.relative(rootDirectory, file).split(path.sep).join('/'), packageJson })
    } catch {
      // Invalid non-plugin workspace packages do not prevent deterministic discovery.
    }
  }
  if (candidates.length > 1) throw new Error(`Multiple DSH plugin packages found: ${candidates.map((candidate) => candidate.packagePath).join(', ')}. Use --path to select one.`)
  return candidates[0]
}

async function loadLocalTarget(reference: string, options: LoadTargetOptions): Promise<LoadedTarget> {
  const inputPath = path.resolve(reference)
  const rootDirectory = path.basename(inputPath) === 'package.json' ? path.dirname(inputPath) : inputPath
  const targetReference = path.relative(process.cwd(), rootDirectory) || '.'
  const explicitPath = normalizePackagePath(options.packagePath)
  let selectedPath = explicitPath ?? 'package.json'
  const absolutePackagePath = path.resolve(rootDirectory, ...selectedPath.split('/'))
  const relativeGuard = path.relative(rootDirectory, absolutePackagePath)
  if (relativeGuard.startsWith('..') || path.isAbsolute(relativeGuard)) throw new Error('Package path must stay inside the target directory.')

  let packageJson: JsonObject | undefined
  try {
    packageJson = await readLocalPackage(absolutePackagePath)
  } catch (error) {
    if (explicitPath) throw error
  }

  if (!explicitPath && (!packageJson || !isPluginCandidate(packageJson))) {
    const discovered = await discoverLocalPackage(rootDirectory)
    if (discovered) {
      selectedPath = discovered.packagePath
      packageJson = discovered.packageJson
    }
  }
  if (!packageJson) throw new Error(`No package.json could be loaded from ${targetReference}.`)

  return {
    target: { kind: 'local', reference: targetReference, packagePath: selectedPath },
    packageJson,
    localPath: path.dirname(path.resolve(rootDirectory, ...selectedPath.split('/')))
  }
}

export async function loadTarget(reference: string, refOrOptions: string | LoadTargetOptions = {}): Promise<LoadedTarget> {
  const options = typeof refOrOptions === 'string' ? { ref: refOrOptions } : refOrOptions
  return isHttpTarget(reference) ? loadRemoteTarget(reference, options) : loadLocalTarget(reference, options)
}

export function currentFilePath(): string {
  return fileURLToPath(import.meta.url)
}
