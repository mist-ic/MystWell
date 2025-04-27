import { Injectable, CanActivate, ExecutionContext, Inject, UnauthorizedException, Logger } from '@nestjs/common';
import { SupabaseClient, User } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.constants';
import { Request } from 'express';

// Augment Express Request type to include user and profileId
declare global {
  namespace Express {
    interface Request {
      user?: User; // Supabase User object
    }
  }
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    // this.logger.log('AuthGuard activated...');
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      this.logger.warn('No token found in Authorization header.');
      throw new UnauthorizedException('Authorization token not found.');
    }
    // this.logger.log('Token extracted.');

    try {
      // this.logger.log('Verifying token with Supabase...');
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error) {
        this.logger.error('Supabase token verification error:', error.message);
        throw new UnauthorizedException(`Token verification failed: ${error.message}`);
      }

      if (!user) {
        this.logger.warn('Supabase returned null user for a valid token structure. Token might be invalid or expired.');
        throw new UnauthorizedException('Invalid or expired token.');
      }
      
      // this.logger.log(`Supabase user ${user.id} authenticated. Attaching user to request.`);
      // Attach the user object to the request for use in subsequent handlers/services
      (request as any).user = user; 
      // this.logger.log('AuthGuard finished successfully (user authenticated).');
    } catch (e) {
      this.logger.error('Exception during token verification:', e);
      throw new UnauthorizedException('Authentication failed.');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
} 