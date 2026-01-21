/**
 * Worker Logger
 * Structured logging utility for worker threads with consistent formatting
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LoggerOptions {
  /** Prefix for log messages (usually worker name) */
  prefix: string
  /** Minimum log level to output */
  level?: LogLevel
  /** Whether to include timestamp */
  includeTimestamp?: boolean
  /** Whether to include PID */
  includePid?: boolean
}

/**
 * Create a logger instance for a worker
 */
export function createWorkerLogger(options: LoggerOptions): WorkerLogger {
  return new WorkerLogger(options)
}

/**
 * Worker Logger class
 */
export class WorkerLogger {
  private readonly prefix: string
  private readonly level: LogLevel
  private readonly includeTimestamp: boolean
  private readonly includePid: boolean

  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  }

  constructor(options: LoggerOptions) {
    this.prefix = options.prefix
    this.level = options.level ?? 'info'
    this.includeTimestamp = options.includeTimestamp ?? true
    this.includePid = options.includePid ?? true
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.level]
  }

  /**
   * Format log message with prefix and optional metadata
   */
  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const parts: string[] = []

    if (this.includeTimestamp) {
      const now = new Date()
      const timeStr = now.toISOString().split('T')[1].replace('Z', '')
      parts.push(`[${timeStr}]`)
    }

    const pid = process.pid
    const levelUpper = level.toUpperCase().padEnd(5)
    parts.push(`[${levelUpper}]`)

    if (this.includePid) {
      parts.push(`[PID:${pid}]`)
    }

    parts.push(`[${this.prefix}]`)
    parts.push(message)

    if (data !== undefined) {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      parts.push(dataStr)
    }

    return parts.join(' ')
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: unknown): void {
    if (!this.shouldLog('debug')) return
    console.debug(this.formatMessage('debug', message, data))
  }

  /**
   * Log an info message
   */
  info(message: string, data?: unknown): void {
    if (!this.shouldLog('info')) return
    console.log(this.formatMessage('info', message, data))
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: unknown): void {
    if (!this.shouldLog('warn')) return
    console.warn(this.formatMessage('warn', message, data))
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown): void {
    if (!this.shouldLog('error')) return
    const errorInfo = error instanceof Error ? error.message : error
    console.error(this.formatMessage('error', message, errorInfo))
  }

  /**
   * Log an error with full stack trace
   */
  errorWithStack(message: string, error: Error): void {
    if (!this.shouldLog('error')) return
    console.error(this.formatMessage('error', message, error.stack ?? error.message))
  }

  /**
   * Log a progress update (formatted for readability)
   */
  progress(current: number, total: number, extra?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0
    const progressBar = this.createProgressBar(percentage)
    const parts = [`${progressBar} ${percentage}%`]

    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        parts.push(`${key}=${value}`)
      }
    }

    console.log(this.formatMessage('info', parts.join(' | ')))
  }

  /**
   * Create a simple ASCII progress bar
   */
  private createProgressBar(percentage: number, width: number = 20): string {
    const filled = Math.round((percentage / 100) * width)
    const empty = width - filled
    const bar = '█'.repeat(filled) + '░'.repeat(empty)
    return `[${bar}]`
  }

  /**
   * Create a child logger with additional prefix
   */
  child(childPrefix: string): WorkerLogger {
    return new WorkerLogger({
      prefix: `${this.prefix}/${childPrefix}`,
      level: this.level,
      includeTimestamp: this.includeTimestamp,
      includePid: this.includePid
    })
  }
}

/**
 * Create a scoped logger for specific worker operations
 */
export function createScopedLogger(
  workerName: string,
  operation: string
): WorkerLogger {
  return createWorkerLogger({
    prefix: `${workerName}/${operation}`,
    level: 'info',
    includeTimestamp: true,
    includePid: true
  })
}

/**
 * Default logger instances for common workers
 */
export const downloadLogger = createWorkerLogger({
  prefix: 'DOWNLOAD',
  level: 'info',
  includeTimestamp: true,
  includePid: true
})

export const uploadLogger = createWorkerLogger({
  prefix: 'UPLOAD',
  level: 'info',
  includeTimestamp: true,
  includePid: true
})

export const discoverLogger = createWorkerLogger({
  prefix: 'DISCOVER',
  level: 'info',
  includeTimestamp: true,
  includePid: true
})

export const sessionLogger = createWorkerLogger({
  prefix: 'SESSION',
  level: 'info',
  includeTimestamp: true,
  includePid: true
})

export const myVideosLogger = createWorkerLogger({
  prefix: 'MYVIDEOS',
  level: 'info',
  includeTimestamp: true,
  includePid: true
})
