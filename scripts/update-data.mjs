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

const weeklyTimeZone = "Europe/Berlin";
function zonedParts(date, timeZone = weeklyTimeZone) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "short"
  }).formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}
function zonedLocalToUtc({ year, month, day, hour = 0, minute = 0 }, timeZone = weeklyTimeZone) {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let index = 0; index < 2; index += 1) {
    const parts = zonedParts(new Date(guess), timeZone);
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += Date.UTC(year, month - 1, day, hour, minute) - represented;
  }
  return new Date(guess);
}
function weeklyResetWindow(now = new Date()) {
  const parts = zonedParts(now);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const currentDay = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  let resetDay = new Date(currentDay - ((weekdays.indexOf(parts.weekday) - 3 + 7) % 7) * 86400000);
  let resetAt = zonedLocalToUtc({ year: resetDay.getUTCFullYear(), month: resetDay.getUTCMonth() + 1, day: resetDay.getUTCDate(), hour: 6 });
  if (now < resetAt) {
    resetDay = new Date(resetDay.getTime() - 7 * 86400000);
    resetAt = zonedLocalToUtc({ year: resetDay.getUTCFullYear(), month: resetDay.getUTCMonth() + 1, day: resetDay.getUTCDate(), hour: 6 });
  }
  const nextDay = new Date(resetDay.getTime() + 7 * 86400000);
  const nextResetAt = zonedLocalToUtc({ year: nextDay.getUTCFullYear(), month: nextDay.getUTCMonth() + 1, day: nextDay.getUTCDate(), hour: 6 });
  return { resetAt, nextResetAt };
}
function mapRun(run) {
  return {
    dungeon: run.dungeon ?? run.short_name ?? "Dungeon",
    shortName: run.short_name ?? null,
    level: run.mythic_level ?? null,
    score: run.score ?? null,
    upgrades: run.num_keystone_upgrades ?? null,
    clearTimeMs: run.clear_time_ms ?? null,
    completedAt: run.completed_at ?? null,
    url: run.url ?? null
  };
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

function talentImportCode(value) {
  let result = null;
  const walk = (node, key = "") => {
    if (result || node == null) return;
    if (typeof node === "string" && /(?:loadout|talent).*code|code.*(?:loadout|talent)/i.test(key) && node.length > 20) { result = node; return; }
    if (typeof node === "object") for (const [childKey, child] of Object.entries(node)) walk(child, childKey);
  };
  walk(value);
  return result;
}

function selectedTalents(loadout) {
  return (loadout?.loadout ?? []).map(selection => {
    const node = selection.node ?? {};
    const entry = node.entries?.[selection.entryIndex ?? 0] ?? node.entries?.[0];
    const spell = entry?.spell;
    if (!spell?.name) return null;
    return {
      id: spell.id ?? null,
      name: spell.name,
      icon: spell.icon ? `https://render.worldofwarcraft.com/eu/icons/56/${spell.icon}.jpg` : null,
      rank: Number(selection.rank ?? 1),
      hero: Number(node.subTreeId ?? 0) > 0,
      important: Boolean(node.important),
      row: Number(node.row ?? 0),
      column: Number(node.col ?? 0)
    };
  }).filter(Boolean);
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

async function bossDetails(value, authHeaders) {
  const instanceIds = [...new Set((value?.expansions ?? []).flatMap(expansion => (expansion.instances ?? []).map(instance => instance.instance?.id).filter(Boolean)))];
  const journals = await Promise.all(instanceIds.map(async id => [id, await optionalJson(`https://${config.region}.api.blizzard.com/data/wow/journal-instance/${id}?namespace=static-${config.region}&locale=en_GB`, authHeaders)]));
  const rosters = new Map(journals.map(([id, journal]) => [id, (journal?.encounters ?? []).map(encounter => ({ id: encounter.id, name: encounter.name }))]));
  const ids = [...new Set([...rosters.values()].flat().map(encounter => encounter.id).filter(Boolean))];
  const portraits = await Promise.all(ids.map(async id => {
    const journal = await optionalJson(`https://${config.region}.api.blizzard.com/data/wow/journal-encounter/${id}?namespace=static-${config.region}&locale=en_GB`, authHeaders);
    let portrait = null;
    for (const creature of journal?.creatures ?? []) {
      const displayUrl = creature.creature_display?.key?.href;
      const media = displayUrl ? await optionalJson(displayUrl, authHeaders) : null;
      portrait = asset(media, "zoom") ?? asset(media, "main") ?? asset(media, "icon");
      if (portrait) break;
    }
    return [id, portrait];
  }));
  return { portraits: new Map(portraits), rosters };
}

function raidEncounters(value, details = { portraits: new Map(), rosters: new Map() }) {
  const raids = [];
  for (const expansion of value?.expansions ?? []) {
    for (const instance of expansion.instances ?? []) {
      raids.push({
        name: instance.instance?.name ?? "Raid",
        modes: (instance.modes ?? []).map(mode => ({
          difficulty: mode.difficulty?.name ?? "Unbekannt",
          completed: Number(mode.progress?.completed_count ?? 0),
          total: Number(mode.progress?.total_count ?? 0),
          bosses: (details.rosters.get(instance.instance?.id)?.length ? details.rosters.get(instance.instance.id) : (mode.progress?.encounters ?? []).map(encounter => encounter.encounter)).map(encounter => {
            const progress = (mode.progress?.encounters ?? []).find(entry => entry.encounter?.id === encounter.id);
            return { id: encounter.id ?? null, name: encounter.name ?? "Boss", image: details.portraits.get(encounter.id) ?? null, kills: Number(progress?.completed_count ?? 0) };
          })
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
    fields: "gear,talents,mythic_plus_scores_by_season:current,previous,mythic_plus_ranks,mythic_plus_best_runs,raid_progression"
  });
  const historyRioUrl = new URL(rioUrl);
  historyRioUrl.searchParams.set("fields", "mythic_plus_scores_by_season:season-tww-3");
  const weeklyRioUrl = new URL(rioUrl);
  weeklyRioUrl.searchParams.set("fields", "mythic_plus_recent_runs,mythic_plus_weekly_highest_level_runs");

  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  const [profile, rio, historyRio, weeklyRio, media, encounterData] = await Promise.all([
    json(blizzardUrl, { Authorization: `Bearer ${accessToken}` }),
    json(rioUrl),
    optionalJson(historyRioUrl),
    entry.featured ? optionalJson(weeklyRioUrl) : null,
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
  const encounterDetails = entry.featured ? await bossDetails(encounterData, authHeaders) : { portraits: new Map(), rosters: new Map() };

  const raids = Object.entries(rio.raid_progression ?? {}).map(([slug, raid]) => ({
    slug,
    summary: raid.summary ?? "–",
    mythicKilled: Number(raid.mythic_bosses_killed ?? 0),
    heroicKilled: Number(raid.heroic_bosses_killed ?? 0),
    normalKilled: Number(raid.normal_bosses_killed ?? 0),
    totalBosses: Number(raid.total_bosses ?? 0)
  }));

  const classId = profile.character_class?.id ?? null;
  const scores = [...(rio.mythic_plus_scores_by_season ?? []), ...(historyRio?.mythic_plus_scores_by_season ?? [])]
    .filter((score, index, all) => all.findIndex(candidate => candidate.season === score.season) === index);
  return {
    name: profile.name,
    level: profile.level,
    className: profile.character_class?.name ?? entry.expectedClass,
    classId,
    classIcon: await classIcon(classId, authHeaders),
    specName: entry.preferredSpec ?? profile.active_spec?.name ?? rio.active_spec_name ?? "Unbekannt",
    faction: profile.faction?.name ?? rio.faction ?? null,
    itemLevel: profile.equipped_item_level ?? null,
    profileUrl: rio.profile_url ?? null,
    armoryUrl: `https://worldofwarcraft.blizzard.com/de-de/character/${config.region}/${config.realm}/${slug}`,
    featured: Boolean(entry.featured),
    featuredRank: entry.rank ?? null,
    media: { avatar: asset(media, "avatar"), inset: asset(media, "inset"), render: asset(media, "main-raw") },
    equipment: equippedItems,
    talentGroups: talentGroups(specializations),
    selectedTalents: selectedTalents(rio.talentLoadout),
    talentImportCode: rio.talentLoadout?.loadout_text ?? talentImportCode(specializations),
    wowheadTalentUrl: entry.wowheadTalentUrl ?? "https://www.wowhead.com/talent-calc",
    gear: rio.gear ?? null,
    scores,
    mythicPlusRanks: rio.mythic_plus_ranks ?? {},
    bestRuns: (rio.mythic_plus_best_runs ?? []).sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0)).slice(0, 8).map(mapRun),
    recentRuns: (weeklyRio?.mythic_plus_recent_runs ?? []).map(mapRun),
    weeklyHighestRuns: (weeklyRio?.mythic_plus_weekly_highest_level_runs ?? []).map(mapRun),
    weeklyRunsAvailable: Boolean(weeklyRio),
    raids,
    raidEncounters: raidEncounters(encounterData, encounterDetails),
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
    const identity = key === "specName" ? `${character.className}::${label}` : label;
    const old = totals.get(identity) ?? { score: 0, label, className: character.className, character: character.name };
    old.score += value;
    totals.set(identity, old);
  }
  const sum = [...totals.values()].reduce((total, item) => total + item.score, 0);
  return [...totals.values()]
    .map(item => ({ ...item, score: Math.round(item.score), percent: sum ? Number((item.score / sum * 100).toFixed(1)) : 0 }))
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

// Keep archive raids bound to their actual season. Raider.IO may expose aggregate
// or adjacent-season raid slugs in the current payload, so archive data is normalized here.
seasons["season-mn-2"] ??= { bestMythicPlus: null, raids: {}, highlights: [] };
const venomousAbyss = seasons["season-mn-2"].raids?.["the-venomous-abyss"] ?? {
  raid: "The Venomous Abyss", summary: "0/8 M", normalKilled: 0, heroicKilled: 0, mythicKilled: 0, totalBosses: 8, character: "Bufferrari"
};
seasons["season-mn-2"].raids = {
  "the-venomous-abyss": { ...venomousAbyss, raid: "The Venomous Abyss" }
};

seasons["season-mn-1"] ??= { bestMythicPlus: null, raids: {}, highlights: [] };
seasons["season-mn-1"].raids = {
  "the-voidspire": { raid: "The Voidspire", summary: "6/6 M", normalKilled: 6, heroicKilled: 6, mythicKilled: 6, totalBosses: 6, character: "Bufferrari" },
  "the-dreamrift": { raid: "The Dreamrift", summary: "1/1 M", normalKilled: 1, heroicKilled: 1, mythicKilled: 1, totalBosses: 1, character: "Bufferrari" },
  "march-on-queldanas": { raid: "March on Quel'Danas", summary: "2/2 M", normalKilled: 2, heroicKilled: 2, mythicKilled: 2, totalBosses: 2, character: "Bufferrari" }
};

seasons["season-tww-3"] ??= { bestMythicPlus: null, raids: {}, highlights: [] };
seasons["season-tww-3"].highlights ??= [];
if (!seasons["season-tww-3"].highlights.some(highlight => highlight.achievement === "Cutting Edge: Dimensius, the All-Devouring")) {
  seasons["season-tww-3"].highlights.push({ achievement: "Cutting Edge: Dimensius, the All-Devouring", character: "Waterpoof" });
}
seasons["season-tww-3"].raids ??= {};
seasons["season-tww-3"].raids["manaforge-omega"] ??= {
  raid: "Manaforge Omega", summary: "8/8 M", normalKilled: 8, heroicKilled: 8, mythicKilled: 8, totalBosses: 8, character: "Waterpoof"
};

seasons["season-mn-1"] ??= { bestMythicPlus: null, raids: {}, highlights: [] };
seasons["season-mn-1"].highlights ??= [];
for (const trophy of config.trophies.filter(entry => entry.season === "Midnight Season 1")) {
  if (!seasons["season-mn-1"].highlights.some(highlight => highlight.achievement === trophy.achievement)) {
    seasons["season-mn-1"].highlights.push({ achievement: trophy.achievement, character: trophy.character });
  }
}

const { resetAt, nextResetAt } = weeklyResetWindow();
const featuredMain = characters.filter(character => character.featured).sort((a, b) => a.featuredRank - b.featuredRank)[0] ?? characters[0];
const resetKey = resetAt.toISOString();
const runCandidates = [...(featuredMain?.recentRuns ?? []), ...(featuredMain?.weeklyHighestRuns ?? [])]
  .filter((run, index, all) => all.findIndex(candidate => (candidate.url && candidate.url === run.url) || (!candidate.url && candidate.dungeon === run.dungeon && candidate.level === run.level && candidate.completedAt === run.completedAt)) === index)
  .filter(run => !run.completedAt || new Date(run.completedAt) >= resetAt)
  .sort((a, b) => Number(b.level ?? 0) - Number(a.level ?? 0) || Number(b.score ?? 0) - Number(a.score ?? 0));
const timedDungeonNames = new Set(runCandidates.filter(run => Number(run.upgrades ?? 0) > 0).map(run => run.shortName ?? run.dungeon));

const raidIdentity = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").replace(/^the/, "");
function raidKillSnapshot(character) {
  const snapshot = {};
  for (const raid of character?.raidEncounters ?? []) {
    snapshot[raid.name] = {};
    for (const mode of raid.modes ?? []) {
      snapshot[raid.name][mode.difficulty] = Object.fromEntries((mode.bosses ?? []).map(boss => [boss.name, Number(boss.kills ?? 0)]));
    }
  }
  for (const raid of character?.raids ?? []) {
    if (snapshot[raid.slug]) continue;
    snapshot[raid.slug] = {
      Normal: { "__progress": Number(raid.normalKilled ?? 0) },
      Heroic: { "__progress": Number(raid.heroicKilled ?? 0) },
      Mythic: { "__progress": Number(raid.mythicKilled ?? 0) }
    };
  }
  return snapshot;
}
const currentRaidSnapshot = raidKillSnapshot(featuredMain);
const currentBossDetails = new Map((featuredMain?.raidEncounters ?? []).flatMap(raid => (raid.modes ?? []).flatMap(mode => (mode.bosses ?? []).map(boss => [boss.name, boss]))));
const previousWeek = previous.weeklyProgress;
const raidBaseline = structuredClone(previousWeek?.resetKey === resetKey ? (previousWeek.raidBaseline ?? {}) : {});
for (const [raidName, modes] of Object.entries(currentRaidSnapshot)) raidBaseline[raidName] ??= structuredClone(modes);
const weeklyRaidBosses = [];
for (const configuredName of config.activeRaidPatch?.raids ?? []) {
  const candidates = Object.entries(currentRaidSnapshot).filter(([raidName]) => raidIdentity(raidName) === raidIdentity(configuredName));
  if (!candidates.length) continue;
  const detailed = candidates.find(([, modes]) => Object.values(modes).some(bosses => Object.keys(bosses).some(name => name !== "__progress")));
  const [detailedName, detailedModes] = detailed ?? candidates[0];
  const difficulties = {};
  const bosses = new Map();

  for (const [difficulty, currentBosses] of Object.entries(detailedModes)) {
    let total = 0;
    for (const [bossName, kills] of Object.entries(currentBosses)) {
      if (bossName === "__progress") continue;
      const weeklyKills = Math.max(0, Number(kills) - Number(raidBaseline?.[detailedName]?.[difficulty]?.[bossName] ?? kills));
      total += weeklyKills;
      const detail = currentBossDetails.get(bossName);
      const boss = bosses.get(bossName) ?? { id: detail?.id ?? null, name: bossName, image: detail?.image ?? null, difficulties: {} };
      boss.difficulties[difficulty] = weeklyKills;
      bosses.set(bossName, boss);
    }
    difficulties[difficulty] = total;
  }

  // Raider.IO supplies the reliable weekly total while Blizzard supplies the boss names.
  // Merge the aggregate fallback without creating a second visual raid entry.
  for (const [raidName, modes] of candidates) {
    if (raidName === detailedName) continue;
    for (const [difficulty, currentBosses] of Object.entries(modes)) {
      const aggregate = Object.entries(currentBosses).reduce((sum, [bossName, kills]) => sum + Math.max(0, Number(kills) - Number(raidBaseline?.[raidName]?.[difficulty]?.[bossName] ?? kills)), 0);
      difficulties[difficulty] = Math.max(Number(difficulties[difficulty] ?? 0), aggregate);
      const assigned = [...bosses.values()].reduce((sum, boss) => sum + Number(boss.difficulties?.[difficulty] ?? 0), 0);
      const missing = Math.max(0, aggregate - assigned);
      if (missing > 0) {
        const killedBosses = Object.entries(detailedModes[difficulty] ?? {}).filter(([, kills]) => Number(kills) > 0).map(([bossName]) => bosses.get(bossName)).filter(Boolean);
        for (const boss of killedBosses.slice(0, missing)) boss.difficulties[difficulty] = Math.max(1, Number(boss.difficulties[difficulty] ?? 0));
      }
    }
  }

  weeklyRaidBosses.push({ raid: configuredName, difficulties, bosses: [...bosses.values()] });
}
const weeklyProgress = {
  resetKey,
  resetAt: resetAt.toISOString(),
  nextResetAt: nextResetAt.toISOString(),
  character: featuredMain?.name ?? null,
  available: Boolean(featuredMain?.weeklyRunsAvailable),
  bestKeys: runCandidates.slice(0, 5),
  highestKey: Math.max(0, ...runCandidates.map(run => Number(run.level ?? 0))),
  timedDungeons: timedDungeonNames.size,
  raidBosses: weeklyRaidBosses,
  raidBaseline
};

const output = {
  generatedAt: new Date().toISOString(),
  region: config.region,
  realm: config.realm,
  maxLevel: config.maxLevel,
  activeRaidPatch: config.activeRaidPatch,
  activeSeasonKey: currentSeason,
  apiStatus: {
    blizzard: { online: true },
    raiderIO: { online: characters.length > 0 },
    nextUpdateAt: new Date(Math.ceil(Date.now() / (60 * 60 * 1000)) * 60 * 60 * 1000).toISOString()
  },
  weeklyProgress,
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
