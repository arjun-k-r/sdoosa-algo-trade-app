
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
                } else {
                    o.crossed = true;
                    o.msg = "upper limit crossed";
                    o.isBuy = false;
                }
                o.trigger = signal.u;
            } else {
                if (signal.l < cmp) {
                    o.crossed = false;
                    o.isBuy = false;
                } else {
                    o.crossed = true;
                    o.msg = "lower limit crossed";
                    o.isBuy = true;
                }
                o.trigger = signal.l;
            }
            if (o.isBuy) {
                o.price = o.trigger + .05;
            } else {
                o.price = o.trigger - .05;
            }
            o.t = roundToValidPrice(o.price * (targetPer / 100));
            o.sl = roundToValidPrice(o.price * (stopLossPer / 100));
            o.tsl = Math.round(roundToValidPrice(o.price * (trailingStopLossPer / 100)) / 0.05);

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
        symbol: "PEL",
        u: 1438,
        l: 1400
    }, {
        symbol: "DRREDDY",
        u: 4865,
        l: 4800
    }, {
        symbol: "SRTRANSFIN",
        u: 1061,
        l: 1021
    },
    {
        symbol: "GODREJPROP",
        u: 1210,
        l: 1175
    }, {
        symbol: "ADANIPORTS",
        u: 426,
        l: 416
    }, {
        symbol: "INDUSINDBK",
        u: 900,
        l: 870
    }, {
        symbol: "M&M",
        u: 737,
        l: 717
    }
], 15000, 5, 1.2, .4, .4)
    .then((results) => {
        // console.clear();
        console.log(JSON.stringify(results, null, 4));

    })
    .catch(console.error);


