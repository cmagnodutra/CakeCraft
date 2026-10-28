import { IsEmail, IsString } from 'class-validator';

import {
  BCRYPT_MAX_PASSWORD_BYTES,
  MaxByteLength,
} from '../../common/validators/max-byte-length.validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MaxByteLength(BCRYPT_MAX_PASSWORD_BYTES)
  password!: string;
}
