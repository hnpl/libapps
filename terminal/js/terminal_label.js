// Copyright 2022 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Export an element: terminal-label
 */

import {LitElement, css, html} from './lit.js';

/**
 * A label element. Set attribute 'focused' on the element to get the focused
 * style.
 */
export class TerminalLabelElement extends LitElement {
  /** @override */
  static get styles() {
    return css`
      :host > div {
        color: #5F6368;
        font-size: 10px;
        font-weight: 500;
        letter-spacing: .4px;
        line-height: 16px;
        margin-bottom: 8px;
      }

      :host([focused]) > div {
        color: var(--google-blue-600);
      }

      :host([invalid]) > div {
        color: var(--cr-input-error-color);
      }
    `;
  }

  /** @override */
  render() {
    return html`
      <div><slot></slot></div>
    `;
  }
}

customElements.define('terminal-label', TerminalLabelElement);
