/**
 * Worker Factory
 * Centralized worker creation with consistent error handling, progress forwarding, and timeout management
 */

import { Worker } from 'worker_threads'
import path from 'path'
import {
  WORKER_GENERIC_TIMEOUT_MS,
  WORKER_DOWNLOAD_PATH,
  WORKER_UPLOAD_PATH,
  WORKER_DISCOVER_PATH,
  WORKER_MYVIDEOS_PATH,
  WORKER_SESSION_PATH
} from '../constants.js'

/**
 * Worker type enum for type-safe worker path resolution
 */
export enum WorkerType {
  DOWNLOAD = 'download',
  UPLOAD = 'upload',
  DISCOVER = 'discover',
  MYVIDEOS = 'myvideos',
  SESSION = 'session'
}

/**
 * Get the worker file path based on worker type
 */
function getWorkerPath(workerType: WorkerType): string {
  const workerPaths: Record<WorkerType, string> = {
    [WorkerType.DOWNLOAD]: WORKER_DOWNLOAD_PATH,
    [WorkerType.UPLOAD]: WORKER_UPLOAD_PATH,
    [WorkerType.DISCOVER]: WORKER_DISCOVER_PATH,
    [WorkerType.MYVIDEOS]: WORKER_MYVIDEOS_PATH,
    [WorkerType.SESSION]: WORKER_SESSION_PATH
  }

  const workerPath = workerPaths[workerType]
  if (!workerPath) {
    throw new Error(`Unknown worker type: ${workerType}`)
  }

  // Resolve relative path from main process location
  return path.resolve(__dirname, workerPath)
}

/**
 * Progress message from worker
 */
export interface WorkerProgress {
  type: string
  videoId?: string
  status?: string
  progress?: number
  downloadedBytes?: number
  totalBytes?: number
  speed?: number
  eta?: number
  message?: string
}

/**
 * Complete message from worker
 */
export interface WorkerResult {
  type: 'complete'
  success: boolean
  videoId?: string
  error?: string
  skipped?: boolean
  filePath?: string
  fileSize?: number
  data?: unknown
}

/**
 * Options for creating a worker
 */
export interface WorkerOptions {
  /** Type of worker to create */
  workerType: WorkerType
  /** Worker type identifier (passed to worker as workerData.type) */
  type: string
  /** Payload data passed to worker */
  payload: unknown
  /** Optional custom timeout in milliseconds */
  timeoutMs?: number
  /** Optional progress callback */
  onProgress?: (progress: WorkerProgress) => void
  /** Optional complete callback */
  onComplete?: (result: WorkerResult) => void
  /** Optional error callback */
  onError?: (error: Error) => void
}

/**
 * Result from createWorker - includes both promise and cleanup function
 */
export interface WorkerHandle<T = WorkerResult> {
  /** Promise that resolves when worker completes */
  result: Promise<T>
  /** Function to terminate worker early */
  terminate: () => void
}

/**
 * Create a worker with consistent configuration, progress handling, and timeout
 */
export function createWorker<T extends WorkerResult = WorkerResult>(
  options: WorkerOptions
): WorkerHandle<T> {
  const {
    workerType,
    type,
    payload,
    timeoutMs = WORKER_GENERIC_TIMEOUT_MS,
    onProgress,
    onComplete,
    onError
  } = options

  const workerPath = getWorkerPath(workerType)
  console.log('[WorkerFactory] Creating worker:', workerType, 'path:', workerPath, 'type:', type)

  const worker = new Worker(workerPath, {
    workerData: { type, payload }
  })
  console.log('[WorkerFactory] Worker created for type:', type)

  let terminated = false

  /**
   * Cleanup function to kill worker and remove listeners
   */
  function cleanup() {
    terminated = true
    worker.removeAllListeners('message')
    worker.removeAllListeners('error')
    worker.removeAllListeners('exit')
  }

  /**
   * Create a promise-based result handler
   */
  const resultPromise = new Promise<T>((resolve, reject) => {
    // Set timeout for worker completion
    const timeout = setTimeout(() => {
      cleanup()
      worker.terminate()
      reject(new Error(`Worker ${workerType} timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    /**
     * Handle messages from worker
     */
    worker.on('message', (message: WorkerProgress | WorkerResult) => {
      if (terminated) return

      // Handle completion messages - also forward to onProgress for IPC handlers
      if (message.type === 'complete') {
        clearTimeout(timeout)
        cleanup()

        const result = message as WorkerResult
        // Forward complete message to onProgress so renderer can handle it
        onProgress?.(message as WorkerProgress)

        if (result.success) {
          console.log('[WorkerFactory] Worker completed successfully')
          onComplete?.(result)
          resolve(result as T)
        } else {
          const error = new Error(result.error || 'Worker failed')
          console.log('[WorkerFactory] Worker failed:', error.message)
          onError?.(error)
          reject(error)
        }
        return
      }

      // Handle progress messages - no verbose logging, just forward
      if (message.type === 'progress' || message.type === 'status' || message.type === 'error') {
        onProgress?.(message as WorkerProgress)
        return
      }

      console.log('[WorkerFactory] Unknown message type:', message.type)
    })

    /**
     * Handle worker errors
     */
    worker.on('error', (error) => {
      if (terminated) return
      console.log('[WorkerFactory] Worker error:', error)
      clearTimeout(timeout)
      cleanup()
      const errorObj = error instanceof Error ? error : new Error(String(error))
      onError?.(errorObj)
      reject(errorObj)
    })

    /**
     * Handle worker exit
     */
    worker.on('exit', (code) => {
      if (terminated) return
      console.log('[WorkerFactory] Worker exited with code:', code)
      if (code !== 0) {
        clearTimeout(timeout)
        cleanup()
        const error = new Error(`Worker exited with code ${code}`)
        onError?.(error)
        reject(error)
      }
    })
  })

  return {
    result: resultPromise,
    terminate: () => {
      cleanup()
      worker.terminate()
    }
  }
}

/**
 * Simplified worker creation for basic use cases
 * Returns just the promise result without progress handling
 */
export function runWorker(
  workerType: WorkerType,
  type: string,
  payload: unknown,
  timeoutMs?: number
): Promise<WorkerResult> {
  const handle = createWorker<WorkerResult>({
    workerType,
    type,
    payload,
    timeoutMs
  })

  return handle.result
}

/**
 * Convenience function for download workers with progress tracking
 */
export function createDownloadWorker(
  type: string,
  payload: unknown,
  onProgress?: (progress: WorkerProgress) => void
): WorkerHandle {
  return createWorker({
    workerType: WorkerType.DOWNLOAD,
    type,
    payload,
    onProgress
  })
}

/**
 * Convenience function for discover workers with progress tracking
 */
export function createDiscoverWorker(
  type: string,
  payload: unknown,
  onProgress?: (progress: WorkerProgress) => void
): WorkerHandle {
  return createWorker({
    workerType: WorkerType.DISCOVER,
    type,
    payload,
    onProgress
  })
}

/**
 * Convenience function for upload workers with progress tracking
 */
export function createUploadWorker(
  type: string,
  payload: unknown,
  onProgress?: (progress: WorkerProgress) => void
): WorkerHandle {
  return createWorker({
    workerType: WorkerType.UPLOAD,
    type,
    payload,
    onProgress
  })
}

/**
 * Convenience function for session workers
 */
export function createSessionWorker(
  type: string,
  payload: unknown
): WorkerHandle {
  return createWorker({
    workerType: WorkerType.SESSION,
    type,
    payload
  })
}

/**
 * Convenience function for my-videos workers
 */
export function createMyVideosWorker(
  type: string,
  payload: unknown,
  onProgress?: (progress: WorkerProgress) => void
): WorkerHandle {
  return createWorker({
    workerType: WorkerType.MYVIDEOS,
    type,
    payload,
    onProgress
  })
}
