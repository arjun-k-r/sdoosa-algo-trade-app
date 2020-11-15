(function start() {


    return processPreOpenMarket();

    async function processPreOpenMarket() {
        let result = await preOpenMarket();
        return result.data.sort((a, b) => {
            return Math.abs(b.metadata.pChange) - Math.abs(a.metadata.pChange);
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
})()
    .then((results) => {
        // console.clear();
        console.log(JSON.stringify(results.slice(0, 30).map(result => result.metadata.symbol), null, 4));

    })
    .catch(console.error);