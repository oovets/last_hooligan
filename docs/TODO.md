# THE LAST HOOLIGAN — att göra

Det här är backloggen över det som återstår. Planen och bakgrunden finns i [`DESIGN-V2.md`](DESIGN-V2.md).
Senast uppdaterad 2026-11-13.

## Läget just nu

Allt ligger på `main`, de gamla fasgrenarna är mergade.

| Del | Status |
|---|---|
| Fas A: 3D-renderer (Three.js), nu standardläget | klar |
| Fas B: 3D-karaktärer v1 (riggade delar) | klar, ersatt av v2 |
| Fas C: firman i striden (order, nerv, kommandoläge) | klar |
| Fas D: firman mellan matcherna (THE ANCHOR, rykte, heat) | klar |
| Overhaul: skinnade v2-karaktärer, animator, AO, bloom | klar i grunden, polering kvar |
| Overhaul: handkeyade klipp (slag, tillstånd, luft, grepp, Tina och Vic) | klar |
| Overhaul: procedurell rörelse (fightstance, steg, acceleration) | klar, ej provspelad |
| Fullskaliga fordon, nya menyer i full upplösning | klar |
| Fas E: THE TERRACES | pausad (motorstöd för trappsteg finns) |
| Fas F: Football Tour-kartan och arenorna | ej påbörjad |

## Först: provspela och städa

- [ ] **Provspela på riktigt.** Ingen har spelat fas A–D, klippen eller den nya rörelsen live, allt är verifierat med
      tester och renderade bilder. Störst risk: hur det känns att styra firman mitt i en strid (kommandoläget).
      Provspelning utifrån: `python3 scripts/serve.py 8642 --public --root <checkout>`.
- [x] Merga grenarna till `main`.
- [x] 3D är standardläget (äldre sparfiler flyttas över en gång, `?renderer=2d` ger det klassiska läget).
- [ ] 2D-läget: sprite-bygget stannade halvvägs (bland annat `m_jacket` saknas och `assets/sprites/index.json` skrevs
      aldrig), så 2D ritar procedurfigurer. Bygg om spritarna eller pensionera 2D.
- [ ] Bundla Three.js lokalt (i dag laddas det från jsDelivr), kräver ett OK för nedladdningen.
- [ ] `.claude/launch.json` har en extra serverkonfiguration (port 8643) från utvecklingen. Behåll eller ta bort.

## Spelkänsla och rörelse

- [x] Fightstance och fightwalk i 3D är procedurella: boxarstuds i garden, skuffsteg framåt/bakåt och sidsteg relativt
      blickriktningen, blendning efter fart och lutning vid acceleration (förut växlade två poser var 0,2 s).
- [x] Mjuk acceleration för gång och spring (cirka 0,08 s till full fart, 0,06 s till stopp; `MOVE_ACCEL` och
      `MOVE_DECEL` i `src/game/fighter.js`).
- [ ] Provspela och finjustera: acceleration, gång- och springfart, studsens tempo, hur fort figurerna vänder.
- [ ] Vändning: i dag byter spelaren riktning direkt (bara 3D-modellen roterar mjukt). Prova en kort vändsteg-animation
      eller att slag riktas efter stickan i stället för blickriktningen.
- [ ] Träffkänsla: kamerashake och hitstop finns, prova knockback-kurvor, impact-frames och att fiender staplar sig.
- [ ] Fiendernas rörelser: AI:n går rakt mot målet, lägg till cirklande, avstånd i garden och att flera fiender
      inte klumpar ihop sig.

## Grafik och rörelse (overhaulen)

- [x] Klipp för träffreaktioner (fram, huvud, mage, bakifrån), block, blockträff, knockdown, liggande, KO, att resa
      sig och dodge (`STATE_CLIPS` i `src/render3d/clips.js`, väljs av `stateClipFor`).
- [x] Klipp för grepp, strypgrepp, kast, att bli kastad, luftattacker (flyingKick, jumpKick, divePunch) och spinKick
      (hel snurr via klippens `yaw`-spår).
- [x] Klipp för knee, throw, push, slap, counter, backElbow, backKick, bodySlam, throwItem, Tinas yxspark och Vics
      vic_tighten, vic_chokeslam och vic_lunge. Taunt, victory och dizzy.
- [ ] Klipp för bossarnas och banornas specialattacker (`awayend_*`, `city_*`, `derby_*`, `industrial_*`,
      `laststand_*`, `pub_*`, `underground_*`, `cheer`), i dag faller de tillbaka på pose-biblioteket.
- [ ] Idle-variationer utöver viktskiftet (se sig om, spotta, sträcka på sig).
- [ ] Provspela klippen live och finjustera tajming och räckvidd. `tools/anim3d.html` visar klipp som filmremsor:
      `filmstrip(['hurtFront', 'atk:spinKick', 'move:guard:left'], { frames: 7, facing: 0, look: 'vic' })`.
- [ ] Bättre händer (knytnäve, fingrar) och ansikten med uttryck (skrik, ont, KO).
- [ ] Riktiga 3D-vapen i handen, i dag visas föremålets ikon som en sprite.
- [ ] Prestanda: slå ihop meshar per figur (färre draw calls inför stora firmastrider), samt halv upplösning eller
      ett kvalitetsval för GTAO på stora skärmar (`?post=0` är enda reglaget i dag).
- [ ] En grafikinställning i menyn (låg/mellan/hög).
- [ ] Miljö: byt billboard-props mot 3D-modeller i prioritetsordning (lampor, bilar (fullskaliga sedan 6af9448 men
      fortfarande billboards), bänkar, kiosker,
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
