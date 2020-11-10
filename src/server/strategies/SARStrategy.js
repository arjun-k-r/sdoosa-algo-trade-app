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
  formatToInput,
  // getAvgCandleSize
  // formatTimestampToString
} from '../utils/utils.js';
// import SAR from '../indicators/SAR.js';
import SAR from "../indicators/SAR.js";
import logger from '../logger/logger.js';
import { getConfig } from '../config.js';

const BollingerBands = require('technicalindicators').BollingerBands;
const VWAP = require('technicalindicators').VWAP;
const RSI = require('technicalindicators').RSI;
const Stochastic = require('technicalindicators').Stochastic;
const CrossUp = require('technicalindicators').CrossUp;
const CrossDown = require('technicalindicators').CrossDown;
const ADX = require('technicalindicators').ADX;

const config = getConfig();
const alerts = ["Stochastic", "RSI"];

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
      if (!config.sandboxTesting) {
        const now = new Date();
        if (now < this.strategyStartTime) {
          return;
        }
      }
      return this.findSupportAndResistance();
    }).catch(console.error);
  }

  findSupportAndResistance() {
    _.each(this.stocks, tradingSymbol => {
      const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
      if (data && data.traceCandles && data.traceCandles.length) {
        const traceCandles = data.traceCandles;
        const candles = data.candles || traceCandles.slice(traceCandles.length - 75);
        const isChoppyMarket = this.isChoppyMarket(traceCandles);
        const resultVWAP = this.checkVWAP(candles);
        console.log(tradingSymbol, isChoppyMarket ? "CHOPPY" : resultVWAP.uptrend ? "UP" : "DOWN");
        if (isChoppyMarket) {
          const resultStochastic = this.checkMomentumWithStochastic(candles);
          if (resultStochastic.strongCrossOver) {
            let trigger = this.getTrigger(traceCandles, resultStochastic.uptrend);
            this.generateTradeSignals(data, resultStochastic.uptrend, trigger, alerts[0]);
          }
        } else {
          const uptrend = resultVWAP.uptrend;
          let resultRSI = this.checkRSI(candles, uptrend);
          if (!resultRSI.chanceOfTrendReversal && resultVWAP.isNear) {
            resultRSI = this.checkRSI(candles, !uptrend);
          }
          if (resultRSI.chanceOfTrendReversal) {
            let trigger = this.getTrigger(traceCandles, uptrend, resultVWAP.lastVWAP);
            this.generateTradeSignals(data, resultRSI.uptrend, trigger, alerts[1]);
          }
        }
      }
    });
  }
  getTrigger(traceCandles, uptrend, price) {
    const lastCandle = traceCandles[traceCandles.length - 1];
    price = price || lastCandle.close;
    let trigger = this.findBreakPoint(traceCandles, price, uptrend);
    if (!trigger || !isNear(trigger, lastCandle.close, .2)) {
      const n = Math.max(price * .001, .05);
      if (uptrend)
        trigger = roundToValidPrice(price + n);
      else
        trigger = roundToValidPrice(price - n);
    }
    return trigger;
  }
  isChoppyMarket(candles) {
    const formattedInput = formatToInput(candles);
    formattedInput.period = 8;
    const results = ADX.calculate(formattedInput);
    const last = results[results.length - 1];
    return last.adx <= 20;
  }
  findBreakPoint(candles, value, uptrend) {
    const sar = new SAR(candles);
    return sar.mostNearLevel(value, uptrend);
  }
  confirmTrade(tradeSignal, liveQuote) {
    const NEAR = 0.1;
    const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradeSignal.tradingSymbol);
    if (!data || !data.traceCandles)
      return false;

    console.log(tradeSignal.tradingSymbol);

    const tm = TradeManager.getInstance();

    console.log("Check near", tradeSignal.trigger, liveQuote.cmp, tradeSignal.isBuy);
    if (!isNear(tradeSignal.trigger, liveQuote.cmp, NEAR)) {
      if ((tradeSignal.isBuy && tradeSignal.trigger < liveQuote.cmp) || (!tradeSignal.isBuy && tradeSignal.trigger > liveQuote.cmp)) {
        tm.disableTradeSignal(tradeSignal);
        logger.info(`Trigger already crossed, disabling ${this.getSignalDetails(tradeSignal)}`);
      }
      return false;
    }

    // // if (!this.confirmWithVWAP(data, tradeSignal, liveQuote)) {
    // //   return false;
    // // }


    if (tradeSignal.alertBy === alerts[0]) {
      console.log("Check Stochastic");
      const result = this.checkMomentumWithStochastic(data.traceCandles);
      if (!result.strongCrossOver || tradeSignal.isBuy !== result.uptrend) {
        tm.disableTradeSignal(tradeSignal);
        logger.info(`Momentum lost, disabling ${this.getSignalDetails(tradeSignal)}`);
        return false;
      }
      if (!result.reversalStarted)
        return false;
    }

    // console.log("check bollinger");
    // if (!this.confirmWithBollingerBands(data, tradeSignal, liveQuote)) {
    //   return false;
    // }

    if (tradeSignal.alertBy === alerts[1]) {
      console.log("Check RSI");
      const result = this.checkRSI(data.traceCandles, tradeSignal.isBuy);
      if (!result.trendReversalHappend) {
        tm.disableTradeSignal(tradeSignal);
        logger.info(`RSI confirmation lost, disabling ${this.getSignalDetails(tradeSignal)}`);
        return false;
      }
    }

    return true;
  };

  checkMomentumWithStochastic(candles) {
    let period = 8;
    let signalPeriod = 3;
    const formattedInput = formatToInput(candles);
    let input = {
      high: formattedInput.high,
      low: formattedInput.low,
      close: formattedInput.close,
      period: period,
      signalPeriod: signalPeriod
    };
    const stochasticOutput = Stochastic.calculate(input);
    const crossOverInput = stochasticOutput.reduce((acc, o) => {
      acc.lineA.push(o.k);
      acc.lineB.push(o.d);
      return acc;
    }, { lineA: [], lineB: [] });
    const last = stochasticOutput[stochasticOutput.length - 1];
    const uptrend = last.k > last.d;
    const reversalStarted = Math.abs(last.k - last.d) > 3;

    const crossOvers = uptrend ? CrossUp.calculate(crossOverInput) : CrossDown.calculate(crossOverInput);
    const nCrossOvers = crossOvers.slice(Math.max(crossOvers.length - 3, 0));
    const crossOver = nCrossOvers.includes(true);
    const uniqueCrossOver = nCrossOvers.filter(c => c).length === 1;
    const overBroughtOrOverSold = uptrend ? last.d < 20 : last.d > 80;
    return {
      nCrossOvers,
      uptrend,
      crossOver,
      uniqueCrossOver,
      overBroughtOrOverSold,
      last,
      reversalStarted,
      strongCrossOver: overBroughtOrOverSold && crossOver && uniqueCrossOver
    };
  }

  confirmWithBollingerBands(data, tradeSignal, liveQuote) {
    const period = 20;
    const traceCandles = data.traceCandles;
    const input = {
      period: period,
      values: traceCandles.map(candle => candle.close),
      stdDev: 2
    };

    const bollingerBands = BollingerBands.calculate(input);
    const crossOverInput = { lineA: [], lineB: [] };

    for (let i = 0; i < bollingerBands.length; i++) {
      crossOverInput.lineA.push(traceCandles[i].close);
      crossOverInput.lineB.push(bollingerBands[i].middle);
    }

    const crossOvers = tradeSignal.isBuy ? CrossUp.calculate(crossOverInput) : CrossDown.calculate(crossOverInput);
    const crossOver = crossOvers.slice(Math.max(crossOvers.length - 3, 0)).includes(true);

    if (!crossOver)
      return false;
    const lastCandle = traceCandles[traceCandles.length - 1];
    return tradeSignal.isBuy ? liveQuote.cmp >= lastCandle.close : liveQuote.cmp <= lastCandle.close;
  };

  checkVWAP(candles) {
    const input = formatToInput(candles);
    const valuesVWAP = VWAP.calculate(input);
    const lastVWAP = valuesVWAP[valuesVWAP.length - 1];
    const lastCandle = candles[candles.length - 1];
    return {
      uptrend: lastVWAP < lastCandle.close,
      lastVWAP,
      // valuesVWAP,
      isNear: isNear(lastVWAP, lastCandle.close, .2)
    };
  }
  isOverBroughtOrOverSold(last, uptrend) {
    const overBrought = last >= 80;
    const overSold = last <= 20;
    return uptrend ? overSold : overBrought;
  }
  checkRSI(candles, uptrend) {
    const inputRSI = {
      period: 8
    };
    inputRSI.values = candles.map(c => c.volume);
    const outputs = RSI.calculate(inputRSI);
    const last = outputs[outputs.length - 1];
    const overBrought = last >= 80;
    const overSold = last <= 20;
    const chanceOfTrendReversal = uptrend ? overSold : overBrought;
    const trendReversalHappend = outputs
      .slice(Math.max(outputs.length - 3, 0))
      .map(o => this.isOverBroughtOrOverSold(o, uptrend))
      .includes(true);
    return {
      uptrend,
      overBroughtOrOverSold: overBrought || overSold,
      overBrought,
      overSold,
      chanceOfTrendReversal,
      trendReversalHappend
    };
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
          logger.info(`Disable , since max trade reached.`);
          tm.disableTradeSignal(tradeSignal);
          this.maxTradesReached = true;
          return false;
        }
      }
    }
    return this.confirmTrade(tradeSignal, liveQuote);
  }

  generateTradeSignals(data, longPosition, price, alertBy) {
    const tm = TradeManager.getInstance();
    const brokers = _.get(this.strategy, 'brokers', []);
    if (!data.buyTradeSignal) {
      data.buyTradeSignal = {};
    }
    if (!data.sellTradeSignal) {
      data.sellTradeSignal = {};
    }
    const signalType = longPosition ? "buyTradeSignal" : "sellTradeSignal";
    _.each(brokers, broker => {
      const ts1 = this.createTradeSignal(data, longPosition, price, broker, alertBy);
      logger.info(`${this.name}: ${data.tradingSymbol} ${longPosition ? "LONG" : "SHORT"} trade signal generated for ${broker} @ ${ts1.trigger}`);
      data[signalType][broker] = ts1;
      tm.addTradeSignal(ts1);
    });
    data.isTradeSignalGenerated = true;
  }

  createTradeSignal(data, longPosition, price, broker, alertBy) {
    const lastCandle = data.traceCandles[data.traceCandles.length - 1];
    const tm = TradeManager.getInstance();

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
    ts1.alertBy = alertBy;

    const oldts = tm.getTradeSignalOfSame(ts1);
    if (oldts) {
      ts1.correlationID = oldts.correlationID;
    } else {
      ts1.correlationID = uuid();
    }

    return ts1;
  }
}

module.exports = new SARStrategy(); // singleton class
