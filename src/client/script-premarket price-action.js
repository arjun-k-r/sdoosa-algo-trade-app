
(function start(list, capital, liverage, maxTrades, targetPer, stopLossPer) {

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
    const totalCapital = capital * liverage;
    const oneTradeCapital = totalCapital / maxTrades;
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
            if (r.metadata.pChange > 0) {
                if (signal.u > cmp) {
                    o.crossed = false;
                } else {
                    o.crossed = true;
                    o.msg = "upper limit crossed";
                }
                o.limit = signal.u;
                o.t = roundToValidPrice(signal.u * (targetPer / 100));
                o.sl = roundToValidPrice(signal.u * (stopLossPer / 100));
                o.isBuy = true;
                o.quantity = parseInt(oneTradeCapital / o.limit);
            } else {
                if (signal.l < cmp) {
                    o.crossed = false;
                } else {
                    o.crossed = true;
                    o.msg = "lower limit crossed";
                }
                o.limit = signal.l;
                o.t = roundToValidPrice(signal.l * (targetPer / 100));
                o.sl = roundToValidPrice(signal.l * (stopLossPer / 100));
                o.isBuy = false;
                o.quantity = parseInt(oneTradeCapital / o.limit);
            }
            output.push(o);
        });

        return output;

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
        symbol: "INDUSINDBK",
        u: 863,
        l: 849
    }, {
        symbol: "ADANIPORTS",
        u: 416,
        l: 407
    }, {
        symbol: "PVR",
        u: 1330,
        l: 1300
    },
    {
        symbol: "ICICIBANK",
        u: 479,
        l: 470
    }, {
        symbol: "INFRATEL",
        u: 223,
        l: 213
    }, {
        symbol: "M&M",
        u: 736,
        l: 717
    }
], 15000, 5, 4, .4, .2)
    .then((results) => {
        // console.clear();
        console.log(JSON.stringify(results, null, 4));

    })
    .catch(console.error);


