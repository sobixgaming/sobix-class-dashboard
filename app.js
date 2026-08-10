const classColors={"Death Knight":"#c41e3a",Todesritter:"#c41e3a","Demon Hunter":"#a330c9","Dämonenjäger":"#a330c9",Druid:"#ff7c0a",Druide:"#ff7c0a",Evoker:"#33937f",Rufer:"#33937f",Hunter:"#aad372","Jäger":"#aad372",Mage:"#3fc7eb",Magier:"#3fc7eb",Monk:"#00ff98","Mönch":"#00ff98",Paladin:"#f48cba",Priest:"#fff",Priester:"#fff",Rogue:"#fff468",Schurke:"#fff468",Shaman:"#0070dd",Schamane:"#0070dd",Warlock:"#8788ee",Hexenmeister:"#8788ee",Warrior:"#c69b6d",Krieger:"#c69b6d"};
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const data=await fetch("data/dashboard.json",{cache:"no-store"}).then(r=>r.json());
const live=Boolean(data.generatedAt);
document.querySelector("#updated").textContent=live?`Stand ${new Intl.DateTimeFormat("de-DE",{dateStyle:"medium",timeStyle:"short"}).format(new Date(data.generatedAt))}`:"Live-Daten noch nicht geladen";
const maxCount=data.characters.filter(c=>c.level>=data.maxLevel).length;
document.querySelector("#summary").innerHTML=[
  [data.characters.length||13,"Charaktere"],[new Set(data.characters.map(c=>c.className)).size||13,"Klassen"],[maxCount,`auf Stufe ${data.maxLevel}`],[Object.keys(data.seasons||{}).length,"Saisons erfasst"]
].map(([value,label])=>`<article class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></article>`).join("");
const configured=["Bufferrari","Liezen","Sunhappens","Babutcher","Waterpoof","Hotserati","Imbanana","Honkytonky","Mátteagle","Jillkuice","Zerfoxn","Gotdilf","Paindotcom"];
const roster=data.characters.length?data.characters:configured.map(name=>({name,level:"–",className:"Noch nicht geladen",specName:"Workflow starten"}));
document.querySelector("#characters").innerHTML=roster.map(c=>`<article class="character ${c.level>=data.maxLevel?"max":""}" style="--class:${classColors[c.className]||"#8795aa"}"><h3>${esc(c.name)}</h3><p>${esc(c.className)} · ${esc(c.specName)}</p><div class="level">Stufe ${esc(c.level)}${c.itemLevel?` · iLvl ${esc(c.itemLevel)}`:""}</div></article>`).join("");
function bars(items){return items?.length?items.map(item=>`<div class="bar-row"><span>${esc(item.label)}</span><div class="bar"><i style="width:${Math.max(0,Math.min(100,item.percent))}%"></i></div><b>${esc(item.percent)}%</b></div>`).join(""):`<div class="notice">Noch keine M+-Daten. Starte den GitHub-Actions-Workflow.</div>`}
document.querySelector("#class-shares").innerHTML=bars(data.mythicPlus?.classShares);
document.querySelector("#spec-shares").innerHTML=bars(data.mythicPlus?.specShares);
document.querySelector("#raid-note").innerHTML=`<strong>Keine belastbare Prozentmessung verfügbar.</strong><br>${esc(data.raid?.reason||"Für diese Auswertung werden Warcraft Logs benötigt.")}`;
const seasons=Object.entries(data.seasons||{}).reverse();
document.querySelector("#seasons").innerHTML=seasons.length?seasons.map(([name,season])=>{const best=season.bestMythicPlus;const raids=Object.values(season.raids||{}).sort((a,b)=>b.mythicKilled-a.mythicKilled);return `<article class="season"><p class="eyebrow">${esc(name)}</p><div class="season-score">${esc(best?.score??"–")}</div><p>${best?`${esc(best.character)} · ${esc(best.className)} · ${esc(best.specName)}`:"Kein M+-Wert"}</p>${raids.map(r=>`<div class="raid-line"><strong>${esc(r.raid)}</strong><br>${esc(r.summary)} · ${esc(r.character)}</div>`).join("")}</article>`}).join(""):`<article class="notice">Saisonwerte erscheinen nach der ersten Aktualisierung.</article>`;
if(data.errors?.length){document.querySelector("#errors-section").hidden=false;document.querySelector("#errors").innerHTML=data.errors.map(e=>`<div><strong>${esc(e.character)}:</strong> ${esc(e.message)}</div>`).join("")}

