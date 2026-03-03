/**
 * H02: state-change-notification
 * Heuristic: Visibility of system status
 * Detection: Static
 * Category: Static: Consistency (Table 3)
 *
 * Ensures state changes (form submission, data fetch, context updates)
 * are communicated to users through ARIA live regions, toast notifications,
 * or visual state indicators.
 */

"use strict";

const STATE_CHANGE_HOOKS = ["setState", "dispatch", "commit", "emit"];
const NOTIFICATION_PATTERNS = [
  "toast",
  "notify",
  "notification",
  "alert",
  "snackbar",
  "message",
  "feedback",
  "aria-live",
  "role=\"status\"",
  "role=\"alert\"",
];

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require user notification for state changes (Nielsen H1: Visibility of system status)",
      category: "Usability",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          notificationPatterns: {
            type: "array",
            items: { type: "string" },
            description: "Additional notification identifiers to accept",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingNotification:
        "State change via '{{setter}}' has no user notification. " +
        "Consider adding visual feedback (toast, alert, or ARIA live region) " +
        "so users know the operation completed (Nielsen H1).",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const notificationPatterns = [
      ...NOTIFICATION_PATTERNS,
      ...(options.notificationPatterns || []),
    ];

    function containsNotification(body) {
      if (!body) return false;
      const src = context.getSourceCode().getText(body);
      const lower = src.toLowerCase();
      return notificationPatterns.some((p) => lower.includes(p.toLowerCase()));
    }

    function isStateChangeSetter(name) {
      // Matches setState, setX (React useState pattern), dispatch, etc.
      if (STATE_CHANGE_HOOKS.some((h) => name === h)) return true;
      if (/^set[A-Z]/.test(name)) return true;
      return false;
    }

    return {
      CallExpression(node) {
        let calleeName = "";

        if (node.callee.type === "Identifier") {
          calleeName = node.callee.name;
        } else if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier"
        ) {
          calleeName = node.callee.property.name;
        }

        if (!isStateChangeSetter(calleeName)) return;

        // Find enclosing function body
        let parent = node.parent;
        while (parent) {
          if (
            parent.type === "FunctionDeclaration" ||
            parent.type === "FunctionExpression" ||
            parent.type === "ArrowFunctionExpression"
          ) {
            break;
          }
          parent = parent.parent;
        }

        if (!parent || !parent.body) return;

        // Only flag if the function is an event handler or async callback
        const funcSrc = context.getSourceCode().getText(parent);
        const isHandler =
          /handle|submit|click|save|update|delete|remove/i.test(funcSrc);
        const isAsync = parent.async || /\.then\(/.test(funcSrc);

        if ((isHandler || isAsync) && !containsNotification(parent.body)) {
          context.report({
            node,
            messageId: "missingNotification",
            data: { setter: calleeName },
          });
        }
      },
    };
  },
};
