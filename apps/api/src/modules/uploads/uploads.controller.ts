import { Controller, HttpCode, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsIn } from 'class-validator';
import { randomUUID } from 'crypto';
import type { UploadPurpose, UploadResponse } from '@card-trader/shared';
import type { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { Errors } from '../../common/errors/app.exception';
import { sniffImage } from './image-sniffer';
import { StorageService } from './storage.service';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const UPLOAD_PURPOSES: UploadPurpose[] = ['AVATAR', 'ITEM_IMAGE', 'VENDOR_LOGO'];

class UploadQueryDto {
  @IsIn(UPLOAD_PURPOSES)
  purpose: UploadPurpose;
}

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post('images')
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({ name: 'purpose', enum: UPLOAD_PURPOSES })
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }),
  )
  async uploadImage(
    @CurrentUser() user: AuthUser,
    @Query() query: UploadQueryDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UploadResponse> {
    if (!file) throw Errors.badRequest('FILE_REQUIRED', 'Attach an image in the "file" field');
    const extension = sniffImage(file.buffer);
    if (!extension) throw Errors.badRequest('UNSUPPORTED_IMAGE', 'Only JPEG, PNG or WebP images are allowed');

    const key = this.storage.buildKey(query.purpose, user.userId, randomUUID(), extension);
    await this.storage.put(key, file.buffer);
    return { key, url: this.storage.urlFor(key) as string };
  }
}
