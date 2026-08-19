import { recognizeBoardFromImage, recognitionHealth } from "./analysis-service.mjs";

const results = {};

try {
  await recognizeBoardFromImage({});
  results.emptyImage = "did-not-throw";
} catch (error) {
  results.emptyImage = { statusCode: error.statusCode, message: error.message };
}

results.healthKeys = Object.keys(recognitionHealth()).sort();

if (results.emptyImage?.statusCode !== 400 && results.emptyImage?.statusCode !== 503) {
  console.error(results);
  process.exit(1);
}

console.log(JSON.stringify(results, null, 2));
