import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const MAX_BODY_BYTES = 2 * 1024 * 1024
const MAX_REDIRECTS = 3
const REQUEST_TIMEOUT_MS = 30_000
const JSON_CONTENT_TYPE = /^(?:application\/json|application\/[^;]+\+json)(?:;|$)/iu

const sourceSchemaUrl = new URL('../schemas/desktop-market/catalog-source.schema.json', import.meta.url)
const pageSchemaUrl = new URL('../schemas/desktop-market/catalog-provider-page.schema.json', import.meta.url)

function checkedHttpsUrl(value, label) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} must be an absolute URL.`)
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port && url.port !== '443') {
    throw new Error(`${label} must be credential-free HTTPS without a fragment or non-standard port.`)
  }
  return url
}

export async function fetchJson(start, signal, redirectCount = 0, fetchImplementation = fetch) {
  if (redirectCount > MAX_REDIRECTS) throw new Error(`Too many redirects while fetching ${start}.`)
  const url = checkedHttpsUrl(start, 'Provider URL')
  const response = await fetchImplementation(url, {
    headers: {
      accept: 'application/json',
      'accept-encoding': 'identity',
      'user-agent': 'dsh-gate-provider-smoke/0.1'
    },
    redirect: 'manual',
    signal
  })

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (!location) throw new Error(`${url.href} returned a redirect without Location.`)
    return fetchJson(new URL(location, url).href, signal, redirectCount + 1, fetchImplementation)
  }
  if (!response.ok) throw new Error(`${url.href} returned HTTP ${response.status}.`)

  const contentType = response.headers.get('content-type') ?? ''
  if (!JSON_CONTENT_TYPE.test(contentType)) {
    throw new Error(`${url.href} returned Content-Type ${contentType || '(missing)'}; expected application/json.`)
  }
  const contentEncoding = response.headers.get('content-encoding')
  if (contentEncoding !== null && contentEncoding !== 'identity') {
    throw new Error(`${url.href} returned unsupported Content-Encoding ${contentEncoding}.`)
  }

  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    throw new Error(`${url.href} declared a body larger than ${MAX_BODY_BYTES} bytes.`)
  }
  const body = Buffer.from(await response.arrayBuffer())
  if (body.length > MAX_BODY_BYTES) throw new Error(`${url.href} returned a body larger than ${MAX_BODY_BYTES} bytes.`)

  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(body)
    return { finalUrl: url.href, value: JSON.parse(text) }
  } catch {
    throw new Error(`${url.href} did not return valid UTF-8 JSON.`)
  }
}

function validateDocument(validate, value, label) {
  if (!validate(value)) throw new Error(`${label} failed schema validation: ${JSON.stringify(validate.errors)}`)
}

export function validateManifestSemantics(manifest) {
  const endpoint = checkedHttpsUrl(manifest.transport.endpoint, 'Provider endpoint')
  if (endpoint.search || !endpoint.pathname.endsWith('/v1/plugins')) {
    throw new Error('Provider endpoint must have no query and end in /v1/plugins.')
  }
  if (manifest.query.defaultLimit > manifest.query.maxLimit) {
    throw new Error('Provider defaultLimit must not exceed maxLimit.')
  }
  if (manifest.query.supported.includes('sort') !== (manifest.query.sorts.length > 0)) {
    throw new Error('Provider sorts must be present exactly when sort queries are supported.')
  }
  return endpoint
}

export function validatePageSemantics(page, effectiveLimit) {
  if (page.items.length > effectiveLimit) {
    throw new Error(`Provider returned ${page.items.length} items for an effective limit of ${effectiveLimit}.`)
  }
  const ids = page.items.map(item => item.id)
  if (new Set(ids).size !== ids.length) throw new Error('Provider returned duplicate item IDs.')
}

async function main() {
  const manifestInput = process.argv[2]
  if (!manifestInput) throw new Error('Usage: npm run verify:provider -- https://host/path/manifest.json')
  const manifestUrl = checkedHttpsUrl(manifestInput, 'Manifest URL')
  if (manifestUrl.search) throw new Error('Manifest URL must not contain a query string.')

  const ajv = new Ajv2020({ allErrors: true, strict: true })
  addFormats(ajv)
  const [sourceSchema, pageSchema] = await Promise.all([
    readFile(sourceSchemaUrl, 'utf8').then(JSON.parse),
    readFile(pageSchemaUrl, 'utf8').then(JSON.parse)
  ])
  const validateSource = ajv.compile(sourceSchema)
  const validatePage = ajv.compile(pageSchema)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const manifestResponse = await fetchJson(manifestUrl.href, controller.signal)
    validateDocument(validateSource, manifestResponse.value, 'Manifest')
    const endpoint = validateManifestSemantics(manifestResponse.value)
    const pageResponse = await fetchJson(endpoint.href, controller.signal)
    validateDocument(validatePage, pageResponse.value, 'Provider page')
    validatePageSemantics(pageResponse.value, manifestResponse.value.query.defaultLimit)
    console.log(JSON.stringify({
      manifestUrl: manifestResponse.finalUrl,
      endpointUrl: pageResponse.finalUrl,
      providerId: manifestResponse.value.providerId,
      revision: pageResponse.value.revision,
      itemCount: pageResponse.value.items.length
    }))
  } finally {
    clearTimeout(timeout)
  }
}

const isMain = process.argv[1] !== undefined && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  main().catch(cause => {
    const message = cause instanceof Error ? cause.message : String(cause)
    console.error(`Provider smoke failed: ${message}`)
    process.exitCode = 1
  })
}
