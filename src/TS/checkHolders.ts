import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import {MongoClient, Db, Collection, WithId, ObjectId} from 'mongodb';
import {getMint} from "@solana/spl-token";

let db: Db;
let collection: Collection;

type Document = {
    _id: ObjectId;
    datetime: Date;
    coin: string;
    [key: string]: any;
};


const connection = new Connection(HTTP_URL, {
    wsEndpoint: WSS_URL
});

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
    const pastDate = new Date(currentDate.getTime() - (4 * 60 * 60 * 1000));

    // Find documents where datetime is within the last 24 hours
    const uncheckedDocuments = await collection.find({
        checked: true,
        burned: true,
        datetime: { $gte: pastDate }
    }).toArray();

    return uncheckedDocuments;
}
export async function checkHolders(document: WithId<Document>, connection: Connection, interval: number) {
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

import { setInterval } from 'timers';

// Run the processor every minute
setInterval(hourlyProcessor, 60 * 1000);

async function hourlyProcessor() {
    if (!connection) {
        const connection = new Connection(HTTP_URL, {
            wsEndpoint: WSS_URL
        });
    }
    const documents = await getDocuments();
    const currentHour = new Date().getHours();

    for (const document of documents) {
        // Calculate the time difference in hours
        const timeDiff = (Date.now() - new Date(document.datetime).getTime()) / (1000 * 60 * 60);

        // Check if the time difference is a two-hour interval
        if (Math.floor(timeDiff) % 2 === 0) {
            // Run the checkHolders function for the document
            await checkHolders(document as Document, connection, Math.floor(timeDiff));
        }
    }
}