import { Connection, Keypair, VersionedTransaction, TransactionConfirmationStrategy, PublicKey } from '@solana/web3.js';
import fetch from 'cross-fetch';
import { Wallet } from '@project-serum/anchor';
import bs58 from 'bs58';
import { writeFile } from 'fs/promises';
import { transactionSenderAndConfirmationWaiter } from './transactionSender';
import { TransactionSenderAndConfirmationWaiterArgs } from './transactionSender';

const connection = new Connection(HTTP_URL, {
    wsEndpoint: WSS_URL
});

const wallet = new Wallet(Keypair.fromSecretKey(bs58.decode(""))); // replace with your secret key

export async function getQuote(flag: string, token: string, amount: number, slippage: number) {
    let inputMint;
    let outputMint;
    if (flag == 'buy') {
        inputMint = 'So11111111111111111111111111111111111111112'
        outputMint = token
    } else {
        inputMint = token
        outputMint = 'So11111111111111111111111111111111111111112'
    }
    const quoteResponse = await (
        await fetch('https://quote-api.jup.ag/v6/quote?inputMint='+inputMint+'\
&outputMint='+outputMint+'\
&amount='+amount.toString()+'\
&slippageBps='+slippage.toString()
        )
    ).json();
    return quoteResponse;
}

export async function swap(flag: string, token: string, amount: number, slippage: number) {
    const quoteResponse = await getQuote(flag, token, amount, slippage);
    console.log(quoteResponse);
    // get serialized transactions for the swap
    const { swapTransaction } = await (
        await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                quoteResponse,
                userPublicKey: wallet.publicKey.toString(),
                wrapAndUnwrapSol: true,
                prioritizationFeeLamports: {"priorityLevelWithMaxLamports": {"priorityLevel": "veryHigh", "maxLamports": 5000000}},
            })
        })
    ).json();
    console.log(swapTransaction);
    // deserialize the transaction
    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    let transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    // sign the transaction
    transaction.sign([wallet.payer]);
    // Execute the transaction
    const rawTransaction = transaction.serialize()
    const bufferTransaction = Buffer.from(rawTransaction);
    const bh = await connection.getLatestBlockhash()
    const input: TransactionSenderAndConfirmationWaiterArgs = {connection: connection, serializedTransaction: bufferTransaction,
        blockhashWithExpiryBlockHeight: bh}

    const txid = await transactionSenderAndConfirmationWaiter(input);
    if (txid) {
        const base = txid?.meta?.postTokenBalances
        let outAmount = 0
        for (const balance of (base || []) as any) {
            if (flag === 'buy'){
                if (balance.mint === token && balance.owner === '') {
                    outAmount = balance.uiTokenAmount.amount
                }
            } else if (flag === 'sell') {
                if (balance.mint.toString().includes('So1') && balance.owner === '') {
                    outAmount = balance.uiTokenAmount.amount
                }
            }
        }
        console.log(`https://solscan.io/tx/${txid?.transaction?.signatures?.[0]}`);
        return [true, `https://solscan.io/tx/${txid?.transaction?.signatures?.[0].toString()}`, outAmount];
    } else {
        return [false, 'failed'];
    }

}