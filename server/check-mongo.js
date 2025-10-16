#!/usr/bin/env node
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load .env from server folder
dotenv.config({ path: path.resolve(__dirname, '.env') });

const argv = process.argv.slice(2);
const useEnv = argv.includes('--use-env');

async function tryConnect(uri) {
  console.log('\nAttempting to connect to MongoDB with URI:\n', uri, '\n');
  try {
    // short timeout to fail fast
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to MongoDB successfully!');
    await mongoose.disconnect();
    return 0;
  } catch (err) {
    console.error('❌ MongoDB connection failed:');
    // Print useful fields
    console.error('name:', err.name);
    console.error('message:', err.message);
    if (err.reason) console.error('reason:', err.reason);
    if (err.errorResponse) console.error('errorResponse:', err.errorResponse);
    console.error('\nFull error object:');
    console.error(err);
    return 1;
  }
}

async function main() {
  const envUri = process.env.MONGO_URI;
  if (!envUri) {
    console.log('No MONGO_URI found in server/.env. You can pass a full URI as an argument.');
  }

  if (useEnv && envUri) {
    const code = await tryConnect(envUri);
    process.exit(code);
  }

  // Interactive prompt
  const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  function question(q) {
    return new Promise(resolve => readline.question(q, ans => resolve(ans)));
  }

  console.log('\nMongoDB connection tester');
  if (envUri) {
    const ans = (await question('Use MONGO_URI from server/.env? (Y/n): ')) || 'Y';
    if (ans.toLowerCase().startsWith('y')) {
      readline.close();
      const code = await tryConnect(envUri);
      process.exit(code);
    }
  }

  const manual = await question('Enter full MongoDB URI (mongodb+srv://... or mongodb://...): ');
  readline.close();
  if (!manual) {
    console.error('No URI provided. Exiting.');
    process.exit(2);
  }
  const code = await tryConnect(manual.trim());
  process.exit(code);
}

main();

/*
Notes:
- You can run this non-interactively using: node check-mongo.js --use-env
- If auth fails, ensure your Atlas user password is correct and percent-encoded in the URI.
  Example: password 'P@ssw0rd!' becomes 'P%40ssw0rd%21' in the URI.
- Typical URI format (replace placeholders):
  mongodb+srv://<username>:<password>@cluster0.i8fgkhu.mongodb.net/<dbname>?retryWrites=true&w=majority
*/
