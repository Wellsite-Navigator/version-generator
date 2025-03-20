/**
 * iOS build number generation utilities
 * Handles interaction with App Store Connect API to get and increment build numbers
 */

import * as jwt from 'jsonwebtoken';
import * as https from 'https';
import { IncomingMessage } from 'http';

/**
 * Options for iOS build number generation
 */
export interface IosVersionOptions {
  /**
   * Whether iOS build number generation is enabled
   */
  enabled?: boolean;
  
  /**
   * App Store Connect API Key ID
   */
  apiKeyId?: string;
  
  /**
   * App Store Connect API Issuer ID
   */
  apiIssuerId?: string;
  
  /**
   * App Store Connect API Private Key
   * Can be a string or base64-encoded string
   */
  apiPrivateKey?: string;
  
  /**
   * Bundle ID of the iOS app (e.g., com.example.app)
   */
  bundleId?: string;
  
  /**
   * Current app release version (CFBundleShortVersionString)
   * This is the version string in format major.minor.patch
   */
  appReleaseVersion: string;
  
  /**
   * Git commit hash to encode in the build number
   */
  commitHash?: string;
}

/**
 * Version information returned from App Store Connect
 */
export interface AppStoreVersionInfo {
  highestBuildNumber: number;
}

/**
 * iOS build number information
 */
export interface IosBuildNumberInfo {
  /**
   * The build number, incremented for each build with the same short version string
   */
  buildNumber: number;
  
  /**
   * The encoded commit hash (if included)
   */
  encodedCommitHash?: number;
  
  /**
   * The composed build version string in format "buildNumber.encodedCommitHash"
   * or just "buildNumber" if encodedCommitHash is not included
   */
  buildVersion: string;
}

/**
 * Interface for iOS executor with all required dependencies
 */
export interface IosExecutor {
  /**
   * Generates a JWT token for App Store Connect API authentication
   * 
   * @param keyId - The App Store Connect API Key ID
   * @param issuerId - The App Store Connect API Issuer ID
   * @param privateKey - The App Store Connect API Private Key
   * @returns The JWT token
   */
  generateToken(keyId: string, issuerId: string, privateKey: string): string;
  
  /**
   * Queries the App Store Connect API for builds
   * 
   * @param bundleId - The bundle ID of the iOS app
   * @param appReleaseVersion - The app release version (CFBundleShortVersionString)
   * @param token - The JWT token for authentication
   * @returns Promise resolving to the builds data
   */
  queryApi(bundleId: string, appReleaseVersion: string, token: string): Promise<any>;
}



/**
 * Function type for getting iOS build number
 */
export type IosVersionProvider = (options: IosVersionOptions) => Promise<number>;

/**
 * Gets the iOS build number from App Store Connect API
 * 
 * @param options - Options for getting the iOS build number
 * @returns Promise resolving to the next iOS build number to use
 */
export async function getIosBuildNumber(options: IosVersionOptions): Promise<number> {
  const buildNumberInfo = await getIosBuildNumberInfo(options);
  return parseInt(buildNumberInfo.buildVersion.replace('.', ''));
}

/**
 * Gets detailed iOS build number information
 * 
 * @param options - Options for getting the iOS build number
 * @param versionInfoProvider - Function to get version info from App Store Connect
 * @param jwtGenerator - JWT token generator
 * @param apiClient - App Store Connect API client
 * @param buildProcessor - Build data processor
 * @returns Promise resolving to the iOS build number info
 */
/**
 * Default implementation of IosExecutor
 */
export class DefaultIosExecutor implements IosExecutor {
  /**
   * Generates a JWT token for App Store Connect API authentication
   * 
   * @param keyId - The App Store Connect API Key ID
   * @param issuerId - The App Store Connect API Issuer ID
   * @param privateKey - The App Store Connect API Private Key
   * @returns The JWT token
   */
  generateToken(keyId: string, issuerId: string, privateKey: string): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      iss: issuerId,
      exp: now + 20 * 60, // Token expires in 20 minutes
      aud: 'appstoreconnect-v1'
    };
    
    const signOptions: jwt.SignOptions = {
      algorithm: 'ES256' as jwt.Algorithm,
      header: {
        alg: 'ES256',
        kid: keyId,
        typ: 'JWT'
      }
    };
    
    return jwt.sign(payload, privateKey, signOptions);
  }
  
  /**
   * Queries the App Store Connect API for builds
   * 
   * @param bundleId - The bundle ID of the iOS app
   * @param appReleaseVersion - The app release version (CFBundleShortVersionString)
   * @param token - The JWT token for authentication
   * @returns Promise resolving to the builds data
   */
  async queryApi(
    bundleId: string,
    appReleaseVersion: string,
    token: string
  ): Promise<any> {
    // Encode the filter parameters for the URL
    const encodedBundleId = encodeURIComponent(bundleId);
    const encodedVersion = encodeURIComponent(appReleaseVersion);
    
    // Construct the API URL with filters for bundle ID and version
    const url = `https://api.appstoreconnect.apple.com/v1/builds?filter[app.bundleId]=${encodedBundleId}&filter[version]=${encodedVersion}`;
    
    return new Promise((resolve, reject) => {
      const req = https.get(
        url,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Version Generator'
          }
        },
        (res: IncomingMessage) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const jsonData = JSON.parse(data);
                resolve(jsonData);
              } catch (error) {
                reject(new Error(`Failed to parse App Store Connect API response: ${error instanceof Error ? error.message : String(error)}`));
              }
            } else {
              reject(new Error(`App Store Connect API request failed with status ${res.statusCode}: ${data}`));
            }
          });
        }
      );
      
      req.on('error', (error) => {
        reject(new Error(`App Store Connect API request failed: ${error.message}`));
      });
      
      req.end();
    });
  }
}

export async function getIosBuildNumberInfo(
  options: IosVersionOptions,
  executor: IosExecutor = new DefaultIosExecutor()
): Promise<IosBuildNumberInfo> {
  try {
    if (!options.enabled) {
      return { buildNumber: 0, buildVersion: '0' };
    }
  
    if (!options.apiKeyId || !options.apiIssuerId || !options.apiPrivateKey || !options.bundleId || !options.appReleaseVersion) {
      throw new Error('iOS build number generation requires apiKeyId, apiIssuerId, apiPrivateKey, bundleId, and appReleaseVersion');
    }
  
    // Get version info from App Store Connect API
    const versionInfo = await getAppStoreVersionInfo(
      options.bundleId,
      options.appReleaseVersion,
      options.apiKeyId,
      options.apiIssuerId,
      options.apiPrivateKey,
      executor
    );
    
    // If no version info found, start with build number 1
    if (!versionInfo) {
      return composeIosBuildVersion(1, options.commitHash);
    }
    
    // Increment the highest build number found
    return composeIosBuildVersion(versionInfo.highestBuildNumber + 1, options.commitHash);
  } catch (error) {
    throw new Error(`Failed to get iOS build number: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Encodes a commit hash into an integer for use in iOS build numbers
 * 
 * @param commitHash - The commit hash to encode
 * @returns The encoded commit hash as an integer
 */
export function encodeCommitHash(commitHash: string): number {
  // Take the first 8 characters of the commit hash (this is commonly used as a short hash)
  const shortHash = commitHash.substring(0, 8);
  
  // Convert the hex string to a decimal number
  // This could be very large, so we'll take modulo to ensure it fits in a 32-bit integer
  // (iOS build numbers are typically expected to be 32-bit integers)
  const decimal = parseInt(shortHash, 16) % 2147483647; // Max 32-bit signed integer
  
  return decimal;
}

/**
 * Gets the iOS build number with dependency injection for testing
 * 
 * @param options - Options for getting the iOS build number
 * @param versionInfoProvider - Function to get version info from App Store Connect
 * @returns Promise resolving to the next iOS build number to use
 */
/**
 * Composes an iOS build version object from a build number and optional commit hash
 * 
 * @param buildNumber - The build number
 * @param commitHash - Optional commit hash to encode in the build version
 * @returns The composed iOS build number info
 */
export function composeIosBuildVersion(buildNumber: number, commitHash?: string): IosBuildNumberInfo {
  // Create the build number info object
  const buildNumberInfo: IosBuildNumberInfo = {
    buildNumber,
    buildVersion: buildNumber.toString()
  };
  
  // If commit hash is provided, encode it and add to the build number
  if (commitHash) {
    buildNumberInfo.encodedCommitHash = encodeCommitHash(commitHash);
    buildNumberInfo.buildVersion = `${buildNumber}.${buildNumberInfo.encodedCommitHash}`;
  }
  
  return buildNumberInfo;
}



/**
 * Processes the builds data to find the highest build number
 * 
 * @param builds - The builds data from the App Store Connect API
 * @param appReleaseVersion - The app release version (CFBundleShortVersionString)
 * @returns The version info with the highest build number
 */
export function processBuilds(builds: any, appReleaseVersion: string): AppStoreVersionInfo | undefined {
  // Check if there are any builds
  if (!builds || !builds.data || !Array.isArray(builds.data) || builds.data.length === 0) {
    return undefined;
  }
  
  let highestBuildNumber = 0;
  
  // Process each build to find the highest build number
  for (const build of builds.data) {
    if (build.attributes && build.attributes.version === appReleaseVersion) {
      const buildNumber = parseInt(build.attributes.buildNumber, 10);
      if (!isNaN(buildNumber) && buildNumber > highestBuildNumber) {
        highestBuildNumber = buildNumber;
      }
    }
  }
  
  // If no valid build number was found, return undefined
  if (highestBuildNumber === 0) {
    return undefined;
  }
  
  return { highestBuildNumber };
}

export async function getAppStoreVersionInfo(
  bundleId: string,
  appReleaseVersion: string,
  apiKeyId: string,
  apiIssuerId: string,
  apiPrivateKey: string,
  executor: IosExecutor = new DefaultIosExecutor()
): Promise<AppStoreVersionInfo | undefined> {
  try {
    // Decode the private key if it's base64-encoded
    const privateKey = isBase64(apiPrivateKey) 
      ? Buffer.from(apiPrivateKey, 'base64').toString('utf8')
      : apiPrivateKey;
    
    // Generate JWT token for authentication
    const token = executor.generateToken(apiKeyId, apiIssuerId, privateKey);
    
    // Query App Store Connect API for builds
    const builds = await executor.queryApi(bundleId, appReleaseVersion, token);
    
    // Process the builds to find the highest build number
    return processBuilds(builds, appReleaseVersion);
  } catch (error) {
    throw new Error(`Failed to get App Store version info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Checks if a string is base64-encoded
 * 
 * @param str - The string to check
 * @returns Whether the string is base64-encoded
 */
function isBase64(str: string): boolean {
  try {
    return Buffer.from(str, 'base64').toString('base64') === str;
  } catch (error) {
    return false;
  }
}
