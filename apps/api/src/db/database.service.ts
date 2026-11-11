import { Injectable, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { Pool, QueryResultRow } from "pg";
import { loadEnv } from "../env";
import { migrate } from "./migrate";

function sslFor(url: string): false | { rejectUnauthorized: boolean } | undefined {
  if (/sslmode=disable/.test(url)) return false;
  if (/localhost|127\.0\.0\.1/.test(url) && !/sslmode=require/.test(url)) return undefined;
  return { rejectUnauthorized: false };
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: Pool | null = null;

  constructor() {
    loadEnv();
    const url = process.env.DATABASE_URL;
    if (!url) return;
    this.pool = new Pool({ connectionString: url, ssl: sslFor(url), max: 8 });
  }

  async onModuleInit(): Promise<void> {
    if (!this.pool) return;
    await migrate(this.pool);
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  available(): boolean {
    return this.pool !== null;
  }

  async query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
    if (!this.pool) {
      throw new ServiceUnavailableException("DATABASE_URL is not configured.");
    }
    const result = await this.pool.query<T>(text, params);
    return result.rows;
  }
}
