import { createTechnologyDemo } from "./demo.js";
import { technologyFixtures } from "../evaluation/fixtures.js";
import { evaluateResponse } from "../evaluation/metrics.js";

const agent = createTechnologyDemo();
const args = process.argv.slice(2);
if (args[0] === "--evaluate") {
  const results = [];
  for (const fixture of technologyFixtures) {
    const response = await agent.plan(fixture.prompt, fixture.id, new Date().toISOString());
    results.push({ ...evaluateResponse(fixture, response), response });
  }
  console.log(JSON.stringify(results, null, 2));
} else if (args.length === 0) {
  console.error('Usage: pnpm demo "application planning request" | pnpm evaluate');
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(await agent.plan(args.join(" "), "cli", new Date().toISOString()), null, 2));
}
