export interface TestDb {
  execute: (sql: string) => Promise<void>;
}

/** Test-only reset helper; production services never call this. */
export async function resetDatabase(db: TestDb, tables: string[]): Promise<void> {
  for (const table of tables) await db.execute(`TRUNCATE TABLE "${table}" CASCADE`);
}
