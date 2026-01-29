
import Database from 'better-sqlite3';
import path from 'path';

// Use a persistent database file
const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    stream_key TEXT UNIQUE,
    avatar TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration for existing tables
try {
  db.exec('ALTER TABLE users ADD COLUMN avatar TEXT');
} catch (error: any) {
  // Column likely exists
  if (!error.message.includes('duplicate column name')) {
    // console.error('Migration error:', error);
  }
}

export default db;
