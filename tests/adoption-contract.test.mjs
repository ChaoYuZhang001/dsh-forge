import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const packageJson = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))
const releaseRef = `ChaoYuZhang001/dsh-gate@v${packageJson.version}`

async function text(path) {
  return readFile(new URL(path, root), 'utf8').then(source => source.replace(/\r\n/gu, '\n'))
}

test('keeps public Action adoption examples on the current release', async () => {
  for (const path of [
    'README.md',
    'README.zh-CN.md',
    'docs/adoption.md',
    'docs/plugin-author-quickstart.md',
    'examples/github-actions/dsh-gate.yml'
  ]) {
    const source = await text(path)
    assert.match(source, new RegExp(releaseRef.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'), `${path} must reference ${releaseRef}`)
  }
})

test('keeps the copyable workflow read-only and bound to immutable source input', async () => {
  const workflow = await text('examples/github-actions/dsh-gate.yml')
  assert.match(workflow, /permissions:\n  contents: read\n/u)
  assert.match(workflow, new RegExp(releaseRef.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u'))
  assert.match(workflow, /target: \$\{\{ github\.event\.pull_request\.head\.repo\.html_url \|\| github\.event\.repository\.html_url \}\}/u)
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/u)
  assert.match(workflow, /smoke: 'false'/u)
  assert.doesNotMatch(workflow, /actions\/checkout@/u)
  assert.doesNotMatch(workflow, /secrets\./u)
  assert.doesNotMatch(workflow, /write/u)
})

test('keeps self-service adoption consented and public-only', async () => {
  const form = await text('.github/ISSUE_TEMPLATE/adoption.yml')
  const quickstart = await text('docs/plugin-author-quickstart.md')

  assert.match(form, /labels: \[plugin, ci, help wanted, "status:needs-triage"\]/u)
  assert.match(form, /label: Public plugin repository/u)
  assert.match(form, /I maintain this repository or I am authorized by its maintainer/u)
  assert.match(form, /require no credentials or private fixtures/u)
  assert.match(form, /not a security audit or endorsement/u)
  assert.match(form, /workflow permissions at contents read/u)
  assert.match(quickstart, /issues\/new\?template=adoption\.yml/u)
})
