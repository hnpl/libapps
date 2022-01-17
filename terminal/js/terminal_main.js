// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Initializes global state used in terminal.
 */

import {terminal} from './terminal.js';
import {getTerminalInfoTracker, setUpTitleHandler} from './terminal_info.js';

getTerminalInfoTracker().then((tracker) => {
  if (tracker.launchInfo.ssh?.needRedirect) {
    window.location.pathname = '/html/terminal_ssh.html';
    return;
  }
  // This must be called before we initialize the terminal to ensure capturing
  // the first title that hterm sets.
  setUpTitleHandler(tracker);

  // TODO(crbug.com/999028): Make sure system web apps are not discarded as
  // part of the lifecycle API.  This fix used by crosh and nassh is not
  // guaranteed to be a long term solution.
  chrome.tabs.update(tracker.tabId, {autoDiscardable: false});
});

window.addEventListener('DOMContentLoaded', () => {
  lib.registerInit('terminal-private-storage', () => {
    hterm.defaultStorage = new lib.Storage.TerminalPrivate();
  });

  // Load i18n messages.
  lib.registerInit('messages', async () => {
    // Load hterm.messageManager from /_locales/<lang>/messages.json.
    hterm.messageManager.useCrlf = true;
    const url = lib.f.getURL('/_locales/$1/messages.json');
    await hterm.messageManager.findAndLoadMessages(url);
  });

  lib.init().then(() => {
    window.term_ = terminal.init(
        lib.notNull(document.querySelector('#terminal')));
  });
});
