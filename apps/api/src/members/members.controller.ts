import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { InviteService } from './invite.service';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgRoleGuard } from '../auth/guards/org-role.guard';
import { RequireOrgRole } from '../auth/decorators/require-org-role.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '@orion/types';

@Controller('orgs/:slug/members')
@UseGuards(JwtAuthGuard, OrgRoleGuard)
export class MembersController {
  constructor(
    private membersService: MembersService,
    private inviteService: InviteService,
  ) {}

  @Get()
  getMembers(@Param('slug') slug: string) {
    return this.membersService.getMembers(slug);
  }

  @Get('invitations')
  @RequireOrgRole('admin')
  getInvitations(@Param('slug') slug: string) {
    return this.inviteService.getInvitations(slug);
  }

  @Delete('invitations/:invitationId')
  @RequireOrgRole('admin')
  revokeInvitation(
    @Param('slug') slug: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.inviteService.revokeInvitation(slug, invitationId);
  }

  @Patch(':memberId/role')
  @RequireOrgRole('admin')
  updateRole(
    @Param('slug') slug: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.membersService.updateRole(slug, memberId, dto);
  }

  @Delete(':memberId')
  @RequireOrgRole('admin')
  removeMember(
    @Param('slug') slug: string,
    @Param('memberId') memberId: string,
  ) {
    return this.membersService.removeMember(slug, memberId);
  }

  @Post('invite')
  @RequireOrgRole('admin')
  sendInvite(
    @Param('slug') slug: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.inviteService.sendInvite(slug, dto.email, dto.role, user?.sub);
  }
}
