import { Injectable } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, resolve, sep } from 'path';
import type { UploadPurpose } from '@card-trader/shared';
import { AppConfig } from '../../config/app-config.service';

const PURPOSE_DIR: Record<UploadPurpose, string> = { AVATAR: 'avatars', ITEM_IMAGE: 'items', VENDOR_LOGO: 'vendors' };
const KEY_PATTERN = /^(avatars|items|vendors)\/([0-9a-f-]{36})\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const MEDIA_ROUTE_PREFIX = '/media/';

/**
 * Object storage behind a small interface. The MVP driver writes to local disk
 * (served at /media). A production S3-compatible driver can implement the same
 * three methods without touching callers.
 */
@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(private readonly config: AppConfig) {
    this.root = resolve(this.config.get('STORAGE_LOCAL_DIR'));
  }

  get localRoot(): string {
    return this.root;
  }

  buildKey(purpose: UploadPurpose, userId: string, fileId: string, extension: 'jpg' | 'png' | 'webp'): string {
    return `${PURPOSE_DIR[purpose]}/${userId}/${fileId}.${extension}`;
  }

  /** True when `key` is a well-formed key for `purpose` uploaded by `userId`. */
  isOwnedKey(key: string, purpose: UploadPurpose, userId: string): boolean {
    const match = KEY_PATTERN.exec(key);
    return !!match && match[1] === PURPOSE_DIR[purpose] && match[2] === userId;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data, { flag: 'wx' });
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.pathFor(key));
    } catch {
      // Already gone; deleting media is best-effort.
    }
  }

  urlFor(key: string | null | undefined): string | null {
    if (!key) return null;
    return `${this.config.get('PUBLIC_BASE_URL').replace(/\/$/, '')}${MEDIA_ROUTE_PREFIX}${key}`;
  }

  private pathFor(key: string): string {
    if (!KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
    const path = resolve(this.root, key);
    if (!path.startsWith(this.root + sep)) throw new Error('Invalid storage key');
    return path;
  }
}
