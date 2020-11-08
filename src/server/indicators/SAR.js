/*
  Author: Gokul T
*/

import { createClustors, range, getAvgCandleSize } from "../utils/utils";

class SAR {
  constructor(candles) {
    this.candles = candles;
    this.avgCandleSize = getAvgCandleSize(candles);
    this.levels = [];
    this.calculate();
  }
  isSupport(candles, i) {
    const support = candles[i].low < candles[i - 1].low && candles[i].low < candles[i + 1].low && candles[i + 1].low < candles[i + 2].low && candles[i - 1].low < candles[i - 2].low;
    if (support)
      return Math.min(...range(candles.map(c => c.low), i, 6)) === candles[i].low;
    return false;
  }
  isResistance(candles, i) {
    const resistance = candles[i].high > candles[i - 1].high && candles[i].high > candles[i + 1].high && candles[i + 1].high > candles[i + 2].high && candles[i - 1].high > candles[i - 2].high;
    if (resistance)
      return Math.max(...range(candles.map(c => c.high), i, 6)) === candles[i].high;
    return false;
  }
  getAvgCandleSize() {
    return this.avgCandleSize;
  }
  isFarFromLevel(l) {
    return this.nearLevels(l).length === 0;
  }
  nearLevels(l) {
    return this.levels.filter(x => Math.abs(l - x) < this.avgCandleSize);
  }
  mostNearLevel(l, up) {
    const filtered = this.nearLevels(l).filter(x => up ? x >= l : x <= l);
    console.log(this.avgCandleSize, filtered, this.levels);
    if (filtered.length) {
      return filtered[up ? filtered.length - 1 : 0];
    }
    return null;
  }
  calculate() {
    const candles = this.candles;
    let highest = candles[0].high, lowest = candles[0].low;
    for (let i = 0; i < candles.length - 1; i++) {
      const l = candles[i].low;
      const h = candles[i].high;
      if (highest < h)
        highest = h;
      if (lowest > l)
        lowest = l;
      if (i >= 2 && i < candles.length - 3) {
        if (this.isSupport(candles, i)) {
          // if (this.isFarFromLevel(l)) {
          this.levels.push(l);
          // }
        }
        if (this.isResistance(candles, i)) {
          // if (this.isFarFromLevel(h)) {
          this.levels.push(h);
          // }
        }
      }
    }
    this.levels.push(highest);
    this.levels.push(lowest);
    this.levels = this.levels.sort((a, b) => a - b);
    return this.levels;
  }
  getLevels() {
    return this.levels;
  }
  calculateClusters() {
    return createClustors(this.getLevels(), this.avgCandleSize).map(c => [c[0], c[c.length - 1]]);
  }
}

module.exports = SAR;
