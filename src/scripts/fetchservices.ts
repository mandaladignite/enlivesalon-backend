import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 👉 Use env variable in real projects
const uri = "mongodb+srv://mandaladignite_db_user:JC97EXDUg9mkJ4wd@cluster0.qayx2jv.mongodb.net";

const OUTPUT_FILE = path.join(__dirname, "services.json");

async function fetchAndStoreServices() {
  const client = new MongoClient(uri);

  try {
    await client.connect();

    const db = client.db("enlive-salon");
    const collection = db.collection("services");

    const services = await collection.find({}).toArray();

    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(services, null, 2),
      "utf-8"
    );

    console.log(`✅ ${services.length} records saved to`);
    console.log(`📄 ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await client.close();
  }
}

fetchAndStoreServices();
