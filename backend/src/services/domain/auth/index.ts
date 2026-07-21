import bcrypt from 'bcryptjs';
import { userRepository, User, OidcClaims } from '../../../models';
import { systemService } from '../system';
import { generateToken } from '../../../middleware/auth';
import { logger } from '../../../utils/system/logger';

export class AuthService {
  /**
   * Check if user registration is enabled globally
   */
  async isRegistrationEnabled(): Promise<boolean> {
    const enabled = await systemService.getSetting('registration_enabled');
    return enabled !== 'false';
  }

  /**
   * Register a new user
   * Handles validation, password hashing, and first-admin promotion
   */
  async registerUser(email: string, password: string): Promise<{ token: string; user: any }> {
    // 1. Check if registration is enabled
    const registrationEnabled = await this.isRegistrationEnabled();
    if (!registrationEnabled) {
      throw new Error('Registration is currently disabled');
    }

    // 2. Basic validation
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    // 3. Check for existing user
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      const err = new Error('Email already registered');
      (err as any).statusCode = 409;
      throw err;
    }

    // 4. Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 5. Create user
    const user = await userRepository.create(email, passwordHash);

    // 6. Make first user an admin
    const allUsers = await userRepository.findAll();
    if (allUsers.length === 1) {
      await userRepository.setAdmin(user.id, true);
      user.is_admin = true;
      logger.info(`Auth | First User Promoted to Admin | ID: ${user.id} | Email: ${user.email}`, 'Auth');
    }

    // 7. Generate token
    const token = generateToken(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || null,
        is_admin: user.is_admin,
        categories: user.categories || [],
      },
    };
  }

  /**
   * Authenticate a user and return a session token
   */
  async loginUser(email: string, password: string): Promise<{ token: string; user: any }> {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      const err = new Error('Invalid email or password');
      (err as any).statusCode = 401;
      throw err;
    }

    // SSO-provisioned accounts have no password. Without this guard the value
    // reaches bcrypt.compare as null, and the account would be unreachable via
    // a confusing error rather than being told to use SSO.
    if (!user.password_hash) {
      const err = new Error('This account signs in with SSO. Use the SSO button to log in.');
      (err as any).statusCode = 401;
      throw err;
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      const err = new Error('Invalid email or password');
      (err as any).statusCode = 401;
      throw err;
    }

    if (user.disabled) {
      const err = new Error('Your account has been locked or disabled. Please contact the site administrator.');
      (err as any).statusCode = 403;
      throw err;
    }

    const token = generateToken(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name || null,
        is_admin: user.is_admin,
        categories: user.categories || [],
      },
    };
  }

  /**
   * Resolve an OIDC identity to a local user.
   *
   * Resolution order, per docs/SSO_DESIGN.md:
   *   1. Match on (oidc_issuer, oidc_subject) -- a returning SSO user.
   *   2. Match on email -- an existing local account, linked to this identity.
   *   3. JIT-create, if the admin has enabled it.
   *
   * Returns null when no account matches and JIT is disabled, which the caller
   * surfaces as "ask an admin for an account" rather than a generic failure.
   *
   * The first user in the database becomes admin whichever path created them,
   * matching the rule already applied to local registration.
   */
  async resolveOidcUser(claims: OidcClaims, jitEnabled: boolean): Promise<User | null> {
    // 1. Stable external identity.
    const bySubject = await userRepository.findByOidcSubject(claims.issuer, claims.subject);
    if (bySubject) {
      if (bySubject.disabled) {
        const err = new Error(
          'Your account has been locked or disabled. Please contact the site administrator.'
        );
        (err as any).statusCode = 403;
        throw err;
      }
      return bySubject;
    }

    // 2. Existing local account with the same email -- link it.
    const byEmail = await userRepository.findByEmail(claims.email);
    if (byEmail) {
      if (byEmail.disabled) {
        const err = new Error(
          'Your account has been locked or disabled. Please contact the site administrator.'
        );
        (err as any).statusCode = 403;
        throw err;
      }
      await userRepository.linkOidcIdentity(byEmail.id, claims.issuer, claims.subject);
      logger.info(
        `Auth | Linked existing account to OIDC identity | ID: ${byEmail.id} | Email: ${byEmail.email}`,
        'Auth'
      );
      return byEmail;
    }

    // 3. Just-in-time provisioning.
    if (!jitEnabled) return null;

    const existingCount = await userRepository.count();
    const newUser = await userRepository.createOidc({
      email: claims.email,
      name: claims.name,
      issuer: claims.issuer,
      subject: claims.subject,
    });
    logger.info(
      `Auth | JIT-provisioned OIDC user | ID: ${newUser.id} | Email: ${newUser.email}`,
      'Auth'
    );

    // This user made the count 1, so they are the first: promote to admin.
    if (existingCount === 0) {
      await userRepository.setAdmin(newUser.id, true);
      newUser.is_admin = true;
      logger.info(`Auth | First User Promoted to Admin | ID: ${newUser.id}`, 'Auth');
    }

    return newUser;
  }
}

export const authService = new AuthService();
