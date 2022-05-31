// Copyright 2020 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Common code for terminal and it settings page.
 */

// The value of an entry is true if it is a web font from fonts.google.com,
// otherwise it is a local font. Note that the UI shows the fonts in the same
// order as the entries'.
//
// @type {!Map<string, boolean>}
export const SUPPORTED_FONT_FAMILIES = new Map([
  // The first font is the default font. It must be a local font.
  ['Noto Sans Mono', false],
  ['Cousine', false],
  ['Roboto Mono', true],
  ['Inconsolata', true],
  ['Source Code Pro', true],
]);
export const DEFAULT_FONT_FAMILY = SUPPORTED_FONT_FAMILIES.keys().next().value;
export const SUPPORTED_FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20];
export const SUPPORTED_LINE_HEIGHT_PADDINGS = [-2, -1.5, -1, -0.5, 0, 0.5, 1,
  1.5, 2, 3, 4, 5];

// Numeric chrome version (e.g. 78). `null` if fail to detect.
export const CHROME_VERSION = (function() {
  const matches = navigator.userAgent.match(/Chrome\/(\d+)/);
  if (matches) {
    return parseInt(matches[1], 10);
  }
  return null;
})();

/** @type {!Array<string>} */
export const DEFAULT_ANSI_COLORS = [
  '#3C4043',
  '#F28B82',
  '#137356',
  '#E37400',
  '#8AB4F8',
  '#EE5FFA',
  '#03BFC8',
  '#FFFFFF',
  '#9AA0A6',
  '#F6AEA9',
  '#87FFC5',
  '#FDD663',
  '#AECBFA',
  '#F4B5FB',
  '#80F9F9',
  '#F8F9FA',
];
export const DEFAULT_BACKGROUND_COLOR = '#202124';
export const DEFAULT_BACKGROUND_SIZE = '100% 100%';
export const DEFAULT_FOREGROUND_COLOR = '#FFFFFF';
export const DEFAULT_CURSOR_COLOR = '#669DF680';
export const DEFAULT_FONT_SIZE = 13;
export const DEFAULT_SCREEN_PADDING_SIZE = 8;
export const DEFAULT_THEME = 'dark';

export const DEFAULT_VM_NAME = 'termina';
export const DEFAULT_CONTAINER_NAME = 'penguin';

export const SETTINGS_PROFILE_PARAM_NAME = 'settings_profile';
export const TMUX_PARAM_NAME = 'tmux';

// Cache the url at the first opportunity. The url normally should not change,
// so this is being defensive.
export const ORIGINAL_URL = new URL(document.location.href);

/**
 * Convert a font family to a CSS string.
 *
 * @param {string} fontFamily one of the font in SUPPORTED_FONT_FAMILIES.
 * @return {string}
 */
export function fontFamilyToCSS(fontFamily) {
  if (fontFamily === DEFAULT_FONT_FAMILY) {
    return `'${fontFamily}', 'Powerline For ${fontFamily}'`;
  }
  return `'${fontFamily}', 'Powerline For ${fontFamily}', ` +
      `'${DEFAULT_FONT_FAMILY}'`;
}

/**
 * Normalize a css font family string and return one of the font family in
 * SUPPORTED_FONT_FAMILIES.
 *
 * @param {string} cssFontFamily The css font family string.
 * @return {string} The normalized font.
 */
export function normalizeCSSFontFamily(cssFontFamily) {
  for (let fontFamily of cssFontFamily.split(',')) {
    // The regex can never fail, so it is safe to just use the result.
    fontFamily = fontFamily.match(/^\s*['"]?(.*?)['"]?\s*$/)[1];
    if (SUPPORTED_FONT_FAMILIES.has(fontFamily)) {
      return fontFamily;
    }
  }
  return DEFAULT_FONT_FAMILY;
}

/**
 * Define prefs for terminal which are not used by hterm, or that have a
 * different default.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 */
export function definePrefs(prefs) {
  // Set terminal default overrides from hterm.
  prefs.definePreference('audible-bell-sound', '');
  prefs.definePreference('background-color', DEFAULT_BACKGROUND_COLOR);
  prefs.definePreference('background-size', DEFAULT_BACKGROUND_SIZE);
  prefs.definePreference('cursor-color', DEFAULT_CURSOR_COLOR);
  prefs.definePreference('color-palette-overrides', DEFAULT_ANSI_COLORS);
  prefs.definePreference('font-family', fontFamilyToCSS(DEFAULT_FONT_FAMILY));
  prefs.definePreference('font-size', DEFAULT_FONT_SIZE);
  prefs.definePreference('foreground-color', DEFAULT_FOREGROUND_COLOR);
  prefs.definePreference('pass-alt-number', false);
  prefs.definePreference('pass-ctrl-number', false);
  prefs.definePreference('pass-ctrl-tab', true);
  prefs.definePreference('screen-padding-size', DEFAULT_SCREEN_PADDING_SIZE);
  prefs.definePreference('theme', DEFAULT_THEME);
  prefs.definePreference('theme-variations', {});
}

/**
 * Make sure preference values are valid.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 */
export function normalizePrefsInPlace(prefs) {

  prefs.set('font-family', fontFamilyToCSS(normalizeCSSFontFamily(
      /** @type {string} */(prefs.get('font-family')))));

  if (!SUPPORTED_FONT_SIZES.includes(prefs.get('font-size'))) {
    prefs.set('font-size', DEFAULT_FONT_SIZE);
  }

  // Remove alpha from background-color.
  const backgroundColor = lib.colors.normalizeCSS(
      /** @type {string} */(prefs.get('background-color')));
  if (!backgroundColor) {
    // The color value is invalid.
    prefs.reset('background-color');
  } else {
    // Store uppercase hex to help detect when a value is set to default.
    const rgb = lib.colors.setAlpha(backgroundColor, 1);
    prefs.set('background-color', lib.colors.rgbToHex(rgb).toUpperCase());
  }
}

/**
 * Add a listener to 'background-color' pref and set it on the outer body.
 * to update tab and frame colors.
 *
 * @param {!lib.PreferenceManager} prefs The preference manager.
 */
export function watchBackgroundColor(prefs) {
  prefs.addObserver('background-color', (color) => {
    document.body.style.backgroundColor = /** @type {string} */ (color);
  });
}

/**
 * Load a web font into a document object.
 *
 * @param {!Document} document The document to load the web font into.
 * @param {string} fontFamily The font family to load.
 * @param {?string=} link_id The id for the <link> element. Existing element
 *     with the same id will be removed first. If this is not specified, a
 *     default value will be used.
 * @return {!Promise<boolean>} Reject if cannot load the font. Otherwise, it
 *     resolves to a boolean indicating whether the font is a web font or not.
 */
export function loadWebFont(document, fontFamily, link_id) {
  return new Promise((resolve, reject) => {
    link_id = link_id || 'terminal:web-font-link';
    if (!SUPPORTED_FONT_FAMILIES.get(fontFamily)) {
      // Not a web font.
      resolve(false);
      return;
    }

    const head = document.querySelector('head');
    let link = head.querySelector(`#${CSS.escape(link_id)}`);
    if (link) {
      link.remove();
    }
    link = document.createElement('link');
    link.id = link_id;
    link.href = `https://fonts.googleapis.com/css2?family=` +
        `${encodeURIComponent(fontFamily)}&display=swap`;
    link.rel = 'stylesheet';
    link.addEventListener('load', async () => {
      // 'X' is the character of which hterm measures the size. For the font
      // size, the default one is used because it probably does not matter.
      const fonts = await document.fonts.load(
          `${DEFAULT_FONT_SIZE}px "${fontFamily}"`, 'X');
      if (fonts.length === 0) {
        reject(new Error('Unable to load fonts'));
      } else {
        resolve(true);
      }
    });
    link.addEventListener('error',
        () => reject(new Error('Unable to load css')));
    head.appendChild(link);
  });
}

/**
 * Load local Powerline web fonts.
 *
 * @param {!Document} document The document to load into.
 */
export function loadPowerlineWebFonts(document) {
  const style = document.createElement('style');
  style.textContent = Array.from(SUPPORTED_FONT_FAMILIES.keys()).map((f) => `
      @font-face {
        font-family: 'Powerline For ${f}';
        src: url('../fonts/PowerlineFor${f.replace(/\s/g, '')}.woff2')
             format('woff2');
        font-weight: normal bold;
        unicode-range:
            U+2693,U+26A1,U+2699,U+270E,U+2714,U+2718,U+273C,U+279C,U+27A6,
            U+2B06-2B07,U+E0A0-E0D4;
      }
  `).join('');
  document.head.appendChild(style);
}

/**
 * Registers with lib.registerInit() to set window.MULTI_PROFILE_ENABLED.
 */
export function registerGetOSInfo() {
  window.MULTI_PROFILE_ENABLED = false;

  if (chrome.terminalPrivate) {
    lib.registerInit('get-os-info', async () => {
      return new Promise((resolve) => {
        chrome.terminalPrivate.getOSInfo((info) => {
          window.MULTI_PROFILE_ENABLED = !!info.multi_profile;
          resolve();
        });
      });
    });
  } else {
    // Always true for testing.
    window.MULTI_PROFILE_ENABLED = true;
  }
}

/**
 * Resolves to true if tmux integration is enabled via chrome://flags.
 *
 * @type {!Promise<boolean>}
 */
export const getTmuxIntegrationEnabled = new Promise((resolve) => {
  const getOSInfo = chrome.terminalPrivate?.getOSInfo;
  if (!getOSInfo) {
    resolve(false);
    return;
  }
  getOSInfo((info) => resolve(info.tmux_integration));
});

/**
 * @param {{
 *   windowChannelName: string,
 *   driverChannelName: string,
 *   settingsProfileId: (?string|undefined)
 * }} obj
 * @return {string}
 */
export function composeTmuxUrl(
    {windowChannelName, driverChannelName, settingsProfileId}) {
  const url = new URL(ORIGINAL_URL.origin);
  url.pathname = '/html/terminal.html';

  const paramValue = JSON.stringify({windowChannelName, driverChannelName});
  const settingsProfileParam = settingsProfileId ?
      `&${SETTINGS_PROFILE_PARAM_NAME}=${settingsProfileId}` : '';
  url.search = `?${TMUX_PARAM_NAME}=${paramValue}${settingsProfileParam}`;

  return url.toString();
}

/**
 * Re-dispatch an event on the element. Note that some events are "composed" and
 * can cross shadow boundary [1], so you don't need this for them.
 *
 * [1] https://developers.google.com/web/fundamentals/web-components/shadowdom#events
 *
 * @param {!HTMLElement} element
 * @param {!Event} event
 */
export function redispatchEvent(element, event) {
    element.dispatchEvent(new event.constructor(event.type, event));
}
