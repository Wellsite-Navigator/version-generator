export function isBase64(str: string, expectJson: boolean = false): boolean {
  if (!str || typeof str !== 'string') {
    return false;
  }

  // Check if the string is wrapped in quotes (common when passed from environment variables)
  if (str.startsWith('"') && str.endsWith('"')) {
    // Remove the quotes and try again
    return isBase64(str.slice(1, -1), expectJson);
  }

  // If we expect JSON, check if it's already valid JSON
  // But only consider it non-base64 if it's a complex JSON object or array
  // (simple values like "true" or "123" could be both valid JSON and valid base64)
  if (expectJson) {
    try {
      const parsed = JSON.parse(str);
      // Only return false if it's a complex JSON object or array
      // This helps avoid the edge case where a string could be both valid JSON and valid base64
      if (typeof parsed === 'object' && parsed !== null) {
        return false; // It's a complex JSON object or array, not base64
      }
      // For simple JSON values (strings, numbers, booleans), continue checking if it's base64
    } catch (e) {
      // Not valid JSON, continue checking if it's base64
    }
  }

  // Clean the string by removing any whitespace (including line breaks)
  // Service account keys might have line breaks when copied from files
  const cleanStr = str.replace(/\s/g, '');

  // Check if the cleaned string matches the base64 pattern
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(cleanStr)) {
    return false;
  }

  // Try to decode
  try {
    const decoded = Buffer.from(cleanStr, 'base64').toString('utf8');
    if (!decoded || decoded.length === 0) {
      return false;
    }

    // If we expect JSON, check if it decodes to valid JSON
    if (expectJson) {
      try {
        const parsed = JSON.parse(decoded);
        // If it's a valid JSON object, it's a valid base64-encoded JSON
        return typeof parsed === 'object';
      } catch (e) {
        // If we expected JSON but couldn't parse it, return false
        return false;
      }
    } else {
      // For non-JSON content, just check if we successfully decoded something
      return decoded.length > 0;
    }
  } catch (error) {
    return false;
  }
}

export function parseJSONValue(value: string) {
  if (isBase64(value, true)) {
    // Clean the string by removing any whitespace (including line breaks)
    const cleanStr = value.replace(/\s/g, '');

    try {
      // Decode base64 to JSON
      const decoded = Buffer.from(cleanStr, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw new Error(`Failed to parse base64-encoded service account key: ${errorMessage}`);
    }
  } else {
    // Try to parse as direct JSON
    try {
      return JSON.parse(value);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw new Error(`Value is neither valid JSON nor valid base64-encoded JSON: ${errorMessage}`);
    }
  }
}
