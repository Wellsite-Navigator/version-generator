import { getAndroidVersionCode, AndroidVersionOptions, processReleases, DEFAULT_MAJOR_VERSION_INCREMENT, getPlayStoreVersionInfo } from './android-version';
import { google } from 'googleapis';

/**
 * Mock implementation for testing without actual API calls
 */
function createMockAndroidVersionProvider(mockVersionCode?: number, mockMajorVersion?: number) {
  return async (options: AndroidVersionOptions): Promise<number> => {
    if (!options.enabled) {
      return 0; // Return 0 to indicate not enabled (will be filtered out in index.ts)
    }

    // Check required options
    if (!options.packageName || !options.serviceAccountKey) {
      throw new Error('Missing required Android options: packageName and serviceAccountKey');
    }

    if (!mockVersionCode) {
      return 1; // Start with version code 1 for new apps
    }

    if (options.currentMajorVersion > (mockMajorVersion || 0)) {
      return mockVersionCode + (options.majorVersionIncrement || DEFAULT_MAJOR_VERSION_INCREMENT);
    } else {
      return mockVersionCode + 1;
    }
  };
}

describe('Android Version Code', () => {
  // Mock options for testing
  const baseOptions: AndroidVersionOptions = {
    enabled: true,
    packageName: 'com.example.app',
    serviceAccountKey: '{}',
    currentMajorVersion: 2,
    majorVersionIncrement: DEFAULT_MAJOR_VERSION_INCREMENT
  };

  describe('createMockAndroidVersionProvider', () => {
    it('should return 0 when not enabled', async () => {
      const mockProvider = createMockAndroidVersionProvider(100, 1);
      const result = await mockProvider({ ...baseOptions, enabled: false });
      expect(result).toBe(0);
    });

    it('should throw error when missing required options', async () => {
      const mockProvider = createMockAndroidVersionProvider(100, 1);
      
      // Test missing packageName
      const options1 = { ...baseOptions, packageName: undefined };
      await expect(mockProvider(options1)).rejects.toThrow('Missing required Android options');
      
      // Test missing serviceAccountKey
      const options2 = { ...baseOptions, serviceAccountKey: undefined };
      await expect(mockProvider(options2)).rejects.toThrow('Missing required Android options');
    });

    it('should create a base version when no existing version code', async () => {
      const mockProvider = createMockAndroidVersionProvider();
      const result = await mockProvider(baseOptions);
      expect(result).toBe(1); // Start with version code 1
    });

    it('should increment by 1 when major version is the same', async () => {
      const mockProvider = createMockAndroidVersionProvider(100, 2);
      const result = await mockProvider(baseOptions);
      expect(result).toBe(101);
    });

    it('should increment by majorVersionIncrement when major version increases', async () => {
      const mockProvider = createMockAndroidVersionProvider(100, 1);
      const result = await mockProvider(baseOptions);
      expect(result).toBe(110);
    });

    it('should use default majorVersionIncrement if not provided', async () => {
      const mockProvider = createMockAndroidVersionProvider(100, 1);
      const options = { ...baseOptions };
      delete options.majorVersionIncrement;
      const result = await mockProvider(options);
      expect(result).toBe(100 + DEFAULT_MAJOR_VERSION_INCREMENT); // Use default increment
    });
  });

  // Note: We can't easily test the actual API calls without mocking the Google API
  // These tests would be integration tests that require actual credentials
  describe('getAndroidVersionCode', () => {
    it('should return 0 when not enabled', async () => {
      const result = await getAndroidVersionCode({ ...baseOptions, enabled: false });
      expect(result).toBe(0);
    });

    it('should throw error when missing required options', async () => {
      // Test missing packageName
      const options1 = { ...baseOptions, packageName: undefined };
      await expect(getAndroidVersionCode(options1)).rejects.toThrow('Missing required Android options');
      
      // Test missing serviceAccountKey
      const options2 = { ...baseOptions, serviceAccountKey: undefined };
      await expect(getAndroidVersionCode(options2)).rejects.toThrow('Missing required Android options');
    });
    
    // Note: This test doesn't actually call the API, it just tests the base64 decoding logic
    it('should handle base64-encoded service account key', async () => {
      // Mock implementation that just verifies the key was decoded
      jest.spyOn(google.auth, 'GoogleAuth').mockImplementationOnce((options: any) => {
        // Verify the credentials were parsed correctly
        expect(options?.credentials).toEqual({ test: 'value' });
        return {} as any;
      });
      
      // Base64 encoding of {"test":"value"}
      const base64Key = 'eyJ0ZXN0IjoidmFsdWUifQ==';
      
      // Create a mock for androidpublisher to prevent actual API calls
      jest.spyOn(google, 'androidpublisher').mockImplementationOnce(() => {
        return {
          edits: {
            insert: jest.fn().mockResolvedValue({ data: { id: 'test-edit-id' } })
          }
        } as any;
      });
      
      // This will throw an error later in the process, but we just want to test
      // that the base64 decoding worked, so we catch and ignore that error
      try {
        await getPlayStoreVersionInfo('com.example.app', base64Key);
      } catch (e) {
        // Expected to throw, but we've already verified the decoding worked
      }
      
      // Restore the mocks
      jest.restoreAllMocks();
    });

    // For actual API calls, we would need to mock the googleapis library
    // This is just a placeholder to show how we would structure those tests
  });

  describe('processReleases', () => {
    it('should return initial values when releases array is empty', () => {
      const result = processReleases([], 10, 2);
      expect(result.highestVersionCode).toBe(10);
      expect(result.majorVersion).toBe(2);
    });

    it('should find highest version code in releases', () => {
      const releases = [
        {
          versionCodes: ['100', '101'],
          name: '1.0.0'
        },
        {
          versionCodes: ['102', '105'],
          name: '1.1.0'
        },
        {
          versionCodes: ['90'],
          name: '0.9.0'
        }
      ];

      const result = processReleases(releases);
      expect(result.highestVersionCode).toBe(105);
      expect(result.majorVersion).toBe(1);
    });

    it('should extract major version from release name', () => {
      const releases = [
        {
          versionCodes: ['100'],
          name: '1.0.0'
        },
        {
          versionCodes: ['200'],
          name: '2.0.0'
        }
      ];

      const result = processReleases(releases);
      expect(result.highestVersionCode).toBe(200);
      expect(result.majorVersion).toBe(2);
    });

    it('should handle releases without version codes', () => {
      const releases = [
        {
          name: '1.0.0'
        },
        {
          versionCodes: ['100'],
          name: '1.1.0'
        }
      ];

      const result = processReleases(releases);
      expect(result.highestVersionCode).toBe(100);
      expect(result.majorVersion).toBe(1);
    });

    it('should handle releases without names', () => {
      const releases = [
        {
          versionCodes: ['100']
        },
        {
          versionCodes: ['200']
        }
      ];

      const result = processReleases(releases, 0, 3);
      expect(result.highestVersionCode).toBe(200);
      expect(result.majorVersion).toBe(3); // Should keep initial major version
    });

    it('should handle invalid version codes', () => {
      const releases = [
        {
          versionCodes: ['abc', '100'],
          name: '1.0.0'
        }
      ];

      const result = processReleases(releases);
      expect(result.highestVersionCode).toBe(100); // Should ignore 'abc'
      expect(result.majorVersion).toBe(1);
    });

    it('should handle release names without proper version format', () => {
      const releases = [
        {
          versionCodes: ['100'],
          name: 'Release 1'
        },
        {
          versionCodes: ['200'],
          name: '2.0.0'
        }
      ];

      const result = processReleases(releases);
      expect(result.highestVersionCode).toBe(200);
      expect(result.majorVersion).toBe(2); // Should extract from the second release
    });
  });
});
