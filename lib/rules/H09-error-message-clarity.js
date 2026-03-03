/**
 * H09: error-message-clarity
 * Heuristic: Help users recognize, diagnose, and recover from errors
 * Detection: Static
 * Category: Static: Error Prevention (Table 3)
 *
 * Error message quality analyzer that examines error text for clarity,
 * actionability, and position. Ensures errors provide constructive
 * guidance rather than technical messages (Table 2 description).
 */

"use strict";

const TECHNICAL_JARGON = [
  "null",
  "undefined",
  "NaN",
  "exception",
  "stack trace",
  "runtime error",
  "fatal",
  "segfault",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "errno",
  "error code",
  "status 4",
  "status 5",
  "500",
  "404",
  "403",
  "401",
  "200",
  "TypeError",
  "ReferenceError",
  "SyntaxError",
  "failed to fetch",
  "network error",
  "unexpected token",
  "cannot read property",
  "is not a function",
  "is not defined",
];

const RECOVERY_PATTERNS = [
  "try again",
  "please",
  "check",
  "verify",
  "contact",
  "support",
  "help",
  "retry",
  "go back",
  "refresh",
  "update",
  "correct",
  "fix",
];

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Ensure error messages are clear and actionable (Nielsen H9: Help users with errors)",
      category: "Usability",
      recommended: true,
    },
    schema: [
      {
        type: "object",
        properties: {
          additionalJargon: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      technicalJargon:
        "Error message contains technical jargon '{{jargon}}'. " +
        "Rewrite in plain language that helps users understand what happened " +
        "(Nielsen H9: Help users with errors).",
      noRecoveryGuidance:
        "Error message lacks recovery guidance. Tell users what they can do " +
        "to fix the problem (e.g., 'Please try again' or 'Check your input').",
      missingRecoveryCTA:
        "Error container lacks a recovery action button. Add a CTA " +
        "(e.g., 'Retry', 'Go Back') to help users recover from the error.",
    },
  },

  create(context) {
    const options = context.options[0] || {};
    const jargonList = [
      ...TECHNICAL_JARGON,
      ...(options.additionalJargon || []),
    ];

    function isErrorContext(node) {
      // Check if element has error-related className or role
      if (!node.openingElement) return false;
      const attrs = node.openingElement.attributes;

      for (const attr of attrs) {
        if (attr.type !== "JSXAttribute" || !attr.name) continue;

        const name = attr.name.name;
        let value = "";

        if (attr.value && attr.value.type === "Literal") {
          value = String(attr.value.value);
        }

        if (name === "className" || name === "class") {
          if (/error|alert|danger|warning|invalid/i.test(value)) return true;
        }
        if (name === "role") {
          if (value === "alert" || value === "status") return true;
        }
      }

      // Check tag name
      const tag = node.openingElement.name;
      if (tag && tag.name && /error|alert/i.test(tag.name)) return true;

      return false;
    }

    function extractTextContent(node) {
      const texts = [];
      for (const child of node.children || []) {
        if (child.type === "JSXText") {
          texts.push(child.value.trim());
        }
        if (
          child.type === "JSXExpressionContainer" &&
          child.expression.type === "Literal" &&
          typeof child.expression.value === "string"
        ) {
          texts.push(child.expression.value);
        }
        if (child.type === "JSXElement") {
          texts.push(...extractTextContent(child));
        }
      }
      return texts.filter((t) => t.length > 0);
    }

    function hasButtonChild(node) {
      for (const child of node.children || []) {
        if (child.type === "JSXElement" && child.openingElement) {
          const tag = child.openingElement.name;
          if (tag && tag.name) {
            if (
              tag.name.toLowerCase() === "button" ||
              tag.name.toLowerCase() === "a" ||
              /button/i.test(tag.name)
            ) {
              return true;
            }
          }
          if (hasButtonChild(child)) return true;
        }
      }
      return false;
    }

    return {
      JSXElement(node) {
        if (!isErrorContext(node)) return;

        const texts = extractTextContent(node);
        const fullText = texts.join(" ").toLowerCase();

        if (fullText.length === 0) return;

        // Check for technical jargon
        for (const jargon of jargonList) {
          if (fullText.includes(jargon.toLowerCase())) {
            context.report({
              node: node.openingElement,
              messageId: "technicalJargon",
              data: { jargon },
            });
            break; // One report per element
          }
        }

        // Check for recovery guidance
        const hasRecovery = RECOVERY_PATTERNS.some((p) =>
          fullText.includes(p.toLowerCase()),
        );
        if (!hasRecovery && fullText.length > 10) {
          context.report({
            node: node.openingElement,
            messageId: "noRecoveryGuidance",
          });
        }

        // Check for recovery CTA button
        if (!hasButtonChild(node) && fullText.length > 20) {
          context.report({
            node: node.openingElement,
            messageId: "missingRecoveryCTA",
          });
        }
      },
    };
  },
};
