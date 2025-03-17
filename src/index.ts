import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import * as https from 'https';

/**
 * Environment variables type for dependency injection
 * This allows us to pass environment variables explicitly in tests
 * instead of relying on process.env
 */
export type EnvVars = {
  GITHUB_REF_NAME?: string;
  GITHUB_SHA?: string;
  NODE_ENV?: string;
  [key: string]: string | undefined;
};

/**
 * Executor interface for dependency injection
 * This allows us to mock the external dependencies in tests
 */
export interface Executor {
  execCommand(command: string): string;

  fileExists(filePath: string): boolean;

  readFile(filePath: string): string;

  writeFile(filePath: string, content: string): void;

  mkdirSync(dirPath: string, options?: { recursive: boolean }): void;

  getGitHubData(url: string): Promise<Record<string, unknown>>;
}

/**
 * Default executor implementation using real commands
 */
export const defaultExecutor: Executor = {
  execCommand: (command: string) => execSync(command).toString().trim(),
  fileExists: (filePath: string) => existsSync(filePath),
  readFile: (filePath: string) => readFileSync(filePath, 'utf8'),
  writeFile: (filePath: string, content: string) => writeFileSync(filePath, content),
  mkdirSync: (dirPath: string, options?: { recursive: boolean }) => mkdirSync(dirPath, options),
  getGitHubData: async (url: string, env: EnvVars = process.env as EnvVars) => {
    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            'User-Agent': 'Node.js',
            Accept: 'application/vnd.github.v3+json',
            ...(env.GITHUB_TOKEN ? { Authorization: `token ${env.GITHUB_TOKEN}` } : {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on('error', (e) => {
        reject(e);
      });
      req.end();
    });
  },
};

/**
 * Gets the latest tag from GitHub API
 *
 * @param executor - Custom executor for dependency injection
 * @param env - Environment variables for dependency injection
 * @returns Promise resolving to the latest tag from GitHub API
 */
async function getLatestTagFromGitHub(
  executor: Executor = defaultExecutor,
  env: EnvVars = process.env as EnvVars,
): Promise<string> {
  const owner = env.GITHUB_REPOSITORY_OWNER;
  const repo = env.GITHUB_REPOSITORY?.split('/')[1];

  if (!owner || !repo) {
    throw new Error('Missing required GitHub environment variables');
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/tags`;
  try {
    const response = await executor.getGitHubData(url);
    if (!Array.isArray(response) || response.length === 0) {
      throw new Error('No tags found in repository');
    }

    // Find the latest tag that starts with 'v'
    const vTags = response.filter((tag: any) => typeof tag.name === 'string' && tag.name.startsWith('v'));

    if (vTags.length === 0) {
      throw new Error('No tags starting with "v" found in repository');
    }

    return vTags[0].name;
  } catch (error: unknown) {
    throw new Error(`Failed to get latest tag from GitHub: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets the latest tag from git
 *
 * @param options - Options for getting the latest tag
 * @param options.executor - Custom executor for dependency injection
 * @param options.env - Environment variables for dependency injection
 * @returns Promise resolving to the latest tag
 */
export async function getLatestTag(options: { executor?: Executor; env?: EnvVars } = {}): Promise<string> {
  const executor = options.executor || defaultExecutor;
  const env = options.env || (process.env as EnvVars);

  // If running in GitHub Actions, use the GitHub API
  if (env.GITHUB_ACTIONS === 'true') {
    try {
      return await getLatestTagFromGitHub(executor, env);
    } catch (error) {
      throw new Error(`Failed to get tag from GitHub API: ${error}`);
    }
  }

  try {
    return executor.execCommand('git describe --tags --abbrev=0');
  } catch (error: unknown) {
    throw new Error(`No git tags found ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Gets the commit count from GitHub API
 *
 * @param fromTag - The tag to count commits from
 * @param executor - Custom executor for dependency injection
 * @param env
 * @returns Promise resolving to the commit count
 */
export async function getCommitCountFromGitHub(
  fromTag: string,
  executor: Executor = defaultExecutor,
  env: EnvVars = process.env as EnvVars,
): Promise<number> {
  const owner = env.GITHUB_REPOSITORY_OWNER;
  const repo = env.GITHUB_REPOSITORY?.split('/')[1];
  const sha = env.GITHUB_SHA;

  if (!owner || !repo || !sha) {
    throw new Error('Missing required GitHub environment variables');
  }

  const url = `https://api.github.com/repos/${owner}/${repo}/compare/${fromTag}...${sha}`;
  try {
    const response = await executor.getGitHubData(url);
    const aheadBy = response.ahead_by;
    if (typeof aheadBy !== 'number') {
      throw new Error(`Invalid response from GitHub API: ahead_by is not a number: ${aheadBy}`);
    }
    return aheadBy;
  } catch (error: unknown) {
    throw new Error(
      `Failed to get commit count from GitHub: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Gets the commit count from git
 *
 * @param fromTag - The tag to count commits from
 * @param options - Options for getting commit count
 * @param options.executor - Custom executor for dependency injection
 * @returns Promise resolving to the commit count
 */
export async function getCommitCount(
  fromTag: string,
  options: { executor?: Executor; env?: EnvVars } = {},
): Promise<number> {
  const executor = options.executor || defaultExecutor;
  const env = options.env || (process.env as EnvVars);

  // No special case needed as we're failing when no tags are found
  if (env.GITHUB_ACTIONS === 'true') {
    try {
      return await getCommitCountFromGitHub(fromTag, executor, env);
    } catch (error: unknown) {
      throw new Error(`Failed to get commit count from tag ${fromTag} via \
GITHUB API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    const count = executor.execCommand(`git rev-list ${fromTag}..HEAD --count`);
    return parseInt(count, 10);
  } catch (error) {
    throw new Error(`Failed to get commit count from tag ${fromTag}`);
  }
}

/**
 * Gets the current branch name
 *
 * @param options - Options for getting the current branch
 * @param options.executor - Custom executor for dependency injection
 * @returns The current branch name
 */
export function getCurrentBranch(
  options: {
    executor?: Executor;
    env?: EnvVars;
  } = {},
): string {
  const executor = options.executor || defaultExecutor;
  const env = options.env || (process.env as EnvVars);

  if (env.GITHUB_REF_NAME) {
    return env.GITHUB_REF_NAME;
  }

  try {
    return executor.execCommand('git rev-parse --abbrev-ref HEAD');
  } catch (error) {
    throw new Error('Failed to get current branch');
  }
}

/**
 * Gets the short commit hash
 *
 * @param options - Options for getting the short commit hash
 * @param options.executor - Custom executor for dependency injection
 * @returns The short commit hash
 */
export function getShortCommitHash(
  options: {
    executor?: Executor;
    env?: EnvVars;
  } = {},
): string {
  const executor = options.executor || defaultExecutor;
  const env = options.env || (process.env as EnvVars);

  if (env.GITHUB_SHA) {
    return env.GITHUB_SHA.substring(0, 8);
  }

  try {
    return executor.execCommand('git rev-parse --short=8 HEAD');
  } catch (error) {
    throw new Error('Failed to get commit hash');
  }
}

/**
 * Cleans a branch name for use in a version string
 *
 * @param branchName - The branch name to clean
 * @returns The cleaned branch name
 */
export function cleanBranchName(branchName: string): string {
  return branchName.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * Generates a version string based on git information
 *
 * @param rootDir - Optional root directory
 * @param options - Options for version generation
 * @param options.executor - Custom executor for dependency injection
 * @returns Promise resolving to the generated version string
 */
export async function generatePackageVersion(
  rootDir?: string,
  options: { executor?: Executor; env?: EnvVars } = {},
): Promise<string> {
  const executor = options.executor || defaultExecutor;
  const env = options.env || (process.env as EnvVars);

  // Get the latest tag (format: v<major>.<minor>)
  const tag = await getLatestTag({ executor, env });
  if (!tag.startsWith('v')) {
    throw new Error('Tag must start with "v"');
  }

  // Extract major and minor from tag
  const [major, minor] = tag.substring(1).split('.');
  if (!major || !minor) {
    throw new Error('Invalid tag format. Expected v<major>.<minor>');
  }

  // Get patch (number of commits since tag)
  const patch = await getCommitCount(tag, { executor, env });

  // Get branch name and clean it
  const branchName = cleanBranchName(getCurrentBranch({ executor, env }));

  // Get short commit hash
  const commitHash = getShortCommitHash({ executor, env });

  // Generate version string in npm semver compatible format
  return `${major}.${minor}.${patch}-${branchName}.${commitHash}`;
}

/**
 * Writes the generated version to a file
 *
 * @param version - The version string to write
 * @param filePath - The path to write the version file to
 * @param options - Options for writing the version file
 * @param options.executor - Custom executor for dependency injection
 * @param options.env - Environment variables for dependency injection
 */
export function writeVersionToFile(
  version: string,
  filePath: string,
  options: { executor?: Executor; env?: EnvVars } = {},
): void {
  const executor = options.executor || defaultExecutor;
  // We don't currently use env in this function, but include it for consistency
  const fileContent = JSON.stringify({ version }, null, 2);

  // Create directory if it doesn't exist
  executor.mkdirSync(dirname(filePath), { recursive: true });

  executor.writeFile(filePath, fileContent);
}

/**
 * Generates a version string and optionally writes it to the specified destination as a JSON object
 * with 'version' as the key
 *
 * @param rootDir - The root directory of the monorepo
 * @param destination - Optional destination path relative to rootDir where the version file should be written
 * @param options - Options for generating and writing the version
 * @param options.executor - Custom executor for dependency injection
 * @param options.env - Environment variables for dependency injection
 * @returns Promise resolving to an object with the version string
 */
export async function generateAndWriteVersion(
  rootDir: string,
  destination?: string,
  options: { executor?: Executor; env?: EnvVars } = {},
): Promise<{ version: string }> {
  const executor = options.executor || defaultExecutor;
  const env = options.env || (process.env as EnvVars);

  const version = await generatePackageVersion(rootDir, {
    executor,
    env,
  });
  const versionObject = { version };

  // If a destination is provided, write the version to that location as a JSON object
  if (destination) {
    const versionFilePath = join(rootDir, destination);

    // Write the version file
    writeVersionToFile(version, versionFilePath, { executor });
  }

  return versionObject;
}
