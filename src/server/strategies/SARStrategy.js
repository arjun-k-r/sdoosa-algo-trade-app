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
  isNear,
  formatToInput
  // formatTimestampToString
} from '../utils/utils.js';
// import SAR from '../indicators/SAR.js';
import SAR from "../indicators/SAR.js";
import logger from '../logger/logger.js';

const BollingerBands = require('technicalindicators').BollingerBands;
const VWAP = require('technicalindicators').VWAP;

class SARStrategy extends BaseStrategy {

  constructor() {
    super('SAR');
  }

  process() {
    logger.info(`${this.name}: process`);
    if (this.maxTradesReached) {
      return Promise.resolve();
    }

    return this.fetchTraceCandlesHistory().then(() => {
      const now = new Date();
      if (now < this.strategyStartTime) {
        return;
      }
      return this.findSupportAndResistance();
    });
  }

  findSupportAndResistance() {
    const brokers = _.get(this.strategy, 'brokers', []);
    const TARGET_PERCENTAGE = _.get(this.strategy, 'targetPercentage', .6);

    _.each(this.stocks, tradingSymbol => {
      const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
      if (data && data.traceCandles && data.traceCandles.length > 0) {

        // check first candle close with previous day close
        // data.sarpoints = SAR.find(data.traceCandles);
        data.sarpoints = SAR.calculate(data.traceCandles, TARGET_PERCENTAGE);

        console.log(tradingSymbol);
        console.log(data.sarpoints);

        const lastCandle = data.traceCandles[data.traceCandles.length - 1];
        const isBuy = lastCandle.open < lastCandle.close;
        _.each(data.sarpoints, sarpoint => {
          const [s, r] = sarpoint;
          if (isBuy) {
            if (isNear(r, lastCandle.close, TARGET_PERCENTAGE, true)) {
              _.each(brokers, broker => {
                return this.generateTradeSignals(data, true, r, broker);
              });
            }
          } else {
            if (isNear(s, lastCandle.close, TARGET_PERCENTAGE, false)) {
              _.each(brokers, broker => {
                return this.generateTradeSignals(data, false, s, broker);
              });
            }
          }
        });
      }
    });
  }

    confirmTrade = (tradeSignal, liveQuote) => {
      const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradeSignal.tradingSymbol);
      if (!data)
        return false;
      if (!this.confirmWithBollingerBands(data, tradeSignal, liveQuote)) {
        return false;
      }
      if (!this.confirmWithVWAPs(data, tradeSignal, liveQuote)) {
        return false;
      }
      return true;
    };

    confirmWithBollingerBands = (data, tradeSignal, liveQuote) => {
      const period = 14;
      const traceCandles = data.traceCandles;
      const input = {
        period: period,
        values: traceCandles.map(candle => candle.close),
        stdDev: 2
      };
      const lastCandle = traceCandles[traceCandles.length - 1];
      const bollingerBands = BollingerBands.calculate(input);
      const lastBollingerBand = bollingerBands[bollingerBands.length - 1];
      if (tradeSignal.isBuy && lastCandle.close > lastBollingerBand.middle > lastCandle.open) {
        return true;
      }
      if (!tradeSignal.isBuy && lastCandle.close < lastBollingerBand.middle < lastCandle.open) {
        return true;
      }
      return false;
    };

    confirmWithVWAP(data, tradeSignal, liveQuote) {
      const traceCandles = data.traceCandles;
      const input = formatToInput(traceCandles);
      const output = VWAP.calculate(input);
      const lastOutput = output[output.length - 1];
      const lastCandle = traceCandles[traceCandles.length - 1];
      if (tradeSignal.isBuy)
        return lastOutput < lastCandle.close;
      if (!tradeSignal.isBuy)
        return lastOutput > lastCandle.close;
      return false;
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
      return this.confirmTrade();
    }

    generateTradeSignals(data, longPosition, price, broker) {
      const lastCandle = data.traceCandles[data.traceCandles.length - 1];
      const tm = TradeManager.getInstance();

      const signalType = longPosition ? "buyTradeSignal" : "sellTradeSignal";

      if (!data.buyTradeSignal) {
        data.buyTradeSignal = {};
      }
      if (!data.sellTradeSignal) {
        data.sellTradeSignal = {};
      }

      const SL_PERCENTAGE = _.get(this.strategy, 'slPercentage', 0.2);
      const TARGET_PERCENTAGE = _.get(this.strategy, 'targetPercentage', .6);

      let enableRiskManagement = _.get(this.strategy, 'enableRiskManagement', false);

      let TOTAL_CAPITAL, CAPITAL_PER_TRADE, RISK_PERCENTAGE_PER_TRADE, MARGIN = 1;
      if (enableRiskManagement) {
        TOTAL_CAPITAL = parseInt(_.get(this.strategy, 'withRiskManagement.totalCapital', 1000));
        RISK_PERCENTAGE_PER_TRADE = parseFloat(_.get(this.strategy, 'withRiskManagement.riskPercentagePerTrade', 1.0));

      } else {
        CAPITAL_PER_TRADE = parseInt(_.get(this.strategy, 'withoutRiskManagement.capitalPerTrade', 1000));
        MARGIN = parseInt(_.get(this.strategy, 'withoutRiskManagement.margin', 1));
      }

      const ts1 = {};
      ts1.broker = broker;
      ts1.placeBracketOrder = false;
      ts1.placeCoverOrder = false;
      ts1.strategy = this.getName();
      ts1.tradingSymbol = data.tradingSymbol;
      ts1.isBuy = longPosition; // long signal
      ts1.trigger = price;
      if (ts1.isBuy) {
        ts1.stopLoss = roundToValidPrice(price - price * SL_PERCENTAGE / 100);
        ts1.target = roundToValidPrice(price + price * TARGET_PERCENTAGE / 100);
      } else {
        ts1.stopLoss = roundToValidPrice(price + price * SL_PERCENTAGE / 100);
        ts1.target = roundToValidPrice(price - price * TARGET_PERCENTAGE / 100);
      }

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
      } else {
        ts1.correlationID = uuid();
      }

      logger.info(`${this.name}: ${data.tradingSymbol} ${longPosition ? "LONG" : "SHORT"} trade signal generated for ${broker} @ ${ts1.trigger}`);
      const existingTradeSignal = data[signalType][broker];
      data[signalType][broker] = ts1;
      if (existingTradeSignal)
        tm.disableTradeSignal(existingTradeSignal);
      tm.addTradeSignal(ts1);
      data.isTradeSignalGenerated = true;
    }
}

module.exports = new SARStrategy(); // singleton class
