import fs from "fs/promises";
import { type DB } from "./models.ts"; 

/**
 * Reads the JSON database from disk.
 */
export const getDB = async (path: string | URL): Promise<DB> => {
  const raw = await fs.readFile(path, { encoding: 'utf-8' });
  return JSON.parse(raw);
};

/**
 * Writes the database object to disk.
 */
export const saveDB = async (path: string | URL, db: DB): Promise<void> => {
  await fs.writeFile(path, JSON.stringify(db, null, 2), 'utf-8');
};

/**
 * Returns the next available ID for a given array of items with numeric `id` fields.
 */
export const getNextId = (items: { id: number }[]): number => {
  if (items.length === 0) return 1;
  const maxId = Math.max(...items.map(item => item.id));
  return maxId + 1;
};

/**
 * Convert numbers safely out of a string
 */
export function parseNumberSafe(val: string): number | null {
  const parsed = Number(val);

  if (val.trim() === "" || Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}
