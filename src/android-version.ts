/**
 * Android version code generation utilities
 * Handles interaction with Google Play Developer API to get and increment version codes
 */

import { google } from 'googleapis';
import { parseJSONValue } from './base64';

/**
 * Default increment to add to version code when major version changes
 */
export const DEFAULT_MAJOR_VERSION_INCREMENT = 10;

/**
 * Raw track data returned from the Play Store API
 */
export interface PlayStoreTrackData {
  /**
   * Track name
   */
  track?: string;

  /**
   * Releases in the track
   */
  releases?: any[];
}

/**
 * Interface for Android executor to handle Play Store API interactions
 * This allows for easier mocking in tests
 */
export interface AndroidExecutor {
  /**
   * Query a specific track from the Play Store API
   *
   * @param packageName - The package name of the Android app
   * @param credentials - The parsed service account credentials
   * @param track - The track to query
   * @returns Promise resolving to the track data
   */
  queryTrack(packageName: string, credentials: any, track: string): Promise<PlayStoreTrackData | undefined>;

  /**
   * Query all tracks from the Play Store API
   *
   * @param packageName - The package name of the Android app
   * @param credentials - The parsed service account credentials
   * @returns Promise resolving to an array of track data
   */
  queryAllTracks(packageName: string, credentials: any): Promise<PlayStoreTrackData[]>;
}

/**
 * Options for Android version code generation
 */
export interface AndroidVersionOptions {
  /**
   * Whether Android version code generation is enabled
   */
  enabled?: boolean;

  /**
   * Package name of the Android app
   */
  packageName?: string;

  /**
   * Service account key JSON for Google Play API authentication
   * Can be either a JSON string or a base64-encoded JSON string
   */
  serviceAccountKey?: string;

  /**
   * Track to check for version codes (if not specified, checks all tracks)
   */
  track?: string;

  /**
   * Increment to add to version code when major version changes
   * @default 10
   */
  majorVersionIncrement?: number;

  /**
   * Current major version from app version
   */
  currentMajorVersion: number;
}

/**
 * Version information returned from Google Play
 */
export interface PlayStoreVersionInfo {
  /**
   * The highest version code found
   */
  highestVersionCode: number;

  /**
   * The major version associated with the highest version code
   */
  majorVersion: number;
}

/**
 * Default implementation of AndroidExecutor
 */
export class DefaultAndroidExecutor implements AndroidExecutor {
  /**
   * Create an authenticated Google Play API client
   *
   * @param credentials - The parsed service account credentials
   * @returns The authenticated API client
   */
  private createApiClient(credentials: any) {
    // Create auth client with the parsed credentials
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    });

    // Create the Android Publisher client
    return google.androidpublisher({
      version: 'v3',
      auth,
    });
  }

  /**
   * Query a specific track from the Play Store API
   *
   * @param packageName - The package name of the Android app
   * @param credentials - The parsed service account credentials
   * @param track - The track to query
   * @returns Promise resolving to the track data
   */
  async queryTrack(packageName: string, credentials: any, track: string): Promise<PlayStoreTrackData | undefined> {
    // Remove quotes if the package name is wrapped in quotes
    if (typeof packageName === 'string' && packageName.startsWith('"') && packageName.endsWith('"')) {
      packageName = packageName.slice(1, -1);
    }

    const androidPublisher = this.createApiClient(credentials);

    try {
      // Create a temporary edit to get track information
      const edit = await androidPublisher.edits.insert({
        packageName,
      });

      const editId = edit.data.id;
      if (!editId) {
        throw new Error('Failed to create edit');
      }

      try {
        const trackInfo = await androidPublisher.edits.tracks.get({
          packageName,
          editId,
          track,
        });

        return {
          track,
          releases: trackInfo.data.releases || [],
        };
      } finally {
        // Always try to delete the edit when done
        try {
          await androidPublisher.edits.delete({
            packageName,
            editId,
          });
        } catch (deleteError) {
          // Just log this error since we're already in an error handling block
          console.warn(
            `Error deleting edit: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`,
          );
        }
      }
    } catch (error) {
      // If we can't get the specific track, return undefined
      // The caller can decide to fall back to queryAllTracks
      return undefined;
    }
  }

  /**
   * Query all tracks from the Play Store API
   *
   * @param packageName - The package name of the Android app
   * @param credentials - The parsed service account credentials
   * @returns Promise resolving to an array of track data
   */
  async queryAllTracks(packageName: string, credentials: any): Promise<PlayStoreTrackData[]> {
    // Remove quotes if the package name is wrapped in quotes
    if (typeof packageName === 'string' && packageName.startsWith('"') && packageName.endsWith('"')) {
      packageName = packageName.slice(1, -1);
    }

    const androidPublisher = this.createApiClient(credentials);

    try {
      // Create a temporary edit to get all tracks
      const edit = await androidPublisher.edits.insert({
        packageName,
      });

      const editId = edit.data.id;
      if (!editId) {
        throw new Error('Failed to create edit');
      }

      try {
        const allTracks = await androidPublisher.edits.tracks.list({
          packageName,
          editId,
        });

        if (!allTracks.data.tracks) {
          return [];
        }

        return allTracks.data.tracks.map((track) => ({
          track: track.track || undefined, // Convert null to undefined to match our interface
          releases: track.releases || [],
        }));
      } finally {
        // Always try to delete the edit when done
        try {
          await androidPublisher.edits.delete({
            packageName,
            editId,
          });
        } catch (deleteError) {
          // Just log this error since we're already in an error handling block
          console.warn(
            `Error deleting edit: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`,
          );
        }
      }
    } catch (error) {
      throw new Error(`Failed to get track information: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Gets the Android version code from Google Play API
 *
 * @param options - Options for getting the Android version code
 * @param executor - The Android executor to use (optional)
 * @returns Promise resolving to the next Android version code to use
 */
export async function getAndroidVersionCode(
  options: AndroidVersionOptions,
  executor: AndroidExecutor = new DefaultAndroidExecutor(),
): Promise<number> {
  // Check if Android version code generation is enabled
  if (!options.enabled) {
    return 0; // Return 0 to indicate not enabled (will be filtered out in index.ts)
  }

  // Check if required options are provided
  if (!options.packageName || !options.serviceAccountKey) {
    throw new Error('Missing required Android options: packageName and serviceAccountKey');
  }

  try {
    // Use Google Play Developer API to get the current highest versionCode
    const currentVersionInfo = await getPlayStoreVersionInfo(
      options.packageName,
      options.serviceAccountKey,
      options.track,
      executor,
    );

    if (!currentVersionInfo) {
      // If no version info is found, start with version code 1
      // This is appropriate for first-time publishing
      return 1;
    }

    const currentVersionCode = currentVersionInfo.highestVersionCode;
    const currentMajorVersion = currentVersionInfo.majorVersion;

    // If the major version has changed, increment by a larger step
    if (options.currentMajorVersion > currentMajorVersion) {
      return currentVersionCode + (options.majorVersionIncrement || DEFAULT_MAJOR_VERSION_INCREMENT);
    } else {
      // Otherwise, increment by 1
      return currentVersionCode + 1;
    }
  } catch (error) {
    throw new Error(`Failed to get Android version code: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Helper function to process releases and find the highest version code
 *
 * @param releases - Array of releases to process
 * @param currentHighestVersionCode - Current highest version code found
 * @param currentMajorVersion - Current major version found
 * @returns Object containing the highest version code and associated major version
 */
export function processReleases(
  releases: any[],
  currentHighestVersionCode: number = 0,
  currentMajorVersion: number = 0,
): { highestVersionCode: number; majorVersion: number } {
  let highestVersionCode = currentHighestVersionCode;
  let majorVersion = currentMajorVersion;

  for (const release of releases) {
    if (release.versionCodes && release.versionCodes.length > 0) {
      for (const versionCodeStr of release.versionCodes) {
        const versionCode = parseInt(versionCodeStr, 10);
        if (versionCode > highestVersionCode) {
          highestVersionCode = versionCode;
          // Try to extract major version from name if available
          if (release.name) {
            const versionMatch = release.name.match(/^(\d+)\./);
            if (versionMatch) {
              majorVersion = parseInt(versionMatch[1], 10);
            }
          }
        }
      }
    }
  }

  return { highestVersionCode, majorVersion };
}

/**
 * Gets the version info from the Play Store
 *
 * @param packageName - The package name of the Android app
 * @param serviceAccountKey - The service account key for authentication
 * @param track - The track to get the version info from (optional)
 * @param executor - The Android executor to use (optional)
 * @returns Promise resolving to the version info
 */
export async function getPlayStoreVersionInfo(
  packageName: string,
  serviceAccountKey: string,
  track?: string,
  executor: AndroidExecutor = new DefaultAndroidExecutor(),
): Promise<PlayStoreVersionInfo | undefined> {
  try {
    // Parse the service account key
    const credentials = parseJSONValue(serviceAccountKey);
    let trackData: PlayStoreTrackData[] = [];

    // If a specific track is provided, try to get that track's info first
    if (track) {
      const specificTrackData = await executor.queryTrack(packageName, credentials, track);
      if (specificTrackData && specificTrackData.releases && specificTrackData.releases.length > 0) {
        trackData.push(specificTrackData);
      }
    }

    // If no specific track was provided or no data was found in the specific track,
    // query all tracks
    if (trackData.length === 0) {
      trackData = await executor.queryAllTracks(packageName, credentials);
    }

    // Process the track data to find the highest version code
    return processTrackData(trackData);
  } catch (error) {
    throw new Error(`Failed to get Play Store version info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Process track data to find the highest version code and associated major version
 *
 * @param trackData - Array of track data to process
 * @returns The version info with highest version code and major version
 */
export function processTrackData(trackData: PlayStoreTrackData[]): PlayStoreVersionInfo | undefined {
  if (trackData.length === 0) {
    return undefined;
  }

  let highestVersionCode = 0;
  let majorVersion = 0;

  // Process each track to find the highest version code
  for (const track of trackData) {
    if (track.releases && track.releases.length > 0) {
      const result = processReleases(track.releases, highestVersionCode, majorVersion);
      if (result.highestVersionCode > highestVersionCode) {
        highestVersionCode = result.highestVersionCode;
        majorVersion = result.majorVersion;
      } else if (result.highestVersionCode === highestVersionCode && result.majorVersion > majorVersion) {
        majorVersion = result.majorVersion;
      }
    }
  }

  if (highestVersionCode === 0) {
    return undefined;
  }

  return { highestVersionCode, majorVersion };
}
