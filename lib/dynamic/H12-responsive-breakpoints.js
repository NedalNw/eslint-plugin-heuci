/**
 * H12: responsive-breakpoints
 * Heuristic: Responsiveness / Flexibility and efficiency of use
 * Detection: Dynamic (Puppeteer-based)
 * Category: Dynamic: Responsiveness (Table 3 — P:0.86, R:0.83, F1:0.84)
 *
 * Tests responsive behavior at different viewport sizes (mobile, tablet,
 * desktop) to detect layout issues, overflow, and missing responsive
 * adaptations.
 *
 * Usage:
 *   node lib/dynamic/H12-responsive-breakpoints.js --url http://localhost:3000
 */

"use strict";

const DEFAULT_CONFIG = {
  baseUrl: "http://localhost:3000",
  timeout: 30000,
  breakpoints: [
    { width: 320, height: 568, label: "mobile-small" },
    { width: 375, height: 812, label: "mobile" },
    { width: 768, height: 1024, label: "tablet" },
    { width: 1024, height: 768, label: "tablet-landscape" },
    { width: 1440, height: 900, label: "desktop" },
    { width: 1920, height: 1080, label: "desktop-large" },
  ],
  pages: ["/"],
  checks: {
    horizontalOverflow: true,
    touchTargetSize: true,
    textReadability: true,
    imageScaling: true,
    navigationAdaptation: true,
  },
  minTouchTarget: 44, // Apple HIG recommendation in px
  minFontSize: 12,
};

/**
 * Analyzes a page at a given viewport for responsive issues.
 */
async function analyzeViewport(page, breakpoint, checks) {
  await page.setViewport({
    width: breakpoint.width,
    height: breakpoint.height,
  });

  // Wait for reflow
  await page.waitForTimeout(500);

  return page.evaluate(
    (bp, opts) => {
      const issues = [];

      // 1. Horizontal overflow detection
      if (opts.horizontalOverflow) {
        const docWidth = document.documentElement.scrollWidth;
        const viewWidth = window.innerWidth;
        if (docWidth > viewWidth + 5) {
          issues.push({
            type: "horizontal-overflow",
            message: `Page overflows horizontally by ${docWidth - viewWidth}px at ${bp.label} (${bp.width}px)`,
            severity: "major",
            details: { overflow: docWidth - viewWidth },
          });
        }

        // Check individual elements
        const allElements = document.querySelectorAll("*");
        for (const el of allElements) {
          const rect = el.getBoundingClientRect();
          if (rect.right > viewWidth + 5 && rect.width > 0) {
            const tag = el.tagName.toLowerCase();
            const cls = el.className
              ? `.${String(el.className).split(" ")[0]}`
              : "";
            issues.push({
              type: "element-overflow",
              message: `<${tag}${cls}> overflows viewport at ${bp.label}`,
              severity: "minor",
              element: `${tag}${cls}`,
            });
            break; // Report first offender only
          }
        }
      }

      // 2. Touch target size (mobile viewports)
      if (opts.touchTargetSize && bp.width <= 768) {
        const interactive = document.querySelectorAll(
          'button, a, input, select, textarea, [role="button"], [role="link"]',
        );
        for (const el of interactive) {
          const rect = el.getBoundingClientRect();
          if (
            rect.width > 0 &&
            rect.height > 0 &&
            (rect.width < opts.minTouchTarget ||
              rect.height < opts.minTouchTarget)
          ) {
            const tag = el.tagName.toLowerCase();
            const text = el.textContent.trim().substring(0, 30);
            issues.push({
              type: "small-touch-target",
              message: `Touch target too small (${Math.round(rect.width)}x${Math.round(rect.height)}px, min: ${opts.minTouchTarget}px) for "${text || tag}" at ${bp.label}`,
              severity: "major",
              element: tag,
              size: {
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
            });
          }
        }
      }

      // 3. Text readability
      if (opts.textReadability) {
        const textElements = document.querySelectorAll(
          "p, span, li, td, th, label, a",
        );
        for (const el of textElements) {
          if (!el.textContent.trim()) continue;
          const fontSize = parseFloat(getComputedStyle(el).fontSize);
          if (fontSize < opts.minFontSize && el.offsetParent !== null) {
            issues.push({
              type: "small-text",
              message: `Text "${el.textContent.trim().substring(0, 30)}..." is ${fontSize}px (min: ${opts.minFontSize}px) at ${bp.label}`,
              severity: "minor",
            });
            break; // Report once
          }
        }
      }

      // 4. Image scaling
      if (opts.imageScaling) {
        const images = document.querySelectorAll("img");
        for (const img of images) {
          const rect = img.getBoundingClientRect();
          if (rect.width > window.innerWidth) {
            issues.push({
              type: "oversized-image",
              message: `Image overflows viewport (${Math.round(rect.width)}px > ${window.innerWidth}px) at ${bp.label}`,
              severity: "major",
              src: img.src.substring(0, 100),
            });
          }
        }
      }

      // 5. Navigation adaptation (mobile should have hamburger or similar)
      if (opts.navigationAdaptation && bp.width <= 768) {
        const nav = document.querySelector("nav, [role='navigation']");
        if (nav) {
          const navLinks = nav.querySelectorAll("a");
          const visibleLinks = Array.from(navLinks).filter(
            (a) =>
              a.offsetParent !== null &&
              getComputedStyle(a).display !== "none",
          );
          if (visibleLinks.length > 5) {
            // Check for hamburger menu
            const hamburger = document.querySelector(
              '[aria-label*="menu"], [aria-label*="Menu"], .hamburger, .menu-toggle, button[aria-expanded]',
            );
            if (!hamburger) {
              issues.push({
                type: "no-mobile-nav-adaptation",
                message: `Navigation shows ${visibleLinks.length} links on mobile without a menu toggle at ${bp.label}`,
                severity: "major",
              });
            }
          }
        }
      }

      return issues;
    },
    breakpoint,
    { ...checks, minTouchTarget: DEFAULT_CONFIG.minTouchTarget, minFontSize: DEFAULT_CONFIG.minFontSize },
  );
}

/**
 * Main runner for CI/CD integration.
 */
async function run(config = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  let puppeteer;

  try {
    puppeteer = require("puppeteer");
  } catch {
    console.error(
      "Puppeteer is required for dynamic analysis. Install: npm install puppeteer",
    );
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox"],
  });

  try {
    const page = await browser.newPage();
    const allViolations = [];

    for (const pagePath of cfg.pages) {
      const url = `${cfg.baseUrl}${pagePath}`;

      try {
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: cfg.timeout,
        });
      } catch (err) {
        console.warn(`Failed to load ${url}: ${err.message}`);
        continue;
      }

      for (const bp of cfg.breakpoints) {
        const issues = await analyzeViewport(page, bp, cfg.checks);
        allViolations.push(
          ...issues.map((v) => ({ ...v, page: pagePath, breakpoint: bp.label })),
        );
      }
    }

    return {
      rule: "H12-responsive-breakpoints",
      heuristic: "Flexibility and efficiency of use / Responsiveness",
      pagesAnalyzed: cfg.pages.length,
      breakpointsTested: cfg.breakpoints.length,
      violations: allViolations,
      passed: allViolations.filter((v) => v.severity === "major").length === 0,
    };
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const urlIdx = args.indexOf("--url");
  const url = urlIdx >= 0 ? args[urlIdx + 1] : DEFAULT_CONFIG.baseUrl;

  run({ baseUrl: url })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(2);
    });
}

module.exports = { run, analyzeViewport };
