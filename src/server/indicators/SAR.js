/*
  Author: Gokul T
*/

import _ from "lodash";
import { createClustors, range } from "../utils/utils";

class SAR {
  constructor(candles) {
    this.candles = candles;
    this.s = this.avgCandleSize();
    this.levels = [];
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
  avgCandleSize(candles = this.candles) {
    const levels = [];
    for (let i = 0; i < candles.length - 1; i++) {
      levels.push(candles[i].high - candles[i].low);
    }
    return _.mean(levels);
  }
  getAvgCandleSize() {
    return this.s;
  }
  isFarFromLevel(l) {
    const s = this.s;
    return this.levels.filter(x => Math.abs(l - x) < s).length === 0;
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
    return createClustors(this.levels, this.s).map(c => [c[0], c[c.length - 1]]);
  }
}

module.exports = SAR;
