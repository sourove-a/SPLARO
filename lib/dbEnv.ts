export type ResolvedDbEnv = {
  hostCandidates: string[];
  port: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  hasRequired: boolean;
  missing: string[];
};

function readEnv(key: string): string {
  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function unique(values: string[]): string[] {
  const out: string[] = [];
  values.forEach((value) => {
    if (!value || out.includes(value)) return;
    out.push(value);
  });
  return out;
}

export function resolveDbEnv(): ResolvedDbEnv {
  const configuredHost = readEnv('DB_HOST') || '127.0.0.1';
  const hostCandidates = unique([
    configuredHost,
    configuredHost === '127.0.0.1' ? 'localhost' : '127.0.0.1',
  ]);

  const portRaw = readEnv('DB_PORT') || '3306';
  const parsedPort = Number(portRaw);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3306;

  const dbName = readEnv('DB_NAME');
  const dbUser = readEnv('DB_USER');
  const dbPassword = readEnv('DB_PASSWORD') || readEnv('DB_PASS');

  const missing: string[] = [];
  if (!dbName) missing.push('DB_NAME');
  if (!dbUser) missing.push('DB_USER');
  if (!dbPassword) missing.push('DB_PASSWORD');

  return {
    hostCandidates,
    port,
    dbName,
    dbUser,
    dbPassword,
    hasRequired: missing.length === 0,
    missing,
  };
}
