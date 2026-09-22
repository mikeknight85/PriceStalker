import { GoogleAuth } from 'google-auth-library';

/**
 * Resolves the Google Cloud Vertex AI endpoint URL.
 * 'global' location uses 'aiplatform.googleapis.com' whereas regional locations
 * use '${location}-aiplatform.googleapis.com'.
 */
export function getVertexEndpoint(projectId: string, location: string, model: string): string {
  const loc = location || 'us-central1';
  const hostname = loc === 'global'
    ? 'aiplatform.googleapis.com'
    : `${loc}-aiplatform.googleapis.com`;

  return `https://${hostname}/v1/projects/${projectId}/locations/${loc}/publishers/google/models/${model}:generateContent`;
}

/**
 * Obtains an OAuth 2.0 access token for Google Cloud Vertex AI API calls.
 * Accepts:
 * - Direct OAuth bearer tokens (e.g. 'ya29....')
 * - Service Account JSON string
 * - Empty/omitted credentials (falls back to Application Default Credentials / ADC)
 */
export async function getVertexAuthToken(credentialsString?: string | null): Promise<string> {
  const trimmed = credentialsString ? credentialsString.trim() : '';

  if (trimmed.startsWith('ya29.')) {
    return trimmed;
  }

  let auth: GoogleAuth;
  if (trimmed.startsWith('{')) {
    try {
      const credentials = JSON.parse(trimmed);
      auth = new GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
    } catch (e: any) {
      throw new Error(`Invalid Google Service Account JSON credentials: ${e.message}`);
    }
  } else {
    // Application Default Credentials (ADC) or environment-level credentials
    auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token || !token.token) {
    throw new Error('Failed to obtain Google Cloud OAuth access token. Ensure valid Service Account JSON or ADC is configured.');
  }
  return token.token;
}
