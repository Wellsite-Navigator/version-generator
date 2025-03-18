import * as index from './index';
import { runVersionGenerator } from './cli';

// Mock the index module
jest.mock('./index', () => ({
  generateAndWriteVersion: jest.fn().mockResolvedValue({
    major: '1',
    minor: '2',
    patch: 3,
    branchName: 'test',
    commitHash: 'abc123',
    version: '1.2.3-test-abc123'
  }),
}));

// Mock console.log and console.error
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

describe('CLI', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
  });

  it('should generate version and output as string by default', async () => {
    // Execute
    const result = await runVersionGenerator('/test/root');

    // Verify
    expect(index.generateAndWriteVersion).toHaveBeenCalledWith('/test/root', undefined);
    expect(result).toEqual({
      major: '1',
      minor: '2',
      patch: 3,
      branchName: 'test',
      commitHash: 'abc123',
      version: '1.2.3-test-abc123'
    });
    expect(mockConsoleLog).toHaveBeenCalledWith('1.2.3-test-abc123');
  });

  it('should generate version and output as JSON when format is json', async () => {
    // Execute
    const result = await runVersionGenerator('/test/root', undefined, 'json');

    // Verify
    expect(index.generateAndWriteVersion).toHaveBeenCalledWith('/test/root', undefined);
    const expectedVersionInfo = {
      major: '1',
      minor: '2',
      patch: 3,
      branchName: 'test',
      commitHash: 'abc123',
      version: '1.2.3-test-abc123'
    };
    expect(result).toEqual(expectedVersionInfo);
    expect(mockConsoleLog).toHaveBeenCalledWith(JSON.stringify(expectedVersionInfo, null, 2));
  });

  it('should generate version and write to destination when provided', async () => {
    // Execute
    const result = await runVersionGenerator('/test/root', 'path/to/version.json');

    // Verify
    expect(index.generateAndWriteVersion).toHaveBeenCalledWith('/test/root', 'path/to/version.json');
    expect(result).toEqual({
      major: '1',
      minor: '2',
      patch: 3,
      branchName: 'test',
      commitHash: 'abc123',
      version: '1.2.3-test-abc123'
    });
    expect(mockConsoleLog).toHaveBeenCalledWith('Successfully generated version: 1.2.3-test-abc123');
  });

  it('should throw an error for invalid format', async () => {
    // Execute and verify
    await expect(runVersionGenerator('/test/root', undefined, 'invalid')).rejects.toThrow(
      'Format must be either "string" or "json"',
    );
  });
});
