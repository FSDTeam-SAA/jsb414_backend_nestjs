import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRateLimitGuard } from '../../middlewares/auth-rate-limit.guard';

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRateLimitGuard],
  exports: [AuthRateLimitGuard],
})
export class AuthModule {}
