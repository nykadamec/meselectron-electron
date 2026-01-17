/**
 * File verification module
 * Handles SHA-256 checksum verification and GPG signature validation
 */

import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// GPG Public Key - replace with your actual public key
const GPG_PUBLIC_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

-----END PGP PUBLIC KEY BLOCK-----`

export interface VerificationResult {
  valid: boolean
  error?: string
  details?: {
    expectedChecksum?: string
    actualChecksum?: string
    gpgValid?: boolean
  }
}

/**
 * Calculate SHA-256 checksum of a file
 */
export async function calculateChecksum(filePath: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath)
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
    return hash
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to calculate checksum: ${message}`)
  }
}

/**
 * Verify SHA-256 checksum against expected value
 */
export async function verifyChecksum(
  filePath: string,
  expectedChecksum: string
): Promise<VerificationResult> {
  try {
    const actualChecksum = await calculateChecksum(filePath)

    // Normalize checksums (lowercase, trim)
    const normalizedExpected = expectedChecksum.toLowerCase().trim()
    const normalizedActual = actualChecksum.toLowerCase().trim()

    if (normalizedExpected === normalizedActual) {
      return {
        valid: true,
        details: {
          expectedChecksum: normalizedExpected,
          actualChecksum: normalizedActual
        }
      }
    }

    return {
      valid: false,
      error: 'Checksum mismatch',
      details: {
        expectedChecksum: normalizedExpected,
        actualChecksum: normalizedActual
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      error: `Verification failed: ${message}`
    }
  }
}

/**
 * Parse checksums file (format: "hash filename" or "hash  filename")
 */
export async function parseChecksumsFile(checksumsPath: string): Promise<Map<string, string>> {
  const checksums = new Map<string, string>()

  try {
    const content = await fs.readFile(checksumsPath, 'utf-8')
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      // Format: "SHA256-xxx=hash filename" or "hash filename"
      const parts = trimmed.split(/\s+/)
      if (parts.length >= 2) {
        let hash: string
        let filename: string

        if (parts[0].startsWith('SHA256-')) {
          // gpg --checksum-algo SHA256 format
          hash = parts[0].split('=')[1] || parts[1]
          filename = parts[2] || parts[1]
        } else {
          hash = parts[0]
          filename = parts[1]
        }

        checksums.set(filename.toLowerCase(), hash.toLowerCase())
      }
    }
  } catch (error) {
    console.error(`[UPDATER] Failed to parse checksums file: ${error}`)
  }

  return checksums
}

/**
 * Find matching checksum for a file in checksums map
 */
export function findMatchingChecksum(
  checksums: Map<string, string>,
  filename: string
): string | null {
  const normalizedFilename = path.basename(filename).toLowerCase()

  // Try exact match first
  if (checksums.has(normalizedFilename)) {
    return checksums.get(normalizedFilename) || null
  }

  // Try partial match
  for (const [key, value] of checksums.entries()) {
    if (normalizedFilename.includes(key) || key.includes(normalizedFilename)) {
      return value
    }
  }

  return null
}

/**
 * Verify download using checksums file
 */
export async function verifyWithChecksums(
  filePath: string,
  checksumsPath: string
): Promise<VerificationResult> {
  try {
    const checksums = await parseChecksumsFile(checksumsPath)
    const expectedChecksum = findMatchingChecksum(checksums, filePath)

    if (!expectedChecksum) {
      return {
        valid: false,
        error: 'No matching checksum found for file'
      }
    }

    return verifyChecksum(filePath, expectedChecksum)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      error: `Checksum verification failed: ${message}`
    }
  }
}

/**
 * Setup GPG - import public key
 */
async function setupGpg(): Promise<void> {
  try {
    // Check if key is already imported
    await execAsync('gpg --list-keys --batch --yes 2>/dev/null')

    // Try to import if not exists
    const keyFile = path.join(process.cwd(), '.gpg_temp_key')
    await fs.writeFile(keyFile, GPG_PUBLIC_KEY)

    try {
      await execAsync(`gpg --import --batch --yes "${keyFile}"`)
    } catch {
      // Key might already exist, ignore error
    }

    await fs.unlink(keyFile).catch(() => {})
  } catch (error) {
    console.error(`[UPDATER] GPG setup failed: ${error}`)
  }
}

/**
 * Verify GPG signature
 */
export async function verifyGpgSignature(
  contentPath: string,
  signaturePath: string
): Promise<VerificationResult> {
  try {
    await setupGpg()

    // First verify the content matches the checksum file
    const contentChecksum = await calculateChecksum(contentPath)

    // Verify signature
    const { stdout } = await execAsync(
      `gpg --verify --batch --status-fd=1 "${signaturePath}" "${contentPath}" 2>&1`,
      { encoding: 'utf-8' }
    )

    // Check for GOODSIG in status
    const lines = stdout.split('\n')
    const goodSig = lines.some(line => line.includes('[GNUPG:] GOODSIG'))
    const badSig = lines.some(line => line.includes('[GNUPG:] BADSIG'))

    if (goodSig && !badSig) {
      return {
        valid: true,
        details: {
          gpgValid: true
        }
      }
    }

    if (badSig) {
      return {
        valid: false,
        error: 'GPG signature verification failed - BAD signature',
        details: {
          gpgValid: false
        }
      }
    }

    return {
      valid: false,
      error: 'GPG signature verification failed - unknown status',
      details: {
        gpgValid: false
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      valid: false,
      error: `GPG verification error: ${message}`
    }
  }
}

/**
 * Full verification: SHA-256 + GPG
 */
export async function verifyDownload(
  filePath: string,
  checksumsPath: string,
  signaturePath?: string
): Promise<VerificationResult> {
  console.log(`[UPDATER] Verifying download: ${filePath}`)

  // Step 1: Verify SHA-256 checksum
  const checksumResult = await verifyWithChecksums(filePath, checksumsPath)
  if (!checksumResult.valid) {
    console.error(`[UPDATER] Checksum verification failed: ${checksumResult.error}`)
    return checksumResult
  }

  console.log(`[UPDATER] Checksum verified successfully`)

  // Step 2: Verify GPG signature if available
  if (signaturePath) {
    const gpgResult = await verifyGpgSignature(checksumsPath, signaturePath)
    if (!gpgResult.valid) {
      console.error(`[UPDATER] GPG verification failed: ${gpgResult.error}`)
      return gpgResult
    }
    console.log(`[UPDATER] GPG signature verified successfully`)
  }

  return {
    valid: true,
    details: {
      ...checksumResult.details,
      gpgValid: signaturePath ? true : undefined
    }
  }
}
