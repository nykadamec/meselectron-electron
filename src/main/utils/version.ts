/**
 * Version utilities for the application
 * Reads version information from package.json (works in both dev and production)
 */

import * as fs from 'fs'
import * as path from 'path'

// Declare __nonWebpack_require__ for asar module loading (used in production only)
declare const __nonWebpack_require__: (modulePath: string) => unknown

/**
 * Get app version from package.json
 * Works in both development and production environments
 */
export function getAppVersion(): string {
  try {
    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV

    if (isDev) {
      const packageJsonPath = path.join(process.cwd(), 'package.json')
      const data = fs.readFileSync(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(data)
      return packageJson.version || '0.0.0'
    } else {
      // In production, package.json is inside app.asar at root level
      const packageJson = __nonWebpack_require__(path.join(process.resourcesPath, 'app.asar/package.json')) as { version?: string }
      return packageJson.version || '0.0.0'
    }
  } catch {
    return '0.0.0'
  }
}

/**
 * Get build number from package.json
 */
export function getBuildNumber(): string {
  try {
    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV

    if (isDev) {
      const packageJsonPath = path.join(process.cwd(), 'package.json')
      const data = fs.readFileSync(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(data)
      return packageJson.buildNumber || '0'
    } else {
      // In production, package.json is inside app.asar at root level
      const packageJson = __nonWebpack_require__(path.join(process.resourcesPath, 'app.asar/package.json')) as { buildNumber?: string }
      return packageJson.buildNumber || '0'
    }
  } catch {
    return '0'
  }
}

/**
 * Get app name from package.json
 */
export function getAppName(): string {
  try {
    const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV

    if (isDev) {
      const packageJsonPath = path.join(process.cwd(), 'package.json')
      const data = fs.readFileSync(packageJsonPath, 'utf-8')
      const packageJson = JSON.parse(data)
      return packageJson.productName || packageJson.name || 'Prehrajto AutoPilot'
    } else {
      // In production, package.json is inside app.asar at root level
      const packageJson = __nonWebpack_require__(path.join(process.resourcesPath, 'app.asar/package.json')) as { productName?: string; name?: string }
      return packageJson.productName || packageJson.name || 'Prehrajto AutoPilot'
    }
  } catch {
    return 'Prehrajto AutoPilot'
  }
}
