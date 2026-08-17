export type FindingSeverity = 'error' | 'warning' | 'info'

export type CheckStatus = 'pass' | 'fail' | 'not-run'

export interface Finding {
  code: string
  severity: FindingSeverity
  message: string
  evidence?: string
}

export interface CheckResult {
  id: string
  status: CheckStatus
  summary: string
}

export interface ForgeManifest {
  id?: string
  compatibleWith?: string
  permissions?: string[]
  platforms?: string[]
  requiresRestart?: boolean
  nativeBinaries?: boolean
}

export interface PluginManifest {
  id: string
  version: string
  description?: string
  dshBundle: boolean
  dshClient: boolean
  forge?: ForgeManifest
  peerDependencies: Record<string, string>
  dependencies: Record<string, string>
  scripts: Record<string, string>
  packageJson: Record<string, unknown>
}

export interface VerifyOptions {
  dshVersion: string
  platform: string
  smoke: boolean
}

export interface LoadTargetOptions {
  ref?: string
  packagePath?: string
}

export interface VerifyReceipt {
  schemaVersion: '0.2'
  generatedAt: string
  verifier: {
    name: 'dsh-forge'
    version: string
  }
  target: {
    kind: 'local' | 'github'
    reference: string
    ref?: string
    packagePath?: string
    commitSha?: string
    packageBlobSha?: string
    repositoryId?: number
    license?: string | null
    archived?: boolean
  }
  baseline: {
    dshVersion: string
    platform: string
  }
  plugin?: {
    id: string
    version: string
    description?: string
  }
  status: 'pass' | 'warn' | 'fail'
  checks: CheckResult[]
  findings: Finding[]
  notes: string[]
}

export interface LoadedTarget {
  target: VerifyReceipt['target']
  packageJson: Record<string, unknown>
  localPath?: string
}
