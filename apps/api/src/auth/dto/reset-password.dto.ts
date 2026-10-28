import { IsString, MinLength } from 'class-validator';

import {
  BCRYPT_MAX_PASSWORD_BYTES,
  MaxByteLength,
} from '../../common/validators/max-byte-length.validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(10)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxByteLength(BCRYPT_MAX_PASSWORD_BYTES)
  newPassword!: string;
}
