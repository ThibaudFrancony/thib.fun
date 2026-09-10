import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const COMMUNES_URL = "https://geo.api.gouv.fr/communes?fields=nom,code,codeDepartement,population,centre,departement&format=json&geometry=centre";
const MAP_URL = "https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-version-simplifiee.geojson";
const POPULATION_YEAR = 2023;
const SOURCE_URL = "https://geo.api.gouv.fr/";
const MAP_LICENSE = "Licence Ouverte / Etalab";

const metropolitanDepartment = /^(?:0[1-9]|[1-8][0-9]|9[0-5]|2[AB])$/;

function isMetropolitanCommune(item) {
  const coordinates = item.centre?.coordinates;
  return (
    typeof item.code === "string" &&
    metropolitanDepartment.test(item.codeDepartement ?? "") &&
    Number.isInteger(item.population) &&
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    Number.isFinite(coordinates[0]) &&
    Number.isFinite(coordinates[1]) &&
    coordinates[0] >= -6 &&
    coordinates[0] <= 10 &&
    coordinates[1] >= 41 &&
    coordinates[1] <= 52
  );
}

function sortCandidates(items) {
  return [...items].sort((a, b) => a.code.localeCompare(b.code));
}

function roundRobinByDepartment(items, count) {
  const groups = new Map();
  for (const item of sortCandidates(items)) {
    const group = groups.get(item.departmentCode) ?? [];
    group.push(item);
    groups.set(item.departmentCode, group);
  }
  const departments = [...groups.keys()].sort();
  const selected = [];
  let index = 0;
  while (selected.length < count) {
    let added = false;
    for (const department of departments) {
      const candidate = groups.get(department)?.[index];
      if (!candidate) continue;
      selected.push(candidate);
      added = true;
      if (selected.length === count) break;
    }
    if (!added) break;
    index += 1;
  }
  return selected;
}

function selectPool(items, count) {
  const diverse = roundRobinByDepartment(items, count);
  if (diverse.length >= count) return diverse;
  const selectedCodes = new Set(diverse.map((item) => item.code));
  return [...diverse, ...sortCandidates(items).filter((item) => !selectedCodes.has(item.code))].slice(0, count);
}

function normalise(item, difficulty) {
  const [longitude, latitude] = item.centre.coordinates;
  return {
    inseeCode: item.code,
    name: item.nom.trim(),
    departmentCode: item.codeDepartement,
    departmentName: item.departement?.nom?.trim() ?? item.codeDepartement,
    latitude,
    longitude,
    population: item.population,
    populationYear: POPULATION_YEAR,
    difficulty,
    sourceUrl: `${SOURCE_URL}communes/${encodeURIComponent(item.code)}?fields=nom,code,codeDepartement,population,centre`,
  };
}

function departmentCodeFromFeature(feature) {
  const properties = feature?.properties ?? {};
  const candidates = [properties.code, properties.code_dept, properties.codeDepartement, properties.insee];
  return candidates.find((value) => typeof value === "string") ?? null;
}

function filterMap(map) {
  return {
    type: "FeatureCollection",
    features: (map.features ?? []).filter((feature) => metropolitanDepartment.test(departmentCodeFromFeature(feature) ?? "")),
  };
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Impossible de télécharger ${url}: ${response.status}`);
  return response.json();
}

const communes = await fetchJson(COMMUNES_URL);
const candidates = communes.filter(isMetropolitanCommune);
const pools = {
  easy: selectPool(candidates.filter((item) => item.population >= 100000), 40),
  medium: selectPool(candidates.filter((item) => item.population >= 20000 && item.population < 100000), 120),
  hard: selectPool(candidates.filter((item) => item.population < 20000), 220),
};

for (const [difficulty, items] of Object.entries(pools)) {
  const minimum = difficulty === "easy" ? 30 : difficulty === "medium" ? 100 : 200;
  if (items.length < minimum) throw new Error(`Pool ${difficulty} incomplet: ${items.length}/${minimum}`);
}

const cities = [
  ...pools.easy.map((item) => normalise(item, "easy")),
  ...pools.medium.map((item) => normalise(item, "medium")),
  ...pools.hard.map((item) => normalise(item, "hard")),
];
const map = filterMap(await fetchJson(MAP_URL));
const outputDirectory = resolve(ROOT, "content/geography");
await mkdir(outputDirectory, { recursive: true });
await writeFile(resolve(outputDirectory, "cities.json"), `${JSON.stringify(cities, null, 2)}\n`, "utf8");
await writeFile(resolve(outputDirectory, "france-departments.geojson"), `${JSON.stringify(map)}\n`, "utf8");
await writeFile(
  resolve(outputDirectory, "manifest.json"),
  `${JSON.stringify({
    kind: "geography",
    slug: "france-metropole",
    version: 1,
    status: "published",
    populationYear: POPULATION_YEAR,
    citySource: SOURCE_URL,
    mapSource: MAP_URL,
    mapLicense: MAP_LICENSE,
    counts: Object.fromEntries(Object.entries(pools).map(([difficulty, items]) => [difficulty, items.length])),
  }, null, 2)}\n`,
  "utf8",
);

console.log(`Pack Géographie généré : ${cities.length} villes (${Object.entries(pools).map(([key, value]) => `${key}=${value.length}`).join(", ")})`);
