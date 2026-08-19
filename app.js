const classColors={"Death Knight":"#c41e3a",Todesritter:"#c41e3a","Demon Hunter":"#a330c9","Dämonenjäger":"#a330c9",Druid:"#ff7c0a",Druide:"#ff7c0a",Evoker:"#33937f",Rufer:"#33937f",Hunter:"#aad372","Jäger":"#aad372",Mage:"#3fc7eb",Magier:"#3fc7eb",Monk:"#00ff98","Mönch":"#00ff98",Paladin:"#f48cba",Priest:"#fff",Priester:"#fff",Rogue:"#fff468",Schurke:"#fff468",Shaman:"#0070dd",Schamane:"#0070dd",Warlock:"#8788ee",Hexenmeister:"#8788ee",Warrior:"#c69b6d",Krieger:"#c69b6d"};
const medals={1:["GOLD","🥇"],2:["SILBER","🥈"],3:["BRONZE","🥉"]};
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const data=await fetch("data/dashboard.json",{cache:"no-store"}).then(r=>r.json());
const roster=data.characters?.length?data.characters:[];
const byName=name=>roster.find(character=>character.name===name);
const currentScore=character=>Number((character?.scores?.find(score=>score.season==="current")??character?.scores?.[0])?.scores?.all??0);
const color=character=>classColors[character?.className]||"#8795aa";
const formatNumber=value=>new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(Number(value||0));
const formatTime=ms=>ms?`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,"0")} min`:"–";
const live=Boolean(data.generatedAt);

document.querySelector("#updated").textContent=live?`Stand ${new Intl.DateTimeFormat("de-DE",{dateStyle:"medium",timeStyle:"short"}).format(new Date(data.generatedAt))}`:"Live-Daten noch nicht geladen";
const mainCharacter=byName(data.featured?.primary?.[0]||"Bufferrari")||roster[0];
const primary=(data.featured?.primary||["Bufferrari","Liezen"]).map(byName).filter(Boolean);
const ranked=[...roster].sort((a,b)=>currentScore(b)-currentScore(a)).slice(0,3);

document.querySelector("#podium").innerHTML=ranked.map((character,index)=>{
  const rank=index+1;
  const [label,icon]=medals[rank];
  const image=character.classIcon;
  return `<article class="podium-card rank-${rank}" style="--class:${color(character)}">
    <div class="medal"><span>${icon}</span>${label}</div>
    <div class="crest-stage">${image?`<img src="${esc(image)}" alt="${esc(character.className)}-Wappen" loading="lazy">`:`<div class="portrait-fallback">${esc(character.className?.[0])}</div>`}</div>
    <div class="podium-copy"><h3>${esc(character.name)}</h3><p>${esc(character.className)} · ${esc(character.specName)}</p><div><strong>${formatNumber(currentScore(character))}</strong> M+</div></div>
  </article>`;
}).join("");

const trophySeasonOrder={"Midnight Season 2":300,"Midnight Season 1":200,"TWW Season 3":100,"The War Within Season 3":100};
const sortedTrophies=(data.trophies||[]).map((trophy,index)=>({...trophy,sourceIndex:index})).sort((a,b)=>(trophySeasonOrder[b.season]??0)-(trophySeasonOrder[a.season]??0)||a.sourceIndex-b.sourceIndex);
document.querySelector("#trophies").innerHTML=sortedTrophies.map((trophy,index)=>{const character=byName(trophy.character);return `<article class="trophy" style="--class:${color(character)}"><div class="trophy-cup"><span>★</span></div><p>Cutting Edge</p><h3>${esc(trophy.achievement?.replace(/^Cutting Edge:\s*/,""))}</h3><div class="trophy-owner">${character?.classIcon?`<img src="${esc(character.classIcon)}" alt="">`:""}<strong>${esc(trophy.character||"–")}</strong></div><small>${esc(trophy.season)} · Patch ${esc(trophy.patch||"–")}</small><i>${String(index+1).padStart(2,"0")}</i></article>`}).join("");

function raidBlock(character){
  const wanted=data.activeRaidPatch?.raids||[];
  const encounterRaids=character.raidEncounters||[];
  return wanted.map(name=>{
    const raid=encounterRaids.find(entry=>entry.name.toLowerCase().includes(name.toLowerCase().replace(/^the\s+/,""))||name.toLowerCase().includes(entry.name.toLowerCase().replace(/^the\s+/,"")));
    const modes=raid?.modes||[];
    const value=difficulty=>{const mode=modes.find(entry=>entry.difficulty.toLowerCase().startsWith(difficulty));return mode?`${mode.completed}/${mode.total}`:"–"};
    return `<div class="raid-progress"><strong>${esc(name)}</strong><div><span class="normal">N <b>${value("normal")}</b></span><span class="heroic">H <b>${value("heroic")}</b></span><span class="mythic">M <b>${value("mythic")}</b></span></div></div>`;
  }).join("")||`<p class="empty">Noch kein aktueller Raidfortschritt verfügbar.</p>`;
}

function runBlock(character){
  if(!character.bestRuns?.length)return `<p class="empty">Beste Runs erscheinen nach der nächsten Datenaktualisierung.</p>`;
  return [...character.bestRuns].sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,8).map((run,index)=>`<a class="run-row" href="${esc(run.url||character.profileUrl||character.armoryUrl)}" target="_blank" rel="noreferrer"><span><i>${index+1}</i><b>+${esc(run.level??"–")}</b> ${esc(run.shortName||run.dungeon)}</span><strong>${formatNumber(run.score)} · ${formatTime(run.clearTimeMs)}</strong></a>`).join("");
}

function renderCurrentProgress(character){
  const seasonLabel=data.activeRaidPatch?.season||"Aktuelle Season";
  const patch=data.activeRaidPatch?.patch||"–";
  const wantedRaids=data.activeRaidPatch?.raids||[];
  const raids=wantedRaids.map(name=>{
    const wanted=name.toLowerCase().replace(/^the\s+/,"").replace(/[^a-z0-9]+/g,"-");
    const raid=(character?.raids||[]).find(entry=>entry.slug===wanted||entry.slug?.includes(wanted)||wanted.includes(entry.slug));
    return {name,raid};
  });
  const raidMarkup=raids.map(({name,raid})=>`<article class="live-raid"><div><span>AKTUELLER RAID</span><strong>${esc(name)}</strong><small>${esc(character?.name||"–")}</small></div><div class="live-difficulties"><span class="normal">N <b>${esc(raid?.normalKilled??0)}/${esc(raid?.totalBosses??"–")}</b></span><span class="heroic">H <b>${esc(raid?.heroicKilled??0)}/${esc(raid?.totalBosses??"–")}</b></span><span class="mythic">M <b>${esc(raid?.mythicKilled??0)}/${esc(raid?.totalBosses??"–")}</b></span></div></article>`).join("");
  const runs=[...(character?.bestRuns||[])].sort((a,b)=>Number(b.score||0)-Number(a.score||0)).slice(0,3);
  const runsMarkup=runs.length?runs.map((run,index)=>`<a href="${esc(run.url||character.profileUrl)}" target="_blank" rel="noreferrer"><i>${index+1}</i><span><b>+${esc(run.level??"–")} ${esc(run.shortName||run.dungeon)}</b><small>${formatNumber(run.score)} Punkte · ${formatTime(run.clearTimeMs)}</small></span></a>`).join(""):`<p class="empty">Die aktuellen M+-Runs werden automatisch ergänzt.</p>`;
  document.querySelector("#current-progress").innerHTML=`<article class="current-progress-card" style="--class:${color(character)}"><div class="live-glow"></div><header><div><p class="eyebrow"><span class="live-dot"></span> AKTUELLE SEASON</p><h2>${esc(seasonLabel)}</h2><p>Raid- und Mythic+-Fortschritt · automatisch aktualisiert</p><div class="current-main-name">${character?.classIcon?`<img src="${esc(character.classIcon)}" alt="">`:""}<span><small>AKTUELLER MAIN</small><strong>${esc(character?.name||"–")}</strong></span></div></div><strong class="patch-badge">PATCH ${esc(patch)}</strong></header><div class="current-progress-grid"><div class="live-score"><span>MYTHIC+ SCORE</span><strong>${formatNumber(currentScore(character))}</strong><small>Aktueller Season-Wert</small></div><div class="live-raids">${raidMarkup}</div><div class="live-runs"><h3>Beste aktuelle Runs</h3>${runsMarkup}</div></div></article>`;
}
renderCurrentProgress(mainCharacter);

function equipmentBlock(character){
  if(!character.equipment?.length)return `<p class="empty">Ausrüstung erscheint nach der nächsten automatischen API-Aktualisierung.</p>`;
  return character.equipment.map(item=>`<a class="equipment-item" href="${esc(item.wowheadUrl||character.armoryUrl)}" target="_blank" rel="noreferrer" title="${esc(item.slot)}: ${esc(item.name)}">
    ${item.icon?`<img src="${esc(item.icon)}" alt="" loading="lazy">`:`<span class="item-placeholder"></span>`}
    <div><small>${esc(item.slot)}</small><strong>${esc(item.name)}</strong><em>iLvl ${esc(item.itemLevel??"–")}</em></div>
  </a>`).join("");
}

function talentBlock(character){
  const selected=character.selectedTalents||[];
  const importCode=character.talentImportCode;
  const calculator=character.wowheadTalentUrl||"https://www.wowhead.com/talent-calc";
  const groups=[["Hero-Talente",selected.filter(talent=>talent.hero)],["Klassen- & Spezialisierungstalente",selected.filter(talent=>!talent.hero)]];
  const preview=selected.length?`<div class="talent-loadout"><div class="loadout-head"><div><span>RAIDER.IO LOADOUT</span><b>${esc(character.className)} · ${esc(character.specName)}</b></div><a href="${esc(calculator)}" target="_blank" rel="noreferrer">Auf Wowhead öffnen ↗</a></div><div class="loadout-groups">${groups.filter(([,talents])=>talents.length).map(([label,talents])=>`<section class="loadout-group"><h5>${label}</h5><div class="talent-icon-grid">${talents.sort((a,b)=>(b.row-a.row)||(a.column-b.column)).map(talent=>`<span class="selected-talent ${talent.important?"important":""}" title="${esc(talent.name)}${talent.rank>1?` · Rang ${talent.rank}`:""}">${talent.icon?`<img src="${esc(talent.icon)}" alt="${esc(talent.name)}" loading="lazy">`:`<i></i>`}${talent.rank>1?`<b>${talent.rank}</b>`:""}</span>`).join("")}</div></section>`).join("")}</div></div>`:`<a class="build-link" href="${esc(calculator)}" target="_blank" rel="noreferrer">Wowhead Talent Calculator öffnen ↗</a>`;
  return `${preview}${importCode?`<div class="import-code"><code>${esc(importCode)}</code><button type="button" data-copy-code="${esc(importCode)}">Code kopieren</button></div>`:`<p class="empty">Talent-Importcode wird bei der nächsten Blizzard-Aktualisierung ergänzt.</p>`}`;
}

document.querySelector("#featured").innerHTML=primary.map((character,index)=>{
  const render=character.media?.render||character.media?.inset;
  const role=index===0?"main":"secondary";
  return `<article class="featured-card ${role}" style="--class:${color(character)}">
    <div class="featured-visual">${render?`<img src="${esc(render)}" alt="${esc(character.name)}" loading="lazy">`:""}<div class="visual-shade"></div><div class="featured-title"><p class="eyebrow">${index===0?"MAIN CHARACTER":"SPLIT-CHARACTER"}</p><h3>${esc(character.name)}</h3><p>${esc(character.className)} · ${esc(character.specName)}</p></div><span class="role-badge">${index===0?"MAIN":"SPLIT"}</span></div>
    <div class="featured-content">
      <div class="stat-strip"><div><strong>${formatNumber(currentScore(character))}</strong><span>M+-Score</span></div><div><strong>${esc(character.itemLevel??"–")}</strong><span>Itemlevel</span></div><div><strong>${esc(character.level)}</strong><span>Stufe</span></div></div>
      <div><h4>Talent-Build</h4>${talentBlock(character)}</div>
      <div class="raid-section"><h4>Raidfortschritt · Patch ${esc(data.activeRaidPatch?.patch||"12.0")}</h4>${raidBlock(character)}</div>
      <div><h4>Beste Mythic+-Runs</h4>${runBlock(character)}</div>
      <div><h4>Ausrüstung</h4><div class="equipment-grid">${equipmentBlock(character)}</div></div>
      <div class="profile-links"><a href="${esc(character.armoryUrl)}" target="_blank" rel="noreferrer">World of Warcraft Arsenal ↗</a><a href="${esc(character.profileUrl||character.armoryUrl)}" target="_blank" rel="noreferrer">Raider.IO ↗</a></div>
    </div>
  </article>`;
}).join("");

function pie(items,{absolute=false}={}){
  const visible=(items||[]).filter(item=>absolute?item.score>0:item.percent>0);
  if(!visible.length)return `<div class="empty">Noch keine M+-Daten.</div>`;
  let offset=0;
  const enriched=visible.map((item,index)=>{
    const character=byName(item.character)||roster.find(entry=>entry.className===item.className)||roster.find(entry=>entry.specName===item.label)||byName(item.label);
    const percent=Number(item.percent||0);
    const segment={...item,character,percent,start:offset,end:offset+percent,segmentColor:color(character)||["#ffbd3d","#5ed9ed","#b06cff"][index%3]};
    offset+=percent;
    return segment;
  });
  const gradient=enriched.map(item=>`${item.segmentColor} ${item.start}% ${item.end}%`).join(",");
  return `<div class="pie-layout"><div class="pie-chart" style="background:conic-gradient(${gradient})"><div><strong>${absolute?formatNumber(visible.reduce((sum,item)=>sum+Number(item.score||0),0)):"100%"}</strong><span>${absolute?"Gesamt-Score":"Anteile"}</span></div></div><div class="pie-legend">${enriched.map(item=>`<div style="--slice:${item.segmentColor}">${item.character?.classIcon?`<img src="${esc(item.character.classIcon)}" alt="${esc(item.character.className)}">`:`<i></i>`}<span><b>${esc(item.label)}</b>${item.className&&item.className!==item.label?`<small>${esc(item.className)}</small>`:""}</span><strong>${absolute?formatNumber(item.score):`${esc(item.percent)}%`}</strong></div>`).join("")}</div></div>`;
}
document.querySelector("#class-shares").innerHTML=pie(data.mythicPlus?.classShares);
document.querySelector("#spec-shares").innerHTML=pie(data.mythicPlus?.specShares);
const scoreTotal=roster.reduce((sum,character)=>sum+currentScore(character),0);
const characterScores=roster.map(character=>({label:character.name,character:character.name,className:character.className,score:currentScore(character),percent:scoreTotal?currentScore(character)/scoreTotal*100:0})).sort((a,b)=>b.score-a.score);
document.querySelector("#character-scores").innerHTML=pie(characterScores,{absolute:true});

const otherCharacters=roster.filter(character=>!ranked.includes(character));
document.querySelector("#characters").innerHTML=otherCharacters.map(character=>`<a class="character ${character.level>=data.maxLevel?"max":""}" style="--class:${color(character)}" href="${esc(character.armoryUrl||character.profileUrl)}" target="_blank" rel="noreferrer">
  ${character.media?.avatar?`<img src="${esc(character.media.avatar)}" alt="" loading="lazy">`:""}<div><h3>${esc(character.name)}</h3><p>${esc(character.className)} · ${esc(character.specName)}</p><div class="level">Stufe ${esc(character.level)} · iLvl ${esc(character.itemLevel??"–")} · M+ ${formatNumber(currentScore(character))}</div></div><span class="open-link">↗</span>
</a>`).join("");

const seasonMeta={
  "season-mn-2":{label:"Midnight Season 2",order:300},
  "season-mn-1":{label:"Midnight Season 1",order:200},
  "season-tww-3":{label:"The War Within Season 3",order:100}
};
const activeSeasonKey=data.activeSeasonKey||({"Midnight Season 2":"season-mn-2","Midnight Season 1":"season-mn-1","The War Within Season 3":"season-tww-3","TWW Season 3":"season-tww-3"}[data.activeRaidPatch?.season]);
const seasons=Object.entries(data.seasons||{}).filter(([name])=>name!==activeSeasonKey).sort(([a],[b])=>(seasonMeta[b]?.order??0)-(seasonMeta[a]?.order??0));
const raidBadges=raid=>`<div class="raid-badges"><span class="normal">N <b>${esc(raid.normalKilled??0)}/${esc(raid.totalBosses??0)}</b></span><span class="heroic">H <b>${esc(raid.heroicKilled??0)}/${esc(raid.totalBosses??0)}</b></span><span class="mythic">M <b>${esc(raid.mythicKilled??0)}/${esc(raid.totalBosses??0)}</b></span></div>`;
document.querySelector("#seasons").innerHTML=seasons.length?seasons.map(([name,season])=>{
  const best=season.bestMythicPlus;
  const raids=Object.values(season.raids||{});
  const scoreCharacter=byName(best?.character);
  return `<article class="season">
    <p class="eyebrow">${esc(seasonMeta[name]?.label||name.replace("season-","").toUpperCase())}</p>
    <div class="archive-person" style="--class:${color(scoreCharacter)}">${scoreCharacter?.classIcon?`<img src="${esc(scoreCharacter.classIcon)}" alt="">`:""}<div><small>Bester M+-Score</small><strong>${esc(best?.character||"–")}</strong><span>${esc(best?.score??"–")} Punkte</span></div></div>
    <div class="archive-raids">${raids.map(raid=>{const raidCharacter=byName(raid.character);return `<section class="archive-raid" style="--class:${color(raidCharacter)}"><div class="archive-raid-head">${raidCharacter?.classIcon?`<img src="${esc(raidCharacter.classIcon)}" alt="">`:""}<div><small>Raidfortschritt · ${esc(raid.character||"–")}</small><strong>${esc(raid.raid||"Unbekannter Raid")}</strong></div></div>${raidBadges(raid)}</section>`}).join("")||'<p class="empty">Kein Raid gespeichert.</p>'}</div>
    ${(season.highlights||[]).map(highlight=>`<div class="archive-highlight"><span class="ce">CE</span><strong>${esc(highlight.achievement)}</strong><small>${esc(highlight.character)}</small></div>`).join("")}
  </article>`;
}).join(""):`<article class="notice">Saisonwerte erscheinen nach der ersten Aktualisierung.</article>`;

if(data.errors?.length){document.querySelector("#errors-section").hidden=false;document.querySelector("#errors").innerHTML=data.errors.map(error=>`<div><strong>${esc(error.character)}:</strong> ${esc(error.message)}</div>`).join("")}

document.addEventListener("click",async event=>{const button=event.target.closest("[data-copy-code]");if(!button)return;try{await navigator.clipboard.writeText(button.dataset.copyCode);const old=button.textContent;button.textContent="Kopiert";setTimeout(()=>button.textContent=old,1400)}catch{button.textContent="Kopieren nicht möglich"}});
