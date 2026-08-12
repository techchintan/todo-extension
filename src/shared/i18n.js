/**
 * Chrome i18n helper. Falls back to the key if a message is missing.
 * @param {string} key
 * @param {string|string[]|undefined} substitutions
 */
export function t(key, substitutions) {
  try {
    const msg = chrome.i18n.getMessage(key, substitutions);
    return msg || key;
  } catch {
    return key;
  }
}

/** UI language for Date/Number formatting (e.g. en-US). */
export function uiLocale() {
  try {
    return chrome.i18n.getUILanguage() || undefined;
  } catch {
    return undefined;
  }
}
