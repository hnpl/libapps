// Copyright 2019 The Chromium OS Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/**
 * @fileoverview Terminal Settings Dropdown Element unit tests.
 */

import {TerminalSettingsDropdownElement} from './terminal_dropdown.js';

describe('terminal_dropdown_tests.js', () => {
  const preference = 'terminal_dropdown_tests_preference';
  const createOptions = () => [
    {value: 'opt1'},
    {value: 'opt2'},
    {value: 'opt3'},
  ];
  const options = createOptions();

  beforeEach(async function() {
    window.preferenceManager =
      new lib.PreferenceManager(new lib.Storage.Memory());
    window.preferenceManager.definePreference(preference, options[0].value);

    this.el = /** @type {!TerminalSettingsDropdownElement} */ (
        document.createElement('terminal-settings-dropdown'));
    this.el.setAttribute('preference', preference);
    this.el.options = createOptions();
    document.body.appendChild(this.el);

    this.getNthLiElement = function(index) {
      return this.el.shadowRoot.querySelector(`#option-${index}`);
    };

    // The element renders asynchronously.
    await this.el.updateComplete;

    this.button = this.el.shadowRoot.querySelector('button');
    this.ul = this.el.shadowRoot.querySelector('ul');

    this.waitAndCheckFocusAfterExpaneded = async () => {
      // We focus the `ul` element using `setTimeout()`, so here we need to wait
      // a bit.
      await new Promise((resolve) => setTimeout(resolve));
      assert.equal(this.el.shadowRoot.activeElement, this.ul);
    };
  });

  afterEach(function() {
    document.body.removeChild(this.el);

    delete window.preferenceManager;
  });

  it('updates-ui-when-preference-changes', async function() {
    assert.equal(window.preferenceManager.get(preference), options[0].value);
    assert.equal(this.el.value, options[0].value);

    await window.preferenceManager.set(preference, options[1].value);
    assert.equal(this.el.value, options[1].value);

    await window.preferenceManager.set(preference, options[2].value);
    assert.equal(this.el.value, options[2].value);
  });

  it('updates-preference-when-options-clicked', async function() {
    assert.equal(window.preferenceManager.get(preference), options[0].value);
    assert.equal(this.el.value, options[0].value);

    let prefChanged = test.listenForPrefChange(
        window.preferenceManager, preference);
    this.getNthLiElement(1).click();
    await prefChanged;
    assert.equal(window.preferenceManager.get(preference), options[1].value);

    prefChanged = test.listenForPrefChange(
        window.preferenceManager, preference);
    this.getNthLiElement(2).click();
    await prefChanged;
    assert.equal(window.preferenceManager.get(preference), options[2].value);
  });

  it('toggles-options-list-when-mousedown-on-button', async function() {
    assert.isFalse(this.el.expanded);

    this.button.dispatchEvent(new MouseEvent('mousedown'));
    await this.el.updateComplete;

    assert.isTrue(this.el.expanded);

    this.button.dispatchEvent(new MouseEvent('mousedown'));
    await this.el.updateComplete;

    assert.isFalse(this.el.expanded);
  });

  it('closes-options-list-when-option-clicked', async function() {
    this.el.expanded = true;
    await this.el.updateComplete;

    this.getNthLiElement(1).click();
    await this.el.updateComplete;

    assert.isFalse(this.el.expanded);
  });

  // Unlike other tests that can wait for something to happen after a click, we
  // have nothing to wait for in this caes, so instead we directly test the
  // private function `onItemClickedHandler_()`.
  it('does-nothing-when-disabled-options-clicked', async function() {
    const newOptions = createOptions();
    newOptions[0].disabled = true;
    this.el.options = newOptions;
    await this.el.updateComplete;
    this.el.value = 'opt3';

    this.el.expanded = true;

    // Clicking a disabled item should do nothing.
    this.el.onItemClickedHandler_(0)(new MouseEvent('click'));
    assert.equal(this.el.value, 'opt3');
    assert.equal(this.el.expanded, true, 'dropdown should not be closed');

    // Clicking a enabled item should do the thing.
    this.el.onItemClickedHandler_(1)(new MouseEvent('click'));
    assert.equal(this.el.value, 'opt2');
    assert.equal(this.el.expanded, false);
  });

  it('closes-options-list-when-element-looses-focus', async function() {
    assert.isFalse(this.el.expanded);

    this.button.dispatchEvent(new MouseEvent('mousedown'));
    await this.el.updateComplete;

    assert.isTrue(this.el.expanded);
    await this.waitAndCheckFocusAfterExpaneded();

    this.ul.blur();
    await this.el.updateComplete;

    assert.isFalse(this.el.expanded);
  });

  ['Enter', 'Space'].forEach((key) => it(
      `toggle-list-when-${key}-pressed-on-button`, async function() {
    assert.isFalse(this.el.expanded);

    this.button.dispatchEvent(new KeyboardEvent('keydown', {code: key}));
    await this.el.updateComplete;

    assert.isTrue(this.el.expanded);
    await this.waitAndCheckFocusAfterExpaneded();

    this.button.dispatchEvent(new KeyboardEvent('keydown', {code: key}));
    await this.el.updateComplete;

    assert.isFalse(this.el.expanded);
  }));

  ['PageUp', 'Home', 'PageDown', 'End', 'ArrowLeft', 'ArrowUp', 'ArrowRight',
  'ArrowDown'].forEach((key) => it(
      `key ${key} on <button> is passed to <ul>`, async function() {
    const ulKeyDownPromise = new Promise((resolve) => {
      this.el.onUlKeyDown_ = resolve;
    });

    const keyboardEvent = new KeyboardEvent('keydown', {code: key});
    this.button.dispatchEvent(keyboardEvent);
    await this.el.updateComplete;

    // The <ul> should also be expanded and focused automatically.
    assert.isTrue(this.el.expanded);
    await this.waitAndCheckFocusAfterExpaneded();

    assert.equal(await ulKeyDownPromise, keyboardEvent);
  }));

  ['Enter', 'Space', 'Escape'].forEach((key) => it(
      `collapses-options-list-when-${key}-pressed`, async function() {
    this.el.expanded = true;
    await this.el.updateComplete;

    this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: key}));
    await this.el.updateComplete;

    assert.isFalse(this.el.expanded);

    this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: key}));
    await this.el.updateComplete;

    // Pressing the key on a contracted dropdown has no affect.
    assert.isFalse(this.el.expanded);
  }));

  ['PageUp', 'Home'].forEach((keyCode) => it(
      `selects-first-enabled-option-when-${keyCode}-pressed-on-ul`,
      async function() {
        await window.preferenceManager.set(preference, options[2].value);
        assert.equal(this.el.value, options[2].value);

        this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;

        assert.equal(this.el.value, options[0].value);

        // Let's disable the first item, then the second item should be
        // selected.
        const newOptions = createOptions();
        newOptions[0].disabled = true;
        this.el.options = newOptions;
        await this.el.updateComplete;

        this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;

        assert.equal(this.el.value, newOptions[1].value);
      },
  ));

  ['PageDown', 'End'].forEach((keyCode) => it(
      `selects-last-enabled-option-when-${keyCode}-pressed-on-ul`,
      async function() {
        assert.equal(this.el.value, options[0].value);

        this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;

        assert.equal(this.el.value, options[2].value);

        // Let's disable the last item, then the second last item should be
        // selected.
        const newOptions = createOptions();
        newOptions[2].disabled = true;
        this.el.options = newOptions;
        await this.el.updateComplete;

        this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;

        assert.equal(this.el.value, newOptions[1].value);
      },
  ));

  ['ArrowLeft', 'ArrowUp'].forEach((keyCode) => it(
      `selects-previous-enabled-option-when-${keyCode}-pressed-on-ul`,
      async function() {
        await window.preferenceManager.set(preference, options[2].value);
        assert.equal(this.el.value, options[2].value);

        this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        assert.equal(this.el.value, options[1].value);

        this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        assert.equal(this.el.value, options[0].value);

        this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        // There is not previous option.
        assert.equal(this.el.value, options[0].value);

        // Let's disable the second option, and it should be skipped.
        const newOptions = createOptions();
        newOptions[1].disabled = true;
        this.el.options = newOptions;
        await this.el.updateComplete;

        await window.preferenceManager.set(preference, options[2].value);
        assert.equal(this.el.value, options[2].value);

        this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        assert.equal(this.el.value, options[0].value);
      },
  ));

  ['ArrowRight', 'ArrowDown'].forEach((keyCode) => it(
      `selects-next-enabled-option-when-${keyCode}-pressed-on-ul`,
      async function() {
        assert.equal(this.el.value, options[0].value);

        this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        assert.equal(this.el.value, options[1].value);

        this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        assert.equal(this.el.value, options[2].value);

        this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        // There is no next option.
        assert.equal(this.el.value, options[2].value);

        // Let's disable the second option, and it should be skipped.
        const newOptions = createOptions();
        newOptions[1].disabled = true;
        this.el.options = newOptions;
        await this.el.updateComplete;

        await window.preferenceManager.set(preference, options[0].value);
        assert.equal(this.el.value, options[0].value);

        this.ul.dispatchEvent(new KeyboardEvent('keydown', {code: keyCode}));
        await this.el.updateComplete;
        assert.equal(this.el.value, options[2].value);
      },
  ));

  it('uses-label-for-option-if-available', async function() {
    const newOptions = createOptions();
    newOptions[0].label = 'hello world';
    this.el.options = newOptions;
    await this.el.updateComplete;

    assert.equal(this.getNthLiElement(0).textContent.trim(), 'hello world');
    assert.equal(this.getNthLiElement(1).textContent.trim(),
        newOptions[1].value,
        'fallback to value if no label specified');
  });

  it('uses-style-for-option-if-available', async function() {
    const style = 'opacity: 0.5;';

    const newOptions = createOptions();
    newOptions[0].style = style;
    this.el.options = newOptions;
    await this.el.updateComplete;

    assert.equal(this.getNthLiElement(0).getAttribute('style'), style);
    assert.equal(this.getNthLiElement(1).getAttribute('style'), '');

    // Style does not apply to the button, only the <li>.
    assert.equal(this.el.value, newOptions[0].value);
    assert.isNull(this.button.getAttribute('style'));
  });

  // This only test that the attr is set. The behavior for disabled <li> element
  // (e.g. click, arrow keys) is tested in other test cases.
  it('sets-invalid-attr', async function() {
    const newOptions = createOptions();
    newOptions[0].disabled = true;
    this.el.options = newOptions;
    await this.el.updateComplete;

    assert.isTrue(this.getNthLiElement(0).hasAttribute('disabled'));
    assert.isFalse(this.getNthLiElement(1).hasAttribute('disabled'));

    await window.preferenceManager.set(preference, options[0].value);
    await this.el.updateComplete;
    assert.isTrue(this.button.hasAttribute('data-invalid'));

    await window.preferenceManager.set(preference, options[1].value);
    await this.el.updateComplete;
    assert.isFalse(this.button.hasAttribute('data-invalid'));

    // For value not in the options, the invalid attribute should also be set.
    await window.preferenceManager.set(preference, 'opt4');
    await this.el.updateComplete;
    assert.isTrue(this.button.hasAttribute('data-invalid'));
  });

  it('allows-type-coercion-for-value-matching', async function() {
    window.preferenceManager.definePreference(preference, 1);
    this.el.options = [
      {value: 1},
      {value: 2},
      {value: 3},
    ];
    await this.el.updateComplete;

    assert.strictEqual(window.preferenceManager.get(preference), 1);
    assert.strictEqual(this.el.value, 1);

    // Update prefs with a string, and make sure the current value is updated.
    await window.preferenceManager.set(preference, '2');
    assert.strictEqual(this.el.value, '2');  // This is still a string.
    assert.strictEqual(this.button.innerText, '2');
  });
});
