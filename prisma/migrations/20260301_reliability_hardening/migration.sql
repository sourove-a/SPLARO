-- Reliability + integration foundation (additive, non-destructive)

CREATE TABLE IF NOT EXISTS `session_tokens` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `refreshToken` VARCHAR(255) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `rotatedAt` DATETIME(3) NULL,
  `revokedAt` DATETIME(3) NULL,
  `userAgent` VARCHAR(191) NULL,
  `ipAddress` VARCHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_tokens_refreshToken_key` (`refreshToken`),
  KEY `session_tokens_userId_createdAt_idx` (`userId`, `createdAt`),
  KEY `session_tokens_expiresAt_idx` (`expiresAt`),
  KEY `session_tokens_revokedAt_createdAt_idx` (`revokedAt`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `integration_settings` (
  `id` VARCHAR(191) NOT NULL,
  `service` VARCHAR(120) NOT NULL,
  `key` VARCHAR(120) NOT NULL,
  `value` LONGTEXT NULL,
  `valueMask` VARCHAR(255) NULL,
  `isSecret` TINYINT(1) NOT NULL DEFAULT 0,
  `enabled` TINYINT(1) NOT NULL DEFAULT 0,
  `updatedBy` VARCHAR(191) NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `integration_settings_service_key_key` (`service`, `key`),
  KEY `integration_settings_service_enabled_idx` (`service`, `enabled`),
  KEY `integration_settings_updatedAt_idx` (`updatedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_events` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(80) NOT NULL,
  `status` ENUM('INITIATED','PENDING','PAID','FAILED','CANCELED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  `eventType` VARCHAR(80) NOT NULL,
  `eventKey` VARCHAR(191) NOT NULL,
  `transactionId` VARCHAR(191) NULL,
  `idempotencyKey` VARCHAR(191) NULL,
  `amount` DECIMAL(12,2) NULL,
  `currency` VARCHAR(20) NULL,
  `requestPayload` JSON NULL,
  `responsePayload` JSON NULL,
  `validationRef` VARCHAR(191) NULL,
  `httpCode` INT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `payment_events_eventKey_key` (`eventKey`),
  UNIQUE KEY `payment_events_transactionId_key` (`transactionId`),
  UNIQUE KEY `payment_events_idempotencyKey_key` (`idempotencyKey`),
  KEY `payment_events_orderId_createdAt_idx` (`orderId`, `createdAt`),
  KEY `payment_events_provider_status_createdAt_idx` (`provider`, `status`, `createdAt`),
  KEY `payment_events_status_createdAt_idx` (`status`, `createdAt`),
  CONSTRAINT `payment_events_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `shipments` (
  `id` VARCHAR(191) NOT NULL,
  `orderId` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(80) NOT NULL,
  `status` ENUM('PENDING','BOOKED','IN_TRANSIT','DELIVERED','FAILED','RETURNED') NOT NULL DEFAULT 'PENDING',
  `consignmentId` VARCHAR(191) NULL,
  `trackingUrl` VARCHAR(512) NULL,
  `externalStatus` VARCHAR(120) NULL,
  `timeline` JSON NULL,
  `bookingPayload` JSON NULL,
  `idempotencyKey` VARCHAR(191) NULL,
  `lastSyncedAt` DATETIME(3) NULL,
  `lastError` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `shipments_orderId_key` (`orderId`),
  UNIQUE KEY `shipments_consignmentId_key` (`consignmentId`),
  UNIQUE KEY `shipments_idempotencyKey_key` (`idempotencyKey`),
  KEY `shipments_provider_status_createdAt_idx` (`provider`, `status`, `createdAt`),
  KEY `shipments_externalStatus_updatedAt_idx` (`externalStatus`, `updatedAt`),
  CONSTRAINT `shipments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `integration_logs` (
  `id` VARCHAR(191) NOT NULL,
  `service` VARCHAR(120) NOT NULL,
  `eventType` VARCHAR(120) NOT NULL,
  `status` VARCHAR(40) NOT NULL,
  `referenceType` VARCHAR(80) NULL,
  `referenceId` VARCHAR(191) NULL,
  `httpCode` INT NULL,
  `errorMessage` TEXT NULL,
  `responsePreview` TEXT NULL,
  `metaJson` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `integration_logs_service_createdAt_idx` (`service`, `createdAt`),
  KEY `integration_logs_status_createdAt_idx` (`status`, `createdAt`),
  KEY `integration_logs_referenceType_referenceId_idx` (`referenceType`, `referenceId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(191) NOT NULL,
  `actorId` VARCHAR(191) NULL,
  `action` VARCHAR(120) NOT NULL,
  `entityType` VARCHAR(120) NOT NULL,
  `entityId` VARCHAR(191) NOT NULL,
  `beforeJson` JSON NULL,
  `afterJson` JSON NULL,
  `ipAddress` VARCHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `audit_logs_actorId_createdAt_idx` (`actorId`, `createdAt`),
  KEY `audit_logs_entityType_createdAt_idx` (`entityType`, `createdAt`),
  KEY `audit_logs_action_createdAt_idx` (`action`, `createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Hot-path order indexes/columns should be managed in a dedicated schema migration
-- if existing production table naming differs (Order vs orders).
