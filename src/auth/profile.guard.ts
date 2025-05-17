import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ProfileGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check if the user object exists and has a profileId
    if (!user || !user.profileId) {
      throw new UnauthorizedException('User does not have an associated profile');
    }

    // Add profileId to request for easy access in controllers
    request.user.profileId = user.profileId;
    return true;
  }
} 