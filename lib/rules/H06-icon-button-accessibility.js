/**
 * H06: icon-button-accessibility
 * Heuristic: Recognition rather than recall
 * Detection: Static
 * Category: Static: Recognition (Table 3 — P:0.82, R:0.79, F1:0.80)
 *
 * Ensures icon-only buttons have accessible labels (aria-label, title).
 * Buttons containing only icons (SVG, icon components, emoji) without
 * visible text need explicit labeling for both accessibility and
 * usability — users should recognize rather than recall button functions.
 */

"use strict";

const ICON_COMPONENT_PATTERNS = [
  /icon/i,
  /^Fa[A-Z]/,    // FontAwesome
  /^Md[A-Z]/,    // Material Design
  /^Io[A-Z]/,    // Ionicons
  /^Ai[A-Z]/,    // Ant Design Icons
  /^Bs[A-Z]/,    // Bootstrap Icons
  /^Fi[A-Z]/,    // Feather Icons
  /^Hi[A-Z]/,    // Heroicons
];

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require accessible labels on icon-only buttons (Nielsen H6: Recognition rather than recall)",
      category: "Usability",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          iconPatterns: {
            type: "array",
            items: { type: "string" },
            description: "Additional icon component name patterns (regex strings)",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingLabel:
        "Icon-only button lacks an accessible label. Add aria-label or title " +
        "so users can identify the button's purpose without relying on memory " +
        "(Nielsen H6: Recognition rather than recall).",
      missingLabelValue:
        "Button has empty aria-label. Provide a descriptive label for the action.",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const extraPatterns = (options.iconPatterns || []).map(
      (p) => new RegExp(p),
    );
    const allIconPatterns = [...ICON_COMPONENT_PATTERNS, ...extraPatterns];

    function isIconComponent(name) {
      return allIconPatterns.some((pattern) => pattern.test(name));
    }

    function hasTextContent(node) {
      if (!node.children) return false;

      for (const child of node.children) {
        // Literal text content
        if (child.type === "JSXText" && child.value.trim().length > 0) {
          return true;
        }
        // <span>text</span> nested
        if (child.type === "JSXElement") {
          if (hasTextContent(child)) return true;
        }
        // {expression} that is a string literal
        if (
          child.type === "JSXExpressionContainer" &&
          child.expression.type === "Literal" &&
          typeof child.expression.value === "string" &&
          child.expression.value.trim().length > 0
        ) {
          return true;
        }
        // Visually hidden text (sr-only, visually-hidden)
        if (child.type === "JSXElement" && child.openingElement) {
          const cls = child.openingElement.attributes.find(
            (a) =>
              a.type === "JSXAttribute" &&
              a.name &&
              a.name.name === "className",
          );
          if (cls && cls.value) {
            const val =
              cls.value.type === "Literal" ? cls.value.value : "";
            if (/sr-only|visually-hidden|screen-reader/i.test(val)) {
              return true;
            }
          }
        }
      }
      return false;
    }

    function hasOnlyIconChildren(node) {
      if (!node.children || node.children.length === 0) return false;

      const meaningful = node.children.filter((child) => {
        if (child.type === "JSXText") return child.value.trim().length > 0;
        return child.type === "JSXElement" || child.type === "JSXExpressionContainer";
      });

      if (meaningful.length === 0) return false;

      return meaningful.every((child) => {
        if (child.type === "JSXElement" && child.openingElement.name) {
          const name = child.openingElement.name.name || "";
          return name.toLowerCase() === "svg" || isIconComponent(name);
        }
        return false;
      });
    }

    function hasAccessibleLabel(node) {
      if (!node.openingElement) return false;

      return node.openingElement.attributes.some((attr) => {
        if (attr.type !== "JSXAttribute" || !attr.name) return false;
        const name = attr.name.name || (attr.name.namespace ? `${attr.name.namespace.name}:${attr.name.name.name}` : "");
        return ["aria-label", "aria-labelledby", "title"].includes(name);
      });
    }

    function hasNonEmptyLabel(node) {
      if (!node.openingElement) return false;

      const labelAttr = node.openingElement.attributes.find((attr) => {
        if (attr.type !== "JSXAttribute" || !attr.name) return false;
        return attr.name.name === "aria-label";
      });

      if (!labelAttr) return true; // No aria-label to check
      if (!labelAttr.value) return false;
      if (labelAttr.value.type === "Literal") {
        return labelAttr.value.value && labelAttr.value.value.trim().length > 0;
      }
      return true; // Dynamic value, assume valid
    }

    return {
      JSXElement(node) {
        if (!node.openingElement || !node.openingElement.name) return;

        const tagName = node.openingElement.name.name;
        if (!tagName) return;

        const isButton =
          tagName.toLowerCase() === "button" ||
          tagName === "IconButton" ||
          /button/i.test(tagName);

        // Also check role="button"
        const hasButtonRole = node.openingElement.attributes.some(
          (attr) =>
            attr.type === "JSXAttribute" &&
            attr.name &&
            attr.name.name === "role" &&
            attr.value &&
            attr.value.type === "Literal" &&
            attr.value.value === "button",
        );

        if (!isButton && !hasButtonRole) return;

        // Only flag icon-only buttons (no visible text)
        if (hasTextContent(node)) return;
        if (!hasOnlyIconChildren(node) && node.children && node.children.length > 0) return;

        if (!hasAccessibleLabel(node)) {
          context.report({
            node: node.openingElement,
            messageId: "missingLabel",
          });
        } else if (!hasNonEmptyLabel(node)) {
          context.report({
            node: node.openingElement,
            messageId: "missingLabelValue",
          });
        }
      },
    };
  },
};
