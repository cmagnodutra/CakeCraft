import { Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class AsaasWebhookPaymentPayloadDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsOptional()
  @IsString()
  externalReference?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class AsaasWebhookDto {
  @IsString()
  @IsNotEmpty()
  event!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => AsaasWebhookPaymentPayloadDto)
  payment!: AsaasWebhookPaymentPayloadDto;
}
