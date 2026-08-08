// ============================================================
// 织律 Weaveline - Deterministic Random Engine
// mulberry32 + fork support for named RNG branches
// ============================================================

class SeededRandom {
  constructor(seed) {
    this._state = seed | 0;
    if (this._state === 0) this._state = 1;
  }

  /** Returns [0, 1) float */
  nextFloat() {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns integer in [min, max] inclusive */
  nextInt(min, max) {
    if (min > max) [min, max] = [max, min];
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }

  /** Weighted random pick */
  weightedPick(items) {
    if (!items || items.length === 0) return null;
    const totalWeight = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
    if (totalWeight <= 0) return items[0].value;
    let roll = this.nextFloat() * totalWeight;
    for (const item of items) {
      roll -= Math.max(0, item.weight);
      if (roll <= 0) return item.value;
    }
    return items[items.length - 1].value;
  }

  /** Uniform random pick from array */
  pick(items) {
    if (!items || items.length === 0) return null;
    return items[this.nextInt(0, items.length - 1)];
  }

  /** Shuffle array in place */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Fork a named branch - uses hash of label to create independent stream */
  fork(label) {
    let hash = 0;
    const str = String(label);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return new SeededRandom(this._state + hash);
  }

  getState() { return this._state; }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SeededRandom };
}
