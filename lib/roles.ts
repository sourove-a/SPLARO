export const ADMIN_ROLES = ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'STAFF', 'EDITOR', 'VIEWER'] as const;
export const CMS_WRITE_ROLES = ['OWNER', 'ADMIN', 'SUPER_ADMIN', 'STAFF', 'EDITOR'] as const;
export const PROTOCOL_WRITE_ROLES = ['OWNER', 'ADMIN', 'SUPER_ADMIN'] as const;

export const normalizeRole = (role: unknown): string => String(role || '').toUpperCase();

export const isAdminRole = (role: unknown): boolean => {
  const normalized = normalizeRole(role);
  return ADMIN_ROLES.includes(normalized as typeof ADMIN_ROLES[number]);
};

export const canWriteCms = (role: unknown): boolean => {
  const normalized = normalizeRole(role);
  return CMS_WRITE_ROLES.includes(normalized as typeof CMS_WRITE_ROLES[number]);
};

export const canWriteProtocols = (role: unknown): boolean => {
  const normalized = normalizeRole(role);
  return PROTOCOL_WRITE_ROLES.includes(normalized as typeof PROTOCOL_WRITE_ROLES[number]);
};
