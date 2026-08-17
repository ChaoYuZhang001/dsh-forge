import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { renderCatalogManifest, renderCatalogPage } from '../dist/index.js'

const sourceSchemaPath = new URL('../schemas/desktop-market/catalog-source.schema.json', import.meta.url)
const pageSchemaPath = new URL('../schemas/desktop-market/catalog-provider-page.schema.json', import.meta.url)
const manifestPath = new URL('../catalog/manifest.json', import.meta.url)
const pagePath = new URL('../catalog/v1/plugins', import.meta.url)

const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
const sourceSchema = JSON.parse(await readFile(sourceSchemaPath, 'utf8'))
const pageSchema = JSON.parse(await readFile(pageSchemaPath, 'utf8'))
const validateSource = ajv.compile(sourceSchema)
const validatePage = ajv.compile(pageSchema)

function clone(value) {
  return structuredClone(value)
}

function assertSourceSemantics(manifest) {
  const endpoint = new URL(manifest.transport.endpoint)
  assert.equal(endpoint.protocol, 'https:')
  assert.equal(endpoint.username, '')
  assert.equal(endpoint.password, '')
  assert.equal(endpoint.search, '')
  assert.equal(endpoint.hash, '')
  assert.match(endpoint.pathname, /\/v1\/plugins$/u)
  assert.ok(manifest.query.defaultLimit <= manifest.query.maxLimit)
  if (manifest.query.supported.includes('sort')) assert.ok(manifest.query.sorts.length > 0)
  else assert.equal(manifest.query.sorts.length, 0)
}

function assertPageSemantics(page, effectiveLimit = 100) {
  assert.ok(page.items.length <= effectiveLimit)
  const ids = page.items.map(item => item.id)
  assert.equal(new Set(ids).size, ids.length)
}

function assertSchemaRejects(validate, value, message) {
  assert.equal(validate(value), false, message)
  assert.ok(validate.errors?.length, message)
}

function sampleMatrix() {
  return {
    schemaVersion: '0.1',
    generatedAt: '2026-08-18T00:00:00.000Z',
    generator: { name: 'dsh-gate', version: '0.4.0-alpha.2' },
    baseline: { dshVersion: '0.1.0-rc.7', platform: 'linux-x64' },
    counts: { pass: 1, warn: 0, fail: 0, error: 0 },
    entries: [{
      id: 'sample-plugin',
      displayName: 'Sample plugin',
      target: 'https://github.com/example/sample-plugin',
      repository: 'https://github.com/example/sample-plugin',
      categories: ['tools'],
      status: 'pass',
      receipt: {
        schemaVersion: '0.3',
        generatedAt: '2026-08-18T00:00:00.000Z',
        verifier: { name: 'dsh-gate', version: '0.4.0-alpha.2' },
        target: {
          kind: 'github',
          reference: 'https://github.com/example/sample-plugin',
          packagePath: 'package.json',
          commitSha: 'a'.repeat(40),
          license: 'MIT',
          archived: false
        },
        baseline: { dshVersion: '0.1.0-rc.7', platform: 'linux-x64' },
        plugin: { id: 'sample-plugin', version: '1.0.0', description: 'Sample', permissions: ['network'] },
        status: 'pass',
        checks: [],
        findings: [],
        notes: []
      }
    }]
  }
}

test('pins the Desktop 1.0.0 wire schemas to the reviewed source commit', async () => {
  const expected = {
    'catalog-source.schema.json': '8e6dcaaa93dca426a399ba12f8d5bf57e586865b32c003de4ab79a42faf2b48b',
    'catalog-provider-page.schema.json': 'c527283b110cebf6e537172376cd2802ac45bafd3ea683b31a282faea61ceb5a'
  }
  for (const [name, url] of Object.entries({
    'catalog-source.schema.json': sourceSchemaPath,
    'catalog-provider-page.schema.json': pageSchemaPath
  })) {
    const normalizedSchema = (await readFile(url, 'utf8')).replace(/\r\n/gu, '\n')
    const digest = createHash('sha256').update(normalizedSchema).digest('hex')
    assert.equal(digest, expected[name], `${name} changed without updating the pinned source record`)
  }
})

test('checked-in catalog output conforms to the Desktop provider contract', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const page = JSON.parse(await readFile(pagePath, 'utf8'))
  assert.equal(validateSource(manifest), true, JSON.stringify(validateSource.errors))
  assert.equal(validatePage(page), true, JSON.stringify(validatePage.errors))
  assertSourceSemantics(manifest)
  assertPageSemantics(page, manifest.query.defaultLimit)
})

test('renderer output conforms to the Desktop provider contract', () => {
  const manifest = renderCatalogManifest('https://example.com/dsh-gate')
  const page = renderCatalogPage(sampleMatrix())
  assert.equal(validateSource(manifest), true, JSON.stringify(validateSource.errors))
  assert.equal(validatePage(page), true, JSON.stringify(validatePage.errors))
  assertSourceSemantics(manifest)
  assertPageSemantics(page, manifest.query.defaultLimit)
})

test('rejects unsafe or ambiguous provider input', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const page = JSON.parse(await readFile(pagePath, 'utf8'))

  const httpManifest = clone(manifest)
  httpManifest.transport.endpoint = 'http://example.com/v1/plugins'
  assertSchemaRejects(validateSource, httpManifest, 'HTTP endpoint must be rejected')

  const unknownManifestField = clone(manifest)
  unknownManifestField.enabled = true
  assertSchemaRejects(validateSource, unknownManifestField, 'unknown source fields must be rejected')

  const invalidLimitManifest = clone(manifest)
  invalidLimitManifest.query.defaultLimit = 30
  invalidLimitManifest.query.maxLimit = 20
  assert.equal(validateSource(invalidLimitManifest), true, 'schema leaves cross-field limit semantics to the host')
  assert.throws(() => assertSourceSemantics(invalidLimitManifest))

  const missingIdentityPage = clone(page)
  delete missingIdentityPage.items[0].repository
  delete missingIdentityPage.items[0].package
  assertSchemaRejects(validatePage, missingIdentityPage, 'items need repository or package identity')

  const remoteCommandPage = clone(page)
  remoteCommandPage.items[0].installCommand = 'npm install untrusted-package'
  assertSchemaRejects(validatePage, remoteCommandPage, 'remote install commands must be rejected')

  const controlCharacterPage = clone(page)
  controlCharacterPage.items[0].summary = 'unsafe\u202e text'
  assertSchemaRejects(validatePage, controlCharacterPage, 'bidi controls must be rejected')

  const overLimitPage = clone(page)
  overLimitPage.items = Array.from({ length: 101 }, (_, index) => ({
    ...clone(page.items[0]),
    id: `plugin-${index}`
  }))
  assertSchemaRejects(validatePage, overLimitPage, 'provider pages over the schema item limit must be rejected')
  assertPageSemantics(page, 20)
  assert.throws(() => assertPageSemantics(overLimitPage, 20))
})
