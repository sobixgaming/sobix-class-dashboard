import fs from "node:fs/promises";

const config = JSON.parse(await fs.readFile(new URL("../config/characters.json", import.meta.url), "utf8"));
const outputUrl = new URL("../data/dashboard.json", import.meta.url);
let previous = { seasons: {} };
try { previous = JSON.parse(await fs.readFile(outputUrl, "utf8")); } catch {}

const clientId = process.env.BLIZZARD_CLIENT_ID;
const clientSecret = process.env.BLIZZARD_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error("BLIZZARD_CLIENT_ID und BLIZZARD_CLIENT_SECRET fehlen.");

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
const tokenResponse = await fetch("https://oauth.battle.net/token", {
  method: "POST",
  headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials"
});
if (!tokenResponse.ok) throw new Error(`Battle.net OAuth fehlgeschlagen: ${tokenResponse.status}`);
const { access_token: accessToken } = await tokenResponse.json();

async function json(url, headers = {}) {
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function loadCharacter(entry) {
  const slug = encodeURIComponent(entry.name.toLocaleLowerCase("de-DE"));
  const blizzardUrl = `https://${config.region}.api.blizzard.com/profile/wow/character/${config.realm}/${slug}?namespace=profile-${config.region}&locale=${config.locale}`;
  const rioUrl = new URL("https://raider.io/api/v1/characters/profile");
  rioUrl.search = new URLSearchParams({
    region: config.region,
    realm: config.realm,
    name: entry.name,
    fields: "mythic_plus_scores_by_season:current,previous,raid_progression"
  });

  const [profile, rio] = await Promise.all([
    json(blizzardUrl, { Authorization: `Bearer ${accessToken}` }),
    json(rioUrl)
  ]);

  return {
    name: profile.name,
    level: profile.level,
    className: profile.character_class?.name ?? entry.expectedClass,
    specName: profile.active_spec?.name ?? rio.active_spec_name ?? "Unbekannt",
    faction: profile.faction?.name ?? rio.faction ?? null,
    itemLevel: profile.equipped_item_level ?? null,
    profileUrl: rio.profile_url ?? null,
    scores: rio.mythic_plus_scores_by_season ?? [],
    raidProgression: rio.raid_progression ?? {}
  };
}

const settled = await Promise.allSettled(config.characters.map(loadCharacter));
const characters = [];
const errors = [];
settled.forEach((result, index) => {
  if (result.status === "fulfilled") characters.push(result.value);
  else errors.push({ character: config.characters[index].name, message: result.reason?.message ?? String(result.reason) });
});

function shares(key) {
  const totals = new Map();
  for (const character of characters) {
    const current = character.scores.find(score => score.season === "current") ?? character.scores[0];
    const value = Number(current?.scores?.all ?? 0);
    const label = character[key] || "Unbekannt";
    totals.set(label, (totals.get(label) ?? 0) + value);
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([label, score]) => ({ label, score: Math.round(score), percent: sum ? Number((score / sum * 100).toFixed(1)) : 0 }))
    .sort((a, b) => b.score - a.score);
}

const seasons = structuredClone(previous.seasons ?? {});
for (const character of characters) {
  for (const seasonScore of character.scores) {
    const season = seasonScore.season || "unbekannt";
    const score = Number(seasonScore.scores?.all ?? 0);
    seasons[season] ??= { bestMythicPlus: null, raids: {} };
    if (!seasons[season].bestMythicPlus || score > seasons[season].bestMythicPlus.score) {
      seasons[season].bestMythicPlus = { score: Math.round(score), character: character.name, className: character.className, specName: character.specName };
    }
  }
}

const currentSeason = characters.find(c => c.scores.length)?.scores[0]?.season ?? "current";
seasons[currentSeason] ??= { bestMythicPlus: null, raids: {} };
for (const character of characters) {
  for (const [raidSlug, raid] of Object.entries(character.raidProgression)) {
    const candidate = {
      raid: raidSlug,
      summary: raid.summary ?? "–",
      mythicKilled: Number(raid.mythic_bosses_killed ?? 0),
      totalBosses: Number(raid.total_bosses ?? 0),
      character: character.name
    };
    const old = seasons[currentSeason].raids[raidSlug];
    if (!old || candidate.mythicKilled > old.mythicKilled) seasons[currentSeason].raids[raidSlug] = candidate;
  }
}

const output = {
  generatedAt: new Date().toISOString(),
  region: config.region,
  realm: config.realm,
  maxLevel: config.maxLevel,
  characters: characters.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "de")),
  mythicPlus: { classShares: shares("className"), specShares: shares("specName") },
  raid: { available: false, reason: "Raid-Spielanteile nach Klasse und Spezialisierung benötigen öffentliche Warcraft-Logs-Daten." },
  seasons,
  errors
};
await fs.writeFile(outputUrl, JSON.stringify(output, null, 2) + "\n");
console.log(`Dashboard aktualisiert: ${characters.length} Charaktere, ${errors.length} Fehler.`);
