# THE LAST HOOLIGAN — att göra

Det här är backloggen över det som återstår. Planen och bakgrunden finns i [`DESIGN-V2.md`](DESIGN-V2.md).
Senast uppdaterad 2026-11-13.

## Läget just nu

| Del | Status | Gren |
|---|---|---|
| Fas A: 3D-renderer (Three.js) | klar | `phase-a-3d` |
| Fas B: 3D-karaktärer v1 (riggade delar) | klar, ersätts av v2 | `phase-b-3d-chars` |
| Fas C: firman i striden (order, nerv, kommandoläge) | klar | `phase-c-firm` |
| Fas D: firman mellan matcherna (THE ANCHOR, rykte, heat) | klar | `phase-d-firm-hub` |
| Overhaul: skinnade v2-karaktärer, animator, AO, bloom | påbörjad | `phase-d-firm-hub` |
| Overhaul: handkeyade slagklipp med näv-IK | klar, ej committad | `overhaul-key-clips` |
| Fas E: THE TERRACES | pausad (motorstöd för trappsteg finns) | – |
| Fas F: Football Tour-kartan och arenorna | ej påbörjad | – |

Grenarna bygger på varandra, så den senaste innehåller allt. `main` har fortfarande bara originalspelet.

## Först: provspela och städa

- [ ] **Provspela på riktigt.** Ingen människa har spelat fas A–D eller overhaulen live, allt är verifierat med tester
      och renderade bilder. Störst risk: hur det känns att styra firman mitt i en strid (kommandoläget).
- [ ] Merga grenarna till `main` när provspelningen är godkänd.
- [ ] Bestäm om 3D ska bli standardläget, i dag är 2D standard och 3D "beta".
- [ ] 2D-läget: sprite-bygget stannade halvvägs (bland annat `m_jacket` saknas och `assets/sprites/index.json` skrevs
      aldrig), så 2D ritar procedurfigurer. Bygg om spritarna eller pensionera 2D.
- [ ] Bundla Three.js lokalt (i dag laddas det från jsDelivr), kräver ett OK för nedladdningen.
- [ ] `.claude/launch.json` har en extra serverkonfiguration (port 8643) från utvecklingen. Behåll eller ta bort.

## Grafik och rörelse (overhaulen)

- [ ] Klipp för träffreaktioner (riktningsberoende), knockdown, att resa sig, block och parry samt dodge.
- [ ] Klipp för grepp, kast och att bli kastad, hopp- och luftattacker (flyingKick, jumpKick, divePunch) och spinKick.
- [ ] Klipp för grabbarnas signaturslag: Mos hammare, Stigs flurry och glidtackling, Tinas yxspark, Vics strypgrepp
      och chokeslam, Old Boys skalle.
- [ ] Klipp för bossarnas specialattacker (bodySlam, push, derby_*, underground_*, laststand_*).
- [ ] Taunt, victory, dizzy och idle-variationer.
- [ ] Bättre händer (knytnäve, fingrar) och ansikten med uttryck (skrik, ont, KO).
- [ ] Riktiga 3D-vapen i handen, i dag visas föremålets ikon som en sprite.
- [ ] Prestanda: slå ihop meshar per figur (färre draw calls inför stora firmastrider), samt halv upplösning eller
      ett kvalitetsval för GTAO på stora skärmar (`?post=0` är enda reglaget i dag).
- [ ] En grafikinställning i menyn (låg/mellan/hög).
- [ ] Miljö: byt billboard-props mot 3D-modeller i prioritetsordning (lampor, bilar, bänkar, kiosker,
      läktardetaljer). Golvdekaler och `drawGround` i 3D, bilarnas strålkastarljus och custom actors (tåg, folkmassor)
      som ritas utan djup.
- [ ] Kamerazoom i dueller och bossfighter (zoom finns, men 2D-överlägget stämmer bara vid zoom 1).

## Firman

- [ ] Ordrar med handkontroll (radialmeny).
- [ ] Firma på/av och firmans storlek i menyn (finns bara i sparfilen).
- [ ] Mål i strider utöver "slå ner alla", t.ex. ta läktaren, håll puben eller hämta en skadad kompis (DESIGN-V2 §3.4).
- [ ] Större strider (6 mot 10) när prestandan tillåter.
- [ ] Gör relationerna synligare och påverkbara.
- [ ] Balansera ekonomin: priser, rykte, heat, skador och avhopp.
- [ ] **Öppen fråga:** kan grabbar dö permanent eller bara skadas?
- [ ] **Öppen fråga:** finns story-kampanjen (bana 1–8) kvar som intro, eller börjar spelet i puben?

## Fas E: THE TERRACES

- [ ] Bygg banan: Approach, Turnstiles, Terraces och Back End med riktiga trappsteg på läktaren (motorstödet finns:
      relativ stegning, `base` på props och `ambientOverride`).
- [ ] Strålkastarna slocknar på läktaren och tänds igen i maskinrummet (dynamisk belysning).
- [ ] Bossen THE FOGHORN: megafonstöt, trumslag och "lights out".
- [ ] Arenamusik (`terraces`-spåret) och publikljud.
- [ ] Banvalet behöver kunna skrolla när det finns fler än 8 banor, och slutsekvensen ska komma efter story-banorna
      i stället för efter sista banan.

## Fas F: The Football Tour

- [ ] Football Tour-kartan i 90-talsmatchprogramstil (ersätter listan på korktavlan i puben), där rykte låser upp
      resmål.
- [ ] England: Old Trafford, Stamford Bridge, The Den, Anfield och Ibrox, var och en som ett eget level-paket med tema,
      boss och musik. Obs: du valde riktiga namn; risken med varumärken och licenser kvarstår om spelet släpps.
- [ ] Europa: Tyskland, Italien, Spanien och Sverige.

## Visionen i övrigt

- [ ] Dynamisk tid och dynamiskt väder (skymning till natt, dimma, vattenpölar).
- [ ] NPC:er som inte slåss: supportrar, fotgängare, personal och trafik.
- [ ] Dynamisk musik, ett komplett soundtrack och fler egna ramsor.
- [ ] Highscore per arena, arenaspecifika menyer och slutsekvenser.
