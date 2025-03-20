import { getAndroidVersionCode, AndroidVersionOptions, processReleases, DEFAULT_MAJOR_VERSION_INCREMENT, getPlayStoreVersionInfo, AndroidExecutor, PlayStoreVersionInfo, PlayStoreTrackData, processTrackData } from './android-version';
import { google } from 'googleapis';

/**
 * Mock implementation of AndroidExecutor for testing
 */
class MockAndroidExecutor implements AndroidExecutor {
  private mockVersionInfo?: PlayStoreVersionInfo;
  private mockTrackData: PlayStoreTrackData[] = [];
  private shouldThrowError: boolean = false;
  private errorMessage: string = '';

  constructor(mockHighestVersionCode?: number, mockMajorVersion?: number) {
    if (mockHighestVersionCode !== undefined && mockMajorVersion !== undefined) {
      this.mockVersionInfo = {
        highestVersionCode: mockHighestVersionCode,
        majorVersion: mockMajorVersion
      };
      
      // Create a mock track with a release that has this version code
      this.mockTrackData = [{
        track: 'production',
        releases: [{
          versionCodes: [mockHighestVersionCode.toString()],
          name: `${mockMajorVersion}.0.0`
        }]
      }];
    }
  }

  setMockVersionInfo(highestVersionCode: number, majorVersion: number): void {
    this.mockVersionInfo = { highestVersionCode, majorVersion };
    
    // Update mock track data to match
    this.mockTrackData = [{
      track: 'production',
      releases: [{
        versionCodes: [highestVersionCode.toString()],
        name: `${majorVersion}.0.0`
      }]
    }];
  }
  
  setMockTrackData(trackData: PlayStoreTrackData[]): void {
    this.mockTrackData = trackData;
    
    // Update version info based on the track data
    const versionInfo = processTrackData(trackData);
    if (versionInfo) {
      this.mockVersionInfo = versionInfo;
    }
  }

  setError(message: string): void {
    this.shouldThrowError = true;
    this.errorMessage = message;
  }

  parseServiceAccountKey(serviceAccountKey: string): any {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage || 'Mock error in parseServiceAccountKey');
    }
    
    try {
      // Try to parse as JSON first
      return JSON.parse(serviceAccountKey);
    } catch (e) {
      // If parsing fails, try to decode from base64
      try {
        const decoded = Buffer.from(serviceAccountKey, 'base64').toString('utf-8');
        // Verify the decoded string is valid JSON
        return JSON.parse(decoded);
      } catch (decodeError) {
        throw new Error('Service account key is neither valid JSON nor valid base64-encoded JSON');
      }
    }
  }
  
  async queryTrack(packageName: string, credentials: any, track: string): Promise<PlayStoreTrackData | undefined> {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage || 'Mock error in queryTrack');
    }
    
    // Find the track in our mock data
    const trackData = this.mockTrackData.find(t => t.track === track);
    return trackData;
  }
  
  async queryAllTracks(packageName: string, credentials: any): Promise<PlayStoreTrackData[]> {
    if (this.shouldThrowError) {
      throw new Error(this.errorMessage || 'Mock error in queryAllTracks');
    }
    
    return this.mockTrackData;
  }
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



  describe('getAndroidVersionCode', () => {
    it('should return 0 when not enabled', async () => {
      const mockExecutor = new MockAndroidExecutor(100, 1);
      const result = await getAndroidVersionCode({ ...baseOptions, enabled: false }, mockExecutor);
      expect(result).toBe(0);
    });

    it('should throw error when missing required options', async () => {
      const mockExecutor = new MockAndroidExecutor(100, 1);
      
      // Test missing packageName
      const options1 = { ...baseOptions, packageName: undefined };
      await expect(getAndroidVersionCode(options1, mockExecutor)).rejects.toThrow('Missing required Android options');
      
      // Test missing serviceAccountKey
      const options2 = { ...baseOptions, serviceAccountKey: undefined };
      await expect(getAndroidVersionCode(options2, mockExecutor)).rejects.toThrow('Missing required Android options');
    });
    
    it('should return 1 when no version info is found', async () => {
      const mockExecutor = new MockAndroidExecutor(); // No version info provided
      const result = await getAndroidVersionCode(baseOptions, mockExecutor);
      expect(result).toBe(1);
    });
    
    it('should increment by 1 when major version is the same', async () => {
      const mockExecutor = new MockAndroidExecutor(100, 2); // Same major version as baseOptions
      const result = await getAndroidVersionCode(baseOptions, mockExecutor);
      expect(result).toBe(101);
    });
    
    it('should increment by majorVersionIncrement when major version increases', async () => {
      const mockExecutor = new MockAndroidExecutor(100, 1); // Lower major version than baseOptions
      const result = await getAndroidVersionCode(baseOptions, mockExecutor);
      expect(result).toBe(110); // 100 + DEFAULT_MAJOR_VERSION_INCREMENT
    });
    
    it('should use default majorVersionIncrement if not provided', async () => {
      const mockExecutor = new MockAndroidExecutor(100, 1);
      const options = { ...baseOptions };
      delete options.majorVersionIncrement;
      const result = await getAndroidVersionCode(options, mockExecutor);
      expect(result).toBe(100 + DEFAULT_MAJOR_VERSION_INCREMENT);
    });
    
    it('should propagate errors from the executor', async () => {
      const mockExecutor = new MockAndroidExecutor(100, 1);
      mockExecutor.setError('Test error from executor');
      await expect(getAndroidVersionCode(baseOptions, mockExecutor)).rejects.toThrow('Test error from executor');
    });
  });
  
  describe('getPlayStoreVersionInfo', () => {
    it('should return version info from the executor', async () => {
      const mockExecutor = new MockAndroidExecutor(100, 2);
      const result = await getPlayStoreVersionInfo('com.example.app', '{}', undefined, mockExecutor);
      expect(result).toEqual({
        highestVersionCode: 100,
        majorVersion: 2
      });
    });
    
    it('should return undefined when no version info is available', async () => {
      const mockExecutor = new MockAndroidExecutor(); // No version info
      const result = await getPlayStoreVersionInfo('com.example.app', '{}', undefined, mockExecutor);
      expect(result).toBeUndefined();
    });
    
    it('should query specific track when provided', async () => {
      const mockExecutor = new MockAndroidExecutor();
      const trackSpy = jest.spyOn(mockExecutor, 'queryTrack');
      const allTracksSpy = jest.spyOn(mockExecutor, 'queryAllTracks');
      
      // Set up mock data for a specific track
      mockExecutor.setMockTrackData([{
        track: 'beta',
        releases: [{
          versionCodes: ['200'],
          name: '3.0.0'
        }]
      }]);
      
      const result = await getPlayStoreVersionInfo('com.example.app', '{}', 'beta', mockExecutor);
      
      // Verify the specific track was queried
      expect(trackSpy).toHaveBeenCalledWith('com.example.app', expect.anything(), 'beta');
      
      // Verify all tracks were not queried since we found data in the specific track
      expect(allTracksSpy).not.toHaveBeenCalled();
      
      // Verify the result matches the mock data
      expect(result).toEqual({
        highestVersionCode: 200,
        majorVersion: 3
      });
      
      trackSpy.mockRestore();
      allTracksSpy.mockRestore();
    });
    
    it('should fall back to all tracks when specific track has no data', async () => {
      const mockExecutor = new MockAndroidExecutor();
      const trackSpy = jest.spyOn(mockExecutor, 'queryTrack');
      const allTracksSpy = jest.spyOn(mockExecutor, 'queryAllTracks');
      
      // Return empty data for the specific track
      jest.spyOn(mockExecutor, 'queryTrack').mockResolvedValueOnce({
        track: 'beta',
        releases: []
      });
      
      // Set up mock data for all tracks
      mockExecutor.setMockTrackData([{
        track: 'production',
        releases: [{
          versionCodes: ['300'],
          name: '4.0.0'
        }]
      }]);
      
      const result = await getPlayStoreVersionInfo('com.example.app', '{}', 'beta', mockExecutor);
      
      // Verify both methods were called
      expect(trackSpy).toHaveBeenCalledWith('com.example.app', expect.anything(), 'beta');
      expect(allTracksSpy).toHaveBeenCalledWith('com.example.app', expect.anything());
      
      // Verify the result matches the mock data from all tracks
      expect(result).toEqual({
        highestVersionCode: 300,
        majorVersion: 4
      });
      
      trackSpy.mockRestore();
      allTracksSpy.mockRestore();
    });
    
    it('should handle base64-encoded service account key', async () => {
      const mockExecutor = new MockAndroidExecutor(100, 2);
      // Create a spy to verify the parseServiceAccountKey method is called correctly
      const parseSpy = jest.spyOn(mockExecutor, 'parseServiceAccountKey');
      
      // Base64 encoding of {"test":"value"}
      const base64Key = 'eyJ0ZXN0IjoidmFsdWUifQ==';
      
      await getPlayStoreVersionInfo('com.example.app', base64Key, undefined, mockExecutor);
      
      // Verify the parseServiceAccountKey method was called with the base64 key
      expect(parseSpy).toHaveBeenCalledWith(base64Key);
      
      // Verify the parsed result
      expect(parseSpy.mock.results[0].value).toEqual({ test: 'value' });
      
      parseSpy.mockRestore();
    });
    
    it('should propagate errors from the executor', async () => {
      const mockExecutor = new MockAndroidExecutor(100, 2);
      mockExecutor.setError('Test error from executor');
      await expect(getPlayStoreVersionInfo('com.example.app', '{}', undefined, mockExecutor)).rejects.toThrow('Test error from executor');
    });
  });
  
  describe('processTrackData', () => {
    it('should return undefined for empty track data', () => {
      const result = processTrackData([]);
      expect(result).toBeUndefined();
    });
    
    it('should find the highest version code across all tracks', () => {
      const trackData = [
        {
          track: 'production',
          releases: [{
            versionCodes: ['100'],
            name: '1.0.0'
          }]
        },
        {
          track: 'beta',
          releases: [{
            versionCodes: ['200'],
            name: '2.0.0'
          }]
        }
      ];
      
      const result = processTrackData(trackData);
      expect(result).toEqual({
        highestVersionCode: 200,
        majorVersion: 2
      });
    });
    
    it('should handle multiple releases within a track', () => {
      const trackData = [
        {
          track: 'production',
          releases: [
            {
              versionCodes: ['100'],
              name: '1.0.0'
            },
            {
              versionCodes: ['150'],
              name: '1.5.0'
            }
          ]
        }
      ];
      
      const result = processTrackData(trackData);
      expect(result).toEqual({
        highestVersionCode: 150,
        majorVersion: 1
      });
    });
    
    it('should handle tracks with no releases', () => {
      const trackData = [
        {
          track: 'production',
          releases: []
        },
        {
          track: 'beta',
          releases: [{
            versionCodes: ['200'],
            name: '2.0.0'
          }]
        }
      ];
      
      const result = processTrackData(trackData);
      expect(result).toEqual({
        highestVersionCode: 200,
        majorVersion: 2
      });
    });
    
    it('should return undefined when no releases have version codes', () => {
      const trackData = [
        {
          track: 'production',
          releases: [{
            // No versionCodes
            name: '1.0.0'
          }]
        }
      ];
      
      const result = processTrackData(trackData);
      expect(result).toBeUndefined();
    });
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
