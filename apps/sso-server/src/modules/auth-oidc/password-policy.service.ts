import { BadRequestException, Injectable } from "@nestjs/common";
import { passwordValid } from "@pmh/shared";
import { SettingsService } from "../../config/settings.service";

/**
 * Policy mật khẩu (E2-S4, FR-32): độ dài tối thiểu + đủ 4 loại (luật chung
 * @pmh/shared), và hạn đổi định kỳ. Con số nằm trong Settings (AD-15).
 */
@Injectable()
export class PasswordPolicyService {
  constructor(private readonly settings: SettingsService) {}

  /** Ném BadRequest nếu mật khẩu không đạt policy. */
  async assertValid(pw: string): Promise<void> {
    const min = await this.settings.getInt("password_min_length", 8);
    if (!passwordValid(pw, min)) {
      throw new BadRequestException(
        `Mật khẩu chưa đạt: tối thiểu ${min} ký tự và đủ 4 loại (hoa/thường/số/đặc biệt).`,
      );
    }
  }

  /** Mật khẩu đã quá hạn đổi (90 ngày) hoặc chưa từng đặt? */
  async isExpired(passwordUpdatedAt: Date | null): Promise<boolean> {
    const maxAgeDays = await this.settings.getInt("password_max_age_days", 90);
    if (maxAgeDays <= 0) return false; // 0 = tắt hết hạn
    if (!passwordUpdatedAt) return true; // chưa từng đặt → buộc đổi
    const ageMs = Date.now() - passwordUpdatedAt.getTime();
    return ageMs > maxAgeDays * 24 * 60 * 60 * 1000;
  }
}
