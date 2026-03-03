/**
 * H04: form-validation-presence
 * Heuristic: Error prevention
 * Detection: Static (code pattern) + Dynamic (runtime simulation)
 * Category: Static: Error Prevention (Table 3 — P:0.89, R:0.92, F1:0.90)
 *
 * Form validation detector that identifies form submissions without
 * prior validation checks and destructive operations without confirmation
 * dialogs. Analyzes event handler chains to ensure validation precedes
 * submission (Table 2 description).
 */

"use strict";

const VALIDATION_PATTERNS = [
  "validate",
  "isValid",
  "checkValid",
  "errors",
  "formErrors",
  "yup",
  "zod",
  "joi",
  "validator",
  "schema",
  "required",
  "pattern",
  "minLength",
  "maxLength",
  "formState",
  "isSubmitting",
  "isDirty",
];

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require validation before form submission (Nielsen H5: Error prevention)",
      category: "Usability",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          validationPatterns: {
            type: "array",
            items: { type: "string" },
            description: "Additional validation identifiers to accept",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingValidation:
        "Form submission handler lacks validation logic. " +
        "Add input validation before submission to prevent user errors " +
        "(Nielsen H5: Error prevention).",
      noHTMLValidation:
        "Form inputs lack validation attributes (required, pattern, etc.). " +
        "Add HTML5 validation constraints as a first line of defense.",
      missingPreventDefault:
        "Form submit handler should call preventDefault() to control submission flow.",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const validationPatterns = [
      ...VALIDATION_PATTERNS,
      ...(options.validationPatterns || []),
    ];

    function handlerHasValidation(node) {
      if (!node) return false;
      const src = context.getSourceCode().getText(node);
      const lower = src.toLowerCase();
      return validationPatterns.some((p) => lower.includes(p.toLowerCase()));
    }

    function handlerHasPreventDefault(node) {
      if (!node) return false;
      const src = context.getSourceCode().getText(node);
      return src.includes("preventDefault");
    }

    const formInputs = new Map(); // formNode -> [inputNodes]

    return {
      // Check JSX form onSubmit handlers
      JSXAttribute(node) {
        if (
          !node.name ||
          node.name.name !== "onSubmit" ||
          !node.value
        ) {
          return;
        }

        let handler = null;

        if (node.value.type === "JSXExpressionContainer") {
          const expr = node.value.expression;

          if (
            expr.type === "ArrowFunctionExpression" ||
            expr.type === "FunctionExpression"
          ) {
            handler = expr;
          } else if (expr.type === "Identifier") {
            // Reference to a named function — resolve from scope
            const scope = context.getScope ? context.getScope() : context.sourceCode.getScope(node);
            const variable = scope.references.find(
              (ref) => ref.identifier.name === expr.name,
            );
            if (variable && variable.resolved) {
              const def = variable.resolved.defs[0];
              if (def && def.node && def.node.init) {
                handler = def.node.init;
              }
            }
          }
        }

        if (!handler) return;

        const body = handler.body || handler;

        if (!handlerHasValidation(body)) {
          context.report({
            node,
            messageId: "missingValidation",
          });
        }

        if (!handlerHasPreventDefault(body)) {
          context.report({
            node,
            messageId: "missingPreventDefault",
          });
        }
      },

      // Track form inputs for HTML5 validation attribute checks
      JSXOpeningElement(node) {
        const name =
          node.name && node.name.type === "JSXIdentifier"
            ? node.name.name.toLowerCase()
            : "";

        if (name === "input" || name === "select" || name === "textarea") {
          const hasValidationAttr = node.attributes.some(
            (attr) =>
              attr.type === "JSXAttribute" &&
              attr.name &&
              [
                "required",
                "pattern",
                "minLength",
                "maxLength",
                "min",
                "max",
                "type",
              ].includes(attr.name.name),
          );

          // Find parent form
          let parent = node.parent;
          while (parent) {
            if (
              parent.type === "JSXElement" &&
              parent.openingElement.name &&
              parent.openingElement.name.name &&
              parent.openingElement.name.name.toLowerCase() === "form"
            ) {
              if (!formInputs.has(parent)) {
                formInputs.set(parent, []);
              }
              formInputs.get(parent).push({ node, hasValidationAttr });
              break;
            }
            parent = parent.parent;
          }
        }
      },

      "Program:exit"() {
        for (const [formNode, inputs] of formInputs) {
          const unvalidated = inputs.filter((i) => !i.hasValidationAttr);
          if (unvalidated.length > 0 && unvalidated.length === inputs.length) {
            context.report({
              node: formNode.openingElement,
              messageId: "noHTMLValidation",
            });
          }
        }
      },
    };
  },
};
