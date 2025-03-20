#!/usr/bin/env node

import { Command } from 'commander';
import { generateAndWriteVersion, VersionInfo } from '.';
import { resolve } from 'path';
import { DEFAULT_MAJOR_VERSION_INCREMENT } from './android-version';

/**
 * Run the version generator with the given options
 * @param rootDir - Root directory of the monorepo
 * @param destination - Optional destination path relative to root directory
 * @param format - Output format (string or json)
 * @param androidOptions - Optional Android version code generation options
 * @returns The generated version data
 */
export async function runVersionGenerator(
  rootDir: string,
  destination?: string,
  format: string = 'string',
  androidOptions?: {
    enabled?: boolean;
    packageName?: string;
    serviceAccountKey?: string;
    track?: string;
    majorVersionIncrement?: number;
    currentMajorVersion?: number;
  },
): Promise<VersionInfo> {
  // Resolve the root directory to an absolute path
  const resolvedRootDir = resolve(rootDir);
  const normalizedFormat = format.toLowerCase();

  // Validate format option
  if (normalizedFormat !== 'string' && normalizedFormat !== 'json') {
    throw new Error('Format must be either "string" or "json"');
  }

  // Generate the version
  const versionInfo = await generateAndWriteVersion(resolvedRootDir, destination, {
    android: androidOptions ? {
      enabled: androidOptions.enabled,
      packageName: androidOptions.packageName,
      serviceAccountKey: androidOptions.serviceAccountKey,
      track: androidOptions.track,
      majorVersionIncrement: androidOptions.majorVersionIncrement,
      currentMajorVersion: androidOptions.currentMajorVersion || 0, // Default to 0 if not provided
    } : undefined
  });

  // Output based on format and destination
  if (!destination) {
    // No destination - output based on format
    if (normalizedFormat === 'string') {
      console.log(versionInfo.version);
    } else {
      console.log(JSON.stringify(versionInfo, null, 2));
    }
  } else {
    // Destination provided - output additional information
    console.log(`Successfully generated version: ${versionInfo.version}`);
  }

  return versionInfo;
}

// Only run the CLI if this file is executed directly
if (require.main === module) {
  const program = new Command();

  program
    .name('generate-version')
    .description('Generate a version based on git information')
    .requiredOption('-r, --root-dir <path>', 'Root directory of the monorepo')
    .option(
      '-d, --destination <path>',
      'Destination path relative to root directory where the version file should be written',
    )
    .option('-f, --format <format>', 'Output format (string or json)', 'string')
    .option('--android', 'Enable Android version code generation')
    .option('--android-package <packageName>', 'Android package name')
    .option('--android-service-account-key <key>', 'Service account key JSON for Google Play API authentication')
    .option('--android-track <track>', 'Track to check for version codes')
    .option('--android-major-increment <increment>', `Increment to add to version code on major version change (default: ${DEFAULT_MAJOR_VERSION_INCREMENT})`, String(DEFAULT_MAJOR_VERSION_INCREMENT))
    .action(async (options) => {
      try {
        // Prepare Android options if --android flag is set
        const androidOptions = options.android ? {
          enabled: true,
          packageName: options.androidPackage,
          serviceAccountKey: options.androidServiceAccountKey,
          track: options.androidTrack,
          majorVersionIncrement: options.androidMajorIncrement ? parseInt(options.androidMajorIncrement, 10) : undefined,
          // We don't set currentMajorVersion here as it will be determined from the git tag in generatePackageVersion
        } : undefined;
        
        await runVersionGenerator(options.rootDir, options.destination, options.format, androidOptions);
      } catch (error: Error | unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  program.parse();
}
