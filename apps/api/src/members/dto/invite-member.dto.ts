import { IsEmail, IsIn, IsOptional } from 'class-validator';
import type { OrgRole } from '@orion/types';
import { ORG_ROLES } from '@orion/constants';

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn([ORG_ROLES.ADMIN, ORG_ROLES.DEVELOPER])
  role?: OrgRole;
}
