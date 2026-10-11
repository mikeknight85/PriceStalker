import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import {
  systemApiTokenRepository,
  SystemApiToken,
  PublicSystemApiToken
} from '../../../models';
import { logger } from '../../../utils/system/logger';
import {
  SCOPE_FULL,
  TOKEN_SCOPES,
  TOKEN_SCOPE_DESCRIPTIONS,
  TokenScope
} from './scopes';

export * from './scopes';

/**
 * `ps_` plus the first 8 hex characters of the secret.
 *
 * Eleven characters is enough to make the indexed lookup select a single row
 * in practice (8 hex = 4.3e9 values; at a thousand tokens the chance of any
 * collision is about one in ten thousand, and a collision is handled anyway)
 * and short enough that it reveals only 32 bits of a 256-bit secret. The
 * remaining 224 bits are what bcrypt still protects.
 */
export const TOKEN_PREFIX_LENGTH = 11;

const TOKEN_PREFIX_PATTERN = /^ps_[0-9a-f]{8}$/;

/** A token row that is linked to a user, and so can authenticate as one. */
export type LinkedSystemApiToken = SystemApiToken & { admin_id: number };

/**
 * The outcome of presenting a bearer token that is not a JWT.
 *
 * Deliberately not a nullable row: `null` used to mean "no such token",
 * "expired" and "matched but unusable" all at once, and the caller could only
 * answer "invalid token" to all three.
 */
export type SystemTokenVerification =
  | { outcome: 'valid'; token: LinkedSystemApiToken }
  | { outcome: 'expired'; label: string }
  | { outcome: 'unlinked'; label: string }
  | { outcome: 'no-match' };

/**
 * The public prefix of a presented token, or null if it does not carry one.
 *
 * Null means the fast path cannot be used for this value -- either it is a
 * token issued before migration 022, or it is not one of ours at all.
 */
export const extractTokenPrefix = (token: string): string | null => {
  const candidate = token.slice(0, TOKEN_PREFIX_LENGTH);
  return TOKEN_PREFIX_PATTERN.test(candidate) ? candidate : null;
};

export class SystemApiTokenService {
  /**
   * Generates a new secure random token
   */
  private generateSecureToken(): string {
    return `ps_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Hashes a token using bcrypt
   */
  private async hashToken(token: string): Promise<string> {
    return await bcrypt.hash(token, 10);
  }

  /**
   * Creates a new system API token.
   *
   * `scopes` is required by the type so that every call site states what the
   * token may do. Callers that have nothing to say -- the legacy REST shape,
   * which accepts only a label, a description and an expiry -- pass `['*']`
   * explicitly and that choice is logged, rather than full access being the
   * quiet default of an omitted field.
   */
  async createSystemToken(data: {
    label: string;
    description?: string;
    /**
     * The account the token acts as. Required, not optional: a token with no
     * linked user is refused at authentication now that `|| 1` is gone, so
     * issuing one would be issuing a token that cannot be used.
     */
    admin_id: number;
    expires_at?: Date;
    scopes: TokenScope[];
  }): Promise<{ token: string; systemToken: PublicSystemApiToken }> {
    const plaintextToken = this.generateSecureToken();
    const tokenHash = await this.hashToken(plaintextToken);
    const tokenPrefix = extractTokenPrefix(plaintextToken);

    // generateSecureToken always produces a well-formed prefix. The guard is
    // here so that changing the token format fails loudly instead of quietly
    // storing a null prefix and putting every new token back on the scan.
    if (!tokenPrefix) {
      throw new Error('Generated token does not carry a recognisable prefix');
    }

    const systemToken = await systemApiTokenRepository.create({
      label: data.label,
      description: data.description,
      admin_id: data.admin_id,
      expires_at: data.expires_at,
      token_hash: tokenHash,
      scopes: data.scopes,
      token_prefix: tokenPrefix
    });

    if (data.scopes.includes(SCOPE_FULL)) {
      logger.warn(
        `Auth | API Token Created with full access | '${data.label}' (ID: ${systemToken.id}) | ` +
          `scopes: ${data.scopes.join(', ')}`,
        'Admin'
      );
    } else {
      logger.info(
        `Auth | API Token Created | '${data.label}' (ID: ${systemToken.id}) | ` +
          `scopes: ${data.scopes.join(', ')}`,
        'Admin'
      );
    }

    return {
      token: plaintextToken,
      systemToken: this.toPublic(systemToken)
    };
  }

  /**
   * Verifies a presented bearer token.
   *
   * Fast path: the token's public prefix selects its row from an index and
   * bcrypt compares that one candidate. Constant-time comparison of the secret
   * is unchanged -- the prefix narrows the search, it never decides the match.
   *
   * Fallback: rows issued before migration 022 have no prefix (only the bcrypt
   * hash was ever stored, and bcrypt does not run backwards), so they can only
   * be found by comparing against each of them. That scan is restricted to
   * exactly those rows, which is why a bogus token no longer costs one bcrypt
   * per token in the table.
   */
  async verifyToken(token: string): Promise<SystemTokenVerification> {
    const prefix = extractTokenPrefix(token);

    if (prefix) {
      const candidates = await systemApiTokenRepository.findByPrefix(prefix);
      for (const candidate of candidates) {
        if (await bcrypt.compare(token, candidate.token_hash)) {
          return await this.accept(candidate);
        }
      }
    }

    // Reached when the prefix matched nothing, or the value carries no prefix
    // at all. Either way the only rows left that could match are the ones with
    // no stored prefix.
    const legacy = await systemApiTokenRepository.listWithoutPrefix();
    for (const candidate of legacy) {
      if (await bcrypt.compare(token, candidate.token_hash)) {
        return await this.accept(candidate);
      }
    }

    return { outcome: 'no-match' };
  }

  /**
   * Shared tail of both verification paths: expiry, the user link, and the
   * deprecation warning for legacy rows.
   */
  private async accept(candidate: SystemApiToken): Promise<SystemTokenVerification> {
    if (candidate.token_prefix === null) {
      // Fires once per successful verification of a legacy token, and names the
      // label so the operator knows which one to regenerate. Never the token,
      // never the hash -- the label is the whole point of having one.
      //
      // Only on success, deliberately: logging every presented value that
      // happens to lack a prefix would let anyone with the URL fill the log by
      // sending garbage.
      logger.warn(
        `Auth | Deprecated system API token | '${candidate.label}' (ID: ${candidate.id}) was issued ` +
          `before token scopes existed, so it has full access and still requires the legacy ` +
          `verification scan. Regenerate it from Admin > API Tokens.`,
        'Auth'
      );
    }

    if (candidate.expires_at && new Date() > new Date(candidate.expires_at)) {
      logger.warn(
        `Auth | Expired system API token presented | '${candidate.label}' (ID: ${candidate.id})`,
        'Auth'
      );
      return { outcome: 'expired', label: candidate.label };
    }

    if (candidate.admin_id === null) {
      // This used to resolve to `req.userId = sysToken.admin_id || 1`, so a
      // token linked to nobody silently acted as user 1 -- whoever that
      // happens to be on this installation. Rejecting it is the only honest
      // answer: the token names no identity, so there is none to act as.
      logger.warn(
        `Auth | System API token is not linked to a user | '${candidate.label}' (ID: ${candidate.id}) | ` +
          `rejected. Regenerate it from Admin > API Tokens so it is linked to an administrator.`,
        'Auth'
      );
      return { outcome: 'unlinked', label: candidate.label };
    }

    await systemApiTokenRepository.updateLastUsed(candidate.id);
    return { outcome: 'valid', token: { ...candidate, admin_id: candidate.admin_id } };
  }

  /**
   * List all system tokens (sanitized)
   */
  async listTokens(): Promise<PublicSystemApiToken[]> {
    return await systemApiTokenRepository.listAll();
  }

  /**
   * The scope vocabulary, for the Admin UI's creation form.
   *
   * Served rather than duplicated in the frontend so that a scope added here
   * appears there without a second edit, and so the two can never disagree
   * about what a scope means.
   */
  describeScopes(): { scope: TokenScope; description: string; deprecated: boolean }[] {
    return TOKEN_SCOPES.map(scope => ({
      scope,
      description: TOKEN_SCOPE_DESCRIPTIONS[scope],
      deprecated: scope === SCOPE_FULL
    }));
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

  /**
   * Strips the hash from a row before it leaves the service.
   *
   * `create` returns `RETURNING *`, which includes `token_hash`; handing that
   * row to a route would put a bcrypt hash in an API response. Secrets are
   * write-only over this API, and the hash is not an exception.
   */
  private toPublic(row: SystemApiToken): PublicSystemApiToken {
    const { token_hash: _hash, ...rest } = row;
    return rest;
  }
}

export const systemApiTokenService = new SystemApiTokenService();
