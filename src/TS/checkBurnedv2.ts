import { Connection, PublicKey } from '@solana/web3.js';
import {MongoClient, Db, Collection, ObjectId} from 'mongodb';
import {checkHolders} from "./checkHolders";
import {burn} from "@solana/spl-token";
let db: Db;
let collection: Collection;

type Document = {
    _id: ObjectId;
    datetime: Date;
    coin: string;
    [key: string]: any;
};

let connection = new Connection(HTTP_URL, {
    wsEndpoint: WSS_URL
});

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPrice(coin: string, docId: ObjectId) {
    try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${coin}`;
        let price;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data['pairs']) {
                price = data['pairs'][0]['priceUsd']; // store the data in price
            } else {
                price = 0
            }
        } catch (error) {
            console.error('Error:', error);
        }
        if (!db) {
            const uri = '';
            const client = new MongoClient(uri);
            await client.connect();
            db = client.db('main'); // replace with your database name
            collection = db.collection('liquidityEnabled'); // replace with your collection name
        }
        await collection.updateOne({_id: docId}, {$set: {BPrice: price}});
        return;
    } catch {
        console.log("Error fetching price");
        return;
    }
}

async function checkLiquidity(coin: string, id: ObjectId, LPBLaunch: number) {
    const maxRetries = 5;
    for(let i = 0; i < maxRetries; i++) {
        try {
            const tokenSupply = await connection.getTokenSupply(new PublicKey(coin));
            const value = tokenSupply.value.uiAmount;
            if (value) {
                let perc = LPBLaunch/value;
                if (perc > 1) {
                    perc = 1
                }
                await collection.updateOne({_id: id}, {$set: {liquidityPercentage: perc, supply: value}});
            }
            break; // If the request was successful, break out of the loop
        }
        catch (error) {
            console.error('Error:', error);
            if(i < maxRetries - 1) {
                await sleep(1000); // Wait for 1 second before retrying
            } else {
                throw error; // If this was the last retry, throw the error
            }
        }
    }
}

async function processor() {
    if (!db) {
        const uri = '';
        const client = new MongoClient(uri);
        await client.connect();
        db = client.db('main'); // replace with your database name
        collection = db.collection('liquidityEnabled'); // replace with your collection name
    }
    const uncheckedDocuments = await collection.find({checked: false, datetime: {$gte: new Date('2024-07-26T23:21:00.000')}}).toArray();
    for (const doc of uncheckedDocuments) {
        try {
            console.log(doc.coin.toString())
            let tokenSupply;
            try {
                tokenSupply = await connection.getTokenSupply(new PublicKey(doc.SPLAddress));
            } catch (error) {
                continue;
            }
            const value = tokenSupply.value.uiAmount;
            if (value || value === 0) {
                console.log(value)
                const transactions = await connection.getConfirmedSignaturesForAddress2(new PublicKey(doc.SPLAddress))
                let flag = false;
                if (transactions.length < 15) {
                    for (const transaction of transactions) {
                        try {
                            const tx = await connection.getParsedTransaction(transaction.signature, {
                                commitment: 'confirmed',
                                maxSupportedTransactionVersion: 2
                            });
                            const initial = tx?.meta?.innerInstructions
                            for (const item of (initial || [])) {
                                const data = item.instructions;
                                let transferCount = 0
                                let burnCount = 0
                                for (const instruction of (data || [])) {
                                    if ('parsed' in instruction) {
                                        const type = instruction.parsed.type
                                        if (type === 'transfer') {
                                            if (instruction.parsed.info.authority === '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1') {
                                                transferCount += 1
                                            }
                                        } else if (type === 'burn') {
                                            burnCount += 1
                                        }
                                    }
                                }
                                if (burnCount == 1 && transferCount == 2) {
                                    flag = true;
                                    break;
                                }
                            }
                            if (flag) {
                                break;
                            }
                        } catch (error) {
                        }
                    }
                }
                const perc = (doc.SPLLaunch - value) / doc.SPLLaunch;
                if (perc > 0.8) {
                    if ('liquidityPull' in doc || flag) {
                        if (doc.liquidityPull == true || flag) {
                            await collection.updateOne({_id: doc._id}, {$set: {burned: false, checked: true}});
                            continue;
                        }
                    }
                    await collection.updateOne({_id: doc._id}, {$set: {burned: true, checked: true}});
                    await fetchPrice(doc.coin, doc._id);
                    await checkHolders(doc as Document, connection, 0);
                    await checkLiquidity(doc.coin, doc._id, doc.LPBLaunch);
                } else {
                    // Check if the current time is more than 2 hours after doc.datetime. If it is, set checked true, else continue, note datetime in the database is utc
                    const currentDate = new Date();
                    const diff = currentDate.getTime() - doc.datetime.getTime();
                    if (diff > 7200000) {
                        await collection.updateOne({_id: doc._id}, {$set: {checked: true}});
                    }
                }
            }
        } catch (error) {
            await collection.updateOne({_id: doc._id}, {
                $set: {
                    burned: false,
                    checked: true,
                    error: error
                }
            });
        }
    }
}

async function run(){
    while (true) {
        try {
            await processor();
            await sleep(15000)
        } catch (error) {
            console.log(error)
            if (!db) {
                const uri = '';
                const client = new MongoClient(uri);
                await client.connect();
                db = client.db('main'); // replace with your database name
                collection = db.collection('liquidityEnabled'); // replace with your collection name
            }
            connection = new Connection(HTTP_URL, {
                wsEndpoint: WSS_URL
            });
        }
        await sleep(5000)
    }
}

run();