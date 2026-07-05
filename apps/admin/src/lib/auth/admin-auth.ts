import { getServerApiBaseUrl } from '@splaro/config'
import { verifyPassword, hashPassword } from './crypto'
import { CEO_EMAIL, formatAdminDisplayName } from './role-label'

export const DEFAULT_ADMIN_EMAIL = CEO_EMAIL

const DEV_FALLBACK_PASSWORD = 'Splaro@2026!'

export interface AdminUserRecord {
  id: string
  email: string
  name: string
  role: string
  passwordHash: string
  storeId?: string
}

function resolveAdminPassword(): string {
  const fromEnv = process.env['ADMIN_PASSWORD']?.trim()
  if (fromEnv) return fromEnv
  if (process.env.NODE_ENV === 'production') return ''
  return DEV_FALLBACK_PASSWORD
}

function envAdmin() {
  const email = process.env['ADMIN_EMAIL'] ?? DEFAULT_ADMIN_EMAIL
  const password = resolveAdminPassword()
  const passwordHash = process.env['ADMIN_PASSWORD_HASH']
  const storeId = process.env['NEXT_PUBLIC_STORE_ID']

  return {
    id: 'admin_env_user',
    email: email.toLowerCase(),
    name: formatAdminDisplayName('SPLARO Admin', email.toLowerCase()),
    role: 'SUPER_ADMIN',
    plainPassword: password,
    ...(passwordHash ? { passwordHash } : {}),
    ...(storeId ? { storeId } : {}),
  }
}

async function authenticateAdminFromDatabase(
  email: string,
  password: string,
): Promise<AdminUserRecord | null> {
  const base = getServerApiBaseUrl()
  const storeId = process.env['NEXT_PUBLIC_STORE_ID'] ?? 'splaro'

  try {
    const res = await fetch(`${base}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, storeId }),
      cache: 'no-store',
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      user?: { id: string; email: string; name: string; role: string; storeId?: string }
    }
    const user = data.user
    if (!user?.id) return null

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      passwordHash: hashPassword(password),
      ...(user.storeId ? { storeId: user.storeId } : {}),
    }
  } catch {
    return null
  }
}

async function authenticateEnvAdmin(
  email: string,
  password: string,
): Promise<AdminUserRecord | null> {
  const normalized = email.trim().toLowerCase()
  const envUser = envAdmin()
  if (!envUser.plainPassword && !('passwordHash' in envUser && envUser.passwordHash)) {
    return null
  }
  if (envUser.email !== normalized) return null

  const passwordOk =
    'passwordHash' in envUser && envUser.passwordHash
      ? verifyPassword(password, envUser.passwordHash)
      : password === envUser.plainPassword

  if (!passwordOk) return null

  const record: AdminUserRecord = {
    id: envUser.id,
    email: envUser.email,
    name: envUser.name,
    role: envUser.role,
    passwordHash:
      'passwordHash' in envUser && envUser.passwordHash
        ? envUser.passwordHash
        : hashPassword(envUser.plainPassword),
  }

  if (envUser.storeId) record.storeId = envUser.storeId
  return record
}

export async function authenticateAdmin(
  email: string,
  password: string,
): Promise<AdminUserRecord | null> {
  const dbUser = await authenticateAdminFromDatabase(email, password)
  if (dbUser) return dbUser
  if (process.env.NODE_ENV === 'production') return null
  return authenticateEnvAdmin(email, password)
}
