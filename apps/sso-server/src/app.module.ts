import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { validateEnv } from "./config/env.validation";
import { SettingsModule } from "./config/settings.module";
import { DatabaseModule } from "./database/database.module";
import { HealthController } from "./health/health.controller";
import { CommonModule } from "./common/common.module";
import { AdminAuthModule } from "./common/admin/admin-auth.module";
import { OidcModule } from "./oidc/oidc.module";
import { AuthOidcModule } from "./modules/auth-oidc/auth-oidc.module";
import { UsersModule } from "./modules/users/users.module";
import { GroupsModule } from "./modules/groups/groups.module";
import { DepartmentsModule } from "./modules/departments/departments.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { DirectoryApiModule } from "./modules/directory-api/directory-api.module";
import { AuditModule } from "./modules/audit/audit.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { MeModule } from "./modules/me/me.module";
import { SettingsAdminModule } from "./modules/settings-admin/settings-admin.module";
import { DocsModule } from "./modules/docs/docs.module";

/**
 * Modular monolith (AD-1): mọi tính năng là module trong 1 process NestJS.
 * Epic 0 chỉ dựng khung — các module nghiệp vụ còn rỗng.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv, // fail-fast nếu thiếu biến .env bắt buộc (AD-15)
    }),
    ScheduleModule.forRoot(), // nền cho cron/queue worker (AD-13)
    DatabaseModule,
    SettingsModule,
    CommonModule,
    OidcModule,
    AdminAuthModule, // nền xác thực quản trị (Epic 4+)
    // ---- module nghiệp vụ ----
    AuthOidcModule,
    UsersModule,
    GroupsModule,
    DepartmentsModule,
    ProjectsModule,
    ClientsModule,
    DirectoryApiModule,
    AuditModule,
    JobsModule,
    NotificationsModule,
    MeModule,
    SettingsAdminModule,
    DocsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
