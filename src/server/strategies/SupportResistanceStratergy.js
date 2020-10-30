/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import uuid from 'uuid/v4';
import BaseStrategy from './BaseStrategy.js';

import TradeManager from '../core/TradeManager.js';
import {
    // percentageChange,
    roundToValidPrice,
    calculateSharesWithRiskFactor,
    shouldPlaceTrade,
    // formatTimestampToString
} from '../utils/utils.js';
import SupportResistance from '../indicators/SupportResistance.js';
import logger from '../logger/logger.js';

class SupportResistanceStrategy extends BaseStrategy {

    constructor() {
        super('SupportResistance');
    }

    process() {
        logger.info(`${this.name}: process`);
        return this.fetchTraceCandlesHistory().then(() => {
            return this.findSupportAndResistance();
        });
    }

    findSupportAndResistance() {
        const neglible = .005;
        const brokers = _.get(this.strategy, 'brokers', []);

        _.each(this.stocks, tradingSymbol => {
            const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
            if (data && data.traceCandles && data.traceCandles.length > 0) {
                // check first candle close with previous day close
                data.srpoints = SupportResistance.find(data.traceCandles);
                // console.log(tradingSymbol, "data.srpoints", data.srpoints);
                const lastCandle = data.traceCandles[data.traceCandles.length - 1];
                this.lastCandleTimestamp = lastCandle.timestamp;
                const longPosition = lastCandle.open < lastCandle.close;

                _.each(data.srpoints, srpoint => {
                    if (longPosition) {
                        const r = srpoint[1];
                        if (r >= lastCandle.close) {
                            const near = r * neglible;
                            if (lastCandle.close + near >= r) {
                                _.each(brokers, broker => {
                                    this.generateTradeSignals(data, lastCandle, roundToValidPrice(r + .1), broker);
                                    logger.info(`${this.name} ${tradingSymbol} Trade signals generated for broker ${broker}`);
                                });
                            }
                        }
                    } else {
                        const s = srpoint[0];
                        if (s < lastCandle.close) {
                            const near = s * neglible;
                            if (lastCandle.close - near <= s) {
                                _.each(brokers, broker => {
                                    this.generateTradeSignals(data, lastCandle, roundToValidPrice(s - .1), broker);
                                });
                            }
                        }
                    }
                });
            }
        });
    }

    shouldPlaceTrade(tradeSignal, liveQuote) {

        if (super.shouldPlaceTrade(tradeSignal, liveQuote) === false) {
            return false;
        }
        const cmp = liveQuote.cmp;
        if (shouldPlaceTrade(tradeSignal, cmp) === false) {
            return false;
        }
        const tm = TradeManager.getInstance();
        if (tm.isTradeAlreadyPlaced(tradeSignal, this.getName())) {
            return false;
        }
        let isReverseTrade = false;
        const oppTradeSignal = tm.getOppositeTradeSignal(tradeSignal);
        if (oppTradeSignal && oppTradeSignal.isTriggered) {
            if (!oppTradeSignal.considerOppositeTrade) {
                return false;
            } else {
                isReverseTrade = true;
            }
        }
        if (isReverseTrade === false) {
            if (_.get(this.strategy, 'enableRiskManagement', false) === true) {
                const MAX_TRADES_PER_DAY = parseInt(_.get(this.strategy, 'withRiskManagement.maxTrades', 1));
                const numberOfTradesPlaced = tm.getNumberOfStocksTradesPlaced(this.getName());
                if (numberOfTradesPlaced >= MAX_TRADES_PER_DAY) {
                    tm.disableTradeSignal(tradeSignal);
                    this.maxTradesReached = true;
                    return false;
                }
            }
        }
        return true;
    }

    generateTradeSignals(data, lastCandle, price, broker) {
        const longPosition = lastCandle.open < lastCandle.close;
        const tm = TradeManager.getInstance();

        if (!data.buyTradeSignal) {
            data.buyTradeSignal = {};
        }
        if (!data.sellTradeSignal) {
            data.sellTradeSignal = {};
        }

        let ts1 = data.buyTradeSignal[broker];
        let ts2 = data.sellTradeSignal[broker];

        const SL_PERCENTAGE = _.get(this.strategy, 'slPercentage', 0.2);
        const TARGET_PERCENTAGE = _.get(this.strategy, 'targetPercentage', .4);

        let enableRiskManagement = _.get(this.strategy, 'enableRiskManagement', false);

        let TOTAL_CAPITAL, CAPITAL_PER_TRADE, RISK_PERCENTAGE_PER_TRADE, MARGIN = 1;
        if (enableRiskManagement) {
            TOTAL_CAPITAL = parseInt(_.get(this.strategy, 'withRiskManagement.totalCapital', 1000));
            RISK_PERCENTAGE_PER_TRADE = parseFloat(_.get(this.strategy, 'withRiskManagement.riskPercentagePerTrade', 1.0));

        } else {
            CAPITAL_PER_TRADE = parseInt(_.get(this.strategy, 'withoutRiskManagement.capitalPerTrade', 1000));
            MARGIN = parseInt(_.get(this.strategy, 'withoutRiskManagement.margin', 1));
        }

        if (longPosition) {
            ts1 = {};
            ts1.broker = broker;
            ts1.placeBracketOrder = false;
            ts1.placeCoverOrder = false;
            ts1.strategy = this.getName();
            ts1.tradingSymbol = data.tradingSymbol;
            ts1.isBuy = true; // long signal
            ts1.trigger = price;
            ts1.stopLoss = roundToValidPrice(price - price * SL_PERCENTAGE / 100);
            ts1.target = roundToValidPrice(price + price * TARGET_PERCENTAGE / 100);

            if (enableRiskManagement) {
                ts1.quantity = calculateSharesWithRiskFactor(TOTAL_CAPITAL, ts1.trigger, ts1.stopLoss, RISK_PERCENTAGE_PER_TRADE);
            } else {
                ts1.quantity = parseInt((CAPITAL_PER_TRADE * MARGIN) / ts1.trigger);
            }

            ts1.considerOppositeTrade = false;
            ts1.timestamp = lastCandle.timestamp;
            ts1.tradeCutOffTime = this.strategyStopTimestamp;
            ts1.isTrailingSL = false;
            ts1.placeMarketOrderIfOrderNotFilled = false;
            ts1.changeEntryPriceIfOrderNotFilled = true;
            ts1.limitOrderBufferPercentage = 0.05;

            const oldts = tm.getTradeSignalOfSame(ts1);
            if (oldts) {
                ts1.correlationID = oldts.correlationID;
            } else if (ts2) {
                ts1.correlationID = ts2.correlationID;
            } else {
                ts1.correlationID = uuid();
            }
            logger.info(`${this.name}: ${data.tradingSymbol} LONG trade signal generated for ${broker} @ ${ts1.trigger}`);
        }

        if (!longPosition) {
            ts2 = {};
            ts2.broker = broker;
            ts2.placeBracketOrder = false;
            ts2.placeCoverOrder = false;
            ts2.strategy = this.getName();
            ts2.tradingSymbol = data.tradingSymbol;
            ts2.isBuy = false; // short signal
            ts2.trigger = price;
            ts2.stopLoss = roundToValidPrice(price + price * SL_PERCENTAGE / 100);
            ts2.target = roundToValidPrice(price - price * TARGET_PERCENTAGE / 100);

            if (enableRiskManagement) {
                ts2.quantity = calculateSharesWithRiskFactor(TOTAL_CAPITAL, ts2.trigger, ts2.stopLoss, RISK_PERCENTAGE_PER_TRADE);
            } else {
                ts2.quantity = parseInt((CAPITAL_PER_TRADE * MARGIN) / ts2.trigger);
            }

            ts2.considerOppositeTrade = false;
            ts2.timestamp = lastCandle.timestamp;
            ts2.tradeCutOffTime = this.strategyStopTimestamp;
            ts2.isTrailingSL = false;
            ts2.placeMarketOrderIfOrderNotFilled = false;
            ts2.changeEntryPriceIfOrderNotFilled = true;
            ts2.limitOrderBufferPercentage = 0.05;

            const oldts = tm.getTradeSignalOfSame(ts2);
            if (oldts) {
                ts2.correlationID = oldts.correlationID;
            } else if (ts1) {
                ts2.correlationID = ts1.correlationID;
            } else {
                ts2.correlationID = uuid();
            }
            logger.info(`${this.name} : ${data.tradingSymbol} SHORT trade signal generated for ${broker} @ ${ts2.trigger}`);
        }
        data.buyTradeSignal[broker] = ts1;
        data.sellTradeSignal[broker] = ts2;
        if (ts1) {
            tm.addTradeSignal(ts1);
            data.isTradeSignalGenerated = true;
        }
        if (ts2) {
            tm.addTradeSignal(ts2);
            data.isTradeSignalGenerated = true;
        }
    }
}

module.exports = new SupportResistanceStrategy(); // singleton class
