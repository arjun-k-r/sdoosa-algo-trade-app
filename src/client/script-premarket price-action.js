
(function start(list, capital, liverage, targetPer, stopLossPer, trailingStopLossPer) {
    const roundOff = (value) => {
        return value.toFixed(2);
    };

    const roundToValidPrice = (value, exchange = 'NSE') => {

        value = roundOff(value);

        if (exchange === 'NSE') { // NSE doesnt support 100.11, 99.34 etc. so changing them to 100.10 & 99.35
            const mid = value * 20;
            value = Math.ceil(mid);
            value = value / 20;
        }
        return value;
    };

    const findNearestBreakPoint = (points, cmp) => {
        const a = Math.abs(points[0] - cmp);
        const b = Math.abs(points[1] - cmp);
        const point = a > b ? points[1] : points[0];
        const near = Math.abs(point - cmp) / cmp * 100;
        return [point, near];
    };

    const totalCapital = capital * liverage;
    const oneTradeCapital = totalCapital / list.length;
    return processPreOpenMarket();

    async function processPreOpenMarket() {
        let result = await preOpenMarket();
        const filteredResult = result.data.sort((a, b) => {
            return Math.abs(b.metadata.pChange) - Math.abs(a.metadata.pChange);
        }).filter((r) => {
            return list.find((l) => {
                return r.metadata.symbol === l.symbol;
            });
        });

        const output = [];
        filteredResult.forEach((r) => {
            const signal = list.find((l) => {
                return r.metadata.symbol === l.symbol;
            });
            const o = {
                symbol: signal.symbol
            };

            const cmp = r.metadata.lastPrice;
            o.cmp = cmp;
            o.pChange = r.metadata.pChange;
            o.previousClose = r.metadata.previousClose;

            const [nearestBreakPoint, near] = findNearestBreakPoint([signal.u, signal.l], cmp);
            o.near = near;
            if (nearestBreakPoint === signal.u) {
                if (signal.u > cmp) {
                    o.crossed = false;
                    o.isBuy = true;
                    o.trigger = signal.u;
                } else {
                    o.crossed = true;
                    o.msg = "upper limit crossed";
                    if (r.reverse === true) {
                        o.isBuy = false;
                        o.trigger = signal.u;
                    } else {
                        o.isBuy = true;
                        o.trigger = cmp;
                    }
                }
            } else {
                if (signal.l < cmp) {
                    o.crossed = false;
                    o.isBuy = false;
                    o.trigger = signal.l;
                } else {
                    o.crossed = true;
                    o.msg = "lower limit crossed";
                    if (r.reverse === true) {
                        o.isBuy = true;
                        o.trigger = signal.l;
                    } else {
                        o.isBuy = false;
                        o.trigger = cmp;
                    }
                }
            }
            const chg = roundToValidPrice(o.trigger * 0.0002);
            if (o.isBuy) {
                o.trigger = o.trigger + chg;
                o.price = o.trigger + .05;
            } else {
                o.trigger = o.trigger - chg;
                o.price = o.trigger - .05;
            }
            o.trigger = roundToValidPrice(o.trigger);
            o.price = roundToValidPrice(o.price);
            o.t = roundToValidPrice(o.price * (targetPer / 100));
            o.sl = roundToValidPrice(o.price * (stopLossPer / 100));

            o.tsl = Math.round(roundToValidPrice(o.price * (trailingStopLossPer / 100)) / 0.05);
            o.tsl = Math.max(20, o.tsl);

            o.quantity = parseInt(oneTradeCapital / o.price);

            output.push(o);
        });

        return output.sort((a, b) => {
            return a.near - b.near;
        });
    }


    async function preOpenMarket() {
        const response = await fetch(
            // "https://www.nseindia.com/api/market-data-pre-open?key=NIFTY",
            "https://www.nseindia.com/api/market-data-pre-open?key=FO",
            {
                headers: {
                    accept:
                        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                    "accept-language": "en-US,en;q=0.9,ms;q=0.8,ml;q=0.7,fi;q=0.6",
                    "cache-control": "max-age=0",
                    "sec-fetch-dest": "document",
                    "sec-fetch-mode": "navigate",
                    "sec-fetch-site": "none",
                    "sec-fetch-user": "?1",
                    "upgrade-insecure-requests": "1",
                },
                referrerPolicy: "strict-origin-when-cross-origin",
                body: null,
                method: "GET",
                mode: "cors",
                credentials: "include",
            }
        );
        return await response.json();
    }
})([
    {
        symbol: "PIDILITIND",
        u: 1625.75,
        l: 1598.55
    }, {
        symbol: "AUROPHARMA",
        u: 904.75,
        l: 887.85
    }, {
        symbol: "MANAPPURAM",
        u: 176.6,
        l: 173.4
    },
    {
        symbol: "TATAMOTORS",
        u: 186.15,
        l: 183
    }, {
        symbol: "ICICIBANK",
        u: 485,
        l: 478.75
    }, {
        symbol: "GODREJPROP",
        u: 1210,
        l: 1180
    }
], 10000, 5, 2, .2, .15)
    .then((results) => {
        const message = (signal) => {
            return `
            ${signal.isBuy ? "BUY" : "SELL"} ${signal.quantity} ${signal.symbol}  @ Trigger : ${signal.trigger}, Price : ${signal.price}
            SL : ${signal.sl} , Target : ${signal.t}
            Trailing : ${signal.tsl}
            ${signal.msg || ""}
            `;
        };
        console.clear();
        results.map(message).forEach(o => console.log(o));
        console.log(JSON.stringify(results, null, 4));

    })
    .catch(console.error);

;
