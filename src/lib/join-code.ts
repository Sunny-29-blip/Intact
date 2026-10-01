/**
 * Generates an unambiguous 8-character alphanumeric join code.
 * Excludes confusing characters like 0, O, 1, I, L.
 */
const UNAMBIGUOUS_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateJoinCode(length = 8): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length);
    result += UNAMBIGUOUS_CHARS[randomIndex];
  }
  return result;
}
