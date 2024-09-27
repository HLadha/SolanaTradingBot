import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import {MongoClient, Db, Collection, ObjectId} from 'mongodb';
import {getMint} from "@solana/spl-token";

const RAYDIUM_PUBLIC_KEY = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const RAYDIUM = new PublicKey(RAYDIUM_PUBLIC_KEY);
const INSTRUCTION_NAME = "Burn";
let db: Db;
let collection: Collection;

const connection = new Connection(HTTP_URL, {
    wsEndpoint: WSS_URL
});

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function startConnection(connection: Connection, programAddress: PublicKey, searchInstruction: string): Promise<void> {
    let count = 1;
    console.log("Monitoring logs for program:", programAddress.toString());
    connection.onLogs(
        programAddress,
        ({ logs, err, signature }) => {
            if (count == 1) {
                console.log("Logs received.");
                count++;
            }
            if (err) return;
            if (logs && logs.some(log => log.includes(searchInstruction))) {
                const transferLogs = logs.filter(log => log.includes('Transfer'));
                if (transferLogs.length === 2) {
                    console.log("Signature for 'burn':", `https://solscan.io/tx/${signature}`);
                    checkFullBurn(connection, signature);
                }
            }
        },
        "confirmed"
    );
}

async function checkFullBurn(connection: Connection, signature: string) {
    try {
        if (!db) {
            const uri = '';
            const client = new MongoClient(uri);
            await client.connect();
            db = client.db('main'); // replace with your database name
            collection = db.collection('liquidityEnabled'); // replace with your collection name
        }
        const tx = await connection.getParsedTransaction(
            signature,
            {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
            });
        const tokenBalances = tx?.meta?.postTokenBalances;
        if (tokenBalances) {
            // Get a list of the tokens included in this transaction:
            const tokens = tokenBalances.map(balance => balance.mint);
            let t: string[] = [];
            // Remove So111 from the list using includes and duplicates
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i].toString().includes('So1')) {
                    // Do nothing
                } else {
                    if (!t.includes(tokens[i])) {
                        t.push(tokens[i]);
                    }
                }
            }
            // Check if the token is a coin in mongodb
            for (let i = 0; i < t.length; i++) {
                const coin = t[i].toString();
                const coinData = await collection.findOne({coin: coin});
                if (coinData) {
                    console.log("Coin found in database:", coin);
                    await collection.updateOne({coin: coin}, {$set: {'liquidityPull': true}});
                }
            }
        }
    }
    catch (error) {
        console.error('Error:', error);
    }
}

startConnection(connection, RAYDIUM, INSTRUCTION_NAME);