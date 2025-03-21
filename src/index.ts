import { execSync } from 'child_process';
import { AndroidVersionOptions, getAndroidVersionCode } from './android-version';
import { getIosBuildNumberInfo, IosVersionOptions } from './ios-version';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import * as https from 'https';

/**
 * Environment variables type for dependency injection
 * This allows us to pass environment variables explicitly in tests
 * instead of relying on process.env
 */
export type EnvVars = {
  GITHUB_REF_NAME?: string;
  GITHUB_HEAD_REF?: string;
  GITHUB_SHA?: string;
  NODE_ENV?: string;
  [key: string]: string | undefined;
};

/**
 * Executor interface for dependency injection
 * This allows us to mock the external dependencies in tests
 */
export interface Executor {
  execCommand(command: string, cwd?: string): string;

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
  execCommand: (command: string, cwd?: string) =>
    execSync(command, cwd ? { cwd } : undefined)
      .toString()
      .trim(),
  fileExists: (filePath: string) => existsSync(filePath),
  readFile: (filePath: string) => readFileSync(filePath, 'utf8'),
  writeFile: (filePath: string, content: string) => writeFileSync(filePath, content),
  mkdirSync: (dirPath: string, options?: { recursive: boolean }) => mkdirSync(dirPath, options),
  getGitHubData: async (url: string, env: EnvVars = process.env as EnvVars) => {
    // Fail if GITHUB_TOKEN is missing when running in GitHub Actions
    if (!env.GITHUB_TOKEN && env.GITHUB_ACTIONS === 'true') {
      throw new Error(
        'GITHUB_TOKEN environment variable is not set. This is required for GitHub API access when running in GitHub Actions.',
      );
    }

    // Warn if GITHUB_TOKEN is missing but not in GitHub Actions
    if (!env.GITHUB_TOKEN && env.GITHUB_ACTIONS !== 'true') {
      console.warn('Warning: GITHUB_TOKEN environment variable is not set. GitHub API requests may be rate-limited.');
    }

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

    // First find all tags that start with 'v'
    const allVTags = response.filter((tag: any) => typeof tag.name === 'string' && tag.name.startsWith('v'));

    if (allVTags.length === 0) {
      throw new Error('No tags starting with "v" found in repository');
    }

    // Then filter to only include tags that match the format vX.Y (e.g., v1.2)
    // This ensures we only consider proper version tags and ignore major version references like v1
    const versionTagRegex = /^v\d+\.\d+$/;
    const vTags = allVTags.filter((tag: any) => versionTagRegex.test(tag.name));

    if (vTags.length === 0) {
      throw new Error('No tags matching the required format vX.Y found in repository');
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
export async function getLatestTag(
  options: { executor?: Executor; env?: EnvVars; cwd?: string } = {},
): Promise<string> {
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
    // Get tags matching v*.* pattern in our ancestry and sort by creation date (newest first)
    // This will find tags like v1.2, v2.3, etc. but not v1, v2, etc.
    const gitCommand = 'git tag --list "v*.*" --sort=-creatordate --merged HEAD';
    const vTags = executor.execCommand(gitCommand, options.cwd).split('\n').filter(Boolean);

    if (vTags.length === 0) {
      throw new Error('No tags matching v*.* pattern found in repository ancestry');
    }

    // Further filter tags to match the exact vX.Y format (e.g., v1.2)
    const versionTagRegex = /^v\d+\.\d+$/;
    const versionTags = vTags.filter((tag) => versionTagRegex.test(tag.trim()));

    // No need to sort as Git already sorted by creation date (newest first)

    if (versionTags.length === 0) {
      throw new Error('No tags matching the required format vX.Y found in repository ancestry');
    }

    return versionTags[0];
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
  options: { executor?: Executor; env?: EnvVars; cwd?: string } = {},
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
    const gitCommand = `git rev-list ${fromTag}..HEAD --count`;
    const count = executor.execCommand(gitCommand, options.cwd);
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
    cwd?: string;
  } = {},
): string {
  const executor = options.executor || defaultExecutor;
  const env = options.env || (process.env as EnvVars);

  // GITHUB_HEAD_REF is set when the workflow is triggered by a pull request
  // In this case, GITHUB_REF_NAME is incorrect (eg: refs/pull/42/merge)
  if (env.GITHUB_HEAD_REF) {
    return env.GITHUB_HEAD_REF;
  }

  if (env.GITHUB_REF_NAME) {
    return env.GITHUB_REF_NAME;
  }

  try {
    const gitCommand = 'git rev-parse --abbrev-ref HEAD';
    return executor.execCommand(gitCommand, options.cwd);
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
    cwd?: string;
  } = {},
): string {
  const executor = options.executor || defaultExecutor;
  const env = options.env || (process.env as EnvVars);

  if (env.GITHUB_SHA) {
    return env.GITHUB_SHA.substring(0, 8);
  }

  try {
    const gitCommand = 'git rev-parse --short=8 HEAD';
    return executor.execCommand(gitCommand, options.cwd);
  } catch (error) {
    throw new Error('Failed to get commit hash');
  }
}

/**
 * Cleans a branch name for use in a version string
 * Removes refs/heads/ or refs/pull/ prefixes if present
 *
 * @param branchName - The branch name to clean
 * @returns The cleaned branch name
 */
export function cleanBranchName(branchName: string): string {
  // Remove refs/heads/ or refs/pull/ prefixes if present
  branchName = branchName.replace(/^refs\/(heads|pull)\//, '');

  // Replace non-alphanumeric characters with hyphens
  return branchName.replace(/[^a-zA-Z0-9]/g, '-');
}

/**
 * Version information object containing all components
 */
export interface VersionInfo {
  major: string;
  minor: string;
  patch: number;
  branchName: string;
  commitHash: string;
  version: string;
  appReleaseVersion: string; // Contains only major.minor.patch for mobile app versioning
  androidVersionCode?: number; // Optional Android version code
  iosBuildNumber?: number; // Optional iOS build number (numeric format for backward compatibility)
  iosBuildNumberString?: string; // Optional iOS build number in string format (e.g., "123.456789")
}

/**
 * Generates version information based on git information
 *
 * @param dir - Optional directory for command execution
 * @param options - Options for version generation
 * @param options.executor - Custom executor for dependency injection
 * @param options.env - Environment variables for dependency injection
 * @param options.android - Android version options
 * @returns Promise resolving to the version information object
 */
export async function generatePackageVersion(
  dir?: string,
  options: {
    executor?: Executor;
    env?: EnvVars;
    android?: AndroidVersionOptions;
    ios?: IosVersionOptions;
  } = {},
): Promise<VersionInfo> {
  const executor = options.executor || defaultExecutor;
  const env = options.env || (process.env as EnvVars);

  // Get the latest tag (format: v<major>.<minor>)
  const tag = await getLatestTag({ executor, env, cwd: dir });
  if (!tag.startsWith('v')) {
    throw new Error('Tag must start with "v"');
  }

  // Extract major and minor from tag
  const [major, minor] = tag.substring(1).split('.');
  if (!major || !minor) {
    throw new Error('Invalid tag format. Expected v<major>.<minor>');
  }

  // Get patch (number of commits since tag)
  const patch = await getCommitCount(tag, { executor, env, cwd: dir });

  // Get branch name and clean it
  const branchName = cleanBranchName(getCurrentBranch({ executor, env, cwd: dir }));

  // Get short commit hash
  const commitHash = getShortCommitHash({ executor, env, cwd: dir });

  // Generate version string in npm semver compatible format
  const version = `${major}.${minor}.${patch}-${branchName}.${commitHash}`;

  // Generate app release version (only major.minor.patch)
  const appReleaseVersion = `${major}.${minor}.${patch}`;

  // Get Android version code if Android options are provided
  let androidVersionCode: number | undefined;
  if (options.android?.enabled) {
    // Since Android option is explicitly enabled, we should fail if we can't generate the version code
    const versionCode = await getAndroidVersionCode({
      ...options.android,
      currentMajorVersion: parseInt(major, 10),
    });

    // Only set androidVersionCode if a valid version code was returned
    if (versionCode > 0) {
      androidVersionCode = versionCode;
    } else {
      throw new Error('Android version code generation failed: returned invalid version code');
    }
  }

  // Get iOS build number if iOS options are provided
  let iosBuildNumber: number | undefined;
  let iosBuildNumberString: string | undefined;
  if (options.ios?.enabled) {
    // Since iOS option is explicitly enabled, we should fail if we can't generate the build number
    const buildNumberInfo = await getIosBuildNumberInfo({
      ...options.ios,
      appReleaseVersion,
      commitHash,
    });

    //ios build number is a monotomically increasing value for the specific shortVersionString
    iosBuildNumber = buildNumberInfo.buildNumber;

    //This is what we end up setting in the IPA. it's the combination of the buildNumber and the commit hash.
    iosBuildNumberString = buildNumberInfo.buildVersion;

    // Ensure we were able to retrieve a build number, otherwise we fail.
    if (iosBuildNumber <= 0) {
      throw new Error('iOS build number generation failed: returned invalid build number');
    }
  }

  // Return the complete version info object
  return {
    major,
    minor,
    patch,
    branchName,
    commitHash,
    version,
    appReleaseVersion,
    androidVersionCode,
    iosBuildNumber,
    iosBuildNumberString,
  };
}

/**
 * Writes the generated version to a file
 *
 * @param versionInfo - The version information to write
 * @param filePath - The path to write the version file to
 * @param options - Options for writing the version file
 * @param options.executor - Custom executor for dependency injection
 * @param options.env - Environment variables for dependency injection
 */
export function writeVersionToFile(
  versionInfo: VersionInfo,
  filePath: string,
  options: { executor?: Executor; env?: EnvVars } = {},
): void {
  const executor = options.executor || defaultExecutor;
  // We don't currently use env in this function, but include it for consistency
  const fileContent = JSON.stringify(versionInfo, null, 2);

  // Create directory if it doesn't exist
  executor.mkdirSync(dirname(filePath), { recursive: true });

  executor.writeFile(filePath, fileContent);
}

/**
 * Generates version information and optionally writes it to the specified output file as a JSON object
 *
 * @param dir - The directory for command execution and relative path resolution (defaults to current working directory)
 * @param outputFilePath - Optional output file path (relative to dir if not absolute) where the version file should be written
 * @param options - Options for generating and writing the version
 * @param options.executor - Custom executor for dependency injection
 * @param options.env - Environment variables for dependency injection
 * @param options.android - Android version options
 * @returns Promise resolving to the version information object
 */
export async function generateAndWriteVersion(
  dir: string,
  outputFilePath?: string,
  options: { executor?: Executor; env?: EnvVars; android?: AndroidVersionOptions; ios?: IosVersionOptions } = {},
): Promise<VersionInfo> {
  const executor = options.executor || defaultExecutor;
  const env = options.env || (process.env as EnvVars);

  const versionInfo = await generatePackageVersion(dir, {
    executor,
    env,
    android: options.android,
    ios: options.ios,
  });

  // If an output file path is provided, write the version to that location as a JSON object
  if (outputFilePath) {
    // If outputFilePath is an absolute path, use it directly, otherwise join with dir
    const versionFilePath = outputFilePath.startsWith('/') ? outputFilePath : join(dir, outputFilePath);

    // Write the version file
    writeVersionToFile(versionInfo, versionFilePath, { executor });
  }

  return versionInfo;
}
