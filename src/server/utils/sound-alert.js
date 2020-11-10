
export default function soundAlert(n = 10) {
    // console.log("\007");
    let count = 1;
    const interval = setInterval(() => {
        // console.log("\007");
        count = count + 1;
        if (count > n) clearInterval(interval);
    }, 300);
}
