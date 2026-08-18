import { readFile } from 'node:fs/promises'
import net from 'node:net'
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

function parseIpv4(value) {
  const parts = value.split('.')
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/u.test(part))) return undefined
  const octets = parts.map(Number)
  if (octets.some(octet => octet > 255)) return undefined
  return octets
}

function isUnsafeIpv4(value) {
  const octets = parseIpv4(value)
  if (octets === undefined) return false
  const [first, second] = octets
  return first === 0 || first === 10 || first === 127 ||
    first === 169 && second === 254 ||
    first === 172 && second >= 16 && second <= 31 ||
    first === 192 && second === 168 ||
    first === 100 && second >= 64 && second <= 127 ||
    first === 198 && second >= 18 && second <= 19 ||
    first >= 224
}

function parseIpv6(value) {
  let normalized = value.toLowerCase().split('%', 1)[0]
  if (normalized.includes('.')) {
    const separator = normalized.lastIndexOf(':')
    const octets = parseIpv4(normalized.slice(separator + 1))
    if (separator < 0 || octets === undefined) return undefined
    const first = ((octets[0] << 8) | octets[1]).toString(16)
    const second = ((octets[2] << 8) | octets[3]).toString(16)
    normalized = `${normalized.slice(0, separator + 1)}${first}:${second}`
  }

  const sections = normalized.split('::')
  if (sections.length > 2) return undefined
  const parseSection = section => {
    if (!section) return []
    const values = section.split(':').map(part => Number.parseInt(part, 16))
    return values.some(valuePart => !Number.isInteger(valuePart) || valuePart < 0 || valuePart > 0xffff)
      ? undefined
      : values
  }
  const left = parseSection(sections[0])
  const right = parseSection(sections[1] ?? '')
  if (left === undefined || right === undefined) return undefined
  const missing = 8 - left.length - right.length
  if (sections.length === 1 && missing !== 0 || sections.length === 2 && missing < 1) return undefined
  return [...left, ...Array.from({ length: missing }, () => 0), ...right]
}

function isUnsafeIpv6(value) {
  const sections = parseIpv6(value)
  if (sections === undefined) return false
  const bytes = sections.flatMap(section => [section >> 8, section & 0xff])
  const allZero = bytes.every(byte => byte === 0)
  const loopback = allZero || bytes.slice(0, 15).every(byte => byte === 0) && bytes[15] === 1
  const uniqueLocal = (bytes[0] & 0xfe) === 0xfc
  const linkLocal = bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80
  const multicast = bytes[0] === 0xff
  const mappedIpv4 = bytes.slice(0, 10).every(byte => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff
  const compatibleIpv4 = bytes.slice(0, 12).every(byte => byte === 0)
  const tail = bytes.slice(12).join('.')
  return loopback || uniqueLocal || linkLocal || multicast ||
    mappedIpv4 && isUnsafeIpv4(tail) ||
    compatibleIpv4 && isUnsafeIpv4(tail)
}

function isUnsafeHostname(value) {
  const hostname = value.replace(/^\[|\]$/gu, '').toLowerCase().replace(/\.$/u, '')
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) return true
  const addressType = net.isIP(hostname)
  return addressType === 4 ? isUnsafeIpv4(hostname) : addressType === 6 && isUnsafeIpv6(hostname)
}

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
  if (isUnsafeHostname(url.hostname)) {
    throw new Error(`${label} must not target localhost or a private address.`)
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
