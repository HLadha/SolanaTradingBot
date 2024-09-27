import {MongoClient, Db, Collection, ObjectId} from 'mongodb';
import {swap} from './tradeFuncs';
import {Connection, PublicKey} from '@solana/web3.js';
import { execSync } from 'child_process';

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

async function openTrades() {
    if (!db) {
        await connectDb();
    }
    if (!connection) {
        await connectSolana();
    }
    const records = await collection.find({supply: {$exists:true}, topHolders0: {$exists:true} ,open: {$exists:false}, predicted: {$exists:false}, liquidityPull: {$exists:false}}).toArray();
    for (const record of records) {
        const recordJSON = JSON.stringify(record);
        if (record.freezeAuth == false && record.mintAuth == false && record.LiquiditySOL > 10) {
            try {
                const command = `python3 src/ApplyModel.py '${recordJSON}'`;
                const stdout = execSync(command, { encoding: 'utf-8' });  // the output will be a String (rather than a Buffer)
                const prediction = JSON.parse(stdout)[0];
                console.log(`${record.coin} : ${prediction}`);
                if (prediction == 1) {
                    const status = await swap('buy', record.coin, 40000000, 2000);
                    console.log(status)
                    if (status[0]) {
                        const buyTransaction = status[1];
                        const amount : any = status[2];
                        let decimals: any = await connection.getTokenSupply(new PublicKey(record.coin));
                        if (decimals && 'value' in decimals) {
                            decimals = decimals['value']['decimals'];
                        }
                        console.log(`decimals: ${decimals}`)
                        const value = amount / Math.pow(10, decimals);
                        console.log(`value: ${value}`)
                        const purchasePrice = 0.04/value;
                        console.log(`purchasePrice: ${purchasePrice}`)
                        await collection.updateOne({_id: record._id}, {$set: {predicted:true, open: true, buyURL: buyTransaction, amount: amount, purchasePrice: purchasePrice}});
                    }
                } else {
                    await collection.updateOne({_id: record._id}, {$set: {predicted: true}});
                }
            } catch (error) {
                throw error;
            }
        }
    }
}

async function main() {
    while (true) {
        try {
            await openTrades();
            await sleep(3000);
        } catch (error) {
            console.error('Error:', error);
            await sleep(3000);
        }
    }
}

main()