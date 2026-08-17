import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTarget, satisfiesRange, verifyTarget } from '../dist/index.js'

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
  assert.equal(receipt.plugin?.id, 'dsh-forge-fixture-healthy')
  assert.equal(receipt.checks.find((check) => check.id === 'package.pack-smoke')?.status, 'pass')
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
