/**
 * H01: loading-indicator-required
 * Heuristic: Visibility of system status
 * Detection: Static
 * Category: Static: Consistency (Table 3)
 *
 * Detects async operations without visual feedback indicators
 * (spinners, loading states). Covers fetch, axios, async/await,
 * and promise-based patterns in React and Angular components.
 */

"use strict";

const ASYNC_PATTERNS = ["fetch", "axios", "http", "request", "ajax"];
const LOADING_STATE_PATTERNS = [
  "loading",
  "isLoading",
  "setLoading",
  "spinner",
  "pending",
  "isFetching",
  "isSubmitting",
];

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require loading indicators for async operations (Nielsen H1: Visibility of system status)",
      category: "Usability",
      recommended: true,
      url: "https://github.com/NedalNw/eslint-plugin-heuci/blob/main/docs/rules/H01-loading-indicator-required.md",
    },
    schema: [
      {
        type: "object",
        properties: {
          asyncPatterns: {
            type: "array",
            items: { type: "string" },
            description: "Additional async function names to check",
          },
          loadingPatterns: {
            type: "array",
            items: { type: "string" },
            description: "Additional loading state identifiers to accept",
          },
          confidenceThreshold: {
            type: "number",
            minimum: 0,
            maximum: 1,
            default: 0.8,
            description: "Minimum confidence score for reporting (0-1)",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingLoadingIndicator:
        "Async operation '{{operation}}' lacks a loading indicator. " +
        "Users should see visual feedback during async operations " +
        "(Nielsen H1: Visibility of system status). " +
        "Consider adding a loading state (e.g., setLoading(true)) before the async call.",
      missingSubmitFeedback:
        "Form submit handler lacks loading/submitting state. " +
        "Users need visual feedback that their submission is being processed.",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const asyncPatterns = [
      ...ASYNC_PATTERNS,
      ...(options.asyncPatterns || []),
    ];
    const loadingPatterns = [
      ...LOADING_STATE_PATTERNS,
      ...(options.loadingPatterns || []),
    ];

    /**
     * Checks whether any identifier in the given scope matches
     * known loading-state patterns.
     */
    function scopeHasLoadingState(node) {
      const scope = context.getScope ? context.getScope() : context.sourceCode.getScope(node);
      const variables = scope.variables || [];

      for (const variable of variables) {
        const name = variable.name.toLowerCase();
        if (loadingPatterns.some((p) => name.includes(p.toLowerCase()))) {
          return true;
        }
      }

      // Walk up parent scopes (component level)
      if (scope.upper) {
        for (const variable of scope.upper.variables || []) {
          const name = variable.name.toLowerCase();
          if (loadingPatterns.some((p) => name.includes(p.toLowerCase()))) {
            return true;
          }
        }
      }

      return false;
    }

    /**
     * Checks whether the body of a function contains a call that
     * sets a loading state before the async operation.
     */
    function bodyHasLoadingCall(body) {
      if (!body) return false;
      const src = context.getSourceCode().getText(body);
      return loadingPatterns.some((p) => src.toLowerCase().includes(p.toLowerCase()));
    }

    /**
     * Determines whether a callee name matches an async pattern.
     */
    function isAsyncCall(calleeName) {
      return asyncPatterns.some((p) =>
        calleeName.toLowerCase().includes(p.toLowerCase()),
      );
    }

    return {
      // Detect fetch/axios/http calls inside functions without loading state
      CallExpression(node) {
        let calleeName = "";

        if (node.callee.type === "Identifier") {
          calleeName = node.callee.name;
        } else if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier"
        ) {
          calleeName = node.callee.object.name;
        }

        if (!isAsyncCall(calleeName)) return;

        // Find enclosing function
        let parent = node.parent;
        while (parent && !isFunctionNode(parent)) {
          parent = parent.parent;
        }

        if (!parent) return;

        const body = parent.body;
        if (!bodyHasLoadingCall(body) && !scopeHasLoadingState(node)) {
          context.report({
            node,
            messageId: "missingLoadingIndicator",
            data: { operation: calleeName },
          });
        }
      },

      // Detect form onSubmit handlers without loading feedback
      JSXAttribute(node) {
        if (
          node.name &&
          node.name.name === "onSubmit" &&
          node.value &&
          node.value.expression
        ) {
          const handler = node.value.expression;

          if (
            handler.type === "ArrowFunctionExpression" ||
            handler.type === "FunctionExpression"
          ) {
            if (!bodyHasLoadingCall(handler.body)) {
              context.report({
                node,
                messageId: "missingSubmitFeedback",
              });
            }
          }
        }
      },
    };
  },
};

function isFunctionNode(node) {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}
