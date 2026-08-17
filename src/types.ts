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

export interface GateManifest {
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
  gate?: GateManifest
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
  schemaVersion: '0.3'
  generatedAt: string
  verifier: {
    name: 'dsh-gate'
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
    compatibleWith?: string
    permissions: string[]
    platforms?: string[]
    requiresRestart?: boolean
    nativeBinaries?: boolean
  }
  status: 'pass' | 'warn' | 'fail'
  checks: CheckResult[]
  findings: Finding[]
  notes: string[]
}

export interface MatrixTarget {
  id: string
  target: string
  displayName?: string
  ref?: string
  packagePath?: string
  categories?: string[]
}

export interface MatrixConfig {
  schemaVersion: '0.1'
  baseline: {
    dshVersion: string
    platform: string
  }
  targets: MatrixTarget[]
}

export interface CompatibilityMatrixEntry {
  id: string
  displayName: string
  target: string
  repository?: string
  requestedRef?: string
  packagePath?: string
  categories: string[]
  status: VerifyReceipt['status'] | 'error'
  receipt?: VerifyReceipt
  error?: string
}

export interface CompatibilityMatrix {
  schemaVersion: '0.1'
  generatedAt: string
  generator: {
    name: 'dsh-gate'
    version: string
  }
  baseline: MatrixConfig['baseline']
  counts: Record<CompatibilityMatrixEntry['status'], number>
  entries: CompatibilityMatrixEntry[]
}

export interface LoadedTarget {
  target: VerifyReceipt['target']
  packageJson: Record<string, unknown>
  localPath?: string
}
