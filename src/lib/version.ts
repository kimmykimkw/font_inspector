import packageJson from '../../package.json';

/**
 * Get the current app version from package.json
 * @returns {string} The current app version (e.g., "0.1.0")
 */
export function getCurrentAppVersion(): string {
  return packageJson.version;
} 