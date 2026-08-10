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
const maxCount=roster.filter(character=>character.level>=data.maxLevel).length;
const highestScoreCharacter=[...roster].sort((a,b)=>currentScore(b)-currentScore(a))[0];
const mainCharacter=byName(data.featured?.primary?.[0]||"Bufferrari")||roster[0];
const identity=character=>`<span class="metric-identity" style="--class:${color(character)}">${character?.classIcon?`<img src="${esc(character.classIcon)}" alt="">`:""}<b>${esc(character?.name||"–")}</b></span>`;
document.querySelector("#summary").innerHTML=`
  <article class="metric focus"><span>Aktueller Main</span>${identity(mainCharacter)}<small>${esc(mainCharacter?.className)} · ${esc(mainCharacter?.specName)}</small></article>
  <article class="metric focus"><span>Höchster M+-Score</span>${identity(highestScoreCharacter)}<small>${formatNumber(currentScore(highestScoreCharacter))} Punkte · ${esc(highestScoreCharacter?.className)}</small></article>
  <article class="metric focus"><span>Charaktere auf Maximalstufe</span><strong>${maxCount}</strong><small>von ${roster.length} Charakteren auf Stufe ${esc(data.maxLevel)}</small></article>`;

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

document.querySelector("#trophies").innerHTML=(data.trophies||[]).map((trophy,index)=>{const character=byName(trophy.character);return `<article class="trophy" style="--class:${color(character)}"><div class="trophy-cup"><span>★</span></div><p>Cutting Edge</p><h3>${esc(trophy.achievement?.replace(/^Cutting Edge:\s*/,""))}</h3><div class="trophy-owner">${character?.classIcon?`<img src="${esc(character.classIcon)}" alt="">`:""}<strong>${esc(trophy.character||"–")}</strong></div><small>${esc(trophy.season)} · Patch ${esc(trophy.patch||"–")}</small><i>${String(index+1).padStart(2,"0")}</i></article>`}).join("");

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
  return character.bestRuns.slice(0,3).map(run=>`<a class="run-row" href="${esc(run.url||character.profileUrl||character.armoryUrl)}" target="_blank" rel="noreferrer"><span><b>+${esc(run.level??"–")}</b> ${esc(run.shortName||run.dungeon)}</span><strong>${formatNumber(run.score)} · ${formatTime(run.clearTimeMs)}</strong></a>`).join("");
}

function equipmentBlock(character){
  if(!character.equipment?.length)return `<p class="empty">Ausrüstung erscheint nach der nächsten automatischen API-Aktualisierung.</p>`;
  return character.equipment.map(item=>`<a class="equipment-item" href="${esc(item.wowheadUrl||character.armoryUrl)}" target="_blank" rel="noreferrer" title="${esc(item.slot)}: ${esc(item.name)}">
    ${item.icon?`<img src="${esc(item.icon)}" alt="" loading="lazy">`:`<span class="item-placeholder"></span>`}
    <div><small>${esc(item.slot)}</small><strong>${esc(item.name)}</strong><em>iLvl ${esc(item.itemLevel??"–")}</em></div>
  </a>`).join("");
}

function talentBlock(character){
  const groups=character.talentGroups||{};
  const definitions=[["hero","Hero-Talente"],["specialization","Spezialisierungsbaum"],["class","Klassenbaum"],["other","Weitere gewählte Talente"]];
  const available=definitions.filter(([key])=>groups[key]?.length);
  const importCode=character.talentImportCode;
  if(character.talentImage)return `<div class="talent-window"><img src="${esc(character.talentImage)}" alt="Talentbaum von ${esc(character.name)}" loading="lazy"></div>${importCode?`<div class="import-code"><code>${esc(importCode)}</code><button type="button" data-copy-code="${esc(importCode)}">Code kopieren</button></div>`:`<p class="empty">Talent-Importcode wird eingeblendet, sobald Blizzard ihn über die API liefert.</p>`}`;
  if(!available.length)return `<a class="build-link" href="${esc(character.armoryUrl)}" target="_blank" rel="noreferrer">Build im Arsenal öffnen ↗</a>`;
  return `<details class="talent-details"><summary>Gewählte Talente anzeigen</summary><div class="talent-trees">${available.map(([key,label])=>`<div class="talent-tree"><h5>${label}</h5>${groups[key].map(talent=>`<span><i></i>${esc(talent.name)}${talent.rank>1?` <b>${talent.rank}</b>`:""}</span>`).join("")}</div>`).join("")}</div></details>${importCode?`<div class="import-code"><code>${esc(importCode)}</code><button type="button" data-copy-code="${esc(importCode)}">Code kopieren</button></div>`:""}`;
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

function bars(items,{absolute=false}={}){
  const visible=(items||[]).filter(item=>absolute?item.score>0:item.percent>0);
  return visible.length?visible.map(item=>`<div class="bar-row"><span>${esc(item.label)}</span><div class="bar"><i style="width:${absolute?Math.max(2,item.percent):Math.max(2,item.percent)}%"></i></div><b>${absolute?formatNumber(item.score):`${esc(item.percent)}%`}</b></div>`).join(""):`<div class="empty">Noch keine M+-Daten.</div>`;
}
document.querySelector("#class-shares").innerHTML=bars(data.mythicPlus?.classShares);
document.querySelector("#spec-shares").innerHTML=bars(data.mythicPlus?.specShares);
const scoreTotal=roster.reduce((sum,character)=>sum+currentScore(character),0);
const characterScores=roster.map(character=>({label:character.name,score:currentScore(character),percent:scoreTotal?currentScore(character)/scoreTotal*100:0})).sort((a,b)=>b.score-a.score);
document.querySelector("#character-scores").innerHTML=bars(characterScores,{absolute:true});

const otherCharacters=roster.filter(character=>!ranked.includes(character));
document.querySelector("#characters").innerHTML=otherCharacters.map(character=>`<a class="character ${character.level>=data.maxLevel?"max":""}" style="--class:${color(character)}" href="${esc(character.armoryUrl||character.profileUrl)}" target="_blank" rel="noreferrer">
  ${character.media?.avatar?`<img src="${esc(character.media.avatar)}" alt="" loading="lazy">`:""}<div><h3>${esc(character.name)}</h3><p>${esc(character.className)} · ${esc(character.specName)}</p><div class="level">Stufe ${esc(character.level)} · iLvl ${esc(character.itemLevel??"–")} · M+ ${formatNumber(currentScore(character))}</div></div><span class="open-link">↗</span>
</a>`).join("");

const seasons=Object.entries(data.seasons||{}).reverse();
const raidBadges=raid=>`<div class="raid-badges"><span class="normal">N <b>${esc(raid.normalKilled??0)}/${esc(raid.totalBosses??0)}</b></span><span class="heroic">H <b>${esc(raid.heroicKilled??0)}/${esc(raid.totalBosses??0)}</b></span><span class="mythic">M <b>${esc(raid.mythicKilled??0)}/${esc(raid.totalBosses??0)}</b></span></div>`;
document.querySelector("#seasons").innerHTML=seasons.length?seasons.map(([name,season])=>{const best=season.bestMythicPlus;const raids=Object.values(season.raids||{}).sort((a,b)=>(b.mythicKilled-a.mythicKilled)||(b.heroicKilled-a.heroicKilled)||(b.normalKilled-a.normalKilled));const bestRaid=raids[0];const scoreCharacter=byName(best?.character);const raidCharacter=byName(bestRaid?.character);return `<article class="season"><p class="eyebrow">${esc(name.replace("season-","").toUpperCase())}</p><div class="archive-person" style="--class:${color(scoreCharacter)}">${scoreCharacter?.classIcon?`<img src="${esc(scoreCharacter.classIcon)}" alt="">`:""}<div><small>Bester M+-Score</small><strong>${esc(best?.character||"–")}</strong><span>${esc(best?.score??"–")} Punkte</span></div></div><div class="archive-person" style="--class:${color(raidCharacter)}">${raidCharacter?.classIcon?`<img src="${esc(raidCharacter.classIcon)}" alt="">`:""}<div><small>Höchster Raidfortschritt</small><strong>${esc(bestRaid?.character||"–")}</strong><span>${esc(bestRaid?.raid||"Kein Raid gespeichert")}</span></div></div>${bestRaid?raidBadges(bestRaid):""}${(season.highlights||[]).map(highlight=>`<div class="archive-highlight"><span class="ce">CE</span><strong>${esc(highlight.achievement)}</strong><small>${esc(highlight.character)}</small></div>`).join("")}</article>`}).join(""):`<article class="notice">Saisonwerte erscheinen nach der ersten Aktualisierung.</article>`;
if(data.errors?.length){document.querySelector("#errors-section").hidden=false;document.querySelector("#errors").innerHTML=data.errors.map(error=>`<div><strong>${esc(error.character)}:</strong> ${esc(error.message)}</div>`).join("")}

document.addEventListener("click",async event=>{const button=event.target.closest("[data-copy-code]");if(!button)return;try{await navigator.clipboard.writeText(button.dataset.copyCode);const old=button.textContent;button.textContent="Kopiert";setTimeout(()=>button.textContent=old,1400)}catch{button.textContent="Kopieren nicht möglich"}});
