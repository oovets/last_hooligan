// Run state shared across levels (score, lives, inventory, outfit) + persistence hooks.
import { save } from '../save.js';
import { buildLook } from '../content/wardrobe.js';

export const MAX_SLOTS = 4;

export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.score = 0;
    this.character = save.data.character || 'kenny';
    this.lives = 3;
    this.cash = 0;
    this.levelIndex = 0;
    // [{ id, count }] consumables, max MAX_SLOTS different items. Every new game starts with your own bag of charlie and
    // a gum shield in the kit bag.
    this.inventory = [{ id: 'charlie', count: 1 }, { id: 'gumshield', count: 1 }];
    this.keys = new Set();         // key ids collected in the current level
    this.collected = {};           // levelId -> { scarves:Set(idx), badge:bool, secrets:Set }
    this.perks = {};               // e.g. { power: 0.1 } from unlocks
    this.continues = 3;
    this.stats = this.blankStats();
  }

  blankStats() { return { kos: 0, hits: 0, maxCombo: 0, damageTaken: 0, time: 0, secrets: 0, scarves: 0, items: 0 }; }

  look() { return buildLook(save.data.outfit); }

  addItem(id, count = 1) {
    const s = this.inventory.find(i => i.id === id);
    if (s) { s.count = Math.min(9, s.count + count); return true; }
    if (this.inventory.length >= MAX_SLOTS) return false;
    this.inventory.push({ id, count });
    return true;
  }

  takeItem(slot) {
    const s = this.inventory[slot];
    if (!s) return null;
    s.count--;
    if (s.count <= 0) this.inventory.splice(slot, 1);
    return s.id;
  }

  levelRecord(levelId) {
    return (this.collected[levelId] ||= { scarves: new Set(), badge: false, secrets: new Set() });
  }

  // Snapshot for "continue" (stored when a level starts).
  snapshot() {
    return { character: this.character, score: this.score, lives: this.lives, cash: this.cash, levelIndex: this.levelIndex, inventory: this.inventory.map(i => ({ ...i })) };
  }

  restore(snap) {
    if (!snap) return;
    if (snap.character) this.character = snap.character;
    this.score = snap.score; this.lives = snap.lives; this.cash = snap.cash; this.levelIndex = snap.levelIndex;
    this.inventory = (snap.inventory || []).map(i => ({ ...i }));
  }
}

export const game = new GameState();
