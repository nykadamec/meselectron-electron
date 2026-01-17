/**
 * GitHub Releases API fetcher for app updates
 * Fetches release information from GitHub Releases
 */

import axios from 'axios'

// Configuration - change these for your repository
const GITHUB_OWNER = 'nykadamec'
const GITHUB_REPO = 'meselectron-electron'

export interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
  content_type: string
}

export interface ReleaseInfo {
  tag_name: string
  name: string
  published_at: string
  body: string
  html_url: string
  assets: ReleaseAsset[]
}

export interface PlatformAsset {
  macDmg: ReleaseAsset | null
  macZip: ReleaseAsset | null
  windowsExe: ReleaseAsset | null
  windowsZip: ReleaseAsset | null
  checksums: ReleaseAsset | null
  checksumsSig: ReleaseAsset | null
}

/**
 * Fetch the latest release from GitHub
 */
export async function getLatestRelease(): Promise<ReleaseInfo | null> {
  try {
    const response = await axios.get(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Prehrajto-AutoPilot-Updater'
        },
        timeout: 30000
      }
    )

    if (response.status !== 200) {
      console.error(`[UPDATER] GitHub API returned status ${response.status}`)
      return null
    }

    return response.data as ReleaseInfo
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[UPDATER] Failed to fetch latest release: ${message}`)
    return null
  }
}

/**
 * Get assets for specific platform
 */
export function getPlatformAssets(release: ReleaseInfo): PlatformAsset {
  const assets = release.assets || []

  const findAsset = (patterns: string[]): ReleaseAsset | null => {
    for (const pattern of patterns) {
      const asset = assets.find(a =>
        a.name.toLowerCase().includes(pattern.toLowerCase())
      )
      if (asset) return asset
    }
    return null
  }

  return {
    macDmg: findAsset(['.dmg']),
    macZip: findAsset(['-mac.zip', '-mac-']),
    windowsExe: findAsset(['.exe', 'setup']),
    windowsZip: findAsset(['-win.zip', '-windows']),
    checksums: findAsset(['checksums.txt', 'checksum']),
    checksumsSig: findAsset(['checksums.txt.sig', 'checksum.sig', '.sig'])
  }
}

/**
 * Get the appropriate asset for current platform
 */
export function getCurrentPlatformAsset(assets: PlatformAsset): ReleaseAsset | null {
  const platform = process.platform
  const arch = process.arch

  console.log(`[UPDATER] Current platform: ${platform}/${arch}`)

  if (platform === 'darwin') {
    // macOS
    if (arch === 'arm64') {
      return assets.macDmg || assets.macZip || null
    }
    return assets.macDmg || assets.macZip || null
  }

  if (platform === 'win32') {
    // Windows
    return assets.windowsExe || assets.windowsZip || null
  }

  // Linux or other - try zip
  return assets.windowsZip || assets.macZip || null
}

/**
 * Parse version string to comparable format
 */
export function parseVersion(tag: string): string {
  // Remove 'v' prefix if present
  return tag.startsWith('v') ? tag.substring(1) : tag
}

/**
 * Compare two version strings
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => {
    return v.split('.').map(part => {
      const num = parseInt(part.replace(/[^0-9]/g, ''), 10)
      return isNaN(num) ? 0 : num
    })
  }

  const aParts = parse(a)
  const bParts = parse(b)

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aNum = aParts[i] || 0
    const bNum = bParts[i] || 0

    if (aNum > bNum) return 1
    if (aNum < bNum) return -1
  }

  return 0
}

/**
 * Check if update is available
 */
export async function checkForUpdate(currentVersion: string): Promise<{
  updateAvailable: boolean
  latestVersion: string | null
  release: ReleaseInfo | null
  asset: ReleaseAsset | null
}> {
  const release = await getLatestRelease()

  if (!release) {
    return {
      updateAvailable: false,
      latestVersion: null,
      release: null,
      asset: null
    }
  }

  const latestVersion = parseVersion(release.tag_name)
  const assets = getPlatformAssets(release)
  const asset = getCurrentPlatformAsset(assets)

  const isNewer = compareVersions(latestVersion, currentVersion) > 0

  console.log(`[UPDATER] Current: ${currentVersion}, Latest: ${latestVersion}, Update: ${isNewer}`)

  return {
    updateAvailable: isNewer,
    latestVersion,
    release,
    asset
  }
}
