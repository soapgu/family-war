import type { BrowserContext, Page } from '@playwright/test'

/** 验收测试运行配置。 */
export interface AcceptanceConfig {
  adminBaseURL: string
  apiBaseURL: string
  apiPath: string
  adminPassword: string
  headless: boolean
  stepTimeoutOverride?: number
  screenshotDir: string
}

/** 可恢复、可续跑的验收状态。 */
export interface AcceptanceState {
  schemaVersion: number
  gitCommit: string
  adminBaseURL: string
  apiBaseURL: string
  planVersion: string
  completed: string[]
  current: string | null
  failed: string[]
  startedAt: string | null
}

/** 单个验收步骤写入报告的接口。 */
export interface AcceptanceReporter {
  onStepStart(id: string, name: string): void
  onStepPass(id: string, detailLines?: string[]): void
  onStepFail(id: string, detailLines: string[], error?: unknown): void
  onStepSkip(id: string, reason: string): void
  getSummary(): ReportSummary
  finish(endTime: Date): void
}

/** 验收报告汇总。 */
export interface ReportSummary {
  passed: number
  failed: number
  skipped: number
  total: number
}

/** 每个步骤共享的执行上下文。 */
export interface StepContext {
  state: AcceptanceState
  page: Page
  config: AcceptanceConfig
  reporter: AcceptanceReporter
  context: BrowserContext
}

/** 验收步骤模块必须实现的结构。 */
export interface AcceptanceStep {
  id: string
  name: string
  requiresAuth: boolean
  timeoutMs?: number
  run(context: StepContext): Promise<void>
}

/** 词库配置恢复登记项。 */
export interface WordConfigRecoveryEntry {
  type: 'wordConfig'
  backupPath: string
}

/** 图片恢复登记项。 */
export interface ImageRecoveryEntry {
  type: 'image'
  word: string
  originalPath: string
  backupPath: string
  originalHash: string
}

/** 验收过程中可能登记的恢复操作。 */
export type RecoveryEntry = WordConfigRecoveryEntry | ImageRecoveryEntry

/** 恢复登记文件的结构。 */
export interface RecoveryData {
  schemaVersion: number
  pending: RecoveryEntry[]
}
