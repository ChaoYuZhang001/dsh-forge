import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchJson, validateManifestSemantics, validatePageSemantics } from '../scripts/provider-smoke.mjs'

test('provider smoke accepts JSON media types and safe semantic limits', async () => {
  const fetchImplementation = async () => new Response(JSON.stringify({ items: [] }), {
    headers: { 'content-type': 'application/vnd.dsh+json; charset=utf-8' },
    status: 200
  })
  const response = await fetchJson(
    'https://plugins.example/v1/plugins',
    new AbortController().signal,
    0,
    fetchImplementation
  )
  assert.deepEqual(response.value, { items: [] })
  assert.equal(response.finalUrl, 'https://plugins.example/v1/plugins')

  const endpoint = validateManifestSemantics({
    transport: { endpoint: 'https://plugins.example/v1/plugins' },
    query: { supported: [], defaultLimit: 20, maxLimit: 100, sorts: [] }
  })
  assert.equal(endpoint.href, 'https://plugins.example/v1/plugins')
  assert.doesNotThrow(() => validatePageSemantics({ items: [{ id: 'one' }] }, 20))
})

test('provider smoke rejects wrong media types, encodings, and duplicate items', async () => {
  const signal = new AbortController().signal
  await assert.rejects(
    fetchJson('https://plugins.example/v1/plugins', signal, 0, async () => new Response('{}', {
      headers: { 'content-type': 'application/octet-stream' }
    })),
    /expected application\/json/u
  )
  await assert.rejects(
    fetchJson('https://plugins.example/v1/plugins', signal, 0, async () => new Response('{}', {
      headers: { 'content-encoding': 'gzip', 'content-type': 'application/json' }
    })),
    /unsupported Content-Encoding/u
  )
  assert.throws(() => validatePageSemantics({ items: [{ id: 'same' }, { id: 'same' }] }, 20), /duplicate item IDs/u)
  assert.throws(() => validatePageSemantics({ items: [{ id: 'one' }, { id: 'two' }] }, 1), /effective limit/u)
})

test('provider smoke rejects local and private redirect targets', async () => {
  const signal = new AbortController().signal
  for (const target of [
    'https://localhost/v1/plugins',
    'https://127.0.0.1/v1/plugins',
    'https://10.0.0.1/v1/plugins',
    'https://172.16.0.1/v1/plugins',
    'https://192.168.1.1/v1/plugins',
    'https://[::1]/v1/plugins',
    'https://[fd00::1]/v1/plugins',
    'https://[fe80::1]/v1/plugins',
    'https://[::ffff:127.0.0.1]/v1/plugins'
  ]) {
    await assert.rejects(
      fetchJson(target, signal, 0, async () => new Response('{}', {
        headers: { 'content-type': 'application/json' }
      })),
      /localhost or a private address/u
    )
  }

  await assert.rejects(
    fetchJson('https://plugins.example/v1/plugins', signal, 0, async () => new Response(null, {
      status: 302,
      headers: { location: 'https://169.254.169.254/v1/plugins' }
    })),
    /localhost or a private address/u
  )
})
