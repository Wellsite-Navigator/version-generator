#!/usr/bin/env node

import { Command } from 'commander';
import { generateAndWriteVersion, VersionInfo } from '.';
import { resolve } from 'path';

/**
 * Run the version generator with the given options
 * @param rootDir - Root directory of the monorepo
 * @param destination - Optional destination path relative to root directory
 * @param format - Output format (string or json)
 * @returns The generated version data
 */
export async function runVersionGenerator(
  rootDir: string,
  destination?: string,
  format: string = 'string',
): Promise<VersionInfo> {
  // Resolve the root directory to an absolute path
  const resolvedRootDir = resolve(rootDir);
  const normalizedFormat = format.toLowerCase();

  // Validate format option
  if (normalizedFormat !== 'string' && normalizedFormat !== 'json') {
    throw new Error('Format must be either "string" or "json"');
  }

  // Generate the version
  const versionInfo = await generateAndWriteVersion(resolvedRootDir, destination);

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
    .action(async (options) => {
      try {
        await runVersionGenerator(options.rootDir, options.destination, options.format);
      } catch (error: Error | unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error: ${errorMessage}`);
        process.exit(1);
      }
    });

  program.parse();
}
