import { test, expect } from "@playwright/test";
test("Cosmetic preview and equip survive reload without changing weapon stats", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const stats = () =>
    page.evaluate(() =>
      JSON.stringify(window.__game.weapons.weapons.map((w) => w.config)),
    );
  const before = await stats();
  await page.locator('[data-action="loadout"]').click();
  await page.locator("#skin-weapon").selectOption("titan");
  for (const skin of [
    "midnight",
    "arctic",
    "sunset",
    "neon",
    "carbon",
    "retro",
  ]) {
    await page.locator("#skin-select").selectOption(skin);
    await page.locator("#equip-skin").click();
  }
  expect(await stats()).toBe(before);
  await page.reload();
  expect(
    await page.evaluate(
      () => window.__game.viewModel.models.titan.group.userData.skin,
    ),
  ).toBe("retro");
  expect(await stats()).toBe(before);
  expect(errors).toEqual([]);
});
