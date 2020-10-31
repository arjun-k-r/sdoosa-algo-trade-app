/*
  Author: Gokul T
*/
import {
    createClustors
} from '../utils/utils.js';

class SAR {
    isSupport(df, i) {
        const support = df[i]['low'] < df[i - 1]['low'] && df[i]['low'] < df[i + 1]['low'] && df[i + 1]['low'] < df[i + 2]['low'] && df[i - 1]['low'] < df[i - 2]['low'];
        return support;
    }
    isResistance(df, i) {
        const resistance = df[i]['high'] > df[i - 1]['high'] && df[i]['high'] > df[i + 1]['high'] && df[i + 1]['high'] > df[i + 2]['high'] && df[i - 1]['high'] > df[i - 2]['high'];
        return resistance;
    }
    calculate(candles, neglible = .005) {
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