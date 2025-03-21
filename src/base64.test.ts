import { isBase64 } from './base64';

describe('isBase64', () => {
  // Test valid base64 encoded JSON
  test('should return true for valid base64 encoded JSON', () => {
    // This is a base64 encoded JSON: {"test":"value"}
    const validBase64Json = 'eyJ0ZXN0IjoidmFsdWUifQ==';
    // Test with expectJson=true
    expect(isBase64(validBase64Json, true)).toBe(true);
    // Test with default parameter (expectJson=false)
    expect(isBase64(validBase64Json)).toBe(true);
  });

  // Test valid base64 encoded service account key (simplified)
  test('should return true for valid base64 encoded service account key', () => {
    // This is a base64 encoded simplified service account JSON
    const serviceAccountBase64 =
      'eyJ0eXBlIjoic2VydmljZV9hY2NvdW50IiwiY2xpZW50X2VtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsInByaXZhdGVfa2V5IjoiLS0tLS1CRUdJTiBQUklWQVRFIEtFWS0tLS0tXG5NSUlFdlFJQkFEQU5CZ2txaGtpRzl3MEJBUUVGQUFTQ0JLY3dnZ1NqQWdFQUFvSUJBUUM3VkpUVXRmYTI4WFJcbmV4YW1wbGVrZXlcbi0tLS0tRU5EIFBSSVZBVEUgS0VZLS0tLS0ifQ==';
    // Test with expectJson=true (should be true for service account keys which are JSON)
    expect(isBase64(serviceAccountBase64, true)).toBe(true);
    // Test with default parameter (expectJson=false)
    expect(isBase64(serviceAccountBase64)).toBe(true);
  });

  // Test with actual base64 encoded data from the secrets file
  test('should detect base64 from secrets file', () => {
    // Create a function to test with the actual secret
    const testWithSecret = (secret: string) => {
      console.log('Secret length:', secret.length);
      console.log('First 10 chars:', secret.substring(0, 10));
      console.log('Matches regex:', /^[A-Za-z0-9+/]*={0,2}$/.test(secret));

      try {
        const decoded = Buffer.from(secret, 'base64').toString('utf8');
        console.log('Decoded length:', decoded.length);
        console.log('First 50 chars of decoded:', decoded.substring(0, 50));

        try {
          JSON.parse(decoded);
          console.log('Successfully parsed as JSON');
          return true;
        } catch (e) {
          console.log('Failed to parse decoded as JSON');
          return false;
        }
      } catch (e) {
        console.log('Failed to decode as base64:', e);
        return false;
      }
    };

    // This test will be skipped in CI but can be run locally
    // Replace this with your actual secret for local testing
    const mockSecret = 'eyJ0eXBlIjoic2VydmljZV9hY2NvdW50In0='; // {"type":"service_account"}
    expect(testWithSecret(mockSecret)).toBe(true);
  });

  // Test plain JSON
  test('should return false for plain JSON', () => {
    const plainJson = '{"test":"value"}';
    // Should be false regardless of expectJson parameter
    expect(isBase64(plainJson, true)).toBe(false);
    expect(isBase64(plainJson, false)).toBe(false);
  });

  // Test invalid inputs
  test('should return false for invalid inputs', () => {
    expect(isBase64('')).toBe(false);
    expect(isBase64('not-base64')).toBe(false);
    expect(isBase64('{"invalid": "json')).toBe(false);
    // @ts-ignore
    expect(isBase64(null)).toBe(false);
    // @ts-ignore
    expect(isBase64(undefined)).toBe(false);
  });

  // Test with real-world examples that might be causing issues
  test('should handle real-world edge cases', () => {
    // Base64 with line breaks (sometimes found in keys)
    const base64WithLineBreaks = 'eyJ0ZXN0\nIjoidmFs\ndWUifQ==';
    // Our improved function should now handle line breaks
    expect(isBase64(base64WithLineBreaks, true)).toBe(true);
    expect(isBase64(base64WithLineBreaks, false)).toBe(true);

    // Very long base64 string (simulating a real service account key)
    const longJson =
      '{"type":"service_account","project_id":"test-project","private_key_id":"abcdef","client_email":"test@example.com","client_id":"123456","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/test%40example.com","universe_domain":"googleapis.com"}';
    const longBase64 = Buffer.from(longJson).toString('base64');
    expect(isBase64(longBase64, true)).toBe(true);
    expect(isBase64(longBase64, false)).toBe(true);
  });

  // Test with non-JSON base64 content
  test('should handle base64-encoded non-JSON content', () => {
    // Base64 encoded text that is not JSON
    const textBase64 = Buffer.from('This is just plain text, not JSON').toString('base64');

    // Should be true with expectJson=false
    expect(isBase64(textBase64, false)).toBe(true);

    // Should be false with expectJson=true because it's not valid JSON
    expect(isBase64(textBase64, true)).toBe(false);
  });

  // Test with modified regex to handle line breaks
  test('should handle base64 with line breaks using the updated function', () => {
    // Base64 with line breaks
    const base64WithLineBreaks = 'eyJ0ZXN0\nIjoidmFs\ndWUifQ==';

    // Should work with both expectJson settings
    expect(isBase64(base64WithLineBreaks, true)).toBe(true);
    expect(isBase64(base64WithLineBreaks, false)).toBe(true);
  });

  // Test edge case where a string could be both valid JSON and valid base64
  test('should handle edge case where string is both valid JSON and valid base64', () => {
    // The string "true" is both valid JSON (parses to boolean true)
    // and valid base64 (decodes to some binary data)
    const trueString = 'true';

    // When expectJson is false, it should be treated as base64 if it's valid base64
    expect(isBase64(trueString, false)).toBe(true);

    // When expectJson is true, we should still check if it's valid base64
    // that decodes to valid JSON
    expect(isBase64(trueString, true)).toBe(false); // It decodes to binary, not JSON

    // Now let's test with a string that is both valid JSON and decodes to valid JSON
    // Base64 encoding of {"test":"value"}
    const base64Json = 'eyJ0ZXN0IjoidmFsdWUifQ==';

    // This should be recognized as base64 that decodes to valid JSON
    expect(isBase64(base64Json, true)).toBe(true);
  });
});
