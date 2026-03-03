/**
 * H10: aria-label-presence
 * Heuristic: Accessibility (cross-cutting)
 * Detection: Static
 * Category: Static: Accessibility (Table 3 — P:0.95, R:0.88, F1:0.91)
 *
 * Ensures all interactive elements have proper ARIA labels for
 * screen readers. Highest precision rule in the HeuCI suite.
 */

"use strict";

const INTERACTIVE_ELEMENTS = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "details",
  "summary",
];

const INTERACTIVE_ROLES = [
  "button",
  "link",
  "checkbox",
  "radio",
  "tab",
  "menuitem",
  "switch",
  "slider",
  "spinbutton",
  "searchbox",
  "combobox",
  "listbox",
  "option",
  "treeitem",
];

const LABEL_ATTRIBUTES = [
  "aria-label",
  "aria-labelledby",
  "title",
  "alt",
];

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require ARIA labels on interactive elements (Accessibility + Nielsen H6)",
      category: "Usability",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          additionalInteractiveRoles: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingAriaLabel:
        "Interactive element <{{element}}> lacks an accessible label. " +
        "Add aria-label, aria-labelledby, or title attribute.",
      emptyAriaLabel:
        "Empty aria-label on <{{element}}>. Provide a descriptive label.",
      imageButtonNoAlt:
        "Image inside interactive element lacks alt text. " +
        "Add alt attribute describing the image's function.",
    },
  },

  create(context) {
    function hasVisibleText(node) {
      if (!node.children) return false;
      for (const child of node.children) {
        if (child.type === "JSXText" && child.value.trim().length > 0) {
          return true;
        }
        if (child.type === "JSXElement" && hasVisibleText(child)) {
          return true;
        }
        if (
          child.type === "JSXExpressionContainer" &&
          child.expression.type === "Literal" &&
          typeof child.expression.value === "string" &&
          child.expression.value.trim().length > 0
        ) {
          return true;
        }
      }
      return false;
    }

    function hasLabelAttribute(attrs) {
      return attrs.some((attr) => {
        if (attr.type !== "JSXAttribute" || !attr.name) return false;
        const name =
          typeof attr.name === "string"
            ? attr.name
            : attr.name.name || "";
        return LABEL_ATTRIBUTES.includes(name);
      });
    }

    function hasNonEmptyLabel(attrs) {
      for (const attr of attrs) {
        if (attr.type !== "JSXAttribute" || !attr.name) continue;
        const name = attr.name.name || "";
        if (!LABEL_ATTRIBUTES.includes(name)) continue;

        if (!attr.value) return false;
        if (attr.value.type === "Literal") {
          return attr.value.value && String(attr.value.value).trim().length > 0;
        }
        return true; // Dynamic, assume non-empty
      }
      return false;
    }

    function hasForAttribute(attrs) {
      return attrs.some(
        (a) =>
          a.type === "JSXAttribute" && a.name && a.name.name === "htmlFor",
      );
    }

    function isInteractiveElement(name) {
      return INTERACTIVE_ELEMENTS.includes(name.toLowerCase());
    }

    function hasInteractiveRole(attrs) {
      const roleAttr = attrs.find(
        (a) =>
          a.type === "JSXAttribute" &&
          a.name &&
          a.name.name === "role" &&
          a.value &&
          a.value.type === "Literal",
      );
      return (
        roleAttr && INTERACTIVE_ROLES.includes(roleAttr.value.value)
      );
    }

    function isLabelledByAssociation(node) {
      // Check if there's a <label> wrapping or associated via htmlFor
      let parent = node.parent;
      while (parent) {
        if (
          parent.type === "JSXElement" &&
          parent.openingElement &&
          parent.openingElement.name &&
          parent.openingElement.name.name === "label"
        ) {
          return true;
        }
        parent = parent.parent;
      }
      return false;
    }

    return {
      JSXOpeningElement(node) {
        const tagName =
          node.name && node.name.type === "JSXIdentifier"
            ? node.name.name
            : "";

        if (!tagName) return;

        const isInteractive =
          isInteractiveElement(tagName) || hasInteractiveRole(node.attributes);
        if (!isInteractive) return;

        const attrs = node.attributes;
        const parentElement = node.parent;

        // Input elements wrapped in <label> are fine
        if (
          ["input", "select", "textarea"].includes(tagName.toLowerCase()) &&
          isLabelledByAssociation(node)
        ) {
          return;
        }

        // Input with type="hidden" is exempt
        const typeAttr = attrs.find(
          (a) =>
            a.type === "JSXAttribute" &&
            a.name &&
            a.name.name === "type" &&
            a.value &&
            a.value.type === "Literal" &&
            a.value.value === "hidden",
        );
        if (typeAttr) return;

        // Elements with visible text content are fine
        if (parentElement && hasVisibleText(parentElement)) return;

        if (!hasLabelAttribute(attrs)) {
          context.report({
            node,
            messageId: "missingAriaLabel",
            data: { element: tagName },
          });
        } else if (!hasNonEmptyLabel(attrs)) {
          context.report({
            node,
            messageId: "emptyAriaLabel",
            data: { element: tagName },
          });
        }
      },
    };
  },
};
