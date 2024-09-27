import { Connection, PublicKey } from '@solana/web3.js';
import * as fs from 'fs';
import {MongoClient, Db, Collection, ObjectId} from 'mongodb';
import {getMint} from "@solana/spl-token";

const RAYDIUM_PUBLIC_KEY = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
const RAYDIUM = new PublicKey(RAYDIUM_PUBLIC_KEY);
const INSTRUCTION_NAME = "initialize2";
let db: Db;
let collection: Collection;

const connection = new Connection(HTTP_URL, {
    wsEndpoint: WSS_URL
});

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPrice(coin: string, docId: ObjectId) {
    try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${coin}`;
        let price;
        while (!price) {
            try {
                const response = await fetch(url);
                const data = await response.json();
                if (data['pairs']) {
                    price = data['pairs'][0]['priceUsd']; // store the data in price
                } else {
                    await sleep(5000); // Wait for 30 seconds before retrying
                }
            } catch (error) {
                console.error('Error:', error);
            }
        }
        if (!db) {
            const uri = '';
            const client = new MongoClient(uri);
            await client.connect();
            db = client.db('main'); // replace with your database name
            collection = db.collection('liquidityEnabled'); // replace with your collection name
        }
        await collection.updateOne({_id: docId}, {$set: {LPrice: price}});
        return;
    } catch {
        console.log("Error fetching price");
        return;
    }
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
                console.log("Signature for 'initialize2':", `https://explorer.solana.com/tx/${signature}`);
                fetchRaydiumMints(signature, connection);
            }
        },
        "confirmed"
    ); 
}

async function checkFreezeAuthority(connection: Connection, mintAddress: string) {
    const mintAccountPublicKey = new PublicKey(mintAddress);

    let mintAccount = await getMint(connection, mintAccountPublicKey);

    return mintAccount;
}

async function fetchRaydiumMints(txId: string, connection: Connection) {
    try {
        const tx = await connection.getParsedTransaction(
            txId,
            {
                maxSupportedTransactionVersion: 0,
                commitment: 'confirmed'
            });
        const Instructions = tx?.meta?.innerInstructions?.[0]?.instructions;
        const firstInstruction = Instructions?.[0];

        let owner;
        if (firstInstruction && 'parsed' in firstInstruction && 'info' in firstInstruction.parsed) {
            owner = firstInstruction.parsed.info.source;
        }

        let amount;
        if (Instructions) {
            for (const instruction of Instructions) {
                if ('parsed' in instruction && 'info' in instruction.parsed && 'mint' in instruction.parsed.info && 'amount' in instruction.parsed.info) {
                    amount = instruction.parsed.info.amount;
                    break;
                }
            }
        }


        const postTokenBalances = tx?.meta?.postTokenBalances;
        let mintAddress = "";
        if (postTokenBalances) {
            for (const balance of postTokenBalances) {
                if (balance.uiTokenAmount.amount == amount) {
                    mintAddress = balance.mint.toString();
                }
            }
        }
        //@ts-ignore
        const accounts = (tx?.transaction.message.instructions).find(ix => ix.programId.toBase58() === RAYDIUM_PUBLIC_KEY).accounts as PublicKey[];

        if (!accounts) {
            console.log("No accounts found in the transaction.");
            return;
        }

        const tokenAIndex = 8;
        const tokenBIndex = 9;

        const tokenAAccount = accounts[tokenAIndex];
        const tokenBAccount = accounts[tokenBIndex];
        let coin: PublicKey | null = null;

        if (tokenAAccount.toString().includes("So1") || tokenAAccount.toString().includes("bapC8G4wEGGkZwyTDt1v")) {
            coin = tokenBAccount
        } else {
            coin = tokenAAccount
        }

        const displayData = [
            {"Token": "A", "Account Public Key": tokenAAccount.toBase58()},
            {"Token": "B", "Account Public Key": tokenBAccount.toBase58()}
        ];

        const item = tx?.meta?.postTokenBalances?.find((item) => item.mint == coin?.toString() && item.owner == "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1")
        const IV = item?.uiTokenAmount?.uiAmount;

        const soData = tx?.meta?.postTokenBalances?.find((item) => item.mint.includes("So1") && item.owner == "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1")
        const sol = soData?.uiTokenAmount?.uiAmount;
        let SPLAmount: number | null | undefined = 0;
        if (owner) {
            const SPLData = tx?.meta?.postTokenBalances?.find((item) => item.mint == mintAddress.toString() && item.owner == owner.toString())
            SPLAmount = SPLData?.uiTokenAmount?.uiAmount;
        }

        console.log("New LP Found");
        console.log(new Date());
        console.table(displayData);
        console.log("Owner:", owner)
        if (!db) {
            const uri = '';
            const client = new MongoClient(uri);
            await client.connect();
            db = client.db('main'); // replace with your database name
            collection = db.collection('liquidityEnabled'); // replace with your collection name
        }

        const existingDocument = await collection.findOne({
            coin: coin.toString(),
            owner: owner.toString(),
            SPLAddress: mintAddress.toString()
        });

        let data = await checkFreezeAuthority(connection, coin.toString());
        let result = data.freezeAuthority !== null;
        let result2 = data.mintAuthority !== null;

        if (!existingDocument) {
            const document = {
                coin: coin.toString(),
                owner: owner,
                datetime: (new Date),
                LPBLaunch: IV,
                SPLLaunch: SPLAmount,
                LiquiditySOL: sol,
                SPLAddress: mintAddress,
                freezeAuth: result,
                mintAuth: result2,
                checked: false,
                burned: false,
            };

            const { insertedId } = await collection.insertOne(document);
            fetchPrice(coin.toString(), insertedId);
        }
    } catch (e) {
        fs.appendFileSync('errors.json', txId + ',\n');
    }
}
startConnection(connection, RAYDIUM, INSTRUCTION_NAME).catch(console.error);