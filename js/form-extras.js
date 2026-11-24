/* ==========================================================================
   form-extras.js — contact form behaviour
   1. "Még nem tudom" checkboxes switch their field off (disabled fields are
      not submitted, so Formspree receives a clean payload).
   2. Phone numbers are normalised to international E.164 form (+<digits>)
      and validated worldwide.
   Kept outside the Webflow export so a re-export does not overwrite it.
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- helpers */

  function showError(field, message) {
    field.classList.add('has-error');
    var box = field.parentNode.querySelector('.field-error[data-error-for="' + field.id + '"]');
    if (box) {
      box.textContent = message;
      box.classList.add('is-visible');
    }
    field.setCustomValidity(message);
  }

  function clearError(field) {
    field.classList.remove('has-error');
    var box = field.parentNode.querySelector('.field-error[data-error-for="' + field.id + '"]');
    if (box) {
      box.classList.remove('is-visible');
    }
    field.setCustomValidity('');
  }

  /* ------------------------------------------- "Még nem tudom" checkboxes */

  function bindUnknownToggle(checkbox) {
    var field = document.getElementById(checkbox.getAttribute('data-unknown-for'));
    if (!field) return;

    // Remember whether the field started out required.
    var wasRequired = field.required;

    function sync() {
      if (checkbox.checked) {
        field.value = '';
        // a cleared date field goes back to text so its placeholder returns
        if (field.hasAttribute('data-date-field')) field.type = 'text';
        field.required = false;
        field.disabled = true;
        clearError(field);
      } else {
        field.disabled = false;
        field.required = wasRequired;
      }
    }

    checkbox.addEventListener('change', sync);
    sync(); // honour a checkbox the browser restored on reload
  }

  /* ------------------------------------------------------------ date field */

  /**
   * A native <input type="date"> ignores `placeholder` — it always shows the
   * browser's own "éééé. hh. nn." mask. So the field ships as type="text"
   * (showing "Dátum*") and swaps to a real date picker as soon as it is
   * focused, swapping back when it is left empty.
   */
  function bindDateField(field) {
    field.addEventListener('focus', function () {
      if (field.type === 'date') return;
      field.type = 'date';
      try {
        field.focus();
        if (typeof field.showPicker === 'function') field.showPicker();
      } catch (e) {
        /* showPicker needs a user gesture in some browsers; ignore */
      }
    });

    field.addEventListener('blur', function () {
      if (!field.value) field.type = 'text';
    });
  }

  /* ---------------------------------------------------------------- phone */

  // Strip everything a person might type as decoration.
  function stripSeparators(value) {
    return value.replace(/[\s().\-\u2010-\u2015\/]/g, '');
  }

  /**
   * Normalise to E.164: a leading "+" followed by digits only.
   * Handles the two ways Hungarians write a number without "+":
   *   00 36 30 ...  (international access code)
   *   06 30 ...     (national trunk prefix)
   * Anything else without a "+" is left alone so the user is told to add one,
   * rather than us guessing the wrong country.
   */
  function normalisePhone(raw) {
    var value = stripSeparators(raw);
    if (!value) return '';

    if (value.indexOf('+') === 0) {
      return '+' + value.slice(1).replace(/\D/g, '');
    }

    var digits = value.replace(/\D/g, '');

    if (digits.indexOf('00') === 0) {       // 0036 30 123 4567
      return '+' + digits.slice(2);
    }
    if (digits.indexOf('06') === 0) {       // 06 30 123 4567 -> Hungarian
      return '+36' + digits.slice(2);
    }
    if (digits.indexOf('36') === 0 && digits.length === 11) {
      return '+' + digits;                  // 36 30 123 4567
    }
    return digits;                          // no country info: flagged below
  }

  var PHONE_MESSAGE =
    'Add meg a telefonszámot nemzetközi alakban, országkóddal — például +36 30 123 4567.';

  function validatePhone(field, opts) {
    var raw = field.value.trim();
    if (!raw) {                             // empty: leave it to `required`
      clearError(field);
      return true;
    }

    var normalised = normalisePhone(raw);

    if (opts && opts.rewrite && normalised && normalised !== raw) {
      field.value = normalised;
    }

    // Must be "+" followed by 8–15 digits, and a country code never starts
    // with 0 (E.164).
    if (!/^\+[1-9]\d{7,14}$/.test(normalised)) {
      showError(field, PHONE_MESSAGE);
      return false;
    }

    clearError(field);
    return true;
  }

  /* ----------------------------------------------------------------- wire up */

  function init() {
    var toggles = document.querySelectorAll('input[data-unknown-for]');
    for (var i = 0; i < toggles.length; i++) {
      bindUnknownToggle(toggles[i]);
    }

    var dates = document.querySelectorAll('input[data-date-field]');
    for (var d = 0; d < dates.length; d++) {
      bindDateField(dates[d]);
    }

    var phones = document.querySelectorAll('input[data-phone-intl]');
    for (var j = 0; j < phones.length; j++) {
      (function (phone) {
        // While typing, only clear a stale error — don't nag mid-entry.
        phone.addEventListener('input', function () {
          clearError(phone);
        });
        // On leaving the field, tidy the number up and check it.
        phone.addEventListener('blur', function () {
          validatePhone(phone, { rewrite: true });
        });

        var form = phone.form;
        if (form && !form.hasAttribute('data-phone-bound')) {
          form.setAttribute('data-phone-bound', '');
          form.addEventListener('submit', function (event) {
            if (!validatePhone(phone, { rewrite: true })) {
              event.preventDefault();
              event.stopImmediatePropagation();
              phone.focus();
            }
          }, true); // capture: run before Webflow's own submit handler
        }
      })(phones[j]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
