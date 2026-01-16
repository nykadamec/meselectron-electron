/**
 * TypeScript declaration for sync-config.js
 * This file provides IDE support for the sync-config script
 */

export {};

declare global {
  namespace NodeJS {
    interface ProcessVersions {
      pnapi?: string;
    }
  }
}

/**
 * Synchronizes metadata from app.yaml to package.json
 */
export function syncConfig(): void;
