import { IsEmail, IsString } from 'class-validator';
import type { LoginInput } from '@orion-db/types';

export class LoginDto implements LoginInput {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
