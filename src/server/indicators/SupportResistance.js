/*
  Author: Sreenivas Doosa
*/
import _ from 'lodash';
import {
    range,
    createClustors
} from '../utils/utils.js';
// import logger from '../logger/logger.js';

class SupportResistance {
    find(candles, neglible = .005) {
        const minCandlesRange = candles.length / 10;
        // check first candle close with previous day close
        const supportPoints = [];
        const resistantPoints = [];
        _.each(candles, (candle, i) => {
            if ((2 < i) && (i < (candles.length - 3))) {
                if (candles[i - 2].high < candles[i - 1].high) {
                    if (candles[i - 1].high < candle.high) {
                        if (candle.high > candles[i + 1].high) {
                            if (candles[i + 1].high > candles[i + 2].high) {
                                const highes = range(candles, i, minCandlesRange).map(c => c.high);
                                if (Math.max(...highes) === candle.high) {
                                    supportPoints.push(candle.high);
                                }
                            }
                        }
                    }
                }
                if (candles[i - 2].low > candles[i - 1].low) {
                    if (candles[i - 1].low > candle.low) {
                        if (candle.low < candles[i + 1].low) {
                            if (candles[i + 1].low < candles[i + 2].low) {
                                const lowes = range(candles, i, minCandlesRange).map(c => c.low);
                                if (Math.min(...lowes) === candle.low) {
                                    resistantPoints.push(candle.low);
                                }
                            }
                        }
                    }
                }
            }
        });
        const breakpoints = [].concat(supportPoints, resistantPoints);
        const clusters = createClustors(breakpoints, neglible);

        return clusters.map(cluster => {
            return [cluster[0], cluster[cluster.length - 1]];
        });
    }
}

module.exports = new SupportResistance(); // singleton class
