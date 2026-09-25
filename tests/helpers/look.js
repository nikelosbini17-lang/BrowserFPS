// Windows raw pointer lock can deliver physical desktop mouse motion to headless Edge.
// Isolate scripted aim/routes from unrelated host input; explicitly enable real look where tested.
// This touches test instances only and does not alter the shipped input/controller code.
export async function isolateLook(page) {
  await page.evaluate(() => {
    const input = window.__game.input;
    const consume = input.consumeLook.bind(input);
    window.__testLiveLook = false;
    input.consumeLook = () => {
      const look = consume();
      return window.__testLiveLook ? look : [0, 0];
    };
  });
}
export async function setLiveLook(page, enabled) {
  await page.evaluate((enabled) => {
    window.__game.input.consumeLook();
    window.__testLiveLook = enabled;
  }, enabled);
}
