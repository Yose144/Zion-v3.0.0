#!/usr/bin/env node
// Database migration / initialization
// Creates tables if they don't exist

import { initDb } from '../db.js';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.UPDATE_DB_PATH || join(__dirname, '..', 'data', 'licenses.db');

mkdirSync(join(__dirname, '..', 'data'), { recursive: true });
initDb(dbPath);

console.log('Database initialized at:', dbPath);
console.log('Tables: licenses, activations, releases');
