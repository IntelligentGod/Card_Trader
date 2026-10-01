import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthResponse, AuthTokens } from '@card-trader/shared';
import { Errors } from '../../common/errors/app.exception';
import { generatePublicId } from '../../common/utils/ids';
import { PrismaService } from '../../prisma/prisma.service';
import { UserMapper, userProfileInclude } from '../users/user.mapper';
import type { LoginDto, RegisterDto } from './dto/auth.dto';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

const INVALID_CREDENTIALS = 'Invalid email or password';

export const usernameTaken = () => Errors.conflict('USERNAME_TAKEN', 'That username is taken');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly users: UserMapper,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const weakness = this.passwords.weaknessReason(dto.password, dto.email);
    if (weakness) throw Errors.badRequest('WEAK_PASSWORD', weakness);

    const taken = await this.prisma.profile.findUnique({ where: { username: dto.username }, select: { userId: true } });
    if (taken) throw usernameTaken();

    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.createUserWithUniquePublicId(dto, passwordHash);
    const tokens = await this.tokens.issue(user);
    return { user: this.users.toMe(user), tokens };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email }, include: userProfileInclude });
    // Always run a verification so response time does not reveal whether the email exists.
    const valid = await this.passwords.verify(user?.passwordHash ?? null, dto.password);
    if (!user || !valid) throw Errors.unauthorized('INVALID_CREDENTIALS', INVALID_CREDENTIALS);
    if (user.status !== 'ACTIVE') throw Errors.unauthorized('ACCOUNT_INACTIVE', 'Account is not active');

    const tokens = await this.tokens.issue(user);
    return { user: this.users.toMe(user), tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const { tokens } = await this.tokens.rotate(refreshToken);
    return tokens;
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  private async createUserWithUniquePublicId(dto: RegisterDto, passwordHash: string) {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.user.create({
          data: {
            email: dto.email,
            passwordHash,
            publicId: generatePublicId(),
            profile: { create: { username: dto.username, displayName: dto.displayName } },
          },
          include: userProfileInclude,
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const target = String((error.meta as { target?: unknown } | undefined)?.target ?? '');
          if (target.includes('email')) {
            throw Errors.conflict('EMAIL_TAKEN', 'An account with this email already exists');
          }
          if (target.includes('username')) throw usernameTaken();
          continue; // public id collision (astronomically rare): retry with a new one
        }
        throw error;
      }
    }
    throw new Error('Could not allocate a unique public id');
  }
}
