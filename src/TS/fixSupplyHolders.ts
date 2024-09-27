import { Connection, PublicKey } from '@solana/web3.js';
import {MongoClient, Db, Collection, ObjectId, WithId} from 'mongodb';
import {burn, getMint} from "@solana/spl-token";
let db: Db;
let collection: Collection;

type Document = {
    _id: ObjectId;
    datetime: Date;
    coin: string;
    [key: string]: any;
};
async function checkHolders(document: WithId<Document>, connection: Connection, interval: number) {
    const token = document.coin
    const supply = await connection.getTokenSupply(new PublicKey(token), 'confirmed');
    const holders = await connection.getTokenLargestAccounts(new PublicKey(token), 'confirmed');
    const mintInfo = await getMint(connection, new PublicKey(token), 'confirmed');
    const decimals = Math.pow(10, mintInfo.decimals);
    // Check % of supply held by each holder, and total
    let totalPercent = 0;
    let percentHeld = [];
    for (const holder of holders.value) {
        const percent = (Number(holder.amount) / decimals) / (supply.value.uiAmount || 1);
        percentHeld.push(percent);
        totalPercent += percent;
    }
    console.log(percentHeld)
    console.log(totalPercent)

    // Prepare the update operation
    const updateOperation = {
        $set: {
            [`topHolders${interval}`]: percentHeld,
            [`top20Total${interval}`]: totalPercent
        }
    };

    if (!db) {
        const uri = '';
        const client = new MongoClient(uri);
        await client.connect();
        db = client.db('main'); // replace with your database name
        collection = db.collection('liquidityEnabled'); // replace with your collection name
    }
    await collection.updateOne({ _id: document._id }, updateOperation);
    return holders;
}

async function checkLiquidity(coin: string, id: ObjectId, LPBLaunch: number) {
    try {
        const tokenSupply = await connection.getTokenSupply(new PublicKey(coin));
        console.log(tokenSupply.value.uiAmount)
        const value = tokenSupply.value.uiAmount;
        if (value) {
            let perc = LPBLaunch/value;
            if (perc > 1) {
                perc = 1
            }
            console.log(perc)
            await collection.updateOne({_id: id}, {$set: {liquidityPercentage: perc, supply: value}});
        }
    }
    catch (error) {
        console.log('Error:', error);
    }
}

let connection = new Connection(HTTP_URL, {
    wsEndpoint: WSS_URL
});
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    if (!connection) {
        const connection = new Connection(HTTP_URL, {
            wsEndpoint: WSS_URL
        });
    }
    if (!db) {
        const uri = '';
        const client = new MongoClient(uri);
        await client.connect();
        db = client.db('main'); // replace with your database name
        collection = db.collection('liveTrades'); // replace with your collection name
    }
    const documents = await collection.find({$or:[{supply:{$exists:false}}, {topHolders0:{$exists:false}}]}).toArray();
    for (const document of documents) {
        console.log(document.coin)
        await checkLiquidity(document.coin, document._id, document.LPBLaunch);
        await checkHolders(document as Document, connection, 0);
        console.log('Complete')
    }
}

async function run() {
    const uri = '';
    const client = new MongoClient(uri);
    await client.connect();
    db = client.db('main'); // replace with your database name
    collection = db.collection('liveTrades'); // replace with your collection name
    while (true) {
        try {
            await main();
            await sleep(1000);
        } catch (error) {
            console.error('Error:', error);
            await sleep(1000); // Wait for 30 seconds before retrying
        }
    }
}

run()
