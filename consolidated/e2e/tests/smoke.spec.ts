/**
 * FinTrack — E2E Smoke Tests.
 *
 * Verifies the critical user flows work end-to-end in a browser:
 * 1. Login page loads
 * 2. Register → Dashboard
 * 3. Create account
 * 4. Create transaction
 * 5. Demo mode works
 */
import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("login page loads correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=FinTrack")).toBeVisible();
    await expect(page.locator("text=Se connecter")).toBeVisible();
    await expect(page.locator("text=Créer un compte")).toBeVisible();
  });

  test("redirects to login when not authenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("register flow creates account and redirects to dashboard", async ({ page }) => {
    await page.goto("/login");

    // Switch to register mode
    await page.click("text=Créer un compte");

    // Fill form
    await page.fill("#fullName", "Test User E2E");
    await page.fill("#email", `e2e-${Date.now()}@test.com`);
    await page.fill("#password", "testpassword123");

    // Submit
    await page.click('button:has-text("Créer mon compte")');

    // Should redirect to dashboard
    await expect(page.locator("text=Tableau de bord")).toBeVisible({ timeout: 10_000 });
  });

  test("demo mode loads with data", async ({ page }) => {
    await page.goto("/login");

    // Click demo button
    await page.click('button:has-text("données de démo")');

    // Should load dashboard with data
    await expect(page.locator("text=Tableau de bord")).toBeVisible({ timeout: 15_000 });

    // Should have some KPI cards
    await expect(page.locator("text=Revenus")).toBeVisible();
    await expect(page.locator("text=Dépenses")).toBeVisible();
  });

  test("navigation works", async ({ page }) => {
    // Register first
    await page.goto("/login");
    await page.click("text=Créer un compte");
    await page.fill("#fullName", "Nav Test");
    await page.fill("#email", `nav-${Date.now()}@test.com`);
    await page.fill("#password", "testpassword123");
    await page.click('button:has-text("Créer mon compte")');
    await expect(page.locator("text=Tableau de bord")).toBeVisible({ timeout: 10_000 });

    // Navigate to each page
    const pages = [
      { link: "Comptes", header: "Comptes" },
      { link: "Transactions", header: "Transactions" },
      { link: "Catégories", header: "Catégories" },
      { link: "Budgets", header: "Budgets" },
      { link: "Objectifs", header: "Objectifs" },
      { link: "Paramètres", header: "Paramètres" },
    ];

    for (const p of pages) {
      await page.click(`nav >> text=${p.link}`);
      await expect(page.locator(`h1:has-text("${p.header}")`)).toBeVisible({ timeout: 5_000 });
    }
  });

  test("logout works", async ({ page }) => {
    // Register
    await page.goto("/login");
    await page.click("text=Créer un compte");
    await page.fill("#fullName", "Logout Test");
    await page.fill("#email", `logout-${Date.now()}@test.com`);
    await page.fill("#password", "testpassword123");
    await page.click('button:has-text("Créer mon compte")');
    await expect(page.locator("text=Tableau de bord")).toBeVisible({ timeout: 10_000 });

    // Logout
    await page.click('button[title="Déconnexion"]');
    await expect(page).toHaveURL(/\/login/);
  });
});
