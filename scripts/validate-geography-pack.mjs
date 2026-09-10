import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const contentRoot = resolve(root, "content/geography");
const cities = JSON.parse(await readFile(resolve(contentRoot, "cities.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(contentRoot, "manifest.json"), "utf8"));
const map = JSON.parse(await readFile(resolve(contentRoot, "france-departments.geojson"), "utf8"));

if (!Array.isArray(cities) || cities.length === 0) throw new Error("cities.json est vide ou invalide");
const requiredCounts = { easy: 30, medium: 100, hard: 200 };
const counts = Object.fromEntries(Object.keys(requiredCounts).map((difficulty) => [
  difficulty,
  cities.filter((city) => city.difficulty === difficulty).length,
]));
for (const [difficulty, minimum] of Object.entries(requiredCounts)) {
  if ((counts[difficulty] ?? 0) < minimum) throw new Error(`Pool ${difficulty} incomplet`);
}

const ids = new Set();
for (const city of cities) {
  if (ids.has(city.inseeCode)) throw new Error(`Code INSEE dupliqué: ${city.inseeCode}`);
  ids.add(city.inseeCode);
  if (!city.name || !city.departmentName || !/^https?:\/\//.test(city.sourceUrl)) throw new Error(`Ville incomplète: ${city.inseeCode}`);
  if (!Number.isFinite(city.latitude) || city.latitude < 41 || city.latitude > 52) throw new Error(`Latitude hors bbox: ${city.inseeCode}`);
  if (!Number.isFinite(city.longitude) || city.longitude < -6 || city.longitude > 10) throw new Error(`Longitude hors bbox: ${city.inseeCode}`);
  if (!Number.isInteger(city.population) || city.population < 0) throw new Error(`Population invalide: ${city.inseeCode}`);
}

if (manifest.kind !== "geography" || manifest.slug !== "france-metropole" || manifest.version !== 1) {
  throw new Error("Manifest géographique incompatible");
}
for (const difficulty of Object.keys(requiredCounts)) {
  if (manifest.counts?.[difficulty] !== counts[difficulty]) throw new Error(`Manifest incohérent pour ${difficulty}`);
}
if (map.type !== "FeatureCollection" || !Array.isArray(map.features) || map.features.length < 96) {
  throw new Error("La carte doit contenir la métropole et la Corse");
}
const departmentCodes = new Set(map.features.map((feature) => feature.properties?.code));
if (!departmentCodes.has("2A") || !departmentCodes.has("2B")) throw new Error("La carte ne contient pas la Corse");

console.log(`Pack géographique valide: ${cities.length} communes, ${counts.easy}/${counts.medium}/${counts.hard} par difficulté, ${map.features.length} départements.`);
