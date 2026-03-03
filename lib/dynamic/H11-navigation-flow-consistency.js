/**
 * H11: navigation-flow-consistency
 * Heuristic: Navigation consistency
 * Detection: Dynamic (Puppeteer-based)
 * Category: Dynamic: Navigation (Table 3 — P:0.84, R:0.76, F1:0.80)
 *
 * Tests navigation patterns across user journeys to ensure consistent
 * behavior. This is a dynamic analysis rule run via Puppeteer/GeckoDriver,
 * not an ESLint AST rule. Invoked as part of the HeuCI CI/CD pipeline.
 *
 * Usage:
 *   node lib/dynamic/H11-navigation-flow-consistency.js --url http://localhost:3000
 */

"use strict";

const DEFAULT_CONFIG = {
  baseUrl: "http://localhost:3000",
  timeout: 30000,
  viewports: [
    { width: 1920, height: 1080, label: "desktop" },
    { width: 768, height: 1024, label: "tablet" },
    { width: 375, height: 812, label: "mobile" },
  ],
  journeys: [],
  navigationSelectors: {
    primaryNav: "nav, [role='navigation']",
    breadcrumbs: "[aria-label='breadcrumb'], .breadcrumb",
    backButton: "[aria-label*='back'], .back-button, a[href*='back']",
    logo: "a[href='/'], .logo a, .brand a",
  },
  maxDepth: 3,
  consistencyThreshold: 0.85,
};

/**
 * Collects navigation elements from the current page state.
 */
async function collectNavigationState(page, selectors) {
  return page.evaluate((sel) => {
    const state = {};

    // Primary navigation links
    const navElements = document.querySelectorAll(sel.primaryNav);
    state.primaryNav = [];
    navElements.forEach((nav) => {
      const links = nav.querySelectorAll("a, button");
      links.forEach((link) => {
        state.primaryNav.push({
          text: link.textContent.trim(),
          href: link.href || null,
          visible:
            link.offsetParent !== null &&
            getComputedStyle(link).display !== "none",
          order: Array.from(nav.children).indexOf(link.closest("li") || link),
        });
      });
    });

    // Breadcrumbs
    const breadcrumbs = document.querySelectorAll(sel.breadcrumbs);
    state.breadcrumbs = breadcrumbs.length > 0;

    // Back button
    const backBtns = document.querySelectorAll(sel.backButton);
    state.hasBackButton = backBtns.length > 0;

    // Logo link home
    const logos = document.querySelectorAll(sel.logo);
    state.logoLinksHome =
      logos.length > 0 &&
      Array.from(logos).some(
        (l) => l.href && (l.href.endsWith("/") || l.href === window.location.origin),
      );

    // Current URL
    state.url = window.location.href;
    state.title = document.title;

    return state;
  }, selectors);
}

/**
 * Compares navigation states across pages for consistency.
 */
function analyzeConsistency(pageStates) {
  const violations = [];

  if (pageStates.length < 2) return violations;

  const baseNav = pageStates[0].primaryNav;

  for (let i = 1; i < pageStates.length; i++) {
    const currentNav = pageStates[i].primaryNav;

    // Check: same navigation items visible across pages
    const baseLabels = baseNav
      .filter((n) => n.visible)
      .map((n) => n.text)
      .sort();
    const currentLabels = currentNav
      .filter((n) => n.visible)
      .map((n) => n.text)
      .sort();

    if (JSON.stringify(baseLabels) !== JSON.stringify(currentLabels)) {
      const missing = baseLabels.filter((l) => !currentLabels.includes(l));
      const extra = currentLabels.filter((l) => !baseLabels.includes(l));

      if (missing.length > 0 || extra.length > 0) {
        violations.push({
          type: "inconsistent-nav-items",
          page: pageStates[i].url,
          message: `Navigation items differ from baseline. Missing: [${missing.join(", ")}], Extra: [${extra.join(", ")}]`,
          severity: "major",
        });
      }
    }

    // Check: navigation order consistency
    const baseOrder = baseNav.filter((n) => n.visible).map((n) => n.text);
    const currentOrder = currentNav
      .filter((n) => n.visible)
      .map((n) => n.text);
    const commonItems = baseOrder.filter((item) =>
      currentOrder.includes(item),
    );

    for (let j = 0; j < commonItems.length - 1; j++) {
      const baseIdx1 = baseOrder.indexOf(commonItems[j]);
      const baseIdx2 = baseOrder.indexOf(commonItems[j + 1]);
      const curIdx1 = currentOrder.indexOf(commonItems[j]);
      const curIdx2 = currentOrder.indexOf(commonItems[j + 1]);

      if (
        (baseIdx1 < baseIdx2 && curIdx1 > curIdx2) ||
        (baseIdx1 > baseIdx2 && curIdx1 < curIdx2)
      ) {
        violations.push({
          type: "inconsistent-nav-order",
          page: pageStates[i].url,
          message: `Navigation item order inconsistent: '${commonItems[j]}' and '${commonItems[j + 1]}' swap positions`,
          severity: "minor",
        });
      }
    }

    // Check: deep pages should have breadcrumbs or back button
    const depth = new URL(pageStates[i].url).pathname.split("/").filter(Boolean).length;
    if (depth >= 2 && !pageStates[i].breadcrumbs && !pageStates[i].hasBackButton) {
      violations.push({
        type: "missing-navigation-aid",
        page: pageStates[i].url,
        message: "Deep page lacks breadcrumbs or back button for navigation context",
        severity: "major",
      });
    }
  }

  return violations;
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
    await page.setViewport(cfg.viewports[0]);
    const pageStates = [];

    // Crawl pages up to maxDepth
    const visited = new Set();
    const queue = [cfg.baseUrl];

    while (queue.length > 0 && visited.size < 20) {
      const url = queue.shift();
      if (visited.has(url)) continue;
      visited.add(url);

      try {
        await page.goto(url, {
          waitUntil: "networkidle2",
          timeout: cfg.timeout,
        });
        const state = await collectNavigationState(
          page,
          cfg.navigationSelectors,
        );
        pageStates.push(state);

        // Discover internal links
        const links = await page.evaluate((baseUrl) => {
          return Array.from(document.querySelectorAll("a[href]"))
            .map((a) => a.href)
            .filter(
              (href) =>
                href.startsWith(baseUrl) && !href.includes("#") && !href.includes("mailto:"),
            );
        }, cfg.baseUrl);

        const depth =
          new URL(url).pathname.split("/").filter(Boolean).length;
        if (depth < cfg.maxDepth) {
          links.forEach((l) => {
            if (!visited.has(l)) queue.push(l);
          });
        }
      } catch (err) {
        console.warn(`Failed to load ${url}: ${err.message}`);
      }
    }

    const violations = analyzeConsistency(pageStates);

    return {
      rule: "H11-navigation-flow-consistency",
      heuristic: "Navigation consistency",
      pagesAnalyzed: pageStates.length,
      violations,
      passed: violations.length === 0,
    };
  } finally {
    await browser.close();
  }
}

// CLI entry point
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

module.exports = { run, collectNavigationState, analyzeConsistency };
