/**
 * H03: button-styling-consistency
 * Heuristic: Consistency and standards
 * Detection: Static
 * Category: Static: Consistency (Table 3 — P:0.91, R:0.87, F1:0.89)
 *
 * Detects inconsistent button styling patterns across similar UI
 * elements using AST traversal. Identifies when buttons with similar
 * functions use inconsistent class hierarchies.
 *
 * This is the rule shown in the manuscript code snippet (Table 2):
 *   function checkConsistentStyling(ast) {
 *     const buttonClasses = collectButtonClasses(ast);
 *     return detectInconsistentPatterns(buttonClasses);
 *   }
 */

"use strict";

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce consistent button styling patterns (Nielsen H4: Consistency and standards)",
      category: "Usability",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          primaryPatterns: {
            type: "array",
            items: { type: "string" },
            default: ["btn-primary", "primary", "Button--primary"],
            description: "Expected primary button class patterns",
          },
          secondaryPatterns: {
            type: "array",
            items: { type: "string" },
            default: ["btn-secondary", "secondary", "Button--secondary"],
            description: "Expected secondary button class patterns",
          },
          ignorePatterns: {
            type: "array",
            items: { type: "string" },
            description: "Class patterns to exclude from consistency checks",
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      inconsistentClasses:
        "Button uses class '{{found}}' which is inconsistent with the " +
        "dominant pattern '{{expected}}' in this file. " +
        "Maintain consistent styling for similar button types (Nielsen H4).",
      mixedFrameworks:
        "Mixed button styling frameworks detected ({{frameworks}}). " +
        "Use a single consistent approach to button styling (Nielsen H4).",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const ignorePatterns = options.ignorePatterns || [];

    // Collect all button class names across the file
    const buttonClassMap = new Map(); // className -> [node, ...]
    const buttonNodes = [];

    function extractClassName(node) {
      if (!node.value) return null;

      // JSX: className="btn btn-primary"
      if (node.value.type === "Literal" && typeof node.value.value === "string") {
        return node.value.value;
      }

      // JSX: className={`btn ${styles.primary}`}
      if (node.value.type === "JSXExpressionContainer") {
        const expr = node.value.expression;
        if (expr.type === "Literal" && typeof expr.value === "string") {
          return expr.value;
        }
        if (expr.type === "TemplateLiteral") {
          return expr.quasis.map((q) => q.value.raw).join("*");
        }
      }

      return null;
    }

    function isButtonElement(node) {
      // <button>, <Button>, <a role="button">, etc.
      if (node.type !== "JSXOpeningElement") return false;
      const name = node.name;

      if (name.type === "JSXIdentifier") {
        const n = name.name.toLowerCase();
        return n === "button" || n === "btn" || /button/i.test(name.name);
      }

      return false;
    }

    function shouldIgnore(className) {
      return ignorePatterns.some((p) => className.includes(p));
    }

    /**
     * Detect styling framework from class names.
     */
    function detectFramework(className) {
      if (/^btn[-_]/.test(className)) return "Bootstrap";
      if (/^MuiButton/.test(className)) return "MUI";
      if (/^ant-btn/.test(className)) return "Ant Design";
      if (/^chakra/.test(className)) return "Chakra UI";
      if (/^(bg-|text-|px-|py-)/.test(className)) return "Tailwind";
      return "custom";
    }

    return {
      JSXOpeningElement(node) {
        if (!isButtonElement(node)) return;

        const classAttr = node.attributes.find(
          (attr) =>
            attr.type === "JSXAttribute" &&
            attr.name &&
            (attr.name.name === "className" || attr.name.name === "class"),
        );

        if (!classAttr) return;
        const className = extractClassName(classAttr);
        if (!className || shouldIgnore(className)) return;

        buttonNodes.push({ node, className });

        const classes = className.split(/\s+/);
        for (const cls of classes) {
          if (!buttonClassMap.has(cls)) {
            buttonClassMap.set(cls, []);
          }
          buttonClassMap.get(cls).push(node);
        }
      },

      "Program:exit"() {
        if (buttonNodes.length < 2) return;

        // Detect mixed frameworks
        const frameworks = new Set();
        for (const { className } of buttonNodes) {
          frameworks.add(detectFramework(className));
        }
        frameworks.delete("custom");

        if (frameworks.size > 1) {
          context.report({
            node: buttonNodes[0].node,
            messageId: "mixedFrameworks",
            data: { frameworks: [...frameworks].join(", ") },
          });
          return;
        }

        // Find dominant pattern for button types
        const patternCounts = new Map();
        for (const { className } of buttonNodes) {
          const pattern = className.replace(/\s+/g, " ").trim();
          patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + 1);
        }

        // If all buttons use different patterns, flag outliers
        const sorted = [...patternCounts.entries()].sort(
          (a, b) => b[1] - a[1],
        );
        if (sorted.length < 2) return;

        const dominant = sorted[0][0];
        const dominantCount = sorted[0][1];

        // Only flag if there is a clear dominant pattern (>50%)
        if (dominantCount / buttonNodes.length < 0.5) return;

        for (const { node, className } of buttonNodes) {
          const pattern = className.replace(/\s+/g, " ").trim();
          if (pattern !== dominant) {
            context.report({
              node,
              messageId: "inconsistentClasses",
              data: { found: pattern, expected: dominant },
            });
          }
        }
      },
    };
  },
};
