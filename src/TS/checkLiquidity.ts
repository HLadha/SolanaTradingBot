import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import {MongoClient, Db, Collection, ObjectId} from 'mongodb';
import {getMint} from "@solana/spl-token";
import {checkHolders} from "./checkHolders";
let db: Db;
let collection: Collection;


type Document = {
    _id: ObjectId;
    datetime: Date;
    coin: string;
    [key: string]: any;
};

async function getDocuments() {
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
        collection = db.collection('liquidityEnabled'); // replace with your collection name
    }

    // Get the current date and time
    const currentDate = new Date();

    // Subtract 24 hours from the current date and time
    const pastDate = new Date(currentDate.getTime() - (24 * 60 * 60 * 1000));

    // Find documents where datetime is within the last 24 hours
    const uncheckedDocuments = await collection.find({burnedPercentage: {$exists: false}, burned:true}).toArray();

    return uncheckedDocuments;
}

const connection = new Connection(HTTP_URL, {
    wsEndpoint: WSS_URL
});
function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
    if (!db) {
        const uri = '';
        const client = new MongoClient(uri);
        await client.connect();
        db = client.db('main'); // replace with your database name
        collection = db.collection('liquidityEnabled'); // replace with your collection name
    }
    const documents = await getDocuments();
    for (const document of documents) {
        const data = await connection.getTokenSupply(new PublicKey(document.coin));
        const value = data.value.uiAmount;
        console.log(value);
        console.log(document.LPBLaunch);
        let perc;
        if (value) {
            perc = (document.LPBLaunch/value);
            console.log(perc);
        }
        if (perc) {
            await collection.updateOne({_id: document._id}, {$set: {supply: value, burnedPercentage: perc}});
        }
    }
    return;
}

async function main() {
    while (true) {
        await test();
        await sleep(100000);
    }
}

main();