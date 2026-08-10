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

async function optionalJson(url, headers = {}) {
  try { return await json(url, headers); }
  catch (error) { console.warn(`Optionale API-Abfrage fehlgeschlagen: ${url} (${error.message})`); return null; }
}

const asset = (media, key) => media?.assets?.find(entry => entry.key === key)?.value ?? null;

function currentScore(character) {
  const current = character.scores?.find(score => score.season === "current") ?? character.scores?.[0];
  return Number(current?.scores?.all ?? 0);
}

function talentGroups(value) {
  const groups = { hero: new Map(), specialization: new Map(), class: new Map(), other: new Map() };
  const walk = (node, path = "") => {
    if (!node || typeof node !== "object") return;
    const talent = node.talent ?? node.trait ?? (/talent|trait/i.test(path) ? node : null);
    if (talent && typeof talent.name === "string") {
      const group = /hero/i.test(path) ? "hero" : /class/i.test(path) ? "class" : /spec/i.test(path) ? "specialization" : "other";
      groups[group].set(talent.name, Number(node.rank ?? node.value ?? 1));
    }
    for (const [key, child] of Object.entries(node)) walk(child, `${path}.${key}`);
  };
  walk(value);
  return Object.fromEntries(Object.entries(groups).map(([key, talents]) => [key, [...talents].map(([name, rank]) => ({ name, rank }))]));
}

const classMediaCache = new Map();
async function classIcon(classId, authHeaders) {
  if (!classId) return null;
  if (!classMediaCache.has(classId)) {
    const url = `https://${config.region}.api.blizzard.com/data/wow/media/playable-class/${classId}?namespace=static-${config.region}&locale=${config.locale}`;
    classMediaCache.set(classId, optionalJson(url, authHeaders).then(media => asset(media, "icon")));
  }
  return classMediaCache.get(classId);
}

function raidEncounters(value) {
  const raids = [];
  for (const expansion of value?.expansions ?? []) {
    for (const instance of expansion.instances ?? []) {
      raids.push({
        name: instance.instance?.name ?? "Raid",
        modes: (instance.modes ?? []).map(mode => ({
          difficulty: mode.difficulty?.name ?? "Unbekannt",
          completed: Number(mode.progress?.completed_count ?? 0),
          total: Number(mode.progress?.total_count ?? 0),
          bosses: (mode.progress?.encounters ?? []).map(encounter => ({ name: encounter.encounter?.name ?? "Boss", kills: Number(encounter.completed_count ?? 0) }))
        }))
      });
    }
  }
  return raids;
}

async function loadCharacter(entry) {
  const slug = encodeURIComponent(entry.name.toLocaleLowerCase("de-DE"));
  const apiBase = `https://${config.region}.api.blizzard.com/profile/wow/character/${config.realm}/${slug}`;
  const query = `namespace=profile-${config.region}&locale=${config.locale}`;
  const blizzardUrl = `${apiBase}?${query}`;
  const rioUrl = new URL("https://raider.io/api/v1/characters/profile");
  rioUrl.search = new URLSearchParams({
    region: config.region,
    realm: config.realm,
    name: entry.name,
    fields: "gear,mythic_plus_scores_by_season:current,previous,season-tww-3,mythic_plus_ranks,mythic_plus_best_runs,raid_progression"
  });

  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  const [profile, rio, media, encounterData] = await Promise.all([
    json(blizzardUrl, { Authorization: `Bearer ${accessToken}` }),
    json(rioUrl),
    optionalJson(`${apiBase}/character-media?${query}`, authHeaders),
    entry.featured ? optionalJson(`${apiBase}/encounters/raids?namespace=profile-${config.region}&locale=en_GB`, authHeaders) : null
  ]);

  let equipment = null;
  let specializations = null;
  if (entry.featured) {
    [equipment, specializations] = await Promise.all([
      optionalJson(`${apiBase}/equipment?${query}`, authHeaders),
      optionalJson(`${apiBase}/specializations?${query}`, authHeaders)
    ]);
  }

  const equippedItems = await Promise.all((equipment?.equipped_items ?? []).map(async item => {
    const itemMedia = item.media?.key?.href ? await optionalJson(item.media.key.href, authHeaders) : null;
    return {
      id: item.item?.id ?? null,
      slot: item.slot?.name ?? "Ausrüstung",
      name: item.name ?? "Unbekannt",
      itemLevel: item.level?.value ?? null,
      quality: item.quality?.name ?? null,
      icon: asset(itemMedia, "icon"),
      wowheadUrl: item.item?.id ? `https://www.wowhead.com/item=${item.item.id}` : null
    };
  }));

  const raids = Object.entries(rio.raid_progression ?? {}).map(([slug, raid]) => ({
    slug,
    summary: raid.summary ?? "–",
    mythicKilled: Number(raid.mythic_bosses_killed ?? 0),
    heroicKilled: Number(raid.heroic_bosses_killed ?? 0),
    normalKilled: Number(raid.normal_bosses_killed ?? 0),
    totalBosses: Number(raid.total_bosses ?? 0)
  }));

  const classId = profile.character_class?.id ?? null;
  return {
    name: profile.name,
    level: profile.level,
    className: profile.character_class?.name ?? entry.expectedClass,
    classId,
    classIcon: await classIcon(classId, authHeaders),
    specName: profile.active_spec?.name ?? rio.active_spec_name ?? "Unbekannt",
    faction: profile.faction?.name ?? rio.faction ?? null,
    itemLevel: profile.equipped_item_level ?? null,
    profileUrl: rio.profile_url ?? null,
    armoryUrl: `https://worldofwarcraft.blizzard.com/de-de/character/${config.region}/${config.realm}/${slug}`,
    featured: Boolean(entry.featured),
    featuredRank: entry.rank ?? null,
    media: { avatar: asset(media, "avatar"), inset: asset(media, "inset"), render: asset(media, "main-raw") },
    equipment: equippedItems,
    talentGroups: talentGroups(specializations),
    gear: rio.gear ?? null,
    scores: rio.mythic_plus_scores_by_season ?? [],
    mythicPlusRanks: rio.mythic_plus_ranks ?? {},
    bestRuns: (rio.mythic_plus_best_runs ?? []).slice(0, 5).map(run => ({
      dungeon: run.dungeon ?? run.short_name ?? "Dungeon",
      shortName: run.short_name ?? null,
      level: run.mythic_level ?? null,
      score: run.score ?? null,
      upgrades: run.num_keystone_upgrades ?? null,
      clearTimeMs: run.clear_time_ms ?? null,
      url: run.url ?? null
    })),
    raids,
    raidEncounters: raidEncounters(encounterData),
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
      heroicKilled: Number(raid.heroic_bosses_killed ?? 0),
      normalKilled: Number(raid.normal_bosses_killed ?? 0),
      totalBosses: Number(raid.total_bosses ?? 0),
      character: character.name
    };
    const old = seasons[currentSeason].raids[raidSlug];
    const candidateRank = candidate.mythicKilled * 1e6 + candidate.heroicKilled * 1e3 + candidate.normalKilled;
    const oldRank = old ? Number(old.mythicKilled ?? 0) * 1e6 + Number(old.heroicKilled ?? 0) * 1e3 + Number(old.normalKilled ?? 0) : -1;
    if (!old || candidateRank > oldRank) seasons[currentSeason].raids[raidSlug] = candidate;
  }
}

seasons["season-tww-3"] ??= { bestMythicPlus: null, raids: {}, highlights: [] };
seasons["season-tww-3"].highlights ??= [];
if (!seasons["season-tww-3"].highlights.some(highlight => highlight.achievement === "Cutting Edge: Dimensius, the All-Devouring")) {
  seasons["season-tww-3"].highlights.push({ achievement: "Cutting Edge: Dimensius, the All-Devouring", character: "Waterpoof" });
}

const output = {
  generatedAt: new Date().toISOString(),
  region: config.region,
  realm: config.realm,
  maxLevel: config.maxLevel,
  activeRaidPatch: config.activeRaidPatch,
  trophies: config.trophies,
  characters: characters.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "de")),
  featured: {
    primary: characters.filter(character => character.featured).sort((a, b) => a.featuredRank - b.featuredRank).map(character => character.name),
    bronze: characters.filter(character => !character.featured).sort((a, b) => currentScore(b) - currentScore(a))[0]?.name ?? null
  },
  mythicPlus: { classShares: shares("className"), specShares: shares("specName") },
  raid: { available: false, reason: "Raid-Spielanteile nach Klasse und Spezialisierung benötigen öffentliche Warcraft-Logs-Daten." },
  seasons,
  errors
};
await fs.writeFile(outputUrl, JSON.stringify(output, null, 2) + "\n");
console.log(`Dashboard aktualisiert: ${characters.length} Charaktere, ${errors.length} Fehler.`);
