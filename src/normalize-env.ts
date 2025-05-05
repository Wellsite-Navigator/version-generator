/**
 * Environment variables type for dependency injection
 * This allows us to pass environment variables explicitly in tests
 * instead of relying on process.env
 */
export type EnvVars = {
  // Standard normalized environment variables (without provider prefix)
  TOKEN?: string;
  REPOSITORY_OWNER?: string;
  REPOSITORY_NAME?: string; // Just the repo name without owner
  SHA?: string;
  BRANCH_NAME?: string; // Single field for branch name (PR source branch or regular branch)
  CI?: string;

  // Source tracking for each normalized variable
  TOKEN_SOURCE?: string;
  REPOSITORY_OWNER_SOURCE?: string;
  REPOSITORY_NAME_SOURCE?: string;
  SHA_SOURCE?: string;
  BRANCH_NAME_SOURCE?: string;
  CI_SOURCE?: string;

  // Allow any other environment variables that might be passed through
  [key: string]: string | undefined;
};

/**
 * Normalizes environment variables from different CI/CD systems into a standard format
 *
 * @param env - The original environment variables
 * @returns Normalized environment variables with source tracking
 */
export function normalizeEnvironment(env: Record<string, string | undefined>): EnvVars {
  const normalizedEnv: EnvVars = {};
  const sources: Record<string, string> = {};

  const normalizeVar = (
    targetKey: string,
    sourceMap: Array<[string, string]>,
    transform?: (value: string, source: string) => string,
  ) => {
    // Allow the env to include the target key directly
    if (env[targetKey]) {
      normalizedEnv[targetKey] = env[targetKey];
      sources[`${targetKey}_SOURCE`] = 'ENV';
      return;
    }

    for (const [sourceKey, source] of sourceMap) {
      if (env[sourceKey]) {
        normalizedEnv[targetKey] = transform ? transform(env[sourceKey], source) : env[sourceKey];
        sources[`${targetKey}_SOURCE`] = source;
        break;
      }
    }
  };

  // TOKEN - Used to authenticate with GitHub
  normalizeVar('TOKEN', [
    ['GITHUB_TOKEN', 'GITHUB'],
    // Travis CI doesn't expose a token by default, but users might set one
    ['TRAVIS_TOKEN', 'TRAVIS'],
    // Add other CI token variables if needed
  ]);

  // REPOSITORY_OWNER
  normalizeVar(
    'REPOSITORY_OWNER',
    [
      ['GITHUB_REPOSITORY_OWNER', 'GITHUB'],
      ['VERCEL_GIT_REPO_OWNER', 'VERCEL'],
      // Travis CI provides the full slug, we'll extract the owner
      ['TRAVIS_REPO_SLUG', 'TRAVIS'],
      // Add other CI repository owner variables
    ],
    (value, source) => {
      // For Travis, extract owner from the slug (owner/repo)
      if (source === 'TRAVIS') {
        const parts = value.split('/');
        return parts.length > 0 ? parts[0] : value;
      }
      return value;
    },
  );

  // REPOSITORY_NAME (just the repo name without owner)
  normalizeVar(
    'REPOSITORY_NAME',
    [
      ['GITHUB_REPOSITORY', 'GITHUB'],
      ['VERCEL_GIT_REPO_SLUG', 'VERCEL'],
      ['TRAVIS_REPO_SLUG', 'TRAVIS'],
      // Add other CI repository name variables
    ],
    (value, source) => {
      // For GitHub and Travis, extract repository name from full path
      if (source === 'GITHUB' || source === 'TRAVIS') {
        const parts = value.split('/');
        return parts.length > 1 ? parts[1] : value;
      }
      return value;
    },
  );

  // SHA
  normalizeVar('SHA', [
    ['GITHUB_SHA', 'GITHUB'],
    ['VERCEL_GIT_COMMIT_SHA', 'VERCEL'],
    ['TRAVIS_COMMIT', 'TRAVIS'],
    // Add other CI commit SHA variables
  ]);

  // BRANCH_NAME - Intelligently select the appropriate branch name
  // For PRs, use the source branch; for non-PRs, use the current branch
  normalizeVar('BRANCH_NAME', [
    // GitHub: HEAD_REF for PRs, REF_NAME for non-PRs
    ['GITHUB_HEAD_REF', 'GITHUB_PR'],
    ['GITHUB_REF_NAME', 'GITHUB'],

    // Travis: PULL_REQUEST_BRANCH for PRs, BRANCH for non-PRs
    ['TRAVIS_PULL_REQUEST_BRANCH', 'TRAVIS_PR'],
    ['TRAVIS_BRANCH', 'TRAVIS'],

    // Vercel: Only has one branch reference
    ['VERCEL_GIT_COMMIT_REF', 'VERCEL'],

    // Add other CI branch variables
  ]);

  // CI (detect if running in CI)
  normalizeVar(
    'CI',
    [
      ['GITHUB_ACTIONS', 'GITHUB'],
      ['VERCEL', 'VERCEL'],
      ['TRAVIS', 'TRAVIS'],
      ['CI', 'GENERIC_CI'],
      // Add other CI detection variables
    ],
    (value, source) => {
      // Normalize to 'true' string for consistency
      return value === '1' ? 'true' : value;
    },
  );

  // Add source tracking to the normalized environment
  Object.entries(sources).forEach(([key, value]) => {
    normalizedEnv[key] = value;
  });

  return normalizedEnv;
}
