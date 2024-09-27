import {MongoClient, Db, Collection, ObjectId} from 'mongodb';
import {swap} from './tradeFuncs';
import {Connection} from '@solana/web3.js';

let db: Db;
let collection: Collection;
let connection: Connection;

async function connectSolana() {
    connection = new Connection(HTTP_URL, {
        wsEndpoint: WSS_URL
    });
    return connection;
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function connectDb() {
    const uri = '';
    const client = new MongoClient(uri);
    await client.connect();
    db = client.db('main');
    collection = db.collection('liveTrades');
}

async function checkOpenTrades() :  Promise<{ action: string, amount: number, coin: string }[]> {
    const trades = await collection.find({open: true}).toArray();
    const coinList: string[] = [];

    for (const trade of trades) {
        coinList.push(trade.coin);
    }
    if (coinList.length === 0) {
        return [];
    }

    const coinString = coinList.join(',');
    const url = `https://api.dexscreener.com/latest/dex/tokens/${coinString}`;

    const response = await fetch(url);
    const prices = await response.json();
    const pricesWithPairs = prices as { pairs: any[] };

    const output: { action: string, amount: number, coin: string }[] = [];

    for (const price of pricesWithPairs.pairs) {
        const trade = trades.find(t => t.coin === price.baseToken.address);

        if (trade) {
            const diff =  (price.priceNative - trade.purchasePrice);
            const change = (diff/trade.purchasePrice) * 100;
            console.log(`${trade.coin.toString()}: ${change}`)

            if (change <= -100) {
                output.push({action: 'sell', amount: trade.amount, coin: trade.coin.toString()});
            } else if (change >= 200) {
                output.push({
                    action: 'sell',
                    amount: trade.amount,
                    coin: trade.coin.toString()
                });
            }
        }
    }
    return output;
}

async function main() {
    await connectDb();
    if (!connection) {
        await connectSolana();
    }
    while (true) {
        const trades = await checkOpenTrades();
        for (const trade of trades) {
            console.log('Trade in progress');
            console.log(trade)
            const action = trade.action;
            const amount = trade.amount;
            const coin = trade.coin;
            const slippage = 2000;
            //const response: any = [true, 'test', 20000000]
            const response: any = await swap(action, coin, amount, slippage);
            const profit = (response[2] - 40000000)/Math.pow(10, 9)
            console.log(response);
            if (response[0]) {
                await collection.updateOne({coin: coin}, {$set: {open: false, closed: true, closeData: response[1], solProfit: profit}});
            }
        }
        await sleep(500);
    }
}

main();