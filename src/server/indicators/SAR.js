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
    return this.levels.filter(x => Math.abs(l - x) < this.avgCandleSize).length === 0;
  }
  mostNearLevel(l, up) {
    const filtered = this.getLevels().filter(x => up ? x >= l : x <= l);
    console.log(l, up, this.getLevels(), filtered, filtered[up ? 0 : filtered.length - 1]);
    return filtered[up ? 0 : filtered.length - 1];
  }
  calculate() {
    const candles = this.candles;
    for (let i = 2; i < candles.length - 3; i++) {
      if (this.isSupport(candles, i)) {
        const l = candles[i].low;
        // if (this.isFarFromLevel(l)) {
        this.levels.push(l);
        // }
      }
      if (this.isResistance(candles, i)) {
        const l = candles[i].high;
        // if (this.isFarFromLevel(l)) {
        this.levels.push(l);
        // }
      }
    }
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
