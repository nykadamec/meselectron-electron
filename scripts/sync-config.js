/**
 * Synchronizuje metadata z app.yaml do package.json
 *
 * Mapování:
 * - name → name
 * - version → version
 * - description → description
 * - app_name → appName
 * - buildNumber → buildNumber
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const APP_YAML_PATH = path.resolve('app.yaml');
const PACKAGE_JSON_PATH = path.resolve('package.json');

/**
 * Synchronizuje config z app.yaml do package.json
 */
function syncConfig() {
  // Read app.yaml
  const appYamlContent = fs.readFileSync(APP_YAML_PATH, 'utf-8');
  const appConfig = yaml.load(appYamlContent);

  // Get data from nested 'app' key
  const appData = appConfig.app || appConfig;

  // Read package.json
  const packageJsonContent = fs.readFileSync(PACKAGE_JSON_PATH, 'utf-8');
  const packageJson = JSON.parse(packageJsonContent);

  // Sync fields
  if (appData.name) packageJson.name = appData.name;
  if (appData.version) packageJson.version = appData.version;
  if (appData.description) packageJson.description = appData.description;
  if (appData.app_name) packageJson.appName = appData.app_name;
  if (appData.buildNumber) packageJson.buildNumber = appData.buildNumber;

  // Write package.json with proper formatting
  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(packageJson, null, 2) + '\n',
    'utf-8'
  );

  console.log('✅ Config synchronized from app.yaml to package.json');
  console.log(`   name: ${packageJson.name}`);
  console.log(`   version: ${packageJson.version}`);
  console.log(`   appName: ${packageJson.appName}`);
  console.log(`   buildNumber: ${packageJson.buildNumber}`);
}

// Run if executed directly
syncConfig();
