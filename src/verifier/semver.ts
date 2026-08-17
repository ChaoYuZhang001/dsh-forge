export interface Version {
  major: number
  minor: number
  patch: number
  prerelease: string[]
}

export function parseVersion(input: string): Version | undefined {
  const match = input.trim().replace(/^v/, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/)
  if (!match) return undefined
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : []
  }
}

function compareIdentifiers(left: string, right: string): number {
  const leftNumber = /^\d+$/.test(left)
  const rightNumber = /^\d+$/.test(right)
  if (leftNumber && rightNumber) return Number(left) - Number(right)
  if (leftNumber) return -1
  if (rightNumber) return 1
  return left < right ? -1 : left > right ? 1 : 0
}

export function compareVersions(left: Version, right: Version): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] - right[key]
  }
  if (!left.prerelease.length && !right.prerelease.length) return 0
  if (!left.prerelease.length) return 1
  if (!right.prerelease.length) return -1
  const length = Math.max(left.prerelease.length, right.prerelease.length)
  for (let index = 0; index < length; index += 1) {
    if (left.prerelease[index] === undefined) return -1
    if (right.prerelease[index] === undefined) return 1
    const result = compareIdentifiers(left.prerelease[index], right.prerelease[index])
    if (result !== 0) return result
  }
  return 0
}

function makeVersion(major: number, minor: number, patch: number, prerelease: string[] = []): Version {
  return { major, minor, patch, prerelease }
}

function compareToken(version: Version, operator: string, expected: Version): boolean {
  const comparison = compareVersions(version, expected)
  if (operator === '>') return comparison > 0
  if (operator === '>=') return comparison >= 0
  if (operator === '<') return comparison < 0
  if (operator === '<=') return comparison <= 0
  return comparison === 0
}

function prereleaseComparatorMatches(version: Version, token: string): boolean {
  const parsed = parseVersion(token.replace(/^[<>=~^]+/, ''))
  return Boolean(parsed?.prerelease.length && parsed.major === version.major && parsed.minor === version.minor && parsed.patch === version.patch)
}

function satisfiesBranch(version: Version, branch: string): boolean {
  const normalized = branch.trim()
  if (!normalized || normalized === '*' || normalized.toLowerCase() === 'latest') return !version.prerelease.length
  const tokens = normalized.split(/\s+/).filter(Boolean)
  if (version.prerelease.length && !tokens.some((token) => prereleaseComparatorMatches(version, token))) return false

  return tokens.every((token) => {
    if (token === '*' || token.toLowerCase() === 'x') return true
    if (token.startsWith('^')) {
      const lower = parseVersion(token.slice(1))
      if (!lower) return false
      const upper = lower.major > 0
        ? makeVersion(lower.major + 1, 0, 0)
        : lower.minor > 0
          ? makeVersion(0, lower.minor + 1, 0)
          : makeVersion(0, 0, lower.patch + 1)
      return compareVersions(version, lower) >= 0 && compareVersions(version, upper) < 0
    }
    if (token.startsWith('~')) {
      const lower = parseVersion(token.slice(1))
      if (!lower) return false
      return compareVersions(version, lower) >= 0 && compareVersions(version, makeVersion(lower.major, lower.minor + 1, 0)) < 0
    }
    const match = token.match(/^(>=|<=|>|<|=)?(.+)$/)
    if (!match) return false
    const expected = parseVersion(match[2])
    if (!expected) return false
    return compareToken(version, match[1] ?? '=', expected)
  })
}

/**
 * Deliberately small semver support for the first verifier. In particular,
 * prerelease DSH versions require an explicit comparator on the same
 * major.minor.patch tuple, matching node-semver's prerelease rule.
 */
export function satisfiesRange(versionText: string, range: string): boolean {
  const version = parseVersion(versionText)
  if (!version) return false
  return range.split('||').some((branch) => satisfiesBranch(version, branch))
}
