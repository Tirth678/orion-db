import { Module } from '@nestjs/common';
import { JwtModule, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { DbModule } from '../db/db.module';

@Module({
  imports: [
    DbModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): JwtSignOptions => {
        const secret = configService.get<string>('JWT_ACCESS_SECRET') ?? 'default-secret';
        const expiresIn = configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
        return { secret, expiresIn: expiresIn as JwtSignOptions['expiresIn'] };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}