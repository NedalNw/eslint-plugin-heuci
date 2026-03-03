/**
 * H05: destructive-action-confirmation
 * Heuristic: Error prevention
 * Detection: Static
 * Category: Static: Error Prevention (Table 3)
 *
 * Ensures destructive operations (delete, remove, reset, clear)
 * have confirmation dialogs before execution.
 */

"use strict";

const DESTRUCTIVE_PATTERNS = [
  "delete",
  "remove",
  "destroy",
  "reset",
  "clear",
  "erase",
  "purge",
  "drop",
  "wipe",
  "revoke",
  "terminate",
  "cancel",
];

const CONFIRM_PATTERNS = [
  "confirm",
  "dialog",
  "modal",
  "prompt",
  "alert",
  "window.confirm",
  "showConfirm",
  "openConfirm",
  "confirmDialog",
  "ConfirmModal",
  "areYouSure",
];

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require confirmation for destructive actions (Nielsen H5: Error prevention)",
      category: "Usability",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          destructivePatterns: {
            type: "array",
            items: { type: "string" },
          },
          confirmPatterns: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingConfirmation:
        "Destructive operation '{{operation}}' lacks a confirmation step. " +
        "Add a confirmation dialog before executing irreversible actions " +
        "(Nielsen H5: Error prevention).",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const destructive = [
      ...DESTRUCTIVE_PATTERNS,
      ...(options.destructivePatterns || []),
    ];
    const confirms = [
      ...CONFIRM_PATTERNS,
      ...(options.confirmPatterns || []),
    ];

    function isDestructiveName(name) {
      const lower = name.toLowerCase();
      return destructive.some(
        (p) =>
          lower.includes(p) ||
          lower.startsWith("on" + p.charAt(0).toUpperCase() + p.slice(1)),
      );
    }

    function bodyHasConfirmation(body) {
      if (!body) return false;
      const src = context.getSourceCode().getText(body);
      const lower = src.toLowerCase();
      return confirms.some((p) => lower.includes(p.toLowerCase()));
    }

    return {
      // onClick={handleDelete} without confirm
      JSXAttribute(node) {
        if (
          !node.name ||
          node.name.name !== "onClick" ||
          !node.value
        ) {
          return;
        }

        if (node.value.type !== "JSXExpressionContainer") return;
        const expr = node.value.expression;

        // Check inline arrow: onClick={() => deleteItem(id)}
        if (
          expr.type === "ArrowFunctionExpression" ||
          expr.type === "FunctionExpression"
        ) {
          const src = context.getSourceCode().getText(expr.body);
          const hasDestructive = destructive.some((p) =>
            src.toLowerCase().includes(p),
          );

          if (hasDestructive && !bodyHasConfirmation(expr.body)) {
            context.report({
              node,
              messageId: "missingConfirmation",
              data: { operation: "inline handler" },
            });
          }
          return;
        }

        // Check reference: onClick={handleDelete}
        if (expr.type === "Identifier" && isDestructiveName(expr.name)) {
          // Try to find the function definition
          const scope = context.getScope ? context.getScope() : context.sourceCode.getScope(node);
          let resolved = false;

          for (const ref of scope.references) {
            if (ref.identifier.name === expr.name && ref.resolved) {
              for (const def of ref.resolved.defs) {
                if (def.node && def.node.init) {
                  if (bodyHasConfirmation(def.node.init.body || def.node.init)) {
                    resolved = true;
                  }
                }
              }
            }
          }

          if (!resolved) {
            context.report({
              node,
              messageId: "missingConfirmation",
              data: { operation: expr.name },
            });
          }
        }
      },

      // Direct function calls: deleteUser(id) without prior confirm
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

        if (!isDestructiveName(calleeName)) return;

        // Find enclosing function
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

        if (parent && parent.body && !bodyHasConfirmation(parent.body)) {
          context.report({
            node,
            messageId: "missingConfirmation",
            data: { operation: calleeName },
          });
        }
      },
    };
  },
};
