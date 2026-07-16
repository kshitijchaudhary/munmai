const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

if (!configuredApiUrl) {
  throw new Error(
    'Missing EXPO_PUBLIC_API_URL. Copy mobile/.env.example to a local environment file and set the Munmai API URL.',
  );
}

const normalizedApiUrl = configuredApiUrl.replace(/\/+$/, '');

try {
  const parsedApiUrl = new URL(normalizedApiUrl);

  if (parsedApiUrl.protocol !== 'http:' && parsedApiUrl.protocol !== 'https:') {
    throw new Error('The API URL must use http or https.');
  }
} catch {
  throw new Error(
    'EXPO_PUBLIC_API_URL must be a complete http(s) URL, for example http://localhost:5000/api.',
  );
}

export const apiBaseUrl = normalizedApiUrl;
