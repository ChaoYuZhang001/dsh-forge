import { readFile } from 'node:fs/promises'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { LoadedTarget, VerifyReceipt } from '../types.js'

function isHttpTarget(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function parseGitHubTarget(value: string, ref: string): VerifyReceipt['target'] {
  const url = new URL(value)
  if (url.hostname !== 'github.com' && url.hostname !== 'raw.githubusercontent.com') {
    throw new Error('Only GitHub repository URLs are supported for remote verification.')
  }
  const parts = url.pathname.split('/').filter(Boolean)
  const owner = url.hostname === 'raw.githubusercontent.com' ? parts[0] : parts[0]
  const repository = url.hostname === 'raw.githubusercontent.com' ? parts[1] : parts[1]
  if (!owner || !repository) throw new Error('GitHub target must look like https://github.com/owner/repository.')
  return { kind: 'github', reference: `https://github.com/${owner}/${repository.replace(/\.git$/, '')}`, ref }
}

async function fetchRemotePackage(target: VerifyReceipt['target']): Promise<Record<string, unknown>> {
  const url = new URL(target.reference)
  const [owner, repository] = url.pathname.split('/').filter(Boolean)
  const headers: Record<string, string> = {
    'user-agent': 'dsh-forge/0.1.0-alpha.1',
    accept: 'application/vnd.github+json'
  }
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const apiUrl = `https://api.github.com/repos/${owner}/${repository}/contents/package.json?ref=${encodeURIComponent(target.ref ?? 'main')}`
  const apiResponse = await fetch(apiUrl, { headers })
  if (apiResponse.ok) {
    const payload: unknown = await apiResponse.json()
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('GitHub contents response is not an object.')
    const content = (payload as Record<string, unknown>).content
    if (typeof content !== 'string') throw new Error('GitHub contents response did not include package.json content.')
    const value: unknown = JSON.parse(Buffer.from(content.replace(/\s/g, ''), 'base64').toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Remote package.json is not a JSON object.')
    return value as Record<string, unknown>
  }

  // Raw hosting is a useful public fallback when the API is unavailable. The
  // token is read only from the process environment and is never placed in a
  // Receipt or interpolated into a URL.
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repository}/${target.ref ?? 'main'}/package.json`
  const rawResponse = await fetch(rawUrl, { headers })
  if (!rawResponse.ok) throw new Error(`Could not read package.json from ${target.reference} (API HTTP ${apiResponse.status}; raw HTTP ${rawResponse.status}).`)
  const value: unknown = await rawResponse.json()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Remote package.json is not a JSON object.')
  return value as Record<string, unknown>
}

export async function loadTarget(reference: string, ref = 'main'): Promise<LoadedTarget> {
  if (isHttpTarget(reference)) {
    const target = parseGitHubTarget(reference, ref)
    return { target, packageJson: await fetchRemotePackage(target) }
  }

  const localPath = path.resolve(reference)
  const packagePath = path.basename(localPath) === 'package.json' ? localPath : path.join(localPath, 'package.json')
  await access(packagePath)
  const raw = await readFile(packagePath, 'utf8')
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${packagePath} is not a JSON object.`)
  return { target: { kind: 'local', reference: path.relative(process.cwd(), localPath) || '.' }, packageJson: value as Record<string, unknown>, localPath: path.dirname(packagePath) }
}

export function currentFilePath(): string {
  return fileURLToPath(import.meta.url)
}
