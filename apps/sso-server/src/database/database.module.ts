import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

/** Token DI cho pool Postgres dùng chung toàn app. */
export const PG_POOL = "PG_POOL";

/**
 * Kết nối Postgres dùng chung (node-postgres Pool). Ta tự viết SQL/Adapter
 * (không ORM nặng) để kiểm soát atomic consume/revoke của OIDC adapter (AD-6).
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Pool => {
        return new Pool({
          connectionString: config.getOrThrow<string>("DATABASE_URL"),
          max: 20,
          // Cạn pool → chờ tối đa 5s rồi ném lỗi thay vì treo vô hạn
          connectionTimeoutMillis: 5000,
          // Query kẹt → hủy sau 10s, trả connection về pool (chống ngậm slot)
          statement_timeout: 10000,
          idleTimeoutMillis: 30000,
        });
      },
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
