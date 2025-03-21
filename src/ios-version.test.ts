import {
  getIosBuildNumberInfo,
  encodeCommitHash,
  IosVersionOptions,
  AppStoreVersionInfo,
  IosVersionProvider,
  IosExecutor,
  getAppStoreVersionInfo,
  DefaultIosExecutor,
  processBuilds,
  IosBuildNumberInfo,
} from './ios-version';
import { IncomingMessage } from 'http';

describe('iOS Version', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Base options for testing
  const baseOptions: IosVersionOptions = {
    enabled: true,
    bundleId: 'com.example.app',
    apiKeyId: 'test-key-id',
    apiIssuerId: 'test-issuer-id',
    apiPrivateKey: 'test-private-key',
    appReleaseVersion: '1.0.0',
  } as Required<IosVersionOptions>;

  describe('getIosBuildNumberInfo', () => {
    // Create mock implementation of IosExecutor
    class MockIosExecutor implements IosExecutor {
      generateToken = jest.fn().mockReturnValue('mock-jwt-token');
      queryApi = jest.fn().mockResolvedValue({
        data: [
          {
            attributes: {
              version: '1.0.0',
              buildNumber: '5',
            },
          },
        ],
      });
    }

    const mockExecutor = new MockIosExecutor();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return 0 when iOS build number generation is not enabled', async () => {
      const result = await getIosBuildNumberInfo({ ...baseOptions, enabled: false }, mockExecutor);
      expect(result.buildNumber).toBe(0);
      expect(result.buildVersion).toBe('0');
      expect(mockExecutor.generateToken).not.toHaveBeenCalled();
      expect(mockExecutor.queryApi).not.toHaveBeenCalled();
    });

    it('should throw an error when required options are missing', async () => {
      await expect(getIosBuildNumberInfo({ ...baseOptions, apiKeyId: undefined }, mockExecutor)).rejects.toThrow(
        'iOS build number generation requires apiKeyId, apiIssuerId, apiPrivateKey, bundleId, and appReleaseVersion',
      );
      expect(mockExecutor.generateToken).not.toHaveBeenCalled();
      expect(mockExecutor.queryApi).not.toHaveBeenCalled();
    });

    it('should return build number info without commit hash', async () => {
      const result = await getIosBuildNumberInfo(baseOptions, mockExecutor);

      // Verify the expected structure
      expect(result.buildNumber).toBe(6); // 5 + 1
      expect(result.buildVersion).toBe('6');
      expect(mockExecutor.generateToken).toHaveBeenCalled();
      expect(mockExecutor.queryApi).toHaveBeenCalled();
    });

    it('should include encoded commit hash when provided', async () => {
      const commitHash = 'abcdef1234567890';
      const expectedEncodedHash = encodeCommitHash(commitHash);

      const result = await getIosBuildNumberInfo(
        {
          ...baseOptions,
          commitHash,
        },
        mockExecutor,
      );

      // Verify the expected structure
      expect(result.buildNumber).toBe(6);
      expect(result.encodedCommitHash).toBe(expectedEncodedHash);
      expect(result.buildVersion).toBe(`6.${expectedEncodedHash}`);
    });

    it('should return build number 1 when no builds are found', async () => {
      // Mock the queryApi to return empty data
      mockExecutor.queryApi = jest.fn().mockResolvedValue({ data: [] });

      const result = await getIosBuildNumberInfo(baseOptions, mockExecutor);

      expect(result.buildNumber).toBe(1);
      expect(result.buildVersion).toBe('1');
    });

    it('should handle API errors gracefully', async () => {
      // Mock the queryApi to throw an error
      mockExecutor.queryApi = jest.fn().mockRejectedValue(new Error('API request failed'));

      await expect(getIosBuildNumberInfo(baseOptions, mockExecutor)).rejects.toThrow('Failed to get iOS build number');
    });
  });

  describe('encodeCommitHash', () => {
    it('should encode a commit hash to an integer', () => {
      const hash = 'abcdef1234567890';
      const encoded = encodeCommitHash(hash);
      expect(typeof encoded).toBe('number');
      expect(encoded).toBeLessThanOrEqual(2147483647); // Max 32-bit signed integer
    });

    it('should consistently encode the same hash to the same integer', () => {
      const hash1 = 'abcdef1234567890';
      const hash2 = 'abcdef1234567890';
      const encoded1 = encodeCommitHash(hash1);
      const encoded2 = encodeCommitHash(hash2);
      expect(encoded1).toBe(encoded2);
    });

    it('should encode different hashes to different integers', () => {
      const hash1 = 'abcdef1234567890';
      const hash2 = '1234567890abcdef';
      const encoded1 = encodeCommitHash(hash1);
      const encoded2 = encodeCommitHash(hash2);
      expect(encoded1).not.toBe(encoded2);
    });
  });

  describe('getIosBuildNumberInfo for build number tests', () => {
    // Mock the executor for getIosBuildNumberInfo
    let mockExecutor: IosExecutor;

    beforeEach(() => {
      mockExecutor = {
        generateToken: jest.fn().mockReturnValue('mock-token'),
        queryApi: jest.fn().mockImplementation(async (bundleId: string, appReleaseVersion: string) => {
          if (!bundleId || !appReleaseVersion) {
            throw new Error('Bundle ID and app release version are required');
          }

          // Return different values based on the test case
          if (bundleId === 'com.example.app' && appReleaseVersion === '1.0.0') {
            // This is for the "highest build number" test
            return {
              data: [
                { attributes: { version: '1.0.0', buildNumber: '5' } },
                { attributes: { version: '1.0.0', buildNumber: '6' } },
                { attributes: { version: '1.0.0', buildNumber: '4' } },
              ],
            };
          } else if (bundleId === 'com.example.error') {
            throw new Error('API request failed');
          }

          // Default for "no builds found" test
          return { data: [] };
        }),
      };
    });

    afterEach(() => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
    });

    it('should return build number 0 when iOS build number generation is not enabled', async () => {
      const testOptions: IosVersionOptions = {
        enabled: false,
        appReleaseVersion: '1.0.0',
      };

      const result = await getIosBuildNumberInfo(testOptions, mockExecutor);
      expect(result.buildNumber).toBe(0);
      expect(result.buildVersion).toBe('0');
    });

    it('should throw an error when required options are missing', async () => {
      const testOptions: IosVersionOptions = {
        enabled: true,
        appReleaseVersion: '1.0.0',
      };

      await expect(getIosBuildNumberInfo(testOptions, mockExecutor)).rejects.toThrow(
        'iOS build number generation requires apiKeyId, apiIssuerId, apiPrivateKey, bundleId, and appReleaseVersion',
      );
    });

    it('should return build number 1 when no builds are found for the version', async () => {
      const testOptions: IosVersionOptions = {
        enabled: true,
        bundleId: 'com.example.new',
        apiKeyId: 'test-key-id',
        apiIssuerId: 'test-issuer-id',
        apiPrivateKey: 'test-private-key',
        appReleaseVersion: '1.0.0',
      };

      const result = await getIosBuildNumberInfo(testOptions, mockExecutor);
      expect(result.buildNumber).toBe(1);
    });

    it('should return highest build number + 1 when builds are found', async () => {
      const testOptions: IosVersionOptions = {
        enabled: true,
        bundleId: 'com.example.app',
        apiKeyId: 'test-key-id',
        apiIssuerId: 'test-issuer-id',
        apiPrivateKey: 'test-private-key',
        appReleaseVersion: '1.0.0',
      };

      const result = await getIosBuildNumberInfo(testOptions, mockExecutor);
      expect(result.buildNumber).toBe(7); // 6 + 1
    });

    it('should handle API errors gracefully', async () => {
      const testOptions: IosVersionOptions = {
        enabled: true,
        bundleId: 'com.example.error',
        apiKeyId: 'test-key-id',
        apiIssuerId: 'test-issuer-id',
        apiPrivateKey: 'test-private-key',
        appReleaseVersion: '1.0.0',
      };

      await expect(getIosBuildNumberInfo(testOptions, mockExecutor)).rejects.toThrow('Failed to get iOS build number');
    });
  });

  describe('processBuilds', () => {
    it('should return undefined for empty builds data', () => {
      expect(processBuilds(undefined, '1.0.0')).toBeUndefined();
      expect(processBuilds({}, '1.0.0')).toBeUndefined();
      expect(processBuilds({ data: [] }, '1.0.0')).toBeUndefined();
    });

    it('should find the highest build number for matching version', () => {
      const buildsData = {
        data: [
          { attributes: { version: '1.0.0', buildNumber: '3' } },
          { attributes: { version: '1.0.0', buildNumber: '5' } },
          { attributes: { version: '1.0.0', buildNumber: '2' } },
          { attributes: { version: '1.1.0', buildNumber: '10' } }, // Different version
        ],
      };

      const result = processBuilds(buildsData, '1.0.0');
      expect(result).toEqual({ highestBuildNumber: 5 });
    });

    it('should return undefined if no matching version found', () => {
      const buildsData = {
        data: [
          { attributes: { version: '1.1.0', buildNumber: '3' } },
          { attributes: { version: '1.2.0', buildNumber: '5' } },
        ],
      };

      const result = processBuilds(buildsData, '1.0.0');
      expect(result).toBeUndefined();
    });
  });

  describe('getAppStoreVersionInfo', () => {
    // Create mock implementation of IosExecutor
    class MockIosExecutor implements IosExecutor {
      generateToken = jest.fn().mockReturnValue('mock-jwt-token');
      queryApi = jest.fn().mockResolvedValue({
        data: [
          {
            attributes: {
              version: '1.0.0',
              buildNumber: '5',
            },
          },
        ],
      });
    }

    const mockExecutor = new MockIosExecutor();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should handle API response correctly', async () => {
      // Call the function with test parameters and mock executor
      const result = await getAppStoreVersionInfo(
        'com.example.app',
        '1.0.0',
        'test-key-id',
        'test-issuer-id',
        'test-private-key',
        mockExecutor,
      );

      // Verify the result
      expect(result).toEqual({ highestBuildNumber: 5 });

      // Verify that our mock executor methods were called with the correct parameters
      expect(mockExecutor.generateToken).toHaveBeenCalledWith('test-key-id', 'test-issuer-id', 'test-private-key');
      expect(mockExecutor.queryApi).toHaveBeenCalledWith('com.example.app', '1.0.0', 'mock-jwt-token');
    });

    it('should find the highest build number when multiple builds match the filter', async () => {
      // Create a mock executor that returns multiple builds
      const multipleBuildsExecutor = new MockIosExecutor();
      multipleBuildsExecutor.queryApi = jest.fn().mockResolvedValue({
        data: [
          { attributes: { version: '1.0.0', buildNumber: '3' } },
          { attributes: { version: '1.0.0', buildNumber: '8' } }, // Highest build number
          { attributes: { version: '1.0.0', buildNumber: '2' } },
          { attributes: { version: '1.1.0', buildNumber: '10' } }, // Different version
        ],
      });

      // Call the function with test parameters and mock executor
      const result = await getAppStoreVersionInfo(
        'com.example.app',
        '1.0.0',
        'test-key-id',
        'test-issuer-id',
        'test-private-key',
        multipleBuildsExecutor,
      );

      // Verify the result - should find the highest build number (8) for version 1.0.0
      expect(result).toEqual({ highestBuildNumber: 8 });

      // Verify that our mock executor methods were called with the correct parameters
      expect(multipleBuildsExecutor.generateToken).toHaveBeenCalledWith(
        'test-key-id',
        'test-issuer-id',
        'test-private-key',
      );
      expect(multipleBuildsExecutor.queryApi).toHaveBeenCalledWith('com.example.app', '1.0.0', 'mock-jwt-token');
    });

    it('should handle base64-encoded private key', async () => {
      // Base64 encoded 'test-private-key'
      const base64Key = Buffer.from('test-private-key').toString('base64');

      // Call the function with test parameters and mock executor
      await getAppStoreVersionInfo(
        'com.example.app',
        '1.0.0',
        'test-key-id',
        'test-issuer-id',
        base64Key,
        mockExecutor,
      );

      // Verify that the private key was decoded before being passed to the executor
      expect(mockExecutor.generateToken).toHaveBeenCalledWith('test-key-id', 'test-issuer-id', 'test-private-key');
    });

    it('should handle API errors gracefully', async () => {
      // Make the executor's queryApi method throw an error
      mockExecutor.queryApi.mockRejectedValue(new Error('API request failed'));

      // Call the function and expect it to throw
      await expect(
        getAppStoreVersionInfo(
          'com.example.app',
          '1.0.0',
          'test-key-id',
          'test-issuer-id',
          'test-private-key',
          mockExecutor,
        ),
      ).rejects.toThrow('Failed to get App Store version info: API request failed');
    });
  });
});
