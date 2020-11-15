/*
  Author: Sreenivas Doosa
*/

import _ from 'lodash';
import uuid from 'uuid/v4';

import BaseStrategy from './BaseStrategy.js';
import TradeManager from '../core/TradeManager.js';
import {
  // percentageChange,
  formatToInput,
  roundToValidPrice,
  calculateSharesWithRiskFactor,
  shouldPlaceTrade,
  isNear,
  isSideWayMarket,
  // getAvgCandleSize,
  // formatTimestampToString
} from '../utils/utils.js';

import MACD from "../indicators/MACD.js";
import SAR from "../indicators/SAR.js";
import ADX from "../indicators/ADX.js";
import BollingerBands from "../indicators/BollingerBands.js";
import RSI from "../indicators/RSI.js";
import Stochastic from "../indicators/Stochastic.js";
import VWAP from "../indicators/VWAP2.js";
import ZigZag from "../indicators/ZigZag.js";

import logger from '../logger/logger.js';
import { getConfig } from '../config.js';


const bearish = require('technicalindicators').bearish;
const bullish = require('technicalindicators').bullish;

const config = getConfig();


const markets = ["Trending", "Choppy"];
const momentums = ["RSI", "Stochastic"];
const volatility = ["Volatile", "Non-Volatile"];
const trendConfirmations = ["MACD", "VWAP"];

const signalTypes = [
  markets[0] + "/" + momentums[0] + "/" + volatility[0] + "/" + trendConfirmations[0],
  markets[0] + "/" + momentums[0] + "/" + volatility[1] + "/" + trendConfirmations[0],
  markets[1] + "/" + momentums[1] + "/" + trendConfirmations[1]
];

class SARStrategy extends BaseStrategy {

  constructor() {
    super('SAR');
  }

  process() {
    logger.info(`${this.name}: process`);
    if (this.maxTradesReached) {
      return Promise.resolve();
    }
    console.log("process started");
    return this.fetchTraceCandlesHistory().then(() => {
      console.log("traced candle history");

      if (!config.sandboxTesting) {
        const now = new Date();
        if (now < this.strategyStartTime) {
          logger.info(`Stratery starting time is ${this.stratergyStartTime}`);
          return;
        }
      }
      try {
        this.findSupportAndResistance();
      } catch (err) {
        console.error("findSupportAndResistance", err);
      }
    });
  }
  findSupportAndResistance() {
    _.each(this.stocks, tradingSymbol => {
      const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradingSymbol);
      if (data && data.traceCandles && data.traceCandles.length) {
        console.log("=========================================================================================");

        const traceCandles = data.traceCandles;
        const candles = data.candles || traceCandles.slice(traceCandles.length - 75);

        const adx = new ADX(traceCandles);
        const vwap = new VWAP(candles);

        const lastCandle = candles[candles.length - 1];
        const sidewayMarket = isSideWayMarket(traceCandles);

        console.log(lastCandle.date.toLocaleDateString(), lastCandle.date.toLocaleTimeString());
        console.log(tradingSymbol, "@", lastCandle.close, markets[adx.isTrending() ? 0 : 1], adx.isUpTrend() ? "UP" : "DOWN");
        console.log("Sideway Market : ", sidewayMarket);


        const bb = new BollingerBands(traceCandles);
        if (!sidewayMarket) {
          const macd = new MACD(traceCandles);
          const rsi = new RSI(traceCandles);
          let confirmMomentum = false;
          console.log("Volatility : ", bb.isVolatile());
          if (bb.isVolatile()) {
            const strongMomentum = rsi.confirmStrongMomentum(adx.isUpTrend(), !adx.isStrongTrend());
            const isVWAPNear = vwap.isNear();
            const uniqueCrossOver = vwap.uniqueCrossOver();
            console.log("RSI strong: ", strongMomentum);
            if (strongMomentum) {
              console.log("VWAP Not Near :", !isVWAPNear, "uniqueCrossOver :", uniqueCrossOver);
              if (!isVWAPNear || uniqueCrossOver) {
                confirmMomentum = true;
              }
            }
          } else {
            const rsiConfirm = rsi.confirmMomentum(adx.isUpTrend(), !adx.isStrongTrend());
            const strongTrend = adx.isTrending();
            console.log("RSI : ", rsiConfirm, "StrongTrend :", strongTrend);
            if (rsiConfirm && strongTrend) {
              confirmMomentum = true;
            }
          }

          if (confirmMomentum) {
            const touchedBB = bb.inContact(adx.isUpTrend());
            console.log("BolingerBand : ", touchedBB);
            if (touchedBB) {
              const chartPattern = adx.isUpTrend() ? this.bullish(traceCandles) : this.bearish(traceCandles);
              console.log("ChartPattern : ", chartPattern);
              if (chartPattern) {
                const macdConfirm = adx.isUpTrend() ? macd.longMomentum() : macd.shortMomentum();
                console.log("MACD : ", macdConfirm);
                if (macdConfirm) {
                  const zigzag = new ZigZag(traceCandles, 3);
                  const zigzagConfirm = !(adx.isUpTrend() ? zigzag.isNearResistance() : zigzag.isNearSupport());
                  if (zigzagConfirm)
                    this.generateTradeSignals(data, adx.isUpTrend(), lastCandle.close, signalTypes[bb.isVolatile() ? 0 : 1]);
                }
              }
            }
          }
        } else {
          console.log("Strong Trend : ", adx.isStrongTrend());
          console.log("Volatility : ", bb.isVolatile());
          if (adx.isStrongTrend() && bb.isVolatile()) {
            const stochastic = new Stochastic(traceCandles);
            const confirmTrend = vwap.isUpTrend() === adx.isUpTrend();
            console.log("WVAP Confirm : ", confirmTrend);
            if (confirmTrend) {
              const confirmMomentum = stochastic.confirmMomentum(vwap.isUpTrend());
              console.log("Stochastic : ", confirmMomentum);
              if (confirmMomentum) {
                let trigger = this.getTrigger(traceCandles, vwap.isUpTrend());
                this.generateTradeSignals(data, vwap.isUpTrend(), trigger, signalTypes[2]);
              }
            }
          }
        }
      }
    });
  }
  bearish(traceCandles) {
    return bearish(formatToInput(traceCandles));
  }
  bullish(traceCandles) {
    return bullish(formatToInput(traceCandles));
  }
  getTrigger(traceCandles, uptrend, price) {
    const lastCandle = traceCandles[traceCandles.length - 1];
    price = price || lastCandle.close;
    let trigger = this.findBreakPoint(traceCandles, price, uptrend);
    if (!trigger || !isNear(trigger, lastCandle.close, .01)) {
      const n = Math.max(price * .0001, .05);
      if (uptrend)
        trigger = roundToValidPrice(price + n);
      else
        trigger = roundToValidPrice(price - n);
    }
    return trigger;
  }
  findBreakPoint(candles, value, uptrend) {
    const sar = new SAR(candles);
    return sar.nextNearestLevel(uptrend, value);
  }
  confirmTrade(tradeSignal, liveQuote) {
    const NEAR = 0.1;
    const data = _.find(this.stocksCache, sc => sc.tradingSymbol === tradeSignal.tradingSymbol);
    if (!data || !data.traceCandles)
      return false;

    logger.info(this.getSignalDetails(tradeSignal));

    const tm = TradeManager.getInstance();

    console.log("Check near", tradeSignal.trigger, liveQuote.cmp, tradeSignal.isBuy);
    if (!isNear(tradeSignal.trigger, liveQuote.cmp, NEAR)) {
      if ((tradeSignal.isBuy && tradeSignal.trigger < liveQuote.cmp) || (!tradeSignal.isBuy && tradeSignal.trigger > liveQuote.cmp)) {
        tradeSignal.message = (tradeSignal.message || "") + " | Trigger already crossed, so disabling";
        tm.disableTradeSignal(tradeSignal);
        logger.info(`${tradeSignal.message} ${this.getSignalDetails(tradeSignal)}`);
        return false;
      }
    }

    // // if (!this.confirmWithVWAP(data, tradeSignal, liveQuote)) {
    // //   return false;
    // // }

    if (tradeSignal.signalBy === signalTypes[2]) {
      console.log("Check Stochastic");
      const stochastic = new Stochastic(data.traceCandles);
      if (!stochastic.confirmMomentum(tradeSignal.isBuy)) {
        tradeSignal.message = (tradeSignal.message || "") + " | Momentum lost,so disabling";
        tm.disableTradeSignal(tradeSignal);
        logger.info(`${tradeSignal.message} ${this.getSignalDetails(tradeSignal)}`);
        return false;
      }
    }

    if (tradeSignal.signalBy === signalTypes[2]) {
      const sar = new SAR(data.traceCandles);
      if (tradeSignal.isBuy) {
        if (!sar.isBreakOut(liveQuote.cmp)) {
          logger.info(`Wait for breakout ${sar.breakOutPoint(liveQuote.cmp)}`);
          return false;
        }
      } else {
        if (!sar.isBreakDown(liveQuote.cmp)) {
          logger.info(`Wait for breakdown ${sar.breakDownPoint(liveQuote.cmp)}`);
          return false;
        }
      }
    }


    return true;
  };
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

  generateTradeSignals(data, longPosition, price, signalBy) {
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
      const ts1 = this.createTradeSignal(data, longPosition, price, broker, signalBy);
      logger.info(`${this.name}: ${data.tradingSymbol} ${longPosition ? "LONG" : "SHORT"} trade signal generated for ${broker} @ ${ts1.trigger}`);
      data[signalType][broker] = ts1;
      tm.addTradeSignal(ts1);
    });
    data.isTradeSignalGenerated = true;
  }

  createTradeSignal(data, longPosition, price, broker, signalBy) {
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
    ts1.signalBy = signalBy;

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
