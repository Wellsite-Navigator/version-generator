import { normalizeEnvironment } from './normalize-env';

// Helper to create test environment variables
function createTestEnv(vars: Record<string, string>): Record<string, string | undefined> {
  return { ...vars };
}

describe('normalizeEnvironment', () => {
  describe('GitHub environment variables', () => {
    it('should normalize GitHub environment variables', () => {
      const testEnv = createTestEnv({
        GITHUB_TOKEN: 'github-token-value',
        GITHUB_REPOSITORY_OWNER: 'owner',
        GITHUB_REPOSITORY: 'owner/repo',
        GITHUB_SHA: 'abcdef1234567890',
        GITHUB_REF_NAME: 'main',
        GITHUB_ACTIONS: 'true',
      });

      const normalized = normalizeEnvironment(testEnv);

      // Check normalized values
      expect(normalized.TOKEN).toBe('github-token-value');
      expect(normalized.REPOSITORY_OWNER).toBe('owner');
      expect(normalized.REPOSITORY_NAME).toBe('repo');
      expect(normalized.SHA).toBe('abcdef1234567890');
      expect(normalized.BRANCH_NAME).toBe('main');
      expect(normalized.CI).toBe('true');

      // Check source tracking
      expect(normalized.TOKEN_SOURCE).toBe('GITHUB');
      expect(normalized.REPOSITORY_OWNER_SOURCE).toBe('GITHUB');
      expect(normalized.REPOSITORY_NAME_SOURCE).toBe('GITHUB');
      expect(normalized.SHA_SOURCE).toBe('GITHUB');
      expect(normalized.BRANCH_NAME_SOURCE).toBe('GITHUB');
      expect(normalized.CI_SOURCE).toBe('GITHUB');
    });

    it('should handle GitHub pull request environment variables', () => {
      const testEnv = createTestEnv({
        GITHUB_TOKEN: 'github-token-value',
        GITHUB_REPOSITORY_OWNER: 'owner',
        GITHUB_REPOSITORY: 'owner/repo',
        GITHUB_SHA: 'abcdef1234567890',
        GITHUB_REF_NAME: 'main', // Target branch
        GITHUB_HEAD_REF: 'feature-branch', // Source branch
        GITHUB_ACTIONS: 'true',
      });

      const normalized = normalizeEnvironment(testEnv);

      // For PRs, should prioritize HEAD_REF (source branch)
      expect(normalized.BRANCH_NAME).toBe('feature-branch');
      expect(normalized.BRANCH_NAME_SOURCE).toBe('GITHUB_PR');
    });
  });

  describe('Vercel environment variables', () => {
    it('should normalize Vercel environment variables', () => {
      const testEnv = createTestEnv({
        GITHUB_TOKEN: 'github-token-value', // Token still comes from GitHub
        VERCEL_GIT_REPO_OWNER: 'owner',
        VERCEL_GIT_REPO_SLUG: 'repo',
        VERCEL_GIT_COMMIT_SHA: 'abcdef1234567890',
        VERCEL_GIT_COMMIT_REF: 'main',
        VERCEL: '1',
      });

      const normalized = normalizeEnvironment(testEnv);

      // Check normalized values
      expect(normalized.TOKEN).toBe('github-token-value');
      expect(normalized.REPOSITORY_OWNER).toBe('owner');
      expect(normalized.REPOSITORY_NAME).toBe('repo');
      expect(normalized.SHA).toBe('abcdef1234567890');
      expect(normalized.BRANCH_NAME).toBe('main');
      expect(normalized.CI).toBe('true');

      // Check source tracking
      expect(normalized.TOKEN_SOURCE).toBe('GITHUB');
      expect(normalized.REPOSITORY_OWNER_SOURCE).toBe('VERCEL');
      expect(normalized.REPOSITORY_NAME_SOURCE).toBe('VERCEL');
      expect(normalized.SHA_SOURCE).toBe('VERCEL');
      expect(normalized.BRANCH_NAME_SOURCE).toBe('VERCEL');
      expect(normalized.CI_SOURCE).toBe('VERCEL');
    });
  });

  describe('Travis CI environment variables', () => {
    it('should normalize Travis CI environment variables', () => {
      const testEnv = createTestEnv({
        TRAVIS_TOKEN: 'travis-token-value',
        TRAVIS_REPO_SLUG: 'owner/repo',
        TRAVIS_COMMIT: 'abcdef1234567890',
        TRAVIS_BRANCH: 'main',
        TRAVIS: 'true',
      });

      const normalized = normalizeEnvironment(testEnv);

      // Check normalized values
      expect(normalized.TOKEN).toBe('travis-token-value');
      expect(normalized.REPOSITORY_OWNER).toBe('owner');
      expect(normalized.REPOSITORY_NAME).toBe('repo');
      expect(normalized.SHA).toBe('abcdef1234567890');
      expect(normalized.BRANCH_NAME).toBe('main');
      expect(normalized.CI).toBe('true');

      // Check source tracking
      expect(normalized.TOKEN_SOURCE).toBe('TRAVIS');
      expect(normalized.REPOSITORY_OWNER_SOURCE).toBe('TRAVIS');
      expect(normalized.REPOSITORY_NAME_SOURCE).toBe('TRAVIS');
      expect(normalized.SHA_SOURCE).toBe('TRAVIS');
      expect(normalized.BRANCH_NAME_SOURCE).toBe('TRAVIS');
      expect(normalized.CI_SOURCE).toBe('TRAVIS');
    });

    it('should handle Travis CI pull request', () => {
      const testEnv = createTestEnv({
        TRAVIS_TOKEN: 'travis-token-value',
        TRAVIS_REPO_SLUG: 'owner/repo',
        TRAVIS_COMMIT: 'abcdef1234567890',
        TRAVIS_BRANCH: 'main', // Target branch
        TRAVIS_PULL_REQUEST_BRANCH: 'feature-branch', // Source branch
        TRAVIS_PULL_REQUEST: '123', // PR number
        TRAVIS: 'true',
      });

      const normalized = normalizeEnvironment(testEnv);

      // For PRs, should prioritize PULL_REQUEST_BRANCH (source branch)
      expect(normalized.BRANCH_NAME).toBe('feature-branch');
      expect(normalized.BRANCH_NAME_SOURCE).toBe('TRAVIS_PR');
    });
  });

  describe('Generic CI environment variables', () => {
    it('should handle generic CI environment', () => {
      const testEnv = createTestEnv({
        CI: 'true',
      });

      const normalized = normalizeEnvironment(testEnv);
      expect(normalized.CI).toBe('true');
      expect(normalized.CI_SOURCE).toBe('GENERIC_CI');
    });
  });

  describe('Missing environment variables', () => {
    it('should handle missing environment variables gracefully', () => {
      const testEnv = createTestEnv({});

      const normalized = normalizeEnvironment(testEnv);
      expect(normalized.TOKEN).toBeUndefined();
      expect(normalized.REPOSITORY_OWNER).toBeUndefined();
      expect(normalized.REPOSITORY_NAME).toBeUndefined();
      expect(normalized.SHA).toBeUndefined();
      expect(normalized.BRANCH_NAME).toBeUndefined();
      expect(normalized.CI).toBeUndefined();
    });
  });

  describe('Mixed environment variables', () => {
    it('should handle mixed environment variables from different sources', () => {
      const testEnv = createTestEnv({
        GITHUB_TOKEN: 'github-token-value',
        VERCEL_GIT_REPO_OWNER: 'owner',
        TRAVIS_REPO_SLUG: 'owner/repo',
        GITHUB_SHA: 'abcdef1234567890',
        VERCEL_GIT_COMMIT_REF: 'main',
        TRAVIS: 'true',
      });

      const normalized = normalizeEnvironment(testEnv);

      // Should pick the first match for each variable
      expect(normalized.TOKEN).toBe('github-token-value');
      expect(normalized.TOKEN_SOURCE).toBe('GITHUB');

      expect(normalized.REPOSITORY_OWNER).toBe('owner');
      expect(normalized.REPOSITORY_OWNER_SOURCE).toBe('VERCEL');

      expect(normalized.REPOSITORY_NAME).toBe('repo');
      expect(normalized.REPOSITORY_NAME_SOURCE).toBe('TRAVIS');

      expect(normalized.SHA).toBe('abcdef1234567890');
      expect(normalized.SHA_SOURCE).toBe('GITHUB');

      expect(normalized.BRANCH_NAME).toBe('main');
      expect(normalized.BRANCH_NAME_SOURCE).toBe('VERCEL');

      expect(normalized.CI).toBe('true');
      expect(normalized.CI_SOURCE).toBe('TRAVIS');
    });
  });
});
