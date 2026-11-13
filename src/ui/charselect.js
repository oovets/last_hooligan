// Character select: pick who you play as. Big rotating Blender-rendered preview demoing signature moves,
// stat bars, bio and move list. Locked characters show their unlock condition.
import { VIEW_W, VIEW_H } from '../engine/constants.js';
import { input } from '../engine/input.js';
import { drawText } from '../engine/font.js';
import { app } from '../app.js';
import { save } from '../save.js';
import { audio } from '../audio/audio.js';
import { game } from '../game/state.js';
import { CHARACTERS, isCharacterUnlocked } from '../content/characters.js';
import { TRAITS } from '../game/firmdata.js';   // (also adds the firm's lads to CHARACTERS)
import { buildLook } from '../content/wardrobe.js';
import { drawDoll, drawPortrait, normalizeLook } from '../game/doll.js';
import { sampleAnim, attackPose, ATTACK_POSES, ANIMS } from '../game/poses.js';
import { ATTACKS } from '../game/combat.js';
import { specForLook, drawCharacter, SPRITE_MODELS } from '../game/sprites.js';
import { backdrop } from './backdrop.js';
import { frame, bar, hintBar, heading, lockIcon, Repeater, blink, C, rrect, devScale } from './widgets.js';
import { r3d } from '../render3d/index.js';

const MOVES = {
  hooligan: ['J J J / J K L / K J K COMBOS', 'L L = SPIN KICK', 'RUN + J = SHOULDER CHARGE', 'WARDROBE: DRESS HIM UP'],
  mo: ['K = HAMMER FIST (KNOCKDOWN)', 'RUN + J = FRIDGE CHARGE', 'SHRUGS OFF LIGHT HITS', 'SLOW BUT HUGE HEALTH'],
  stig: ['J = LIGHTNING FLURRY', 'RUN + L = SLIDE TACKLE', 'FASTEST RUNNER IN TOWN', 'GLASS JAW - KEEP MOVING'],
  bigal: ['E = TOP OFF: HELICOPTER TWIRL, SHIRT IN THE FACE', 'THE REVEAL FREEZES THEM. LADS GO AL! AL! AL!', 'BARE-CHESTED: HITS HARDER, TAKES MORE', 'L = THE STEPLADDER. LONGEST REACH IN TOWN'],
  kenny: ['K = SHOWTIME BOMB (KNOCKDOWN)', 'RUN + J = SPEAR TACKLE', 'THE MORE HE BLEEDS, THE HARDER HE HITS', 'NEVER BLOCKS. NEVER BACKS DOWN.'],
  vic: ['I = STRYPGREPP (CHOKEHOLD) - LIFTS AND STRANGLES', 'IN THE GRIP: J/K = TIGHTEN, 3RD = CHOKESLAM', 'RUN + I = LUNGE FOR THE THROAT', 'WINS A FIGHT? "VILL DU DÖ ELLER?"'],
  oldboy: ['K = OLD-SCHOOL HEADBUTT', 'TOUGH AS OLD BOOTS', 'SEEN IT ALL', 'NEVER TAKES HIS CAP OFF'],
};
// the firm's lads (game/firmdata.js): the standard moveset and their trait
const ladMoves = c => ['J J J / J K L / K J K COMBOS', 'L L = SPIN KICK', 'RUN + J = SHOULDER CHARGE', c.trait && TRAITS[c.trait] ? TRAITS[c.trait].name + ': ' + TRAITS[c.trait].desc : 'ONE OF THE FIRM'];
const DEMO = {
  hooligan: ['jab', 'cross', 'hook', 'uppercut'], mo: ['haymaker', 'bodySlam'], stig: ['jab', 'hook', 'jab', 'flyingKick'],
  kenny: ['cross', 'kenny_bomb', 'shoulder'], bigal: ['jab', 'al_stepladder', 'al_strip'], vic: ['choking', 'vic_tighten', 'vic_tighten', 'vic_chokeslam'], oldboy: ['jab', 'headbutt', 'kick'],
};
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

function lookOf(c) { return normalizeLook(c.look || buildLook(save.data.outfit)); }

export class CharSelectScene {
  constructor(levelIndex, onPick) {
    this.levelIndex = levelIndex; this.onPick = onPick;
    this.t = 0; this.rep = new Repeater();
    // always opens on Kenny Showtime (whoever you played last)
    this.sel = Math.max(0, CHARACTERS.findIndex(c => c.id === 'kenny'));
    this.picked = -1; this.pickT = 0;
    this.looks = CHARACTERS.map(lookOf);
    this.specs = this.looks.map(l => specForLook(l));
    this.demoT = 0;
  }

  update(dt) {
    this.t += dt; this.demoT += dt; backdrop.update(dt);
    if (this.picked >= 0) {
      this.pickT += dt;
      if (this.pickT > 0.9) this.onPick();
      return;
    }
    const n = CHARACTERS.length;
    const mv = d => { this.sel = (this.sel + d + n) % n; this.demoT = 0; audio.sfx('menuMove'); };
    if (this.rep.check('menuLeft', dt)) mv(-1);
    if (this.rep.check('menuRight', dt)) mv(1);
    if (input.pressed('confirm') || input.pressed('punchL')) {
      const c = CHARACTERS[this.sel];
      if (!isCharacterUnlocked(c, save.data)) { audio.sfx('locked'); return; }
      save.data.character = c.id; save.write();
      game.character = c.id;
      this.picked = this.sel; this.pickT = 0;
      audio.sfx('menuSelect'); audio.sfx('crowdCheer');
    } else if (input.pressed('back')) { audio.sfx('menuBack'); app.go(app.scenes.menu()); }
  }

  // current preview pose: cycle of signature attacks, then a taunt, then a turn
  demo(c) {
    const seq = DEMO[c.id] || ['jab'];
    const per = 0.55, cyc = seq.length * per + 1.4;
    const t = this.demoT % cyc;
    const k = Math.floor(t / per);
    if (k < seq.length) {
      const name = seq[k], p = (t % per) / per;
      if (ANIMS[name]) return { anim: name, t };
      const atk = ATTACKS[name], pose = (atk && atk.pose) || name;
      if (ATTACK_POSES[pose]) {
        const ph = p < 0.4 ? 0 : p < 0.6 ? 1 : 2, pp = ph === 0 ? p / 0.4 : ph === 1 ? (p - 0.4) / 0.2 : (p - 0.6) / 0.4;
        return { attack: pose, phase: ph, p: pp };
      }
    }
    return { anim: t > cyc - 0.7 ? (c.id === 'kenny' || c.id === 'stig' ? 'taunt' : 'victory') : 'guard', t };
  }

  drawFighter(ctx, i, x, y, scale, facing, dark) {
    const c = CHARACTERS[i], spec = this.specs[i], look = this.looks[i];
    const d = this.demo(c);
    // rigged 3D character when the 3D renderer is loaded
    const stage = r3d.menu;
    if (stage && stage.ready) {
      const pose = d.attack ? attackPose(d.attack, d.phase, d.p) : null;
      const yaw = 0.35 + Math.sin(this.t * 0.45) * 0.55;
      const H = 150 * (look.height || 1);
      if (stage.draw(ctx, 'select', [{ look, x, feet: y, h: H, anim: d.anim || 'guard', phase: d.t - this.t, pose, yaw, dark }], { x: 16, y: 40, w: 246, h: 248 }, this.t, { light: 'studio', persp: true })) return;   // hero shot: perspective
    }
    if (SPRITE_MODELS[spec.model]) {
      let clip = 'idle', frame = 0;
      const meta = SPRITE_MODELS[spec.model].meta;
      if (d.attack) {
        clip = 'atk_' + d.attack;
        frame = d.phase === 0 ? (d.p < 0.5 ? 0 : 1) : d.phase === 1 ? 2 : 3;
      } else {
        clip = meta.clips[d.anim] ? d.anim : 'idle';
        const C2 = meta.clips[clip];
        frame = C2.kind === 'loop' ? Math.floor((d.t % C2.dur) / C2.dur * C2.n) % C2.n : Math.min(C2.n - 1, Math.floor(d.t * 8));
      }
      if (meta.clips[clip]) {
        drawCharacter(ctx, x, y, spec, clip, frame, facing[0], facing[1], { scale, silhouette: dark ? '#141018' : null });
        return;
      }
    }
    const pose = d.attack ? attackPose(d.attack, d.phase, d.p) : sampleAnim(d.anim, d.t);
    drawDoll(ctx, x, y, look, pose, { scale: scale * (look.height || 1) * 0.9, flip: facing[0] - facing[1] < 0, silhouette: dark ? '#141018' : null, face: 'angry', time: this.t });
  }

  draw(ctx) {
    backdrop.draw(ctx, false);
    ctx.fillStyle = 'rgba(5,3,10,0.55)'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    heading(ctx, 'CHOOSE YOUR LAD', VIEW_W / 2, 8, { scale: 2 });
    const c = CHARACTERS[this.sel];
    const unlocked = isCharacterUnlocked(c, save.data);

    // ---- big preview (rotates slowly between facings)
    frame(ctx, 14, 38, 250, 252, { accent: C.red });
    // floor disc + spotlight
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(139, 250, 4, 139, 250, 110);
    g.addColorStop(0, 'rgba(255,230,180,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(16, 40, 246, 248);
    ctx.restore();
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(139, 262, 46, 14, 0, 0, Math.PI * 2); ctx.fill();
    // spotlight cone
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const cone = ctx.createLinearGradient(0, 40, 0, 262);
    cone.addColorStop(0, 'rgba(255,240,215,0.16)'); cone.addColorStop(1, 'rgba(255,240,215,0.02)');
    ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(129, 40); ctx.lineTo(149, 40); ctx.lineTo(205, 262); ctx.lineTo(73, 262); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save(); ctx.shadowColor = 'rgba(242,200,17,0.9)'; ctx.shadowBlur = 8 * devScale(ctx);
    ctx.strokeStyle = 'rgba(255,214,60,0.9)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(139, 262, 50, 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    const di = Math.floor(this.t / 2.2) % 3;
    const facing = [DIRS[0], DIRS[1], DIRS[7]][di];
    const pickBounce = this.picked >= 0 ? Math.sin(Math.min(1, this.pickT * 3) * Math.PI) * 8 : 0;
    this.drawFighter(ctx, this.sel, 139, 262 - pickBounce, 2.3, facing, !unlocked);
    if (!unlocked) { lockIcon(ctx, 131, 140, 2); }
    drawText(ctx, c.nick ? '"' + c.nick + '"' : '', 139, 276, { color: C.dim, align: 'center' });

    // ---- info panel
    const px = 278, pw = VIEW_W - px - 14;
    frame(ctx, px, 38, pw, 252, { title: unlocked ? 'PLAYER PROFILE' : 'LOCKED', titleBg: unlocked ? C.red : '#3a3a40' });
    drawText(ctx, c.name, px + 10, 52, { color: unlocked ? C.gold : C.off, scale: 2, outline: '#000' });
    drawText(ctx, c.tagline, px + 10, 72, { color: C.text });
    const st = c.stats || {};
    [['POWER', st.power, '#ff4a4a'], ['SPEED', st.speed, '#3af0e0'], ['TOUGHNESS', st.toughness, '#ffd23a'], ['TECHNIQUE', st.technique, '#ff3aa0']].forEach(([lab, v, col], k) => {
      const y = 90 + k * 13;
      drawText(ctx, lab, px + 10, y, { color: C.dim });
      bar(ctx, px + 86, y - 1, 120, 7, (v || 0) / 5, col, '#ffffff', undefined, 5);
    });
    (c.bio || []).forEach((l, k) => drawText(ctx, l, px + 10, 148 + k * 10, { color: '#c0b8d0' }));
    drawText(ctx, 'MOVES', px + 10, 186, { color: C.gold });
    (MOVES[c.id] || ladMoves(c)).forEach((l, k) => drawText(ctx, '* ' + l, px + 14, 198 + k * 11, { color: C.text }));
    if (!unlocked) drawText(ctx, c.unlock && c.unlock.completed ? 'FINISH THE GAME TO UNLOCK' : 'KEEP PLAYING TO UNLOCK', px + pw / 2, 270, { color: C.bad, align: 'center' });

    // ---- roster strip (portraits)
    const n = CHARACTERS.length, cw = Math.min(40, Math.floor((VIEW_W - 24 + 6) / n) - 6), x0 = Math.round(VIEW_W / 2 - (n * (cw + 6) - 6) / 2), y0 = 298;   // (shrinks to fit the roster)
    const stage = r3d.menu, busts = [];
    CHARACTERS.forEach((ch, i) => {
      const x = x0 + i * (cw + 6), sel = i === this.sel;
      frame(ctx, x, y0, cw, 36, { accent: sel ? C.gold : null, fill: sel ? 'rgba(74,62,6,0.95)' : 'rgba(12,12,14,0.9)', rivets: false, edge: sel ? '#ffd23a' : undefined });
      busts.push({ look: this.looks[i], x: x + cw / 2, feet: y0 + 4 + 118 * (this.looks[i].height || 1), h: 118 * (this.looks[i].height || 1), anim: 'idle', phase: i * 0.7, yaw: sel ? 0.25 + Math.sin(this.t * 2) * 0.2 : 0.35, dark: !isCharacterUnlocked(ch, save.data) });
    });
    let drew3d = false;
    if (stage && stage.ready) {
      ctx.save();
      ctx.beginPath(); CHARACTERS.forEach((ch, i) => rrect(ctx, x0 + i * (cw + 6) + 1, y0 + 1, cw - 2, 34, 4, true)); ctx.clip();
      drew3d = stage.draw(ctx, 'roster', busts, { x: x0 - 6, y: y0 - 4, w: n * (cw + 6) + 6, h: 44 }, this.t, { light: 'studio' });
      ctx.restore();
    }
    CHARACTERS.forEach((ch, i) => {
      if (drew3d) {
        const x = x0 + i * (cw + 6), sel = i === this.sel;
        if (!isCharacterUnlocked(ch, save.data)) lockIcon(ctx, x + 17, y0 + 14, 1);
        if (sel) { ctx.save(); ctx.shadowColor = 'rgba(255,210,58,0.9)'; ctx.shadowBlur = 8 * devScale(ctx); ctx.strokeStyle = C.gold; ctx.lineWidth = 1; rrect(ctx, x - 1, y0 - 1, cw + 2, 38, 5); ctx.stroke(); ctx.restore(); }
        return;
      }
      const x = x0 + i * (cw + 6), sel = i === this.sel, ok = isCharacterUnlocked(ch, save.data);
      frame(ctx, x, y0, cw, 36, { accent: sel ? C.gold : null, fill: sel ? 'rgba(74,62,6,0.95)' : 'rgba(12,12,14,0.9)', rivets: false });
      if (ok) drawPortrait(ctx, this.looks[i], x + 4, y0 + 3, 32, { face: sel ? 'shout' : 'angry' });
      else { ctx.fillStyle = '#141018'; ctx.fillRect(x + 4, y0 + 3, 32, 30); lockIcon(ctx, x + 16, y0 + 12, 1); }
      if (sel && blink(this.t, 3)) { ctx.fillStyle = C.gold; ctx.fillRect(x - 2, y0 - 4, cw + 4, 2); }
    });
    hintBar(ctx, [['menuLeft', 'CHOOSE'], ['confirm', 'PICK'], ['back', 'BACK']], VIEW_H - 12);
    if (this.picked >= 0) {
      ctx.globalAlpha = Math.min(1, this.pickT * 2) * 0.9;
      drawText(ctx, "LET'S 'AVE IT!", VIEW_W / 2, 150, { color: C.gold, scale: 3, align: 'center', outline: '#000' });
      ctx.globalAlpha = 1;
    }
  }
}

app.scenes.charSelect = (levelIndex, onPick) => new CharSelectScene(levelIndex, onPick);
