import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { buildProviderSite, normalizeBaseUrl, resolveOutputDir } from '../scripts/build-provider-site.mjs'

const sourceSchemaPath = new URL('../schemas/desktop-market/catalog-source.schema.json', import.meta.url)
const pageSchemaPath = new URL('../schemas/desktop-market/catalog-provider-page.schema.json', import.meta.url)

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const validateSource = ajv.compile(JSON.parse(await readFile(sourceSchemaPath, 'utf8')))
const validatePage = ajv.compile(JSON.parse(await readFile(pageSchemaPath, 'utf8')))

test('builds a credential-free static Provider site with exact JSON endpoints', async () => {
  await mkdir(path.join(process.cwd(), 'artifacts'), { recursive: true })
  const outputDir = await mkdtemp(path.join(process.cwd(), 'artifacts', 'dsh-gate-provider-'))
  try {
    const result = await buildProviderSite('https://provider.example/catalog/', outputDir)
    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'))
    const page = JSON.parse(await readFile(result.endpointPath, 'utf8'))
    const headers = await readFile(result.headersPath, 'utf8')

    assert.equal(manifest.transport.endpoint, 'https://provider.example/catalog/v1/plugins')
    assert.equal(JSON.parse(await readFile(path.join(result.outputDir, 'manifest.json'), 'utf8')).transport.endpoint, manifest.transport.endpoint)
    assert.equal(validateSource(manifest), true, JSON.stringify(validateSource.errors))
    assert.equal(validatePage(page), true, JSON.stringify(validatePage.errors))
    assert.equal(headers, [
      '/manifest.json',
      '  Content-Type: application/json; charset=utf-8',
      '  X-Content-Type-Options: nosniff',
      '',
      '/v1/plugins',
      '  Content-Type: application/json; charset=utf-8',
      '  X-Content-Type-Options: nosniff',
      ''
    ].join('\n'))
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})

test('rejects credentials, query strings, fragments, unsafe base paths, and unsafe output paths', () => {
  assert.equal(normalizeBaseUrl('https://provider.example/catalog///'), 'https://provider.example/catalog')
  for (const value of [
    'http://provider.example/catalog',
    'https://user:pass@provider.example/catalog',
    'https://provider.example/catalog?token=secret',
    'https://provider.example/catalog#fragment',
    'https://provider.example/catalog/../private',
    'https://provider.example/catalog/%2e%2e/private',
    'https://provider.example:8443/catalog'
  ]) {
    assert.throws(() => normalizeBaseUrl(value), /Provider base URL/u)
  }
  for (const value of ['.', 'artifacts', '../outside', '/tmp/provider-site']) {
    assert.throws(() => resolveOutputDir(value), /child of the repository artifacts/u)
  }
})
