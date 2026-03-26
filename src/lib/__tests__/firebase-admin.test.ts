// parseServiceAccountKey unit tests
import { parseServiceAccountKey } from '../firebase-admin';

describe('parseServiceAccountKey', () => {
  const validConfig = {
    project_id: 'test-project',
    private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n',
    client_email: 'test@example.com',
  };
  const validJson = JSON.stringify(validConfig);

  it('parses valid JSON string', () => {
    const result = parseServiceAccountKey(validJson);
    expect(result).toMatchObject({
      projectId: 'test-project',
      project_id: 'test-project',
    });
  });

  it('parses valid base64 encoded JSON string', () => {
    const base64Json = Buffer.from(validJson).toString('base64');
    const result = parseServiceAccountKey(base64Json);
    expect(result).toMatchObject({
      projectId: 'test-project',
    });
  });

  it('parses JSON with quoted string', () => {
    const quotedJson = `"${validJson.replace(/"/g, '\\"')}"`;
    const result = parseServiceAccountKey(quotedJson);
    expect(result).toMatchObject({
      projectId: 'test-project',
    });
  });

  it('returns null for invalid inputs', () => {
    expect(parseServiceAccountKey('not-a-json')).toBeNull();
    expect(parseServiceAccountKey('')).toBeNull();
    expect(parseServiceAccountKey('{}')).toBeNull();
  });

  it('normalizes private key with literal newlines', () => {
    const configWithLiteralNewlines = {
      ...validConfig,
      private_key: '-----BEGIN PRIVATE KEY-----\nline1\nline2\n-----END PRIVATE KEY-----\n'
    };
    const mangledJson = JSON.stringify(configWithLiteralNewlines).replace(/\\n/g, '\n');
    const result = parseServiceAccountKey(mangledJson);
    expect(result).not.toBeNull();
    expect(result?.private_key).toContain('\\n');
  });
});
