(function start() {

    const min = 90, max = 5000;

    return processCurrentMarket();

    async function processCurrentMarket() {
        let result = await currentMarket();
        return result.data.filter(a => {
            if (min && a.lastPrice < min) {
                return false;
            }
            if (max && a.lastPrice > max) {
                return false;
            }
            return true;
        }).sort((a, b) => {
            if (a.symbol < b.symbol) {
                return -1;
            }
            if (a.symbol > b.symbol) {
                return 1;
            }
            // a must be equal to b
            return 0;
        });
    }


    async function currentMarket() {
        const response = await fetch(
            "https://www.nseindia.com/api/equity-stockIndices?index=SECURITIES%20IN%20F%26O",
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
        console.log(JSON.stringify(results.map(result => result.symbol), null, 4));

    })
    .catch(console.error);