import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { systemApiTokenRepository, SystemApiToken } from '../../../models';
import { logger } from '../../../utils/system/logger';

export class SystemApiTokenService {
  /**
   * Generates a new secure random token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hashes a token using bcrypt
   */
  private async hashToken(token: string): Promise<string> {
    return await bcrypt.hash(token, 10);
  }

  /**
   * Creates a new system API token
   */
  async createSystemToken(data: {
    label: string;
    description?: string;
    admin_id?: number;
    expires_at?: Date;
  }): Promise<{ token: string; systemToken: SystemApiToken }> {
    const plaintextToken = this.generateSecureToken();
    const tokenHash = await this.hashToken(plaintextToken);

    const systemToken = await systemApiTokenRepository.create({
      label: data.label,
      description: data.description,
      admin_id: data.admin_id,
      expires_at: data.expires_at,
      token_hash: tokenHash
    });

    logger.info(`Auth | API Token Created | '${data.label}' (ID: ${systemToken.id})`, 'Admin');

    return {
      token: plaintextToken,
      systemToken
    };
  }

  /**
   * Verifies a token against the database
   */
  async verifyToken(token: string): Promise<SystemApiToken | null> {
    // In a real high-traffic app, we might want to cache hashes or use a faster lookup.
    // But for this use case, we'll list tokens and compare.
    // Actually, bcrypt.compare is slow. 
    // Optimization: Store a prefix or a non-sensitive identifier if we have many tokens.
    // For now, let's just fetch all tokens and compare (likely few tokens).
    // OR we could use a faster hash (SHA256) for the lookup if security allows, 
    // but bcrypt is better for secrets.
    
    const tokens = await systemApiTokenRepository.listAll() as any[];
    // We need the hashes which are not in listAll. Let's add a findByTokenHash-like logic or just fetch all with hashes.
    
    // Better: Fetch all tokens including hashes
    const allTokens = await this.getAllWithHashes();
    
    for (const sysToken of allTokens) {
      if (await bcrypt.compare(token, sysToken.token_hash)) {
        // Check expiration
        if (sysToken.expires_at && new Date() > new Date(sysToken.expires_at)) {
          return null;
        }
        
        // Update last used
        await systemApiTokenRepository.updateLastUsed(sysToken.id);
        return sysToken;
      }
    }
    
    return null;
  }

  /**
   * Internal helper to get all tokens with hashes
   */
  private async getAllWithHashes(): Promise<SystemApiToken[]> {
    const pool = (await import('../../../config/database')).default;
    const result = await pool.query('SELECT * FROM system_api_tokens');
    return result.rows;
  }

  /**
   * List all system tokens (sanitized)
   */
  async listTokens() {
    return await systemApiTokenRepository.listAll();
  }

  /**
   * Delete a system token
   */
  async deleteToken(id: number) {
    const token = await systemApiTokenRepository.findById(id);
    const deleted = await systemApiTokenRepository.deleteById(id);
    if (deleted && token) {
      logger.info(`Auth | API Token Deleted | '${token.label}' (ID: ${id})`, 'Admin');
    }
    return deleted;
  }
}

export const systemApiTokenService = new SystemApiTokenService();
