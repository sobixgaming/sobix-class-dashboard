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
const bestScore=Math.max(0,...roster.map(currentScore));
document.querySelector("#summary").innerHTML=[
  [roster.length||13,"Charaktere"],
  [new Set(roster.map(character=>character.className)).size||13,"Klassen"],
  [maxCount,`auf Stufe ${data.maxLevel}`],
  [formatNumber(bestScore),"höchster M+-Score"]
].map(([value,label])=>`<article class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`).join("");

const primary=(data.featured?.primary||["Bufferrari","Liezen"]).map(byName).filter(Boolean);
const bronze=byName(data.featured?.bronze)||roster.filter(character=>!primary.includes(character)).sort((a,b)=>currentScore(b)-currentScore(a))[0];
const ranked=[primary[0],primary[1],bronze].filter(Boolean);

document.querySelector("#podium").innerHTML=ranked.map((character,index)=>{
  const rank=index+1;
  const [label,icon]=medals[rank];
  const image=character.media?.inset||character.media?.avatar;
  return `<article class="podium-card rank-${rank}" style="--class:${color(character)}">
    <div class="medal"><span>${icon}</span>${label}</div>
    ${image?`<img src="${esc(image)}" alt="${esc(character.name)}" loading="lazy">`:`<div class="portrait-fallback">${esc(character.name?.[0])}</div>`}
    <div class="podium-copy"><p>${esc(character.className)} · ${esc(character.specName)}</p><h3>${esc(character.name)}</h3><div><strong>${formatNumber(currentScore(character))}</strong> M+ · iLvl ${esc(character.itemLevel??"–")}</div></div>
  </article>`;
}).join("");

function raidBlock(character){
  const raids=(character.raids||Object.entries(character.raidProgression||{}).map(([slug,raid])=>({slug,summary:raid.summary,totalBosses:raid.total_bosses,mythicKilled:raid.mythic_bosses_killed}))).slice(0,3);
  if(!raids.length)return `<p class="empty">Noch kein aktueller Raidfortschritt verfügbar.</p>`;
  return raids.map(raid=>`<div class="raid-row"><span>${esc(raid.slug?.replaceAll("-"," "))}</span><strong>${esc(raid.summary||`${raid.mythicKilled||0}/${raid.totalBosses||0} M`)}</strong></div>`).join("");
}

function runBlock(character){
  if(!character.bestRuns?.length)return `<p class="empty">Beste Runs erscheinen nach der nächsten Datenaktualisierung.</p>`;
  return character.bestRuns.slice(0,3).map(run=>`<a class="run-row" href="${esc(run.url||character.profileUrl||character.armoryUrl)}" target="_blank" rel="noreferrer"><span><b>+${esc(run.level??"–")}</b> ${esc(run.shortName||run.dungeon)}</span><strong>${formatNumber(run.score)} · ${formatTime(run.clearTimeMs)}</strong></a>`).join("");
}

function equipmentBlock(character){
  if(!character.equipment?.length)return `<p class="empty">Ausrüstung erscheint nach der nächsten automatischen API-Aktualisierung.</p>`;
  return character.equipment.map(item=>`<div class="equipment-item" title="${esc(item.slot)}: ${esc(item.name)}">
    ${item.icon?`<img src="${esc(item.icon)}" alt="" loading="lazy">`:`<span class="item-placeholder"></span>`}
    <div><small>${esc(item.slot)}</small><strong>${esc(item.name)}</strong><em>iLvl ${esc(item.itemLevel??"–")}</em></div>
  </div>`).join("");
}

document.querySelector("#featured").innerHTML=primary.map((character,index)=>{
  const render=character.media?.render||character.media?.inset;
  const talents=character.talents?.length?character.talents.map(talent=>`<span>${esc(talent)}</span>`).join(""):`<a href="${esc(character.armoryUrl)}" target="_blank" rel="noreferrer">Build im Arsenal öffnen ↗</a>`;
  return `<article class="featured-card" style="--class:${color(character)}">
    <div class="featured-visual">${render?`<img src="${esc(render)}" alt="${esc(character.name)}" loading="lazy">`:""}<div class="visual-shade"></div><div class="featured-title"><p class="eyebrow">MAIN ${index+1}</p><h3>${esc(character.name)}</h3><p>${esc(character.className)} · ${esc(character.specName)}</p></div></div>
    <div class="featured-content">
      <div class="stat-strip"><div><strong>${formatNumber(currentScore(character))}</strong><span>M+-Score</span></div><div><strong>${esc(character.itemLevel??"–")}</strong><span>Itemlevel</span></div><div><strong>${esc(character.level)}</strong><span>Stufe</span></div></div>
      <div class="detail-columns"><div><h4>Hero-Talente & Build</h4><div class="talent-list">${talents}</div></div><div><h4>Raidfortschritt</h4>${raidBlock(character)}</div></div>
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
document.querySelector("#seasons").innerHTML=seasons.length?seasons.map(([name,season])=>{const best=season.bestMythicPlus;const raids=Object.values(season.raids||{}).sort((a,b)=>b.mythicKilled-a.mythicKilled);return `<article class="season"><p class="eyebrow">${esc(name)}</p><div class="season-score">${esc(best?.score??"–")}</div><p>${best?`${esc(best.character)} · ${esc(best.className)} · ${esc(best.specName)}`:"Kein M+-Wert"}</p>${raids.slice(0,3).map(raid=>`<div class="raid-line"><strong>${esc(raid.raid)}</strong><br>${esc(raid.summary)} · ${esc(raid.character)}</div>`).join("")}</article>`}).join(""):`<article class="notice">Saisonwerte erscheinen nach der ersten Aktualisierung.</article>`;
if(data.errors?.length){document.querySelector("#errors-section").hidden=false;document.querySelector("#errors").innerHTML=data.errors.map(error=>`<div><strong>${esc(error.character)}:</strong> ${esc(error.message)}</div>`).join("")}
