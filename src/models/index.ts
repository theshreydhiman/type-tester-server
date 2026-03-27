import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', '..', 'database.sqlite');

let db: Database;

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS User (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT,
      abusiveConsent INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `);

  // Migration: add abusiveConsent column if missing (existing databases)
  try {
    const cols = db.exec('PRAGMA table_info(User)');
    const hasColumn = cols[0]?.values.some((row) => row[1] === 'abusiveConsent');
    if (!hasColumn) {
      db.run('ALTER TABLE User ADD COLUMN abusiveConsent INTEGER NOT NULL DEFAULT 0');
    }
  } catch { /* column already exists */ }

  db.run(`
    CREATE TABLE IF NOT EXISTS TestResult (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER,
      wpm REAL NOT NULL,
      rawWpm REAL NOT NULL,
      accuracy REAL NOT NULL,
      consistency REAL NOT NULL,
      charsCorrect INTEGER NOT NULL,
      charsWrong INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      charErrors TEXT NOT NULL,
      wpmTimeline TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES User(id) ON DELETE SET NULL
    )
  `);

  save();
}

function save(): void {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// ---- User ----

export interface UserRow {
  id: number;
  email: string;
  username: string;
  passwordHash: string | null;
  abusiveConsent: number;
  createdAt: string;
  updatedAt: string;
}

export const User = {
  findOne(opts: { where: Record<string, unknown> }): UserRow | null {
    const keys = Object.keys(opts.where);
    const clause = keys.map(k => `${k} = :${k}`).join(' AND ');
    const params: Record<string, unknown> = {};
    for (const k of keys) params[`:${k}`] = opts.where[k];

    const stmt = db.prepare(`SELECT * FROM User WHERE ${clause} LIMIT 1`);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as UserRow;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  },

  findByPk(id: number, opts?: { attributes?: string[] }): UserRow | null {
    const cols = opts?.attributes?.join(', ') || '*';
    const stmt = db.prepare(`SELECT ${cols} FROM User WHERE id = :id`);
    stmt.bind({ ':id': id });
    if (stmt.step()) {
      const row = stmt.getAsObject() as unknown as UserRow;
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  },

  create(data: { email: string; username: string; passwordHash: string }): UserRow {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO User (email, username, passwordHash, createdAt, updatedAt) VALUES (:email, :username, :passwordHash, :createdAt, :updatedAt)`,
      { ':email': data.email, ':username': data.username, ':passwordHash': data.passwordHash, ':createdAt': now, ':updatedAt': now },
    );
    const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
    save();
    return { id, email: data.email, username: data.username, passwordHash: data.passwordHash, abusiveConsent: 0, createdAt: now, updatedAt: now };
  },

  updateConsent(userId: number, consent: boolean): void {
    db.run(
      `UPDATE User SET abusiveConsent = :consent, updatedAt = :updatedAt WHERE id = :id`,
      { ':consent': consent ? 1 : 0, ':updatedAt': new Date().toISOString(), ':id': userId },
    );
    save();
  },
};

// ---- TestResult ----

export interface TestResultRow {
  id: number;
  userId: number | null;
  wpm: number;
  rawWpm: number;
  accuracy: number;
  consistency: number;
  charsCorrect: number;
  charsWrong: number;
  duration: number;
  charErrors: object;
  wpmTimeline: object;
  createdAt: string;
}

function parseResultRow(row: Record<string, unknown>): TestResultRow {
  return {
    ...row,
    charErrors: JSON.parse(row.charErrors as string),
    wpmTimeline: JSON.parse(row.wpmTimeline as string),
  } as TestResultRow;
}

export const TestResult = {
  create(data: {
    userId: number | null;
    wpm: number;
    rawWpm: number;
    accuracy: number;
    consistency: number;
    charsCorrect: number;
    charsWrong: number;
    duration: number;
    charErrors: object;
    wpmTimeline: object;
  }): TestResultRow {
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO TestResult (userId, wpm, rawWpm, accuracy, consistency, charsCorrect, charsWrong, duration, charErrors, wpmTimeline, createdAt)
       VALUES (:userId, :wpm, :rawWpm, :accuracy, :consistency, :charsCorrect, :charsWrong, :duration, :charErrors, :wpmTimeline, :createdAt)`,
      {
        ':userId': data.userId,
        ':wpm': data.wpm,
        ':rawWpm': data.rawWpm,
        ':accuracy': data.accuracy,
        ':consistency': data.consistency,
        ':charsCorrect': data.charsCorrect,
        ':charsWrong': data.charsWrong,
        ':duration': data.duration,
        ':charErrors': JSON.stringify(data.charErrors),
        ':wpmTimeline': JSON.stringify(data.wpmTimeline),
        ':createdAt': now,
      },
    );
    const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
    save();
    return { id, ...data, createdAt: now };
  },

  findAll(opts: { where: Record<string, unknown>; order?: [string, string][]; limit?: number }): TestResultRow[] {
    const keys = Object.keys(opts.where);
    const clause = keys.map(k => `${k} = :${k}`).join(' AND ');
    const params: Record<string, unknown> = {};
    for (const k of keys) params[`:${k}`] = opts.where[k];

    const orderClause = opts.order?.map(([col, dir]) => `${col} ${dir}`).join(', ') || 'createdAt DESC';
    const limitClause = opts.limit ? `LIMIT ${opts.limit}` : '';

    const results: TestResultRow[] = [];
    const stmt = db.prepare(`SELECT * FROM TestResult WHERE ${clause} ORDER BY ${orderClause} ${limitClause}`);
    stmt.bind(params);
    while (stmt.step()) {
      results.push(parseResultRow(stmt.getAsObject() as Record<string, unknown>));
    }
    stmt.free();
    return results;
  },
};
