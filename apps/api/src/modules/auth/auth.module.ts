import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { AccountSecurityController } from './account-security.controller';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { OIDC_KEY_SOURCES, OidcVerifier, remoteOidcKeySources } from './oidc-verifier';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [UsersModule, NotificationsModule],
  controllers: [AuthController, AccountSecurityController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    OidcVerifier,
    TwoFactorService,
    EmailVerificationService,
    // Google's and Apple's published signing keys (fetched lazily, cached by jose).
    { provide: OIDC_KEY_SOURCES, useFactory: remoteOidcKeySources },
  ],
  exports: [PasswordService, TokenService, EmailVerificationService],
})
export class AuthModule {}
