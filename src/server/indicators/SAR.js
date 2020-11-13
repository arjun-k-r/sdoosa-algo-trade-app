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
    this.clusters = this.calculateClusters();
  }
  isHigh(i, candles = this.candles) {
    return Math.max(...range(candles.map(c => c.high), i, 3)) === candles[i].high;
  }
  isLow(i, candles = this.candles) {
    return Math.min(...range(candles.map(c => c.low), i, 3)) === candles[i].low;
  }
  isSupport(candles, i) {
    const support = candles[i].low < candles[i - 1].low && candles[i].low < candles[i + 1].low && candles[i + 1].low < candles[i + 2].low && candles[i - 1].low < candles[i - 2].low;
    if (support)
      return this.isLow(i);
    return false;
  }
  isResistance(candles, i) {
    const resistance = candles[i].high > candles[i - 1].high && candles[i].high > candles[i + 1].high && candles[i + 1].high > candles[i + 2].high && candles[i - 1].high > candles[i - 2].high;
    if (resistance)
      return this.isHigh(i);
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
      } else {
        if (this.isLow(i)) {
          this.levels.push(candles[i].low);
        }
        if (this.isHigh(i)) {
          this.levels.push(candles[i].high);
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
  currentSupportAndResisitance(cmp) {
    const clusters = this.calculateClusters();
    let s, r;
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      if (cluster[0] > cmp) {
        r = cluster[1];
        if (i)
          s = clusters[i - 1][0];
        break;
      }
      else if (cluster[1] > cmp) {
        r = cluster[1];
        if (cluster[0] < cmp) {
          s = cluster[0];
          break;
        }
        else if (i) {
          s = clusters[i - 1][0];
        }
      }
    }
    const perfect = s < cmp && r > cmp;
    return {
      perfect,
      s,
      r
    };
  }
  getClusters() {
    return this.clusters;
  }
  breakOutPoint(cmp) {
    const clusters = this.getClusters();
    const filtered = clusters.map(c => c[1]).filter(x => Math.abs(cmp - x) < this.avgCandleSize);
    return filtered[filtered.length - 1];
  }
  breakDownPoint(cmp) {
    const clusters = this.getClusters();
    const filtered = clusters.map(c => c[0]).filter(x => Math.abs(cmp - x) < this.avgCandleSize);
    return filtered[0];
  }
  isBreakOut(cmp) {
    const breakOutPoint = this.breakOutPoint(cmp);
    return breakOutPoint && cmp > breakOutPoint;
  }
  isBreakDown(cmp) {
    const breakDownPoint = this.breakDownPoint(cmp);
    return breakDownPoint && cmp < breakDownPoint;
  }
}

module.exports = SAR;
