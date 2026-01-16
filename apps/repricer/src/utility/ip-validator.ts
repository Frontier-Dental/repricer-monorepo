import { isIP } from "net";

/**
 * Validates an IP address for safe shell execution
 * @param input - The IP address string to validate
 * @returns boolean - true if valid and safe, false otherwise
 */
export function validateIPAddress(input: string): boolean {
  // Reject null, undefined, or non-string inputs
  if (!input || typeof input !== "string") {
    return false;
  }

  // Trim whitespace
  const trimmedInput = input.trim();

  // Check if valid IPv4 (returns 4) or IPv6 (returns 6)
  if (!isIP(trimmedInput)) {
    return false;
  }

  // Additional safety: reject if contains shell metacharacters
  // These characters can be used to inject commands
  const dangerousChars = /[;|&$`<>(){}[\]\\'"!#*?~\n\r\t]/;
  if (dangerousChars.test(trimmedInput)) {
    return false;
  }

  // Reject if contains spaces (used in command chaining)
  if (/\s/.test(trimmedInput)) {
    return false;
  }

  return true;
}
