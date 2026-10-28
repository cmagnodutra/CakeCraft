import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

import {
  BCRYPT_MAX_PASSWORD_BYTES,
  MaxByteLength,
} from '../../common/validators/max-byte-length.validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxByteLength(BCRYPT_MAX_PASSWORD_BYTES)
  password!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
