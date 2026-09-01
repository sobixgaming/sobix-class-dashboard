const classColors={"Death Knight":"#c41e3a",Todesritter:"#c41e3a","Demon Hunter":"#a330c9","Dämonenjäger":"#a330c9",Druid:"#ff7c0a",Druide:"#ff7c0a",Evoker:"#33937f",Rufer:"#33937f",Hunter:"#aad372","Jäger":"#aad372",Mage:"#3fc7eb",Magier:"#3fc7eb",Monk:"#00ff98","Mönch":"#00ff98",Paladin:"#f48cba",Priest:"#fff",Priester:"#fff",Rogue:"#fff468",Schurke:"#fff468",Shaman:"#0070dd",Schamane:"#0070dd",Warlock:"#8788ee",Hexenmeister:"#8788ee",Warrior:"#c69b6d",Krieger:"#c69b6d"};
const medals={1:["GOLD","🥇"],2:["SILBER","🥈"],3:["BRONZE","🥉"]};
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fallbackSvg=`data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#23334b"/><stop offset="1" stop-color="#0b111b"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#g)"/><path d="M20 45c2-9 22-9 24 0M32 31a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" fill="#91a0b7"/></svg>')}`;
document.addEventListener("error",event=>{const image=event.target;if(!(image instanceof HTMLImageElement)||image.dataset.fallback)return;image.dataset.fallback="true";image.src=fallbackSvg;image.classList.add("image-fallback")},true);

let data;
try{
  const response=await fetch(`data/dashboard.json?fresh=${Date.now()}`,{cache:"no-store",headers:{"Cache-Control":"no-cache"}});
  if(!response.ok)throw new Error(`Dashboard-Daten konnten nicht geladen werden (HTTP ${response.status}).`);
  data=await response.json();
}catch(error){
  document.body.classList.remove("loading");
  document.body.classList.add("data-failed");
  document.querySelector("#data-status").innerHTML=`<div class="status-error"><strong>Daten momentan nicht verfügbar</strong><span>${esc(error.message)}</span></div>`;
  document.querySelectorAll(".loading-state").forEach(element=>element.textContent="Daten konnten nicht geladen werden. Bitte später erneut versuchen.");
  throw error;
}
const roster=data.characters?.length?data.characters:[];
const byName=name=>roster.find(character=>character.name===name);
const currentScore=character=>Number((character?.scores?.find(score=>score.season==="current")??character?.scores?.[0])?.scores?.all??0);
const color=character=>classColors[character?.className]||"#8795aa";
const formatNumber=value=>new Intl.NumberFormat("de-DE",{maximumFractionDigits:0}).format(Number(value||0));
const formatTime=ms=>ms?`${Math.floor(ms/60000)}:${String(Math.floor(ms/1000)%60).padStart(2,"0")} min`:"–";
const formatDate=value=>value?new Intl.DateTimeFormat("de-DE",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/Berlin"}).format(new Date(value)):"–";
const live=Boolean(data.generatedAt);

function nextUpdateDate(){
  let next=new Date(data.apiStatus?.nextUpdateAt||Math.ceil(new Date(data.generatedAt).getTime()/(60*60*1000))*(60*60*1000));
  while(next<=new Date())next=new Date(next.getTime()+60*60*1000);
  return next;
}
function until(value){
  const minutes=Math.max(0,Math.ceil((value-new Date())/60000));
  if(minutes<60)return `${minutes} Min.`;
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return rest?`${hours} Std. ${rest} Min.`:`${hours} Std.`;
}
function renderDataStatus(){
  const blizzard=data.apiStatus?.blizzard?.online!==false&&live;
  const raider=data.apiStatus?.raiderIO?.online!==false&&live;
  document.querySelector("#data-status").innerHTML=`
    <div class="status-item"><span>Letzte Aktualisierung</span><strong>${formatDate(data.generatedAt)}</strong></div>
    <div class="status-item"><span>Blizzard API</span><strong class="${blizzard?"online":"offline"}"><i></i>${blizzard?"online":"nicht verfügbar"}</strong></div>
    <div class="status-item"><span>Nächstes Update</span><strong>in ${until(nextUpdateDate())}</strong></div>
    <div class="status-item"><span>Raider.IO</span><strong class="${raider?"online":"offline"}"><i></i>${raider?"online":"nicht verfügbar"}</strong></div>`;
}
renderDataStatus();
setInterval(renderDataStatus,60000);
const mainCharacter=byName(data.featured?.primary?.[0]||"Bufferrari")||roster[0];
const primary=(data.featured?.primary||["Bufferrari","Liezen"]).map(byName).filter(Boolean);
const ranked=[...roster].sort((a,b)=>currentScore(b)-currentScore(a)).slice(0,3);

document.querySelector("#podium").innerHTML=ranked.map((character,index)=>{
  const rank=index+1;
  const [label,icon]=medals[rank];
  const image=character.media?.inset||character.media?.avatar||character.media?.render||character.classIcon;
  const imageFallback=character.classIcon||fallbackSvg;
  return `<article class="podium-card rank-${rank}" style="--class:${color(character)}">
    <div class="medal"><span>${icon}</span>${label}</div>
    <div class="crest-stage">${image?`<img src="${esc(image)}" alt="${esc(character.name)} – ${esc(character.className)}" loading="lazy" onerror="this.onerror=null;this.src='${esc(imageFallback)}'">`:`<div class="portrait-fallback">${esc(character.className?.[0])}</div>`}</div>
    <div class="podium-copy"><h3>${esc(character.name)}</h3><p>${esc(character.className)} · ${esc(character.specName)}</p><div><strong>${formatNumber(currentScore(character))}</strong> M+</div></div>
  </article>`;
}).join("");

const trophySeasonOrder={"Midnight Season 2":300,"Midnight Season 1":200,"TWW Season 3":100,"The War Within Season 3":100};
const sortedTrophies=(data.trophies||[]).map((trophy,index)=>({...trophy,sourceIndex:index})).sort((a,b)=>(trophySeasonOrder[b.season]??0)-(trophySeasonOrder[a.season]??0)||a.sourceIndex-b.sourceIndex);
document.querySelector("#trophies").innerHTML=sortedTrophies.map((trophy,index)=>{const character=byName(trophy.character);const expansionClass=/midnight/i.test(trophy.season)?"expansion-midnight":"expansion-tww";return `<article class="trophy ${expansionClass}" style="--class:${color(character)}"><div class="trophy-cup"><span>★</span></div><p>Cutting Edge</p><h3>${esc(trophy.achievement?.replace(/^Cutting Edge:\s*/,""))}</h3><div class="trophy-owner">${character?.classIcon?`<img src="${esc(character.classIcon)}" alt="">`:""}<strong>${esc(trophy.character||"–")}</strong></div><small>${esc(trophy.season)} · Patch ${esc(trophy.patch||"–")}</small><i>${String(index+1).padStart(2,"0")}</i></article>`}).join("");

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
  const raidKey=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g,"").replace(/^the/,"");
  const difficultyCard=(label,short,completed,total,className)=>{
    const done=Number(completed||0),maximum=Number(total||0);
    const progress=maximum?Math.min(100,done/maximum*100):0;
    return `<div class="difficulty-progress ${className}" style="--progress:${progress}%"><i>${short}</i><div><span>${label}</span><strong>${esc(done)} / ${esc(maximum||"–")} <small>Bosse</small></strong></div><em></em></div>`;
  };
  const raidMarkup=raids.map(({name,raid})=>`<article class="live-raid"><div><span>AKTUELLER RAID</span><strong>${esc(name)}</strong><small>${esc(character?.name||"–")}</small></div><div class="difficulty-grid">${difficultyCard("Normal","N",raid?.normalKilled,raid?.totalBosses,"normal")}${difficultyCard("Heroisch","H",raid?.heroicKilled,raid?.totalBosses,"heroic")}${difficultyCard("Mythisch","M",raid?.mythicKilled,raid?.totalBosses,"mythic")}</div></article>`).join("");
  const weekly=data.weeklyProgress;
  const weeklyKeys=weekly?.bestKeys||[];
  const runsMarkup=weeklyKeys.length?weeklyKeys.slice(0,5).map((run,index)=>`<a href="${esc(run.url||character?.profileUrl||"#")}" target="_blank" rel="noreferrer"><i>${index+1}</i><span><b>+${esc(run.level??"–")} ${esc(run.shortName||run.dungeon)}</b><small>${formatNumber(run.score)} Punkte · ${formatTime(run.clearTimeMs)}</small></span></a>`).join(""):`<p class="empty">${weekly?.available?"Diese Woche wurden noch keine Keys erfasst.":"Wochenruns werden bei der nächsten Raider.IO-Aktualisierung ergänzt."}</p>`;
  const difficultyKey=value=>String(value||"").toLowerCase().replace("heroisch","heroic").replace("mythisch","mythic").replace("schlachtzugsbrowser","raid finder");
  const difficultyValue=(difficulties,name)=>Object.entries(difficulties||{}).find(([key])=>difficultyKey(key).startsWith(difficultyKey(name)))?.[1]??0;
  const weeklyBossGrid=(raid,label,className)=>{const bosses=raid.bosses||[];return `<section class="weekly-difficulty ${className}"><header><strong>${esc(label)}</strong><span>${esc(difficultyValue(raid.difficulties,label.toLowerCase()))} / ${esc(bosses.length||"–")} Bosse</span></header><div class="weekly-boss-grid">${bosses.map(boss=>{const defeated=Number(difficultyValue(boss.difficulties,label.toLowerCase()))>0;return `<article class="boss-tile ${defeated?"defeated":"open"}" title="${esc(boss.name)} · ${esc(label)}: ${defeated?"besiegt":"offen"}"><img src="${esc(boss.image||fallbackSvg)}" alt="${esc(boss.name)}" loading="lazy" onerror="this.onerror=null;this.src='${fallbackSvg}'"><strong>${esc(boss.name)}</strong>${defeated?`<b class="defeated-stamp">DEFEATED</b>`:""}</article>`}).join("")}</div></section>`};
  const weeklyRaids=(weekly?.raidBosses||[]).map(raid=>`<div class="weekly-raid-row"><div class="weekly-raid-title"><strong>${esc(raid.raid)}</strong><small>Ausschließlich Kills der aktuellen Resetwoche</small></div>${raid.bosses?.length?`<div class="weekly-difficulties">${weeklyBossGrid(raid,"Normal","normal")}${weeklyBossGrid(raid,"Heroisch","heroic")}${weeklyBossGrid(raid,"Mythisch","mythic")}</div>`:`<p class="empty">Bossbilder werden mit der nächsten Blizzard-Aktualisierung ergänzt.</p>`}</div>`).join("")||`<p class="empty">Noch keine Raidboss-Kills in dieser Resetwoche.</p>`;
  document.querySelector("#current-progress").innerHTML=`<article class="current-progress-card" style="--class:${color(character)}"><div class="live-glow"></div><header><div><p class="eyebrow"><span class="live-dot"></span> AKTUELLE SEASON</p><h2>${esc(seasonLabel)}</h2><p>Raid- und Mythic+-Fortschritt · automatisch aktualisiert</p><a class="current-main-link" href="${esc(character?.armoryUrl||character?.profileUrl||"#")}" target="_blank" rel="noreferrer">${character?.classIcon?`<img src="${esc(character.classIcon)}" alt="${esc(character.className||"Evoker")}-Logo">`:""}<span>Main:</span><strong>${esc(character?.name||"–")}</strong><i>↗</i></a></div><strong class="patch-badge">PATCH ${esc(patch)}</strong></header><div class="current-progress-grid"><div class="live-score"><span>MYTHIC+ SCORE</span><strong>${formatNumber(currentScore(character))}</strong><small>Aktueller Season-Wert</small></div><div class="live-raids">${raidMarkup}</div><div class="live-runs"><h3>Beste Keys dieser Woche</h3>${runsMarkup}</div></div><section class="weekly-progress"><div class="weekly-head"><div><p class="eyebrow">WOCHENFORTSCHRITT</p><h3>Aktuelle Resetwoche</h3></div><span>Nur seit Mittwoch 06:00 Uhr · Reset ${formatDate(weekly?.resetAt)}</span></div><div class="weekly-grid"><article><span>Höchster abgeschlossener Key</span><strong>${weekly?.highestKey?"+".concat(esc(weekly.highestKey)):"–"}</strong></article><article><span>Getimte Dungeons</span><strong>${esc(weekly?.timedDungeons??0)}</strong><small>unterschiedliche Dungeons</small></article><article class="weekly-raids"><span>Raidfortschritt dieser Woche</span>${weeklyRaids}</article></div></section></article>`;
}
renderCurrentProgress(mainCharacter);

function equipmentBlock(character){
  if(!character.equipment?.length)return `<p class="empty">Ausrüstung erscheint nach der nächsten automatischen API-Aktualisierung.</p>`;
  return character.equipment.map(item=>`<a class="equipment-item" href="${esc(item.wowheadUrl||character.armoryUrl)}" target="_blank" rel="noreferrer" title="${esc(item.slot)}: ${esc(item.name)}">
    ${item.icon?`<img src="${esc(item.icon)}" alt="" loading="lazy">`:`<span class="item-placeholder"></span>`}
    <div><small>${esc(item.slot)}</small><strong>${esc(item.name)}</strong><em>iLvl ${esc(item.itemLevel??"–")}</em></div>
  </a>`).join("");
}

function itemLevelChart(character){
  const allPoints=(data.itemLevelHistory?.[character.name]||[]).filter(point=>Number.isFinite(Number(point.value))).sort((a,b)=>new Date(a.at)-new Date(b.at));
  if(!allPoints.length)return `<div class="itemlevel-history empty">Der Itemlevel-Verlauf startet mit der nächsten Datenaktualisierung.</div>`;
  const currentDay=new Date(data.generatedAt||Date.now());currentDay.setUTCHours(12,0,0,0);
  const dayTimes=Array.from({length:14},(_,index)=>currentDay.getTime()-(13-index)*86400000);
  const points=dayTimes.map(time=>{const known=[...allPoints].reverse().find(point=>new Date(point.at).getTime()<time+12*60*60*1000)??allPoints[0];return {at:new Date(time).toISOString(),value:Number(known.value)}});
  const width=640,height=205,padX=38,padTop=22,padBottom=55,values=points.map(point=>Number(point.value));
  const rawMin=Math.min(...values),rawMax=Math.max(...values),range=Math.max(4,rawMax-rawMin),min=Math.floor(rawMin-range*.18),max=Math.ceil(rawMax+range*.18);
  const x=index=>padX+index*(width-padX*2)/(points.length-1);
  const y=value=>padTop+(max-value)*(height-padTop-padBottom)/(max-min||1);
  const coords=points.map((point,index)=>`${x(index).toFixed(1)},${y(Number(point.value)).toFixed(1)}`).join(" ");
  const area=`${x(0)},${height-padBottom} ${coords} ${x(points.length-1)},${height-padBottom}`;
  const first=points[0],last=points.at(-1),growth=Number(last.value)-Number(first.value),date=value=>new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit"}).format(new Date(value));
  const fullDate=value=>new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(value));
  const grid=[min,Math.round((min+max)/2),max].map(value=>`<g><line x1="${padX}" y1="${y(value)}" x2="${width-padX}" y2="${y(value)}"></line><text x="4" y="${y(value)+4}">${esc(value)}</text></g>`).join("");
  const dayGrid=points.map((point,index)=>`<g class="day-grid"><line x1="${x(index)}" y1="${padTop}" x2="${x(index)}" y2="${height-padBottom}"></line><text transform="translate(${x(index)-2} ${height-38}) rotate(-52)">${esc(date(point.at))}</text></g>`).join("");
  const dots=points.map((point,index)=>{const cx=x(index),cy=y(point.value),tx=cx>width-165?cx-148:cx+10,ty=Math.max(3,cy-43);return `<g class="chart-point" tabindex="0" role="button" aria-label="${esc(fullDate(point.at))}: Itemlevel ${esc(point.value)}"><circle class="hit-area" cx="${cx}" cy="${cy}" r="14"></circle><circle cx="${cx}" cy="${cy}" r="4.5"></circle><g class="chart-tooltip" transform="translate(${tx} ${ty})"><rect width="138" height="38" rx="7"></rect><text class="tooltip-date" x="9" y="15">${esc(fullDate(point.at))}</text><text class="tooltip-value" x="9" y="30">Itemlevel ${esc(point.value)}</text></g></g>`}).join("");
  return `<section class="itemlevel-history"><header><div><span>GEGENSTANDSSTUFEN-VERLAUF</span><strong>Letzte 14 Tage</strong></div><b class="${growth>0?"positive":""}">${growth>0?"+":""}${esc(growth)} Itemlevel</b></header><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Itemlevel-Verlauf der letzten 14 Tage von ${esc(first.value)} auf ${esc(last.value)}">${grid}${dayGrid}<polygon points="${area}"></polygon><polyline points="${coords}"></polyline>${dots}</svg><footer><span>Vor 14 Tagen <b>${esc(first.value)}</b></span><span>Heute <b>${esc(last.value)}</b></span></footer></section>`;
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
      <div><h4>Ausrüstung</h4><div class="equipment-grid">${equipmentBlock(character)}</div>${itemLevelChart(character)}</div>
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
  "season-mn-2":{label:"Midnight Season 2",expansion:"Midnight",order:300},
  "season-mn-1":{label:"Midnight Season 1",expansion:"Midnight",order:200},
  "season-tww-3":{label:"The War Within Season 3",expansion:"The War Within",order:100}
};
const activeSeasonKey=data.activeSeasonKey||({"Midnight Season 2":"season-mn-2","Midnight Season 1":"season-mn-1","The War Within Season 3":"season-tww-3","TWW Season 3":"season-tww-3"}[data.activeRaidPatch?.season]);
const seasons=Object.entries(data.seasons||{}).filter(([name])=>name!==activeSeasonKey).sort(([a],[b])=>(seasonMeta[b]?.order??0)-(seasonMeta[a]?.order??0));
const archiveRaidProgress=(raid,highlight)=>{const total=Number(raid.totalBosses??0);const row=(label,short,value,className)=>{const done=Number(value??0),percent=total?Math.min(100,done/total*100):0,complete=total>0&&done>=total;const cuttingEdge=className==="mythic"&&complete&&highlight?`<div class="archive-ce-inline"><span>CE</span><div><strong>${esc(highlight.achievement?.replace(/^Cutting Edge:\s*/,""))}</strong><small>Cutting Edge · ${esc(highlight.character||raid.character||"–")}</small></div></div>`:"";const mythicComplete=className==="mythic"&&complete?`<small>VOLLSTÄNDIG MYTHISCH</small>`:"";return `<div class="archive-progress-row ${className} ${complete?"complete":""}" style="--archive-progress:${percent}%"><div><span><i>${short}</i>${label}</span><b>${esc(done)} / ${esc(total||"–")}</b></div><em><u></u></em>${mythicComplete}${cuttingEdge}</div>`};return `<div class="archive-progress">${row("Normal","N",raid.normalKilled,"normal")}${row("Heroisch","H",raid.heroicKilled,"heroic")}${row("Mythisch","M",raid.mythicKilled,"mythic")}</div>`};
document.querySelector("#seasons").innerHTML=seasons.length?seasons.map(([name,season])=>{
  const best=season.bestMythicPlus;
  const raids=Object.values(season.raids||{});
  const scoreCharacter=byName(best?.character);
  return `<article class="season"><span class="timeline-point" tabindex="0" aria-label="${esc(seasonMeta[name]?.expansion||seasonMeta[name]?.label||name)}" data-label="${esc(seasonMeta[name]?.expansion||seasonMeta[name]?.label||name)}"></span>
    <p class="eyebrow">${esc(seasonMeta[name]?.label||name.replace("season-","").toUpperCase())}</p>
    <div class="archive-person" style="--class:${color(scoreCharacter)}">${scoreCharacter?.classIcon?`<img src="${esc(scoreCharacter.classIcon)}" alt="">`:""}<div><small>Bester M+-Score</small><strong>${esc(best?.character||"–")}</strong><span>${esc(best?.score??"–")} Punkte</span></div></div>
    <div class="archive-raids">${raids.map((raid,index)=>{const raidCharacter=byName(raid.character);const highlight=(season.highlights||[])[index];return `<section class="archive-raid" style="--class:${color(raidCharacter)}"><div class="archive-raid-head">${raidCharacter?.classIcon?`<img src="${esc(raidCharacter.classIcon)}" alt="">`:""}<div><small>Raidfortschritt · ${esc(raid.character||"–")}</small><strong>${esc(raid.raid||"Unbekannter Raid")}</strong></div></div>${archiveRaidProgress(raid,highlight)}</section>`}).join("")||'<p class="empty">Kein Raid gespeichert.</p>'}</div>
  </article>`;
}).join(""):`<article class="notice">Saisonwerte erscheinen nach der ersten Aktualisierung.</article>`;

if(data.errors?.length){document.querySelector("#errors-section").hidden=false;document.querySelector("#errors").innerHTML=`<p>Einige Charakterdaten konnten nicht aktualisiert werden. Die zuletzt verfügbaren Bereiche bleiben sichtbar.</p>${data.errors.map(error=>`<div><strong>${esc(error.character)}:</strong> ${esc(error.message)}</div>`).join("")}`}

document.querySelectorAll("img").forEach(image=>{image.decoding="async";if(!image.closest(".hero"))image.loading="lazy"});
document.body.classList.remove("loading");
document.body.classList.add("loaded");
document.addEventListener("click",async event=>{const button=event.target.closest("[data-copy-code]");if(!button)return;try{await navigator.clipboard.writeText(button.dataset.copyCode);const old=button.textContent;button.textContent="Kopiert";setTimeout(()=>button.textContent=old,1400)}catch{button.textContent="Kopieren nicht möglich"}});
