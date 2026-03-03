/**
 * H07: complex-ui-tooltips
 * Heuristic: Recognition rather than recall
 * Detection: Static
 * Category: Static: Recognition (Table 3)
 *
 * Tooltip and accessibility hint analyzer that ensures complex UI
 * elements provide supplementary information. Checks aria-label,
 * title attributes, and tooltip components relative to UI complexity
 * (Table 2 description).
 */

"use strict";

const COMPLEX_ELEMENTS = [
  "slider",
  "range",
  "datepicker",
  "colorpicker",
  "dropdown",
  "combobox",
  "autocomplete",
  "multiselect",
  "treeview",
  "stepper",
  "accordion",
  "tabs",
  "carousel",
  "drawer",
  "popover",
  "toggle",
  "switch",
];

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Require tooltips or hints for complex UI elements (Nielsen H6: Recognition rather than recall)",
      category: "Usability",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          complexElements: {
            type: "array",
            items: { type: "string" },
            description: "Additional complex element names to check",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingTooltip:
        "Complex UI element '{{element}}' lacks a tooltip or descriptive hint. " +
        "Add title, aria-describedby, or a Tooltip wrapper so users can understand " +
        "the element without recalling prior experience (Nielsen H6).",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const complexList = [
      ...COMPLEX_ELEMENTS,
      ...(options.complexElements || []),
    ];

    function isComplexElement(name) {
      const lower = name.toLowerCase();
      return complexList.some((c) => lower.includes(c));
    }

    function hasTooltipOrHint(node) {
      const attrs = node.openingElement
        ? node.openingElement.attributes
        : node.attributes || [];

      return attrs.some((attr) => {
        if (attr.type !== "JSXAttribute" || !attr.name) return false;
        const name =
          typeof attr.name.name === "string" ? attr.name.name : "";
        return [
          "title",
          "aria-describedby",
          "aria-description",
          "tooltip",
          "helpText",
          "hint",
          "placeholder",
          "data-tooltip",
          "data-tip",
        ].includes(name);
      });
    }

    function isWrappedInTooltip(node) {
      let parent = node.parent;
      while (parent) {
        if (
          parent.type === "JSXElement" &&
          parent.openingElement &&
          parent.openingElement.name
        ) {
          const name = parent.openingElement.name.name || "";
          if (/tooltip|popover|hint/i.test(name)) return true;
        }
        parent = parent.parent;
      }
      return false;
    }

    return {
      JSXOpeningElement(node) {
        const name =
          node.name && node.name.type === "JSXIdentifier"
            ? node.name.name
            : "";

        if (!isComplexElement(name)) return;

        const parentElement = node.parent;
        if (
          !hasTooltipOrHint(parentElement) &&
          !isWrappedInTooltip(parentElement)
        ) {
          context.report({
            node,
            messageId: "missingTooltip",
            data: { element: name },
          });
        }
      },
    };
  },
};
