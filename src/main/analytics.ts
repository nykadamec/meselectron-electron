import * as amplitude from '@amplitude/analytics-node';
import  dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config();

// Declare __nonWebpack_require__ for asar module loading (used in production only)
declare const __nonWebpack_require__: (modulePath: string) => unknown



amplitude.init('e01278f75df82de79029a7038985bcf');

amplitude.track('Track App', undefined, {
  device_id: '<ENTER DEVICE ID>',
});


let isInitialized = false;
let appLaunchTime: number = 0;

const AMPLITUDE_API_KEY = process.env.AMPLITUDE_API_KEY || '';

export function initAnalytics(): void {
  if (!AMPLITUDE_API_KEY) {
    console.warn('[Analytics] No API key configured, analytics disabled');
    return;
  }

  amplitude.init(AMPLITUDE_API_KEY);
  isInitialized = true;
  appLaunchTime = Date.now();
  console.log('[Analytics] Initialized');
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>): void {
  if (!isInitialized) return;
  amplitude.track(eventName, properties);
}

export function trackAppClose(): void {
  if (appLaunchTime === 0) return;
  const durationMs = Date.now() - appLaunchTime;
  trackEvent('app_close', {
    session_duration_ms: durationMs,
  });
}

export function flushAnalytics(): void {
  if (!isInitialized) return;
  amplitude.flush();
}

// Get app version from package.json (robust for dev and production)
function getAppVersion(): string {
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

export function trackAppLaunch(): void {
  trackEvent('app_launch', {
    platform: process.platform,
    version: getAppVersion(),
  });
}
