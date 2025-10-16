#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mongoose = require('mongoose');
const dotenvPath = path.resolve(__dirname, '.env');

function encode(p) { return encodeURIComponent(p); }

function question(prompt, mask = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (!mask) {
      rl.question(prompt, (ans) => { rl.close(); resolve(ans); });
      return;
    }
    // masking: hide input by writing backspace characters
    const stdin = process.stdin;
    process.stdout.write(prompt);
    stdin.setRawMode(true);
    let input = '';
    stdin.on('data', (ch) => {
      ch = ch + '';
      switch (ch) {
        case '\r':
        case '\n':
          process.stdout.write('\n');
          stdin.setRawMode(false);
          stdin.pause();
          resolve(input);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u0008':
        case '\u007f':
          input = input.slice(0, -1);
          break;
        default:
          input += ch;
          break;
      }
    });
  });
}

async function testUri(uri) {
  try {
    console.log('\nTesting URI (will attempt a quick connect)');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    await mongoose.disconnect();
    console.log('✅ Connection OK');
    return true;
  } catch (err) {
    console.error('❌ Connection failed:', err.message || err);
    return false;
  }
}

async function main() {
  console.log('MongoDB URI Builder & Tester');
  const defaultEnv = fs.existsSync(dotenvPath) ? fs.readFileSync(dotenvPath, 'utf8') : '';
  let suggestedHost = '';
  let suggestedDb = '';
  const m = defaultEnv.match(/MONGO_URI=(.*)/);
  if (m) {
    const val = m[1].trim();
    // Try parse host and db
    try {
      const url = new URL(val);
      suggestedHost = url.host;
      suggestedDb = url.pathname && url.pathname !== '/' ? url.pathname.slice(1) : '';
    } catch (e) { /* ignore */ }
  }

  const username = (await question(`Username [${process.env.MONGO_USER || ''}]: `)) || process.env.MONGO_USER || '';
  const password = await question('Password (input hidden): ', true);
  const host = (await question(`Cluster host [${suggestedHost || 'cluster0.example.net'}]: `)) || suggestedHost || 'cluster0.example.net';
  const dbname = (await question(`Database name [${suggestedDb || 'speech_to_text'}]: `)) || suggestedDb || 'speech_to_text';

  const finalUri = `mongodb+srv://${username}:${encode(password)}@${host}/${dbname}?retryWrites=true&w=majority`;
  console.log('\nConstructed URI:\n', finalUri.replace(/:[^:@]+@/, ':<password>@'));

  const ok = await testUri(finalUri);
  if (ok) {
    const ans = (await question('Write this URI into server/.env as MONGO_URI? (y/N): ')) || 'N';
    if (ans.toLowerCase().startsWith('y')) {
      const newEnv = defaultEnv.replace(/MONGO_URI=.*\n?/, '') + `\nMONGO_URI=${finalUri}\n`;
      fs.writeFileSync(dotenvPath, newEnv, { encoding: 'utf8' });
      console.log('✅ Wrote MONGO_URI to', dotenvPath);
    } else {
      console.log('Not writing to .env. You can copy the URI above and update server/.env manually.');
    }
  } else {
    console.log('Fix the credentials and try again.');
  }
  process.exit(ok ? 0 : 1);
}

main();
