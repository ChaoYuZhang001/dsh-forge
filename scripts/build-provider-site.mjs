import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..')
const CATALOG_ROOT = path.join(REPO_ROOT, 'catalog')
const ARTIFACTS_ROOT = path.join(REPO_ROOT, 'artifacts')
const DEFAULT_OUTPUT_DIR = path.join(ARTIFACTS_ROOT, 'provider-site')

function fail(message) {
  throw new Error(message)
}

function safeUrl(value, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be an absolute HTTPS URL.`)

  let decodedInput
  try {
    decodedInput = decodeURIComponent(value)
  } catch {
    fail(`${label} must not contain an invalid encoded path.`)
  }
  const rawPath = decodedInput.split(/[?#]/u, 1)[0]
  if (decodedInput.includes('\\') || rawPath.split('/').some(segment => segment === '.' || segment === '..')) {
    fail(`${label} must not contain traversal or backslash path segments.`)
  }

  let url
  try {
    url = new URL(value)
  } catch {
    fail(`${label} must be an absolute HTTPS URL.`)
  }

  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || (url.port && url.port !== '443')) {
    fail(`${label} must be credential-free HTTPS without a query, fragment, or non-standard port.`)
  }

  return url
}

export function normalizeBaseUrl(value) {
  const url = safeUrl(value, 'Provider base URL')
  const base = url.href.replace(/\/+$/u, '')
  return base || fail('Provider base URL must include a host.')
}

export function resolveOutputDir(value = DEFAULT_OUTPUT_DIR) {
  if (typeof value !== 'string' || value.trim() === '') fail('Output directory must be a non-empty path under artifacts/.')
  const resolved = path.resolve(REPO_ROOT, value)
  const relative = path.relative(ARTIFACTS_ROOT, resolved)
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail('Output directory must be a child of the repository artifacts/ directory.')
  }
  if (relative.split(path.sep).some(segment => segment === '.' || segment === '..')) {
    fail('Output directory must not contain traversal segments.')
  }
  return resolved
}

async function readJson(filePath, label) {
  let source
  try {
    source = await readFile(filePath, 'utf8')
  } catch (cause) {
    fail(`Unable to read ${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
  try {
    return JSON.parse(source)
  } catch (cause) {
    fail(`Unable to parse ${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
}

function jsonDocument(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function headersDocument() {
  return [
    '/manifest.json',
    '  Content-Type: application/json; charset=utf-8',
    '  X-Content-Type-Options: nosniff',
    '',
    '/v1/plugins',
    '  Content-Type: application/json; charset=utf-8',
    '  X-Content-Type-Options: nosniff',
    ''
  ].join('\n')
}

export async function buildProviderSite(baseUrl, outputDir = DEFAULT_OUTPUT_DIR) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const outputRoot = resolveOutputDir(outputDir)
  const manifest = await readJson(path.join(CATALOG_ROOT, 'manifest.json'), 'catalog/manifest.json')
  const page = await readJson(path.join(CATALOG_ROOT, 'v1', 'plugins'), 'catalog/v1/plugins')

  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail('catalog/manifest.json must contain a JSON object.')
  if (!page || typeof page !== 'object' || Array.isArray(page)) fail('catalog/v1/plugins must contain a JSON object.')
  if (!manifest.transport || typeof manifest.transport !== 'object' || Array.isArray(manifest.transport)) {
    fail('catalog/manifest.json must contain a transport object.')
  }

  const rewrittenManifest = {
    ...manifest,
    transport: {
      ...manifest.transport,
      endpoint: `${normalizedBaseUrl}/v1/plugins`
    }
  }

  await mkdir(path.join(outputRoot, 'v1'), { recursive: true })
  await Promise.all([
    writeFile(path.join(outputRoot, 'manifest.json'), jsonDocument(rewrittenManifest), 'utf8'),
    writeFile(path.join(outputRoot, 'v1', 'plugins'), jsonDocument(page), 'utf8'),
    writeFile(path.join(outputRoot, '_headers'), headersDocument(), 'utf8'),
    writeFile(path.join(outputRoot, '.nojekyll'), '', 'utf8')
  ])

  return {
    outputDir: outputRoot,
    manifestPath: path.join(outputRoot, 'manifest.json'),
    endpointPath: path.join(outputRoot, 'v1', 'plugins'),
    headersPath: path.join(outputRoot, '_headers'),
    manifest: rewrittenManifest,
    page
  }
}

async function main() {
  const [baseUrl, outputDir, ...extra] = process.argv.slice(2)
  if (!baseUrl || extra.length > 0) {
    throw new Error('Usage: npm run build:provider-site -- https://host/path [artifacts/output-dir]')
  }
  const result = await buildProviderSite(baseUrl, outputDir)
  console.log(JSON.stringify({
    outputDir: result.outputDir,
    manifestPath: result.manifestPath,
    endpointPath: result.endpointPath,
    headersPath: result.headersPath,
    endpoint: result.manifest.transport.endpoint,
    itemCount: result.page.items?.length ?? 0
  }))
}

const isMain = process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  main().catch(cause => {
    console.error(`Provider site build failed: ${cause instanceof Error ? cause.message : String(cause)}`)
    process.exitCode = 1
  })
}
