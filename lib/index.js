/**
 * eslint-plugin-heuci
 *
 * Embeds Nielsen's usability heuristics into CI/CD pipelines through
 * static and dynamic analysis rules for React and Angular projects.
 *
 * Rules H01–H10: Static analysis (ESLint AST rules)
 * Rules H11–H12: Dynamic analysis (Puppeteer-based, run separately)
 *
 * Reference: Table 1 and Table 3 in the accompanying manuscript.
 */

"use strict";

// Static analysis rules (ESLint)
const loadingIndicatorRequired = require("./rules/H01-loading-indicator-required");
const stateChangeNotification = require("./rules/H02-state-change-notification");
const buttonStylingConsistency = require("./rules/H03-button-styling-consistency");
const formValidationPresence = require("./rules/H04-form-validation-presence");
const destructiveActionConfirmation = require("./rules/H05-destructive-action-confirmation");
const iconButtonAccessibility = require("./rules/H06-icon-button-accessibility");
const complexUiTooltips = require("./rules/H07-complex-ui-tooltips");
const duplicateActionButtons = require("./rules/H08-duplicate-action-buttons");
const errorMessageClarity = require("./rules/H09-error-message-clarity");
const ariaLabelPresence = require("./rules/H10-aria-label-presence");

module.exports = {
  rules: {
    "loading-indicator-required": loadingIndicatorRequired,
    "state-change-notification": stateChangeNotification,
    "button-styling-consistency": buttonStylingConsistency,
    "form-validation-presence": formValidationPresence,
    "destructive-action-confirmation": destructiveActionConfirmation,
    "icon-button-accessibility": iconButtonAccessibility,
    "complex-ui-tooltips": complexUiTooltips,
    "duplicate-action-buttons": duplicateActionButtons,
    "error-message-clarity": errorMessageClarity,
    "aria-label-presence": ariaLabelPresence,
  },
  configs: {
    recommended: {
      plugins: ["heuci"],
      rules: {
        "heuci/loading-indicator-required": "warn",
        "heuci/state-change-notification": "warn",
        "heuci/button-styling-consistency": "warn",
        "heuci/form-validation-presence": "warn",
        "heuci/destructive-action-confirmation": "error",
        "heuci/icon-button-accessibility": "error",
        "heuci/complex-ui-tooltips": "warn",
        "heuci/duplicate-action-buttons": "warn",
        "heuci/error-message-clarity": "warn",
        "heuci/aria-label-presence": "error",
      },
    },
    strict: {
      plugins: ["heuci"],
      rules: {
        "heuci/loading-indicator-required": "error",
        "heuci/state-change-notification": "error",
        "heuci/button-styling-consistency": "error",
        "heuci/form-validation-presence": "error",
        "heuci/destructive-action-confirmation": "error",
        "heuci/icon-button-accessibility": "error",
        "heuci/complex-ui-tooltips": "error",
        "heuci/duplicate-action-buttons": "error",
        "heuci/error-message-clarity": "error",
        "heuci/aria-label-presence": "error",
      },
    },
  },
};
