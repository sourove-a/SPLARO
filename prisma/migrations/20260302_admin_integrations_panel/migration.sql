-- Add integrations table for admin integrations panel (additive, non-destructive)

CREATE TABLE IF NOT EXISTS `integrations` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(120) NOT NULL,
  `category` VARCHAR(120) NOT NULL,
  `isConnected` TINYINT(1) NOT NULL DEFAULT 0,
  `mode` ENUM('SANDBOX','LIVE') NOT NULL DEFAULT 'SANDBOX',
  `config` JSON NULL,
  `configMask` JSON NULL,
  `lastTestStatus` VARCHAR(40) NULL,
  `lastTestMessage` TEXT NULL,
  `lastTestAt` DATETIME(3) NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `integrations_provider_key` (`provider`),
  KEY `integrations_category_isConnected_idx` (`category`, `isConnected`),
  KEY `integrations_updatedAt_idx` (`updatedAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
