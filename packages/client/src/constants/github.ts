/**
 * GitHub repository constants
 *
 * Centralised location for all GitHub URLs used in the app.
 * `__APP_VERSION__` is a Vite compile-time constant — it is replaced at build
 * time, so any URL that embeds the version must be built at runtime inside a
 * function rather than as a static string.
 */

export const GITHUB_OWNER = 'psychosledge';
export const GITHUB_REPO = 'squickr-life';
export const GITHUB_BASE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;

/**
 * Returns the bug-report URL with the current app version pre-filled.
 * Must be a function because `__APP_VERSION__` is resolved at compile time
 * and cannot be concatenated into a module-level `const`.
 */
export function getBugReportUrl(): string {
  return `${GITHUB_BASE_URL}/issues/new?template=bug_report.md&labels=bug&title=%5BBug%5D+&body=**Version**%3A+v${__APP_VERSION__}`;
}

export const GITHUB_URLS = {
  featureRequest: `${GITHUB_BASE_URL}/issues/new?template=feature_request.md&labels=enhancement&title=%5BFeature%5D+`,
  discussions: `${GITHUB_BASE_URL}/discussions`,
  repository: GITHUB_BASE_URL,
} as const;
