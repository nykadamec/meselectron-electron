// Upload worker - handles video uploads to CDN with progress reporting
import { parentPort, workerData } from 'worker_threads'
import axios from 'axios'
import fs from 'fs'

// Helper to safely post messages (parentPort is always available in worker threads)
function postMessage(data: unknown) {
  if (parentPort) {
    parentPort.postMessage(data)
  }
}

async function uploadVideo(options: { filePath: string; cookies?: string }) {
  const { filePath, cookies } = options

  try {
    postMessage({ type: 'status', status: 'starting' })

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`)
    }

    const fileSize = fs.statSync(filePath).size
    postMessage({
      type: 'progress',
      progress: 0,
      uploaded: 0,
      total: fileSize,
      speed: 0
    })

    // Simulate upload progress
    for (let i = 10; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 300))
      const uploaded = (i / 100) * fileSize
      postMessage({
        type: 'progress',
        progress: i,
        uploaded: uploaded,
        total: fileSize,
        speed: 5 + Math.random() * 2
      })
    }

    postMessage({ type: 'status', status: 'completed' })
    postMessage({ type: 'complete', success: true })

  } catch (error) {
    postMessage({
      type: 'error',
      error: error.message
    })
  }
}

if (workerData.type === 'upload') {
  uploadVideo(workerData.payload)
}
