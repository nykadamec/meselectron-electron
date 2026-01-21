/**
 * IPC Validation Utilities
 * Type-safe validation for IPC handler arguments
 */

/**
 * Base validation error
 */
export class IpcValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message)
    this.name = 'IpcValidationError'
  }
}

/**
 * Validate a value is a string
 */
export function validateString(
  value: unknown,
  field: string,
  options?: { minLength?: number; maxLength?: number; pattern?: RegExp }
): string {
  if (typeof value !== 'string') {
    throw new IpcValidationError(`Field '${field}' must be a string`, field, value)
  }

  if (options?.minLength !== undefined && value.length < options.minLength) {
    throw new IpcValidationError(
      `Field '${field}' must be at least ${options.minLength} characters`,
      field,
      value
    )
  }

  if (options?.maxLength !== undefined && value.length > options.maxLength) {
    throw new IpcValidationError(
      `Field '${field}' must be at most ${options.maxLength} characters`,
      field,
      value
    )
  }

  if (options?.pattern && !options.pattern.test(value)) {
    throw new IpcValidationError(
      `Field '${field}' has invalid format`,
      field,
      value
    )
  }

  return value
}

/**
 * Validate a value is a number
 */
export function validateNumber(
  value: unknown,
  field: string,
  options?: { min?: number; max?: number; integer?: boolean }
): number {
  const num = Number(value)
  if (isNaN(num) || typeof value !== 'number') {
    throw new IpcValidationError(`Field '${field}' must be a number`, field, value)
  }

  if (options?.min !== undefined && num < options.min) {
    throw new IpcValidationError(
      `Field '${field}' must be at least ${options.min}`,
      field,
      value
    )
  }

  if (options?.max !== undefined && num > options.max) {
    throw new IpcValidationError(
      `Field '${field}' must be at most ${options.max}`,
      field,
      value
    )
  }

  if (options?.integer && !Number.isInteger(num)) {
    throw new IpcValidationError(
      `Field '${field}' must be an integer`,
      field,
      value
    )
  }

  return num
}

/**
 * Validate a value is a boolean
 */
export function validateBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new IpcValidationError(`Field '${field}' must be a boolean`, field, value)
  }
  return value
}

/**
 * Validate a value is an array
 */
export function validateArray<T>(
  value: unknown,
  field: string,
  options?: { minLength?: number; maxLength?: number; itemValidator?: (item: unknown, index: number) => T }
): T[] {
  if (!Array.isArray(value)) {
    throw new IpcValidationError(`Field '${field}' must be an array`, field, value)
  }

  if (options?.minLength !== undefined && value.length < options.minLength) {
    throw new IpcValidationError(
      `Field '${field}' must have at least ${options.minLength} items`,
      field,
      value
    )
  }

  if (options?.maxLength !== undefined && value.length > options.maxLength) {
    throw new IpcValidationError(
      `Field '${field}' must have at most ${options.maxLength} items`,
      field,
      value
    )
  }

  if (options?.itemValidator) {
    return value.map((item, index) => options.itemValidator!(item, index))
  }

  return value as T[]
}

/**
 * Validate a value is an object
 */
export function validateObject<T extends Record<string, unknown>>(
  value: unknown,
  field: string,
  requiredFields?: (keyof T)[]
): T {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new IpcValidationError(`Field '${field}' must be an object`, field, value)
  }

  const obj = value as T

  if (requiredFields) {
    for (const requiredField of requiredFields) {
      if (!(requiredField in obj) || obj[requiredField] === undefined) {
        throw new IpcValidationError(
          `Field '${field}.${String(requiredField)}' is required`,
          field,
          value
        )
      }
    }
  }

  return obj
}

/**
 * Validate URL format
 */
export function validateUrl(value: unknown, field: string): string {
  const urlString = validateString(value, field)

  try {
    new URL(urlString)
    return urlString
  } catch {
    throw new IpcValidationError(`Field '${field}' must be a valid URL`, field, value)
  }
}

/**
 * Validate optional field - returns undefined if not present
 */
export function validateOptional<T>(
  value: unknown,
  validator: (value: unknown) => T
): T | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  return validator(value)
}

/**
 * Validate IPC arguments against a schema
 */
export function validateIpcArgs<T>(
  args: unknown[],
  schema: {
    [K in keyof T]: (value: unknown) => T[K]
  }
): T {
  if (!Array.isArray(args) || args.length === 0) {
    throw new IpcValidationError('IPC arguments must be a non-empty array')
  }

  // If schema expects a single object argument
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    const result: Partial<T> = {}
    const obj = args[0] as Record<string, unknown>

    for (const key of Object.keys(schema)) {
      if (key in obj) {
        const validator = schema[key as keyof T]
        result[key as keyof T] = validator(obj[key])
      }
    }

    return result as T
  }

  // If schema expects individual arguments
  if (args.length !== Object.keys(schema).length) {
    throw new IpcValidationError(
      `Expected ${Object.keys(schema).length} arguments, got ${args.length}`
    )
  }

  const result: Partial<T> = {}
  let index = 0

  for (const key of Object.keys(schema)) {
    const validator = schema[key as keyof T]
    result[key as keyof T] = validator(args[index])
    index++
  }

  return result as T
}

// Predefined validators for common IPC patterns

/**
 * Validate download options
 */
export function validateDownloadOptions(value: unknown) {
  return validateObject<{
    url: string
    videoId: string
    outputPath?: string
    cookies?: string
    hqProcessing?: boolean
  }>(value, 'options', ['url', 'videoId'])
}

/**
 * Validate discover options
 */
export function validateDiscoverOptions(value: unknown) {
  return validateObject<{
    url: string
    depth?: number
    maxItems?: number
  }>(value, 'options', ['url'])
}

/**
 * Validate upload options
 */
export function validateUploadOptions(value: unknown) {
  return validateObject<{
    filePath: string
    accountId: string
    cookies: string
    title?: string
  }>(value, 'options', ['filePath', 'accountId', 'cookies'])
}

/**
 * Validate settings
 */
export function validateSettings(value: unknown) {
  return validateObject<{
    autoReset?: boolean
    downloadConcurrency?: number
    uploadConcurrency?: number
    videoCount?: number
    nospeed?: boolean
    addWatermark?: boolean
    outputDir?: string
    downloadMode?: string
    hqProcessing?: boolean
  }>(value, 'settings')
}
