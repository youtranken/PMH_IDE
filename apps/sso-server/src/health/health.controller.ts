import { Controller, Get, Inject, Optional, Res } from "@nestjs/common";
import type { Response } from "express";
import { Pool } from "pg";
import { JWT_CLAIMS_VERSION } from "@pmh/shared";
import { PG_POOL } from "../database/database.module";
import { HeartbeatService } from "../modules/jobs/heartbeat.service";
import { OIDC_PROVIDER } from "../oidc/oidc.module";

/**
 * /api/health (E3-S4, AD-16) — liveness + DB + provider + nhịp scheduler.
 * KHÔNG được treo theo pool cạn: ping DB có deadline 2s, các phần phụ
 * best-effort (lỗi → null, không làm sập health).
 */
@Controller("health")
export class HealthController {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Optional() @Inject(OIDC_PROVIDER) private readonly provider: unknown,
    @Optional() private readonly heartbeat?: HeartbeatService,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const db = await this.pingDb();
    if (db !== "up") res.status(503);

    // Phụ trợ — best-effort VÀ có deadline riêng 2s (đúng cam kết "không treo":
    // status() gồm nhiều query, DB chậm không được kéo /health treo theo).
    let scheduler = null;
    let stalePending = null;
    let deadLettered = null;
    try {
      const s = await Promise.race([
        this.heartbeat?.status() ?? Promise.resolve(null),
        new Promise<null>((r) => setTimeout(() => r(null), 2000)),
      ]);
      if (s) {
        scheduler = s.scheduler;
        stalePending = s.stalePending;
        deadLettered = s.deadLettered;
      }
    } catch {
      /* best-effort */
    }

    return {
      status: db === "up" ? "ok" : "degraded",
      db,
      provider: this.provider ? "up" : "down",
      scheduler,
      stalePending,
      deadLettered,
      claimsVersion: JWT_CLAIMS_VERSION,
      ts: new Date().toISOString(),
    };
  }

  private async pingDb(): Promise<"up" | "down"> {
    const timeout = new Promise<"down">((resolve) =>
      setTimeout(() => resolve("down"), 2000),
    );
    const query = this.pool
      .query("SELECT 1")
      .then((): "up" => "up")
      .catch((): "down" => "down");
    return Promise.race([query, timeout]);
  }
}
