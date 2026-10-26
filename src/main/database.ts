import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'

// Backend-only foundation. No schema, migrations, seed data or renderer SQL API.
export function openDatabase(userData: string): Database.Database {
  mkdirSync(userData, { recursive: true })
  const db = new Database(join(userData, 'shumora.sqlite'))
  try {
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    return db
  } catch (error) {
    db.close()
    throw error
  }
}
