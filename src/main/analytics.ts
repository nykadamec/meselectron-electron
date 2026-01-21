import * as amplitude from '@amplitude/analytics-node';
import  dotenv from 'dotenv';
dotenv.config();
import { getAppVersion } from './utils/version';

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

export function trackAppLaunch(): void {
  trackEvent('app_launch', {
    platform: process.platform,
    version: getAppVersion(),
  });
}
