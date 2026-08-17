import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { loadTarget, parseGitHubReference, renderActionSummary, satisfiesRange, verifyTarget, VERSION } from '../dist/index.js'

test('uses package.json as the single version source', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(VERSION, packageJson.version)
})

test('parses GitHub tree URLs and explicit slash refs deterministically', () => {
  assert.deepEqual(
    parseGitHubReference('https://github.com/owner/repository/tree/release/packages/plugin'),
    {
      reference: 'https://github.com/owner/repository',
      ref: 'release',
      packagePath: 'packages/plugin/package.json'
    }
  )
  assert.deepEqual(
    parseGitHubReference('https://github.com/owner/repository', { ref: 'feature/branch', packagePath: 'plugins/tool' }),
    {
      reference: 'https://github.com/owner/repository',
      ref: 'feature/branch',
      packagePath: 'plugins/tool/package.json'
    }
  )
})

test('retries transient GitHub failures and records resolved provenance', async () => {
  const originalFetch = globalThis.fetch
  const commitSha = 'a'.repeat(40)
  const blobSha = 'b'.repeat(40)
  let metadataAttempts = 0
  globalThis.fetch = async (input) => {
    const url = String(input)
    if (url === 'https://api.github.com/repos/owner/repository') {
      metadataAttempts += 1
      if (metadataAttempts === 1) return new Response('temporary', { status: 503 })
      return Response.json({ id: 42, default_branch: 'trunk', archived: false, license: { spdx_id: 'MIT' } })
    }
    if (url === 'https://api.github.com/repos/owner/repository/commits/trunk') return Response.json({ sha: commitSha })
    if (url === `https://api.github.com/repos/owner/repository/contents/package.json?ref=${commitSha}`) {
      const packageJson = {
        name: 'remote-fixture',
        version: '1.0.0',
        dsh: { bundle: { patch: './cordis.patch.yml' } }
      }
      return Response.json({ content: Buffer.from(JSON.stringify(packageJson)).toString('base64'), sha: blobSha })
    }
    return new Response('not found', { status: 404 })
  }

  try {
    const target = await loadTarget('https://github.com/owner/repository')
    assert.equal(metadataAttempts, 2)
    assert.deepEqual(target.target, {
      kind: 'github',
      reference: 'https://github.com/owner/repository',
      ref: 'trunk',
      packagePath: 'package.json',
      commitSha,
      packageBlobSha: blobSha,
      repositoryId: 42,
      license: 'MIT',
      archived: false
    })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('accepts an explicit prerelease comparator for DSH rc.7', () => {
  assert.equal(satisfiesRange('0.1.0-rc.7', '>=0.1.0-rc.1 <0.1.0 || >=0.1.0-rc.1 <0.2.0-0'), true)
})

test('rejects a broad range that silently excludes the DSH prerelease', () => {
  assert.equal(satisfiesRange('0.1.0-rc.7', '>=0.0.1-rc.1 <0.2.0'), false)
})

test('healthy fixture produces a passing receipt', async () => {
  const target = await loadTarget('fixtures/public/healthy-plugin')
  const receipt = await verifyTarget(target, {
    dshVersion: '0.1.0-rc.7',
    platform: 'darwin-arm64',
    smoke: true
  })
  assert.equal(receipt.status, 'pass')
  assert.equal(receipt.schemaVersion, '0.2')
  assert.equal(receipt.verifier.version, VERSION)
  assert.equal(receipt.target.packagePath, 'package.json')
  assert.equal(receipt.plugin?.id, 'dsh-forge-fixture-healthy')
  assert.equal(receipt.checks.find((check) => check.id === 'package.pack-smoke')?.status, 'pass')
})

test('discovers the only DSH plugin package in a local monorepo', async () => {
  const target = await loadTarget('fixtures/public/monorepo')
  assert.equal(target.target.packagePath, 'packages/example-plugin/package.json')
  assert.equal(target.packageJson.name, 'dsh-forge-fixture-monorepo-plugin')
  assert.match(target.localPath, /example-plugin$/)
})

test('supports an explicit local monorepo package path', async () => {
  const target = await loadTarget('fixtures/public/monorepo', { packagePath: 'packages/example-plugin' })
  assert.equal(target.target.packagePath, 'packages/example-plugin/package.json')
  await assert.rejects(
    loadTarget('fixtures/public/monorepo', { packagePath: '../healthy-plugin' }),
    /cannot contain/
  )
})

test('rejects ambiguous monorepos instead of guessing a package', async () => {
  await assert.rejects(
    loadTarget('fixtures/public/ambiguous-monorepo'),
    /Multiple DSH plugin packages found: packages\/first\/package.json, plugins\/second\/package.json/
  )
})

test('incompatible fixture fails without executing install code', async () => {
  const target = await loadTarget('fixtures/public/incompatible-plugin')
  const receipt = await verifyTarget(target, {
    dshVersion: '0.1.0-rc.7',
    platform: 'darwin-arm64',
    smoke: false
  })
  assert.equal(receipt.status, 'fail')
  assert.ok(receipt.findings.some((finding) => finding.code === 'manifest.client-only'))
  assert.ok(receipt.findings.some((finding) => finding.code === 'dsh.peer-range-failed'))
})

test('renders a complete and escaped GitHub Actions summary', async () => {
  const target = await loadTarget('fixtures/public/healthy-plugin')
  const receipt = await verifyTarget(target, {
    dshVersion: '0.1.0-rc.7',
    platform: 'linux-x64',
    smoke: false
  })
  receipt.checks[0].summary = 'safe | readable'
  const summary = renderActionSummary(receipt)
  assert.match(summary, /### DSH Forge Receipt/)
  assert.match(summary, /dsh-forge-fixture-healthy@1\.0\.0/)
  assert.match(summary, /safe \\| readable/)
  assert.match(summary, /Static verification only/)
})
