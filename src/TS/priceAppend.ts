import {MongoClient, Db, Collection, ObjectId} from 'mongodb';
let db: Db;
let collection: Collection;


function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPrice(coin: string, docId: ObjectId, hours: number, BPrice: number) {
    try {
        const url = `https://api.dexscreener.com/latest/dex/tokens/${coin}`;
        let price;
        let roi;
        let success = false;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data['pairs']) {
                price = data['pairs'][0]['priceUsd']; // store the data in price
                roi = (price - BPrice)/ BPrice;
                if (roi > 2) {
                    success = true;
                }
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
        const stamp = `${hours}Price`;
        const stamp2 = `${hours}roi`;
        const stamp3 = `${hours}roi_success`;
        await collection.updateOne({_id: docId}, {$set: {[stamp]: price, [stamp2]:roi, [stamp3]: success}});
        return;
    } catch {
        console.log("Error fetching price");
        return;
    }
}
async function checkPrice() {
    if (!db) {
        const uri = '';
        const client = new MongoClient(uri);
        await client.connect();
        db = client.db('main'); // replace with your database name
        collection = db.collection('liquidityEnabled'); // replace with your collection name
    }
    const docs = await collection.find({burned:true}).toArray();
    for (const doc of docs) {
        console.log(doc)
        const currentDate = new Date();
        const diffInHours = Math.abs(currentDate.getTime() - doc.datetime.getTime()) / 3600000;
        // convert difference in milliseconds to hours
        const remainder = diffInHours % 2;
        if (diffInHours > 2 && diffInHours < 24) {
            if (remainder < 0.1667 || remainder > 1.8333) { // check if the difference is within 10 minutes of a multiple of 2
                const hours = Math.floor(diffInHours);
                const str = `${hours}Price`;
                if (!doc[str]) {
                    console.log(doc.coin.toString())
                    console.log(diffInHours)
                    await fetchPrice(doc.coin, doc._id, hours, doc.BPrice);
                }
            }
        }
    }
}

async function run() {
    while (true) {
        try {
            await checkPrice();
            await sleep(60000); // Wait for 1 minute before retrying
        } catch (error) {
            console.error('Error:', error);
            await sleep(30000); // Wait for 30 seconds before retrying
        }
    }
}

run();