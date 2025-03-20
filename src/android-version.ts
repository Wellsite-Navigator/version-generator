/**
 * Android version code generation utilities
 * Handles interaction with Google Play Developer API to get and increment version codes
 */

import { google } from 'googleapis';

/**
 * Default increment to add to version code when major version changes
 */
export const DEFAULT_MAJOR_VERSION_INCREMENT = 10;

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
interface PlayStoreVersionInfo {
  /**
   * The highest version code found
   */
  versionCode: number;
  
  /**
   * The major version associated with the highest version code
   */
  majorVersion: number;
}

/**
 * Gets the Android version code from Google Play API
 *
 * @param options - Options for getting the Android version code
 * @returns Promise resolving to the next Android version code to use
 */
export async function getAndroidVersionCode(options: AndroidVersionOptions): Promise<number> {
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
      options.track
    );

    if (!currentVersionInfo) {
      // If no version info is found, start with version code 1
      // This is appropriate for first-time publishing
      return 1;
    }

    const currentVersionCode = currentVersionInfo.versionCode;
    const currentMajorVersion = currentVersionInfo.majorVersion;

    // If the major version has changed, increment by a larger step
    if (options.currentMajorVersion > currentMajorVersion) {
      return currentVersionCode + (options.majorVersionIncrement || DEFAULT_MAJOR_VERSION_INCREMENT);
    } else {
      // Otherwise, increment by 1
      return currentVersionCode + 1;
    }
  } catch (error) {
    throw new Error(`Error getting Android versionCode from Google Play API: ${error instanceof Error ? error.message : String(error)}`);
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
  currentMajorVersion: number = 0
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
 * @returns Promise resolving to the version info
 */
export async function getPlayStoreVersionInfo(
  packageName: string,
  serviceAccountKey: string,
  track?: string
): Promise<PlayStoreVersionInfo | undefined> {
  try {
    // Determine if the service account key is base64-encoded
    let parsedCredentials;
    try {
      // Try to parse as JSON first
      parsedCredentials = JSON.parse(serviceAccountKey);
    } catch (e) {
      // If parsing fails, try to decode from base64
      try {
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
        // Verify the decoded string is valid JSON
        parsedCredentials = JSON.parse(decoded);
      } catch (decodeError) {
        throw new Error('Service account key is neither valid JSON nor valid base64-encoded JSON');
      }
    }
    
    // Create auth client with the parsed credentials
    const auth = new google.auth.GoogleAuth({
      credentials: parsedCredentials,
      scopes: ['https://www.googleapis.com/auth/androidpublisher']
    });

    // Create the Android Publisher client
    const androidPublisher = google.androidpublisher({
      version: 'v3',
      auth
    });

    let highestVersionCode = 0;
    let majorVersion = 0;

    // We don't need to get app details separately, we'll focus on getting the track information

    // If a specific track is provided, try to get that track's info
    if (track) {
      try {
        // Create a temporary edit to get track information
        const edit = await androidPublisher.edits.insert({
          packageName
        });
        
        const editId = edit.data.id;
        if (!editId) {
          throw new Error('Failed to create edit');
        }
        
        try {
          const trackInfo = await androidPublisher.edits.tracks.get({
            packageName,
            editId,
            track
          });

        if (trackInfo.data.releases && trackInfo.data.releases.length > 0) {
          // Process releases to find highest version code
          const result = processReleases(trackInfo.data.releases, highestVersionCode, majorVersion);
          highestVersionCode = result.highestVersionCode;
          majorVersion = result.majorVersion;
        }
        } finally {
          // Always delete the temporary edit
          try {
            await androidPublisher.edits.delete({
              packageName,
              editId
            });
          } catch (deleteError) {
            // Just log this error since we're already in an error handling block
            console.warn(`Error deleting edit: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
          }
        }
      } catch (trackError) {
        // Track might not exist, continue to check all tracks
      }
    }

    // If we didn't find anything in the specific track or no track was specified,
    // check all tracks
    if (highestVersionCode === 0) {
      try {
        // Create a temporary edit to get track information
        const edit = await androidPublisher.edits.insert({
          packageName
        });
        
        const editId = edit.data.id;
        if (!editId) {
          throw new Error('Failed to create edit');
        }
        
        try {
          const allTracks = await androidPublisher.edits.tracks.list({
            packageName,
            editId
          });

        if (allTracks.data.tracks) {
          for (const trackInfo of allTracks.data.tracks) {
            if (trackInfo.releases) {
              // Process releases to find highest version code
              const result = processReleases(trackInfo.releases, highestVersionCode, majorVersion);
              highestVersionCode = result.highestVersionCode;
              majorVersion = result.majorVersion;
            }
          }
        }
        } finally {
          // Always delete the temporary edit
          try {
            await androidPublisher.edits.delete({
              packageName,
              editId
            });
          } catch (deleteError) {
            // Just log this error since we're already in an error handling block
            console.warn(`Error deleting edit: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`);
          }
        }
      } catch (tracksError) {
        // If we can't get tracks, we'll return undefined below
      }
    }

    if (highestVersionCode === 0) {
      // No version found
      return undefined;
    }

    return {
      versionCode: highestVersionCode,
      majorVersion
    };
  } catch (error) {
    throw new Error(`Error calling Google Play API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

