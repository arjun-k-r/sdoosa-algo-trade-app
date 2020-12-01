/*
  Author: Sreenivas Doosa
*/

// import _ from 'lodash';
import { getSamples } from '../../config.js';
import { splitAndMergeCandles } from "../../utils/utils.js";

class SampleHistoryAPIs {

    constructor() {
        this.samples = getSamples();
    }

    fetchHistory(tradingSymbol, interval, from, to) {
        const data = this.samples[tradingSymbol].map(sample => {
            const date = new Date(sample[0]);
            return {
                timestamp: date,
                date,
                open: sample[1],
                high: sample[2],
                low: sample[3],
                close: sample[4],
                volume: sample[5]
            };
        });
        let filteredData = data.filter(d => {
            if (d.date < from)
                return false;
            if (d.date > to)
                return false;
            return true;
        });
        if (interval === "day")
            filteredData = splitAndMergeCandles(filteredData);
        console.log(tradingSymbol, interval, from, to, filteredData.length);
        return Promise.resolve(filteredData);
    }

}

module.exports = new SampleHistoryAPIs(); // singleton class
