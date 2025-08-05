// A standalone script to store a JSON object on the Shimmer Testnet.
import { Client, utf8ToHex } from '@iota/sdk';

// Connect to a Shimmer testnet node
const client = new Client({
    nodes: ['https://api.shimmer.network'],
});

async function storeData() {
    try {
        const tag = utf8ToHex('com.my-app.sensor-data');
        const jsonData = {
            sensorId: "TEMP-001",
            timestamp: new Date().toISOString(),
            temperature: 21.5,
            humidity: 45.2,
        };
        const data = utf8ToHex(JSON.stringify(jsonData));

        // --- 1. Calculate the data size in bytes ---
        // The hex string has a '0x' prefix, and 2 hex characters make 1 byte.
        const dataSizeBytes = (data.length - 2) / 2;

        console.log("Submitting block...");

        // --- 2. Record start time before the network request ---
        const startTime = Date.now();

        const [blockId] = await client.buildAndPostBlock(undefined, {
            tag: tag,
            data: data,
        });

        // --- 3. Record end time after the request is complete ---
        const endTime = Date.now();
        const elapsedTime = endTime - startTime; // Time in milliseconds

        const explorerUrl = `https://explorer.shimmer.network/shimmer/block/${blockId}`;
        
        console.log(`\n✅ Block sent successfully!`);
        console.log(`----------------------------------------`);
        console.log(`Data Size: ${dataSizeBytes} bytes`);
        console.log(`Time Elapsed: ${elapsedTime} ms`);
        console.log(`Block ID: ${blockId}`);
        console.log(`View on explorer: ${explorerUrl}`);

    } catch (error) {
        console.error("Error storing data:", error);
    }
}

storeData().then(() => process.exit());