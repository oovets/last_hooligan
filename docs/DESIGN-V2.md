# THE LAST HOOLIGAN — Design v2: 3D, firman i striden och firman mellan matcherna

Status: **förslag** (2026-11-12). Ersätter "retro/8-bit" i visionsdokumentet. THE TERRACES är pausad tills fas A–C är klara.

## 1. Vad som ändras

| Före | Efter |
|---|---|
| 640×360 pixelkänsla, Canvas 2D | Riktig 3D i webbläsaren (Three.js, WebGL), skarp i full upplösning |
| Du slåss ensam | Du slåss själv **och** leder dina grabbar i realtid (RTS-order) |
| Banor i följd, wardrobe mellan dem | **Firman** mellan matcherna: puben som bas, rekrytering, träning, moral, rykte, kassa, skador |
| Football Tour = bansekvens | Football Tour = karta där firmans rykte låser upp resmål |

Det som **inte** ändras är kärnan: den isometriska beat 'em up-känslan, kombinationer, grepp, vapen, hemligheter, scarves/badges, bossar och humorn. Kameran står kvar snett ovanifrån. Spelet ska fortfarande kännas som THE LAST HOOLIGAN, bara större och snyggare.

## 2. Teknisk strategi: behåll simuleringen, byt renderingen

Koden är redan uppdelad på ett sätt som gör bytet rimligt:

- **Simuleringen är renderingsoberoende.** `World.update`, `Fighter`, `combat.js` (attackregister och träffar), `ai.js` (flow-field, tokens), encounters, triggers, hazards, save och audio arbetar i världskoordinater (tiles + höjd i units). `scripts/check.mjs --sim` kör hela banor headless redan i dag.
- **Bara ritningen är 2D.** Det gäller `World.draw`, `Fighter.draw`, `Prop.draw` och alla `draw()` i themes, `tiles.js`, `gfx.js`, `doll.js`/`sprites.js`, `drawLighting` och `drawWeather`.

Planen är en ny renderer, `src/render3d/`, som läser världens tillstånd varje frame och speglar det i en Three.js-scen. Simuleringen rörs inte. Banfilerna fortsätter vara data.

### 2.1 Ingen build step, fortfarande
Three.js läggs vendrad i `vendor/three/` (exakt låst version) och laddas via en `importmap` i `index.html`. Det blir inga npm-beroenden och ingen bundler, så projektets "bara servera mappen" behålls.

### 2.2 Koordinater
- Världens `x, y` (tiles, 1 tile = 1 m) blir Three `x, z`, och höjden `z` (units, 1 unit ≈ 1.02 m) blir Three `y`. Det är samma skala som Blender-pipelinen redan använder (`docs/ART_PIPELINE.md`).
- Kameran är ortografisk eller smal perspektiv i samma vinkel som i dag (+x ned-höger, +y ned-vänster). Den kan zoomas och, i firmavyn, vridas i 90°-steg. Spelvinkeln låses i strid så att banorna läses som förut.

### 2.3 Brygga från 2D-innehållet (så att inget går förlorat på vägen)
Alla 8 banor och cirka 140 props har procedurgrafik i canvas. Att modellera om allt direkt går inte, så bryggan sker i nivåer:

1. **Golv:** `renderFloor()` bakar redan hela golvet till en canvas. Den blir en `CanvasTexture` på ett plan, så golven fungerar direkt.
2. **Väggar:** varje tile med vägg blir en box (instansierad per stil och höjd). Ytorna får textur från stilens `face()`/`top()`, eller från Blender-väggsprites där de finns. Väggarna blir "riktiga" 3D-block i dag.
3. **Props:** första steget är en automatisk billboard. Det befintliga `draw()` renderas till en offscreen canvas och visas som en sprite som står i världen. Därefter ersätts props en i taget med glTF-modeller från Blender (`env_<theme>.py` finns redan per tema).
4. **Karaktärer:** Blender-riggen i `render_char.py` (joints och material-ID:n) exporteras som **glTF med skelett** i stället för sprites. Animationerna kommer från samma poslibrary via `export_poses.mjs`, som genererar animationsklipp i stället för bildrutor. Omfärgningen (wardrobe, fiendevariation) blir materialparametrar per material-ID, alltså samma system som i dag fast i 3D.
5. **Ljus:** banornas `lights[]` blir riktiga punkt- och spotljus (med budget: de närmaste N är aktiva). `ambient` blir hemisfär- och riktat ljus, med skuggor från strålkastare och gatlampor. Väder blir partiklar, och regn får våta reflekterande golv.

Ett tekniskt krav: **`check.mjs --sim` ska ge samma resultat före och efter**. Rendereringen får aldrig påverka spellogiken.

### 2.4 Redan gjort (2026-11-12, inför THE TERRACES)
- Riktiga trappsteg. Flow-field, `hasWalkLine` och `hasLOS` räknar höjdskillnad mellan steg i stället för absolut höjd, så att AI kan gå upp och ner för en läktare. Validatorn i `check.mjs` följer samma regel.
- Props kan stå upphöjt (`base: n`) på ett trappsteg eller en låg vägg.
- `world.ambientOverride` gör att en bana kan ändra ljuset under spelets gång (skymning, natt, strömavbrott).
- Alla 8 befintliga banor klarar `check.mjs --sim` efter ändringarna.

## 3. Firman i striden (RTS-lagret)

Du spelar fortfarande din hooligan med tangentbord eller handkontroll. Samtidigt har du 2–6 grabbar med dig som slåss på egen hand och lyder order.

### 3.1 Kommandoläge
- **Håll C (eller LB):** tiden går ner till 25 %, muspekaren visas och dina grabbar markeras.
- **Markera:** klicka på en grabb eller dra en ruta. **1–3** väljer grupp (ät och drick flyttas till F1–F3).
- **Order (högerklick):** gå dit, anfall den där, håll positionen, ta området (kontrollzon), retirera till mig.
- **Snabborder utan kommandoläge:** Q = "MED MIG!" (alla samlas), R = "PÅ DEM!" (alla anfaller närmaste), F = "HÅLL!".
- **Handkontroll:** radialmeny på LB, och höger spak väljer mål.

### 3.2 Grabbarnas AI
- `AIController` får ett **lag-medvetet mål** i stället för att alltid jaga `world.player`. Fiender väljer närmaste fientliga (spelaren eller en av grabbarna), grabbarna väljer närmaste fiende eller orderns mål. Kodytan är liten: cirka 30 referenser till `world.player` i `ai.js`, bossar och teman. Träffar avgörs redan per lag i `combat.js`/`World.autoAim`.
- Ett **ordertillstånd** per grabb (`follow | hold | attack | move | capture | retreat`) ligger ovanpå den befintliga strids-AI:n, som redan har aggression, block, kombos och vapen.
- Attack-tokens finns redan för fiender. Grabbarna får egna tokens så att striderna blir läsbara i stället för kaos.

### 3.3 Moral och nerv
- Varje grabb har **nerv**. Den sjunker när man är i underläge, tar stryk eller ser en kompis falla, och den stiger med ledarens KOs, tunga träffar och sånger ("SING UP!" är en order som kostar tid men höjer nerven).
- Vid låg nerv tvekar grabben, och vid noll flyr han. Fiendefirmor har samma system, så **att knäcka deras top boy får resten att springa**.

### 3.4 Vad det gör med banorna
- Encounters kan bli större (6 mot 10) med **mål** i stället för bara "döda alla": ta läktaren, håll puben i 60 sekunder, få ut en skadad kompis.
- Den isometriska kameran zoomar ut i stora strider och in i dueller och bossar.
- Bossfighterna förblir dueller som standard. Grabbarna håller undan bossens minions, och det är där RTS-ordern spelar roll.

## 4. Firman mellan matcherna (management-lagret)

### 4.1 Basen: puben
En 3D-interiör (puben från bana 2 blir firmans stamlokal) som du går runt i:
- **Baren:** rekrytera nya grabbar (de dyker upp som NPC:er med egna personligheter).
- **Bakrummet:** träna (slag, sparkar, kondition, nerv) mot kassa och tid.
- **Garderoben:** den befintliga wardrobe-funktionen, nu för hela firman.
- **Kartan på väggen:** THE FOOTBALL TOUR MAP. Där väljer du nästa resa och vilka som följer med.
- **Jukeboxen och tavlan:** troféer, scarves och badges från banorna.

### 4.2 Grabbarna
Varje grabb är en sparad person:
- **Stats:** slag, sparkar, tålighet, snabbhet, nerv, lojalitet.
- **Egenskaper** (1–2 var): Hothead (anfaller före order), Big Lad (tål mer, långsam), Singer (höjer nerv), Lookout (ser fiender tidigare), Lightweight (blir full av en pint), Old School (ger moral åt de yngre) och liknande.
- **Utseende** från det befintliga look- och wardrobe-systemet.
- **Skador:** en grabb som blir nedslagen och inte hämtas missar nästa resa. En hård skada kostar vård.
- **Relationer:** grabbar som slåss bredvid varandra blir polare och får bonus ihop. Bänkade grabbar blir sura och kan lämna firman.

### 4.3 Ekonomi och konsekvenser
- **Kassa:** befintlig `cash` från banorna. Den används till resor, träning, kläder och vård.
- **Rykte:** stiger med vunna strider och bossar. Det låser upp nya arenor på touren och bättre rekryter.
- **Polisens intresse (heat):** stiger av för mycket kaos. Högt heat ger kontroller, bortastängda grabbar och fler poliser på nästa bana. Det skapar en balans mellan att vara störst och att hålla sig undan.
- **Händelsekort** mellan resor: små val med humor ("Tels mamma vill ha hem honom före tio", "Någon har tagit firmans flagga").

### 4.4 Sparformat
`save.js` får en version 2 med `firm: { lads: [...], rep, heat, cash, day, tourProgress }`. Den befintliga merge-logiken ger äldre sparfiler standardvärden. Wardrobe, scarves och badges flyttas över.

## 5. Faser

Varje fas ska vara spelbar och klara `check.mjs --sim` innan nästa börjar.

**Fas A — 3D-renderer, prototyp.** `src/render3d/` med Three.js (vendrat och låst). THE STREETS renderas i 3D med texturerat golv, väggblock, billboard-props, ljus och skuggor, samt karaktärer som enkla placeholder-figurer. HUD:en ligger kvar som 2D-canvas ovanpå. Det finns en växel `?renderer=2d|3d` så att båda lever parallellt.
*Klart när:* bana 1 går att spela från start till mål i 3D med 60 fps på en vanlig laptop, och simuleringen är oförändrad.

> **Status fas A (2026-11-12): prototypen är klar** på grenen `phase-a-3d`. Den startas med `?renderer=3d` eller via OPTIONS → GRAPHICS.
> Koden ligger i `src/render3d/renderer.js`, och Three.js 0.170.0 laddas via importmap från jsDelivr (vendring återstår).
> Ortografisk kamera i exakt samma projektion som 2D: golvtextur bakas från golvstilarna, väggar är instansierade boxar med
> stilarnas texturer, och ljuset består av hemisfärljus, skuggkastande sol/måne och en pool med 10 punktljus.
> Props, figurer, föremål och trafik är billboards som återanvänder den befintliga 2D-grafiken. Väggar framför spelaren
> ditheras bort. Partiklar, popups, pratbubblor, GO-pilen, väder och HUD ritas på 2D-canvasen ovanpå.
> Mätt: cirka 3,4 ms per bildruta inklusive simulering och GPU (1024×576). Alla 8 banor klarar `check.mjs --sim`.
> Saknas: golvdekaler och `drawGround`, och bilarnas strålkastarljus i 3D. Custom actors ritas ovanpå utan djup.

**Fas B — Karaktärer i 3D.** Riggade glTF-karaktärer exporteras från Blender med animationer från poslibraryt och omfärgning per material-ID. Spelaren, fienderna och bossarna i bana 1–2 använder dem.
*Klart när:* alla attacker och tillstånd i `Fighter` har en animation och wardrobe-färgerna syns.

> **Status fas B (2026-11-12): klar** på grenen `phase-b-3d-chars`. `python3 scripts/build_models.py` exporterar de
> 9 karaktärsmodellerna (m/h/f × jacket/parka/tee/hivis) som glTF från samma Blender-byggare som sprites
> (`render_char.py` i läget `"export"`), till `assets/models/`. Varje modell tar 0,7 s och alla tillsammans är 2,1 MB.
> I spelet poseras lederna varje bildruta direkt från `Fighter.getPose()` via `src/render3d/characters.js`. Det behövs
> inga bakade klipp, så alla tillstånd, attacker och bossrörelser som finns i 2D animeras automatiskt (och mjukt,
> eftersom kvantiseringen är avslagen i 3D). Färger, tillbehör och val av modell kommer från samma LOOK-data som
> wardrobe (`specForLook`), och renderingen använder toon-shading med fyra toner. Figurerna kastar riktiga skuggor och
> har en mjuk kontaktskugga. Mätt: 3,9 ms per bildruta med 4 figurer (389 draw calls).
> Kvar till senare: riktiga 3D-vapen (just nu syns föremålets ikon i handen), sammanslagning av mesher per figur för
> färre draw calls, ansiktsuttryck och kontur.

**Fas C — Firman i striden.** Lagmedveten AI, 2–4 grabbar som följer med, kommandoläget, snabbordrar och moral, testat på THE STREETS och THE PUB.
*Klart när:* simuleringen klarar banorna med grabbar, och en headless-test visar att grabbarna lyder alla order.

**Fas D — Firman mellan matcherna.** Puben som bas, grabbar med stats och egenskaper, rekrytering, träning, skador, kassa, rykte, heat och sparversion 2.
*Klart när:* en hel loop fungerar: pub, resa, bana, tillbaka till puben med konsekvenser.

**Fas E — THE TERRACES** som första bana byggd för 3D och firma: läktartrappsteg (motorstöd finns redan), strålkastare som slocknar och tänds, stor strid om läktaren och bossen THE FOGHORN.

**Fas F — Konvertering och touren.** Övriga banors props får glTF i prioritetsordning, Football Tour-kartan byggs och sedan kommer arenorna i ordning.

## 6. Risker och öppna frågor

- **Grafikvolymen är den största kostnaden.** Cirka 140 props och 8 teman ska få riktiga modeller. Billboard-bryggan gör att spelet fungerar under tiden, men en 3D-värld med platta props ser blandad ut. Prioritera props man ser mest (gatulampor, bilar, bänkar, kiosker, läktarelement).
- **Prestanda:** många ljus, skuggor och 15–20 animerade figurer samtidigt kräver ljusbudget, instancing och LOD. Det mäts i fas A.
- **Kontroller:** det är svårt att slåss med tangentbord och styra med mus samtidigt. Kommandolägets slow-motion är tänkt som lösningen, men det måste speltestas tidigt i fas C.
- **Versionshantering:** projektet ligger inte i git. Före fas A bör det initieras (`git init` plus en första commit), eftersom renderingsbytet rör många filer.
- **Öppen fråga:** ska grabbarna kunna dö permanent (roguelite-känsla) eller bara skadas?
- **Öppen fråga:** finns det fortfarande en story-kampanj (bana 1–8 i Nordhamn) som introduktion innan firman och touren öppnas, eller börjar spelet direkt i puben?
