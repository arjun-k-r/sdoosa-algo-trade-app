/*
  Author: Gokul T
*/
import {
  createClustors
} from '../utils/utils.js';

class SAR {
  isSupport(candles, i) {
    const support = candles[i].low < candles[i - 1].low && candles[i].low < candles[i + 1].low && candles[i + 1].low < candles[i + 2].low && candles[i - 1].low < candles[i - 2].low;
    return support;
  }
  isResistance(candles, i) {
    const resistance = candles[i].high > candles[i - 1].high && candles[i].high > candles[i + 1].high && candles[i + 1].high > candles[i + 2].high && candles[i - 1].high > candles[i - 2].high;
    return resistance;
  }
  calculate(candles, neglible = .006) {
    const levels = [];
    for (let i = 2; i < candles.length - 2; i++) {
      if (this.isSupport(candles, i)) {
        levels.push(candles[i].low);
      }
      if (this.isResistance(candles, i)) {
        levels.push(candles[i].high);
      }
    }
    const clusters = createClustors(levels, neglible);
    return clusters.map(cluster => {
      return [cluster[0], cluster[cluster.length - 1]];
    });
  }
}

module.exports = new SAR();
