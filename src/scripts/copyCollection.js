/**
 * Simple script to copy one MongoDB collection
 * from Project A (source) to Project B (target)
 * using Node.js + native MongoDB driver.
 *
 * 👉 Run:  node copyCollection.js
 */

import { MongoClient } from "mongodb";

const sourceURI = "mongodb+srv://mandaladignite_db_user:TioKhVnFlaUL93uC@cluster0.uo9ffw8.mongodb.net";
const targetURI = "mongodb+srv://mandaladignite_db_user:JC97EXDUg9mkJ4wd@cluster0.qayx2jv.mongodb.net";

// 🧩 Change these according to your setup
const sourceDBName = "enlive_db";
const targetDBName = "enlive-salon";
const collectionName = "users"; // e.g. "users"

async function copyCollection() {
  const sourceClient = new MongoClient(sourceURI);
  const targetClient = new MongoClient(targetURI);

  try {
    console.log("⏳ Connecting to both MongoDB projects...");
    await sourceClient.connect();
    await targetClient.connect();

    const sourceDB = sourceClient.db(sourceDBName);
    const targetDB = targetClient.db(targetDBName);

    const sourceCol = sourceDB.collection(collectionName);
    const targetCol = targetDB.collection(collectionName);

    console.log(`📥 Fetching documents from ${sourceDBName}.${collectionName}...`);
    const docs = await sourceCol.find({}).toArray();

    console.log(`Found ${docs.length} documents.`);

    if (docs.length === 0) {
      console.log("⚠️ No documents found — nothing to copy.");
      return;
    }

    console.log(`📤 Inserting into ${targetDBName}.${collectionName}...`);
    await targetCol.insertMany(docs);

    console.log("✅ Successfully copied collection!");
  } catch (error) {
    console.error("❌ Error during copy:", error);
  } finally {
    await sourceClient.close();
    await targetClient.close();
    console.log("🔒 Connections closed.");
  }
}

copyCollection();
