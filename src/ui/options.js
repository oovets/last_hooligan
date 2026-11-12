// Options items (shared by the main-menu OPTIONS screen and the in-game pause menu) + key binding table.
import { VIEW_W } from '../engine/constants.js';
import { KEYMAP } from '../engine/input.js';
import { drawText } from '../engine/font.js';
import { save } from '../save.js';
import { audio } from '../audio/audio.js';
import { C, keyCap } from './widgets.js';

const DIFFS = ['easy', 'normal', 'hard'];
const DIFF_HINT = { easy: 'SUNDAY LEAGUE - SOFTER HITS, FEWER PROBLEMS', normal: 'MATCHDAY - HOW IT WAS MEANT TO BE', hard: 'CUP FINAL - THEY HIT BACK. HARD.' };
const CTRL_HINT = {
  screen: 'SCREEN: UP MOVES UP THE SCREEN (RECOMMENDED)',
  iso: 'ISO: UP/DOWN/LEFT/RIGHT FOLLOW THE STREETS (DIAGONALS)',
};

export function optionItems({ inGame = false, onKeys, onBack, onReset } = {}) {
  const s = save.data.settings;
  const vol = (k, dv) => () => {
    s[k] = Math.max(0, Math.min(1, Math.round(((s[k] ?? 0.5) + dv) * 10) / 10));
    audio.setVolumes({ music: s.music, sfx: s.sfx });
    save.write();
    if (k === 'sfx') audio.sfx('punch');
  };
  const toggle = k => () => { s[k] = !s[k]; save.write(); };
  const onOff = k => () => (s[k] === false ? 'OFF' : 'ON');
  const cycle = (k, list, d) => () => { const i = list.indexOf(s[k]); s[k] = list[((i < 0 ? 0 : i) + d + list.length) % list.length]; save.write(); };
  const items = [
    { label: 'MUSIC', slider: () => s.music ?? 0.6, left: vol('music', -0.1), right: vol('music', 0.1), hint: '← → TO ADJUST' },
    { label: 'SOUND FX', slider: () => s.sfx ?? 0.8, left: vol('sfx', -0.1), right: vol('sfx', 0.1), hint: '← → TO ADJUST' },
    { label: 'SCREEN SHAKE', value: onOff('shake'), left: toggle('shake'), right: toggle('shake'), hint: 'CAMERA SHAKE ON BIG HITS' },
    { label: 'DIFFICULTY', value: () => (s.difficulty || 'normal').toUpperCase(), left: cycle('difficulty', DIFFS, -1), right: cycle('difficulty', DIFFS, 1), hint: () => DIFF_HINT[s.difficulty] + (inGame ? ' (FROM NEXT LEVEL)' : '') },
    { label: 'CONTROLS', value: () => (s.controls === 'iso' ? 'ISO' : 'SCREEN'), left: cycle('controls', ['screen', 'iso'], -1), right: cycle('controls', ['screen', 'iso'], 1), hint: () => CTRL_HINT[s.controls === 'iso' ? 'iso' : 'screen'] },
    { label: 'MINIMAP', value: onOff('minimap'), left: toggle('minimap'), right: toggle('minimap'), hint: 'CORNER MAP IN THE HUD' },
    { label: 'BUTTON HINTS', value: onOff('hints'), left: toggle('hints'), right: toggle('hints'), hint: 'SHOW CONTROL REMINDERS' },
    { label: 'SCANLINES', value: () => (s.scanlines ? 'ON' : 'OFF'), left: () => { s.scanlines = !s.scanlines; save.write(); }, right: () => { s.scanlines = !s.scanlines; save.write(); }, hint: 'OLD TELLY MODE' },
    { label: 'FULLSCREEN', value: () => (typeof document !== 'undefined' && document.fullscreenElement ? 'ON' : 'OFF'), fn: toggleFullscreen, hint: 'PRESS TO TOGGLE' },
  ];
  if (!inGame) {
    // 2D classic renderer or the Three.js 3D renderer (phase A). Switching reloads the page so the renderer is set up cleanly.
    const flip = () => { s.renderer = s.renderer === '3d' ? '2d' : '3d'; save.write(); const u = new URL(location.href); u.searchParams.delete('renderer'); location.href = u.toString(); };
    items.splice(items.length - 1, 0, { label: 'GRAPHICS', value: () => (s.renderer === '3d' ? '3D (BETA)' : '2D CLASSIC'), left: flip, right: flip, hint: '3D: REAL LIGHTS AND SHADOWS. RELOADS THE GAME' });
  }
  if (onKeys) items.push({ label: 'KEY BINDINGS', fn: onKeys, hint: 'KEYBOARD AND GAMEPAD LAYOUT' });
  if (onReset) {
    let armed = -10;
    items.push({
      label: () => (performance.now() - armed < 2500 ? 'REALLY? PRESS AGAIN' : 'RESET SAVE DATA'),
      color: '#ff7a7a',
      fn: () => { const now = performance.now(); if (now - armed < 2500) { onReset(); armed = -10; } else { armed = now; audio.sfx('locked'); } },
      hint: 'WIPES PROGRESS, CASH, WARDROBE AND SCORES',
    });
  }
  if (onBack) items.push({ label: 'BACK', fn: onBack, hint: '' });
  return items;
}

export function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  } catch (e) { /* not available */ }
}

// ---------------------------------------------------------------- bindings
export const BIND_ROWS = [
  ['MOVE', ['up', 'left', 'down', 'right'], 'STICK / D-PAD'],
  ['RUN', null, 'DOUBLE-TAP / FULL STICK', 'DOUBLE-TAP A DIRECTION'],
  ['PUNCH (LEFT)', ['punchL'], 'X'],
  ['PUNCH (RIGHT)', ['punchR'], 'Y'],
  ['KICK', ['kick'], 'B'],
  ['JUMP', ['jump'], 'A'],
  ['BLOCK (HOLD)', ['block'], 'RB / RT'],
  ['DODGE ROLL', ['dodge'], 'LT'],
  ['GRAB / THROW WEAPON', ['grab'], 'LB'],
  ['PICK UP / USE / READ', ['use'], 'STICK CLICK'],
  ['EAT / DRINK SLOT 1-3', ['item1', 'item2', 'item3'], '-'],
  ['KIT BAG', ['inventory'], 'SELECT'],
  ['PAUSE', ['pause'], 'START'],
];

function codeName(c) {
  return c.replace('Key', '').replace('Digit', '').replace('Arrow', '').replace('ShiftLeft', 'SHIFT').replace('ShiftRight', 'R-SHIFT').replace('Escape', 'ESC').replace('Backspace', 'BKSP').replace('NumpadEnter', 'NUM ENTER').toUpperCase();
}

export function bindingText(actions) {
  if (!actions) return '';
  if (actions.length === 4 && actions[0] === 'up') return 'WASD / ARROWS';
  if (actions.length === 3) return '1 / 2 / 3';
  const codes = KEYMAP[actions[0]] || [];
  return codes.map(codeName).join(' / ');
}

export function drawBindings(ctx, x, y, rowH = 14) {
  drawText(ctx, 'ACTION', x, y, { color: C.dim });
  drawText(ctx, 'KEYBOARD', x + 170, y, { color: C.dim });
  drawText(ctx, 'GAMEPAD', x + 330, y, { color: C.dim });
  ctx.fillStyle = C.red; ctx.fillRect(x, y + 9, 440, 1);
  BIND_ROWS.forEach(([name, acts, pad, kbAlt], i) => {
    const yy = y + 16 + i * rowH;
    if (i % 2) { ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(x - 4, yy - 3, 448, rowH); }
    drawText(ctx, name, x, yy, { color: C.gold });
    const kb = kbAlt || bindingText(acts);
    drawText(ctx, kb, x + 170, yy, { color: '#ffffff' });
    drawText(ctx, pad, x + 330, yy, { color: '#c0e8ff' });
  });
  return y + 16 + BIND_ROWS.length * rowH;
}

// Compact key-cap control card (used by HOW TO PLAY and the pause menu).
export function drawControlCard(ctx, x, y) {
  const rows = [
    ['WASD', 'MOVE (DOUBLE-TAP TO RUN)'], ['J', 'PUNCH'], ['K', 'PUNCH 2'], ['L', 'KICK'], ['SPACE', 'JUMP'],
    ['SHIFT', 'BLOCK'], ['O', 'DODGE'], ['I', 'GRAB / THROW'], ['E', 'PICK UP / USE'], ['1 2 3', 'EAT & DRINK'], ['TAB', 'KIT BAG'], ['ESC', 'PAUSE'],
  ];
  rows.forEach(([k, t], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const xx = x + col * 200, yy = y + row * 15;
    const w = keyCap(ctx, k, xx, yy);
    drawText(ctx, t, xx + Math.max(w, 44) + 4, yy + 1, { color: '#e8e0f0' });
  });
}

export const OPT_W = 300;
export const optX = () => Math.round(VIEW_W / 2 - OPT_W / 2);
