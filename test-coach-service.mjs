import { coachHealth, explainCoach } from "./coach-service.mjs";

console.log(JSON.stringify(coachHealth()));
try {
  await explainCoach({ evidenceCatalog: [] });
  console.log("AI coach request succeeded");
} catch (error) {
  console.log(JSON.stringify({ statusCode: error?.statusCode || null, message: error?.message || String(error) }));
}
