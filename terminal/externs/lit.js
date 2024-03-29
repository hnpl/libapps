// Copyright 2019 The ChromiumOS Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Externs definitions for LitElement used in terminal.
 *
 * @externs
 */

/** @typedef {{type: Function}} */
var PropertyDeclaration;

class TemplateResult {}
class CSSResult {}

/** @extends {HTMLElement} */
class LitElement$$module$js$lit{
  constructor() {
    /** @type {!Element} */
    this.renderRoot;

    /** @type {!Promise<boolean>} */
    this.updateComplete;
  }

  /**
   * @return {!Object<string, PropertyDeclaration>}
   * @protected
   */
  static get properties() {};

  /**
   * @return {!Object}
   * @protected
   */
  static get shadowRootOptions() {};

  /**
   * @return {!CSSResult|!Array<CSSResult>}
   * @protected
   */
  static get styles() {};

  /** @param {!Map<string,*>} changedProperties */
  firstUpdated(changedProperties) {}

  /**
   * @return {?Promise}
   * @protected
   */
  performUpdate() {}

  /**
   * @param {(string|Array<(string|number)>)} path
   * @param {*} value
   * @param {Object=} root
   */
  set(path, value, root) {}

  /**
   * @param {!Map<string,*>} changedProperties
   * @return {boolean}
   */
  shouldUpdate(changedProperties) {}

  /**
   * @return {!TemplateResult}
   * @protected
   */
  render() {}

  /**
   * @param {string=} propertyName
   * @param {*=} oldValue
   * @return {!Promise<void>}
   */
  requestUpdate(propertyName, oldValue) {}

  /** @param {!Map<string,*>} changedProperties */
  updated(changedProperties) {}
}

/**
 * @param {ITemplateArray} strings
 * @param {...*} values
 */
function css$$module$js$lit(strings, ...values) {}

/**
 * @param {ITemplateArray} strings
 * @param {...*} values
* @return {!TemplateResult}
 */
function html$$module$js$lit(strings, ...values) {}

/**
 * @param {*} value
 * @return {CSSResult}
 */
function unsafeCSS$$module$js$lit(value) {}

/**
 * @param {*} value
 */
function live$$module$js$lit(value) {}

/**
 * @param {!Object} classInfo
 */
function classMap$$module$js$lit(classInfo) {}

/**
 * @param {boolean} condition
 * @param {function()} trueCase
 * @param {function()=} falseCase
 */
function when$$module$js$lit(condition, trueCase, falseCase) {}
