import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { SettingsService } from "../config/settings.service";
import { PG_POOL } from "../database/database.module";
import { KeysService } from "./keys.service";
import { createOidcProvider } from "./provider.factory";

/** DI token cho instance oidc-provider (ESM, nạp qua dynamic import). */
export const OIDC_PROVIDER = "OIDC_PROVIDER";

/**
 * Lõi OIDC (Epic 1): oidc-provider v9 + khóa ký + (S3) adapter Postgres +
 * (S4) interaction + (S8) findAccount.
 */
@Module({
  providers: [
    KeysService,
    {
      provide: OIDC_PROVIDER,
      inject: [ConfigService, KeysService, PG_POOL, SettingsService],
      useFactory: (
        config: ConfigService,
        keys: KeysService,
        pool: Pool,
        settings: SettingsService,
      ) => createOidcProvider(config, keys, pool, settings),
    },
  ],
  exports: [OIDC_PROVIDER, KeysService],
})
export class OidcModule {}
