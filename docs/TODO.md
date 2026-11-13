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
| Overhaul: handkeyade klipp (slag, tillstånd, luft, grepp, Kenny och Vic) | klar |
| Kenny Showtime ersätter Terrace Tina (muskelbygge `b_*`, balaklava, egna slag) | klar, ej provspelad |
| Big Al (THE STEPLADDER, ny spelbar figur och grundare, TOP OFF-mekaniken) | klar och testad, ej provspelad |
| Realistiska hjältemodeller i menyerna (MPFB2) | Fat Vic klar (kraftig kropp, Stone Island-overshirt med märke), övriga saknas |
| Overhaul: procedurell rörelse (fightstance, steg, acceleration) | klar, ej provspelad |
| Fullskaliga fordon, nya menyer i full upplösning | klar |
| Fas E: THE TERRACES | pausad (motorstöd för trappsteg finns) |
| Fas F: Football Tour-kartan och arenorna | kartan och registret klara, alla fem arenor är stubbar |

## Först: provspela och städa

- [ ] **Provspela på riktigt.** Ingen har spelat fas A–D, klippen eller den nya rörelsen live, allt är verifierat med
      tester och renderade bilder. Störst risk: hur det känns att styra firman mitt i en strid (kommandoläget).
      Provspelning utifrån: `python3 scripts/serve.py 8642 --public --root <checkout>`.
- [x] Merga grenarna till `main`.
- [x] 3D är standardläget (äldre sparfiler flyttas över en gång, `?renderer=2d` ger det klassiska läget).
- [ ] 2D-läget: sprite-bygget stannade halvvägs (bland annat `m_jacket` saknas och `assets/sprites/index.json` skrevs
      aldrig), så 2D ritar procedurfigurer. Bygg om spritarna eller pensionera 2D.
- [ ] Bundla Three.js lokalt (i dag laddas det från jsDelivr), kräver ett OK för nedladdningen.
- [ ] `.claude/launch.json` har en extra serverkonfiguration (`hooligan-3d`, port 8643) från utvecklingen. Behåll
      eller ta bort.

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
- [x] Klipp för knee, throw, push, slap, counter, backElbow, backKick, bodySlam, throwItem, Kennys SHOWTIME BOMB och flex, Vics
      vic_tighten, vic_chokeslam och vic_lunge. Taunt, victory och dizzy.
- [ ] Klipp för bossarnas och banornas specialattacker (`awayend_*`, `city_*`, `derby_*`, `industrial_*`,
      `laststand_*`, `pub_*`, `underground_*`, `cheer`), i dag faller de tillbaka på pose-biblioteket.
- [ ] Idle-variationer utöver viktskiftet (se sig om, spotta, sträcka på sig).
- [ ] Provspela klippen live och finjustera tajming och räckvidd. `tools/anim3d.html` visar klipp som filmremsor:
      `filmstrip(['hurtFront', 'atk:spinKick', 'move:guard:left'], { frames: 7, facing: 0, look: 'vic' })`.
- [ ] Bättre händer (knytnäve, fingrar) och ansikten med uttryck (skrik, ont, KO).
- [ ] Realistiska hjältemodeller (MPFB2, `scripts/blender/char_mpfb.py`) för resten av figurerna. I dag finns bara
      `vic` i `assets/models/hero/index.json`.
- [ ] Big Al: provspela TOP OFF (skräckfrysen, skjortan i ansiktet, att knäppa igen). I 3D är den rutiga skjortan
      klar (även krage och muddar). Den bara överkroppen är tee-modellen i hudfärg, smalare: den blir aldrig riktigt
      "blek och tanig" (m-modellen har bröst- och magmuskler) och fållen ligger kvar som en kant över jeansen. En egen
      bar överkropp i `char_v2.py` skulle lösa båda.
- [ ] Vic (hero): skorna är enfärgade i lookens blå, utan den orange randen och gummisulan från v2-modellen.
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

- [x] Ordrar med handkontroll: d-pad = snabbordrar, håll RT = kommandoläge.
- [x] Kommandoläget utan mus: en ordermarkör som styrs med WASD/stick och fastnar på fiender (J/X = HAVE HIM eller
      OVER THERE, K/Y = välj vem som får ordern, L/B = WITH ME). Ledaren står still medan man ger order.
- [x] Grabbarna skyddar ledaren först på WITH ME, ropar på hjälp när de är skadade och i underläge (HUD:en blinkar
      HELP) och kompisarna kommer till undsättning.
- [x] Lagspel: HOLD HIM! (en grabb låser fast en fiende, dina och grabbarnas slag bryter inte greppet, ibland av sig
      själv, eller GRAB HIM! i kommandoläget med I/LB), DOUBLE TEAM (du och en grabb på samma man ger en slow-motion-
      launch), PASS HIM ON (kast mot en ledig grabb fångas direkt i ett grepp, dina kast fäller inte dina egna),
      PICK HIM UP (E över en utslagen grabb, en gång per grabb och strid), BACK TO ME! (N/R3, samlas tätt kring dig med
      nerv-boost) och GET OFF HIM! (grabbarna slår loss den som har greppet om dig). Kontrollsidan visar firmans knappar.
- [x] Buggfix: grabbarnas sparkar läkte fienden (kickMul från statsen var en offset men användes som multiplikator).
- [ ] Provspela kommandoläget och lagspelet: tempot (25 %), markörens fart, hur ofta grabbarna låser fast själva
      (`PIN_CHANCE` i firm.js), DOUBLE TEAM-tröskeln (`DT_*`) och pinnens längd.
- [ ] Taktiska order: ROUND THE BACK (flankera gruppen du slåss med, kommandoläge O/LT), MIND HIM (livvakt åt en
      annan grabb eller dig), TOOLED UP (ta den med vapnet; kräver pickDelay i world.nearestWeapon först).
- [ ] Egen 3D-animation för att låsa fast / bli fastlåst (i dag används grabbing/grabbed-klippen).
- [ ] Grabbarna siktar egna kast mot fiendeklungor.
- [ ] Firma på/av och firmans storlek i alternativmenyn (finns bara i sparfilen i dag, behöver tätare rader i menyn),
      och en THE FIRM-flik i HOW TO PLAY.
- [ ] Personlighet och egna initiativ i striden: hetsporren rusar in ensam, den fege stannar bak, lookout ropar BEHIND YA, singer drar
      igång en ramsa, bästa kompisar slåss bättre sida vid sida och blir galna när den andra slås ut, liability går
      för långt (heat). Rättning: oldschool-nervbonusen staplas i dag per grabb (firm.js nerve-loopen).
- [x] `test_firm.mjs` seedar Math.random (standard 1994, `FIRM_SEED=n` för andra), så körningarna är repeterbara.
- [ ] Testerna: `PIN ORDER: ...and pins him` fallerar med vissa seeds (t.ex. `FIRM_SEED=15`), alltså är pin-ordern
      fortfarande slumpkänslig. walkPlayer bevisar inget när PlayerController är avstängd.
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

- [x] Football Tour-kartan i 90-talsmatchprogramstil (ersätter listan på korktavlan i puben), där rykte låser upp
      resmål (`src/content/tour/index.js`, `src/ui/hub.js`). Tourvinster ger dubbelt rykte och +15 första gången.
- [x] Level-registret: varje arena är ett eget paket i `src/content/arenas/<id>/`, ofärdiga är `{ stub: true }` och
      visas som SOON på kartan.
- [ ] Bygg arenorna (tema, bana, boss och musik i varje paket): The Den, Stamford Bridge, Anfield, Old Trafford och
      Ibrox. Alla fem är stubbar i dag.
- [ ] Europa: Tyskland, Italien, Spanien och Sverige.

## Visionen i övrigt

- [ ] Dynamisk tid och dynamiskt väder (skymning till natt, dimma, vattenpölar).
- [ ] NPC:er som inte slåss: supportrar, fotgängare, personal och trafik.
- [ ] Dynamisk musik, ett komplett soundtrack och fler egna ramsor.
- [ ] Highscore per arena, arenaspecifika menyer och slutsekvenser.
