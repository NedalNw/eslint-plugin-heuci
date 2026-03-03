/**
 * H08: duplicate-action-buttons
 * Heuristic: Aesthetic and minimalist design
 * Detection: Static
 * Category: Static: Accessibility (Table 3 — P:0.95, R:0.88, F1:0.91)
 *
 * Detects redundant action buttons in the same view that could be
 * consolidated, reducing visual clutter and cognitive load.
 */

"use strict";

const ACTION_VERBS = [
  "save",
  "submit",
  "send",
  "apply",
  "update",
  "create",
  "add",
  "cancel",
  "close",
  "delete",
  "remove",
  "reset",
  "confirm",
  "ok",
  "done",
];

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Detect duplicate action buttons in the same view (Nielsen H8: Aesthetic and minimalist design)",
      category: "Usability",
      recommended: true,
    },
    schema: [],
    messages: {
      duplicateAction:
        "Multiple buttons with the '{{action}}' action detected in the same component. " +
        "Consider consolidating to reduce visual clutter (Nielsen H8: Aesthetic and minimalist design).",
    },
  },

  create(context) {
    // Track buttons per component scope
    const componentButtons = new Map();

    function getComponentScope(node) {
      let parent = node.parent;
      while (parent) {
        if (
          parent.type === "FunctionDeclaration" ||
          parent.type === "FunctionExpression" ||
          parent.type === "ArrowFunctionExpression" ||
          parent.type === "ClassDeclaration"
        ) {
          return parent;
        }
        parent = parent.parent;
      }
      return null;
    }

    function extractButtonAction(node) {
      if (!node.openingElement) return null;
      const attrs = node.openingElement.attributes;

      // Check text content
      for (const child of node.children || []) {
        if (child.type === "JSXText") {
          const text = child.value.trim().toLowerCase();
          const action = ACTION_VERBS.find((v) => text.includes(v));
          if (action) return action;
        }
        if (
          child.type === "JSXExpressionContainer" &&
          child.expression.type === "Literal"
        ) {
          const text = String(child.expression.value).toLowerCase();
          const action = ACTION_VERBS.find((v) => text.includes(v));
          if (action) return action;
        }
      }

      // Check type attribute
      const typeAttr = attrs.find(
        (a) =>
          a.type === "JSXAttribute" &&
          a.name &&
          a.name.name === "type" &&
          a.value &&
          a.value.type === "Literal",
      );
      if (typeAttr) {
        const action = ACTION_VERBS.find((v) =>
          typeAttr.value.value.toLowerCase().includes(v),
        );
        if (action) return action;
      }

      // Check onClick handler name
      const onClickAttr = attrs.find(
        (a) =>
          a.type === "JSXAttribute" &&
          a.name &&
          a.name.name === "onClick",
      );
      if (
        onClickAttr &&
        onClickAttr.value &&
        onClickAttr.value.type === "JSXExpressionContainer"
      ) {
        const expr = onClickAttr.value.expression;
        const name =
          expr.type === "Identifier"
            ? expr.name
            : expr.type === "MemberExpression" && expr.property.type === "Identifier"
              ? expr.property.name
              : "";
        const action = ACTION_VERBS.find((v) =>
          name.toLowerCase().includes(v),
        );
        if (action) return action;
      }

      return null;
    }

    return {
      JSXElement(node) {
        if (!node.openingElement || !node.openingElement.name) return;

        const tag = node.openingElement.name.name;
        if (!tag) return;
        if (tag.toLowerCase() !== "button" && !/button/i.test(tag)) return;

        const action = extractButtonAction(node);
        if (!action) return;

        const scope = getComponentScope(node);
        if (!scope) return;

        if (!componentButtons.has(scope)) {
          componentButtons.set(scope, new Map());
        }

        const buttons = componentButtons.get(scope);
        if (!buttons.has(action)) {
          buttons.set(action, []);
        }
        buttons.get(action).push(node);
      },

      "Program:exit"() {
        for (const [, buttons] of componentButtons) {
          for (const [action, nodes] of buttons) {
            if (nodes.length > 1) {
              // Report on the second occurrence onward
              for (let i = 1; i < nodes.length; i++) {
                context.report({
                  node: nodes[i].openingElement,
                  messageId: "duplicateAction",
                  data: { action },
                });
              }
            }
          }
        }
      },
    };
  },
};
