import test from 'node:test'
import assert from 'node:assert/strict'
import { generateMatrix, parseMatrixConfig, renderCatalogManifest, renderCatalogPage, renderMatrixMarkdown } from '../dist/index.js'

test('parses and sorts matrix targets without guessing duplicates', () => {
  const config = parseMatrixConfig({
    schemaVersion: '0.1',
    baseline: { dshVersion: '0.1.0-rc.7', platform: 'linux-x64' },
    targets: [
      { id: 'z', target: 'fixtures/public/healthy-plugin' },
      { id: 'a', target: 'fixtures/public/incompatible-plugin', categories: ['tools', 'tools'] }
    ]
  })
  assert.deepEqual(config.targets.map(target => target.id), ['a', 'z'])
  assert.deepEqual(config.targets[0].categories, ['tools'])
  assert.throws(() => parseMatrixConfig({
    schemaVersion: '0.1',
    baseline: { dshVersion: '0.1.0-rc.7', platform: 'linux-x64' },
    targets: [{ id: 'same', target: 'a' }, { id: 'same', target: 'b' }]
  }), /Duplicate matrix target id/)
})

test('generates a local matrix with normalized timestamp and counts', async () => {
  const previous = process.env.SOURCE_DATE_EPOCH
  process.env.SOURCE_DATE_EPOCH = '1787011200'
  try {
    const matrix = await generateMatrix({
      schemaVersion: '0.1',
      baseline: { dshVersion: '0.1.0-rc.7', platform: 'linux-x64' },
      targets: [{ id: 'healthy', target: 'fixtures/public/healthy-plugin', categories: ['tools'] }]
    }, { concurrency: 1 })
    assert.equal(matrix.generatedAt, '2026-08-18T00:00:00.000Z')
    assert.equal(matrix.entries[0].status, 'pass')
    assert.deepEqual(matrix.counts, { pass: 1, warn: 0, fail: 0, error: 0 })
    assert.match(renderMatrixMarkdown(matrix), /# DSH Gate Compatibility Matrix/)
  } finally {
    if (previous === undefined) delete process.env.SOURCE_DATE_EPOCH
    else process.env.SOURCE_DATE_EPOCH = previous
  }
})

test('renders a Desktop Catalog Provider page with visible verification status', () => {
  const matrix = {
    schemaVersion: '0.1',
    generatedAt: '2026-08-18T00:00:00.000Z',
    generator: { name: 'dsh-gate', version: '0.4.0-alpha.1' },
    baseline: { dshVersion: '0.1.0-rc.7', platform: 'linux-x64' },
    counts: { pass: 0, warn: 1, fail: 0, error: 0 },
    entries: [{
      id: 'healthy',
      displayName: 'Healthy plugin',
      target: 'https://github.com/example/healthy',
      repository: 'https://github.com/example/healthy',
      categories: ['tools'],
      status: 'warn',
      receipt: {
        schemaVersion: '0.3',
        generatedAt: '2026-08-18T00:00:00.000Z',
        verifier: { name: 'dsh-gate', version: '0.4.0-alpha.1' },
        target: { kind: 'github', reference: 'https://github.com/example/healthy', packagePath: 'package.json', commitSha: 'a'.repeat(40), license: 'MIT', archived: false },
        baseline: { dshVersion: '0.1.0-rc.7', platform: 'linux-x64' },
        plugin: { id: 'example-plugin', version: '1.0.0', description: 'Example', permissions: ['network'] },
        status: 'warn',
        checks: [],
        findings: [{ code: 'example', severity: 'warning', message: 'review' }],
        notes: []
      }
    }]
  }
  const manifest = renderCatalogManifest('https://example.com/dsh-gate')
  const page = renderCatalogPage(matrix)
  assert.equal(manifest.transport.endpoint, 'https://example.com/dsh-gate/v1/plugins')
  assert.equal(page.items[0].categories.includes('verification.warn'), true)
  assert.deepEqual(page.items[0].package, { registry: 'npm', name: 'example-plugin' })
  assert.deepEqual(page.items[0].publisher, { name: 'example', url: 'https://github.com/example' })
})
