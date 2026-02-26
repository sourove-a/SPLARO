-- SPLARO INSTITUTIONAL DATABASE SCHEMA
-- Optimized for Hostinger MySQL/MariaDB Compatibility

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- 1. PRODUCTS REGISTRY
CREATE TABLE IF NOT EXISTS `products` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) DEFAULT NULL,
  `brand` varchar(100) NOT NULL,
  `brand_slug` varchar(120) DEFAULT NULL,
  `price` int(11) NOT NULL,
  `discount_price` int(11) DEFAULT NULL,
  `discount_starts_at` datetime DEFAULT NULL,
  `discount_ends_at` datetime DEFAULT NULL,
  `image` text NOT NULL,
  `main_image_id` varchar(80) DEFAULT NULL,
  `category` varchar(100) NOT NULL,
  `category_slug` varchar(120) DEFAULT NULL,
  `type` varchar(50) NOT NULL,
  `description` longtext DEFAULT NULL,
  `sizes` longtext DEFAULT NULL,
  `colors` longtext DEFAULT NULL,
  `color_variants` longtext DEFAULT NULL,
  `materials` longtext DEFAULT NULL,
  `tags` longtext DEFAULT NULL,
  `featured` tinyint(1) DEFAULT 0,
  `sku` varchar(100) DEFAULT NULL,
  `barcode` varchar(120) DEFAULT NULL,
  `stock` int(11) DEFAULT 50,
  `low_stock_threshold` int(11) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'PUBLISHED',
  `hide_when_out_of_stock` tinyint(1) DEFAULT 0,
  `weight` varchar(50) DEFAULT NULL,
  `dimensions` longtext DEFAULT NULL,
  `variations` longtext DEFAULT NULL,
  `additional_images` longtext DEFAULT NULL,
  `size_chart_image` text DEFAULT NULL,
  `discount_percentage` int(11) DEFAULT NULL,
  `sub_category` varchar(100) DEFAULT NULL,
  `sub_category_slug` varchar(120) DEFAULT NULL,
  `product_url` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_products_slug` (`slug`),
  UNIQUE KEY `uniq_products_sku` (`sku`),
  KEY `idx_products_status_category` (`status`, `category`),
  KEY `idx_products_category_status` (`category`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `product_images` (
  `id` varchar(80) NOT NULL,
  `product_id` varchar(50) NOT NULL,
  `url` text NOT NULL,
  `alt_text` varchar(255) DEFAULT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_main` tinyint(1) DEFAULT 0,
  `width` int(11) DEFAULT NULL,
  `height` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_product_images_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. SHIPMENT MANIFEST (ORDERS)
CREATE TABLE IF NOT EXISTS `orders` (
  `id` varchar(50) NOT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `customer_name` varchar(255) NOT NULL,
  `customer_email` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `district` varchar(100) DEFAULT NULL,
  `thana` varchar(100) DEFAULT NULL,
  `address` text NOT NULL,
  `items` longtext NOT NULL,
  `total` int(11) NOT NULL,
  `status` varchar(50) NOT NULL,
  `tracking_number` varchar(100) DEFAULT NULL,
  `admin_notes` text DEFAULT NULL,
  `customer_comment` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_orders_user_created` (`user_id`, `created_at`),
  KEY `idx_orders_status_created` (`status`, `created_at`),
  KEY `idx_orders_email_created` (`customer_email`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. IDENTITY VAULT (USERS)
CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) DEFAULT 'USER',
  `is_blocked` tinyint(1) DEFAULT 0,
  `email_verified` tinyint(1) DEFAULT 0,
  `phone_verified` tinyint(1) DEFAULT 0,
  `email_verify_code` varchar(10) DEFAULT NULL,
  `email_verify_expiry` datetime DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_phone` (`phone`),
  KEY `idx_users_role_blocked` (`role`,`is_blocked`),
  KEY `idx_users_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3.1 USER ADDRESSES
CREATE TABLE IF NOT EXISTS `user_addresses` (
  `id` varchar(80) NOT NULL,
  `user_id` varchar(50) NOT NULL,
  `label` varchar(60) DEFAULT 'Home',
  `recipient_name` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `thana` varchar(100) DEFAULT NULL,
  `address_line` text DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT 0,
  `is_verified` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_addresses_user_default` (`user_id`,`is_default`,`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3.2 ORDERS LINE ITEMS
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `product_id` varchar(80) DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `product_slug` varchar(255) DEFAULT NULL,
  `brand` varchar(120) DEFAULT NULL,
  `category` varchar(120) DEFAULT NULL,
  `variant_size` varchar(60) DEFAULT NULL,
  `variant_color` varchar(80) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `product_url` text DEFAULT NULL,
  `image_url` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order` (`order_id`),
  KEY `idx_order_items_product` (`product_id`),
  KEY `idx_order_items_order_product_created` (`order_id`,`product_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3.3 ORDER TIMELINE
CREATE TABLE IF NOT EXISTS `order_status_history` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `from_status` varchar(50) DEFAULT NULL,
  `to_status` varchar(50) NOT NULL,
  `note` text DEFAULT NULL,
  `changed_by` varchar(80) DEFAULT NULL,
  `changed_by_role` varchar(40) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_status_history_order_created` (`order_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3.4 PAYMENTS, SHIPMENTS, REFUNDS, CANCELLATIONS
CREATE TABLE IF NOT EXISTS `payments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `payment_method` varchar(80) DEFAULT NULL,
  `provider` varchar(80) DEFAULT NULL,
  `transaction_ref` varchar(120) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` varchar(10) DEFAULT 'BDT',
  `status` varchar(40) NOT NULL DEFAULT 'PENDING',
  `payload_json` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payments_order_status_created` (`order_id`,`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `shipments` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `carrier` varchar(120) DEFAULT NULL,
  `tracking_number` varchar(120) DEFAULT NULL,
  `status` varchar(40) NOT NULL DEFAULT 'PENDING',
  `payload_json` longtext DEFAULT NULL,
  `shipped_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_shipments_order_status_created` (`order_id`,`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `refunds` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `reason` text DEFAULT NULL,
  `status` varchar(40) NOT NULL DEFAULT 'PENDING',
  `created_by` varchar(80) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_refunds_order_status_created` (`order_id`,`status`,`created_at`),
  KEY `idx_refunds_user_created` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `cancellations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `status` varchar(40) NOT NULL DEFAULT 'CONFIRMED',
  `created_by` varchar(80) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cancellations_order_status_created` (`order_id`,`status`,`created_at`),
  KEY `idx_cancellations_user_created` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3.5 ADMIN RBAC + CUSTOMER NOTES
CREATE TABLE IF NOT EXISTS `admin_roles` (
  `id` varchar(50) NOT NULL,
  `name` varchar(80) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_roles_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `admin_permissions` (
  `id` varchar(80) NOT NULL,
  `label` varchar(120) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `admin_role_permissions` (
  `role_id` varchar(50) NOT NULL,
  `permission_id` varchar(80) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`,`permission_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `admin_user_roles` (
  `user_id` varchar(50) NOT NULL,
  `role_id` varchar(50) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `admin_user_notes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(50) NOT NULL,
  `admin_id` varchar(80) DEFAULT NULL,
  `note` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_admin_user_notes_user_created` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `product_variants` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` varchar(50) NOT NULL,
  `variant_sku` varchar(120) NOT NULL,
  `attributes_json` longtext DEFAULT NULL,
  `price_delta` decimal(12,2) NOT NULL DEFAULT 0.00,
  `stock` int(11) NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'ACTIVE',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_product_variants_sku` (`variant_sku`),
  KEY `idx_product_variants_product_status_updated` (`product_id`, `status`, `updated_at`),
  KEY `idx_product_variants_product_created` (`product_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` varchar(50) NOT NULL,
  `variant_id` bigint(20) unsigned DEFAULT NULL,
  `movement_type` varchar(30) NOT NULL DEFAULT 'ADJUSTMENT',
  `delta_qty` int(11) NOT NULL,
  `stock_before` int(11) DEFAULT NULL,
  `stock_after` int(11) DEFAULT NULL,
  `reason` varchar(191) DEFAULT NULL,
  `reference_type` varchar(60) DEFAULT NULL,
  `reference_id` varchar(100) DEFAULT NULL,
  `actor_id` varchar(80) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_stock_movements_product_created` (`product_id`, `created_at`),
  KEY `idx_stock_movements_variant_created` (`variant_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `abandoned_carts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) NOT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `cart_hash` char(64) NOT NULL,
  `items_json` longtext NOT NULL,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `currency` varchar(10) NOT NULL DEFAULT 'BDT',
  `status` varchar(20) NOT NULL DEFAULT 'ABANDONED',
  `last_activity_at` datetime NOT NULL,
  `recovered_order_id` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_abandoned_carts_hash` (`cart_hash`),
  KEY `idx_abandoned_carts_status_activity` (`status`, `last_activity_at`),
  KEY `idx_abandoned_carts_user_activity` (`user_id`, `last_activity_at`),
  KEY `idx_abandoned_carts_session_activity` (`session_id`, `last_activity_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `admin_api_keys` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `key_name` varchar(120) NOT NULL,
  `key_prefix` varchar(32) NOT NULL,
  `key_hash` char(64) NOT NULL,
  `scopes_json` longtext DEFAULT NULL,
  `created_by` varchar(80) DEFAULT NULL,
  `last_used_at` datetime DEFAULT NULL,
  `last_used_ip` varchar(45) DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_api_keys_hash` (`key_hash`),
  KEY `idx_admin_api_keys_revoked_expires` (`revoked_at`, `expires_at`),
  KEY `idx_admin_api_keys_last_used` (`last_used_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `admin_ip_allowlist` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `cidr` varchar(120) NOT NULL,
  `label` varchar(120) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` varchar(80) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admin_ip_allowlist_cidr` (`cidr`),
  KEY `idx_admin_ip_allowlist_active_updated` (`is_active`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `user_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(50) NOT NULL,
  `event_type` varchar(80) NOT NULL,
  `event_payload` longtext DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_events_user_created` (`user_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. INSTITUTIONAL PROTOCOLS (SITE_SETTINGS)
CREATE TABLE IF NOT EXISTS `site_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `site_name` varchar(255) DEFAULT 'SPLARO',
  `maintenance_mode` tinyint(1) DEFAULT 0,
  `support_email` varchar(255) DEFAULT 'support@splaro.co',
  `support_phone` varchar(50) DEFAULT NULL,
  `whatsapp_number` varchar(50) DEFAULT NULL,
  `facebook_link` varchar(255) DEFAULT NULL,
  `instagram_link` varchar(255) DEFAULT NULL,
  `logo_url` text DEFAULT NULL,
  `google_client_id` varchar(255) DEFAULT NULL,
  `smtp_settings` text DEFAULT NULL,
  `logistics_config` text DEFAULT NULL,
  `hero_slides` longtext DEFAULT NULL,
  `content_pages` longtext DEFAULT NULL,
  `story_posts` longtext DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. EVENT STREAM (SYSTEM LOGS)
CREATE TABLE IF NOT EXISTS `system_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_type` varchar(100) NOT NULL,
  `event_description` text NOT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `actor_id` varchar(50) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(100) NOT NULL,
  `entity_id` varchar(100) DEFAULT NULL,
  `before_json` longtext DEFAULT NULL,
  `after_json` longtext DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_actor_created` (`actor_id`, `created_at`),
  KEY `idx_audit_logs_action_entity_created` (`action`, `entity_type`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. COLLECTOR TRAFFIC HEARTBEAT
CREATE TABLE IF NOT EXISTS `traffic_metrics` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `session_id` varchar(100) NOT NULL,
  `user_id` varchar(50) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `path` varchar(255) DEFAULT '/',
  `user_agent` text DEFAULT NULL,
  `last_active` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. WEB PUSH SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS `push_subscriptions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(50) DEFAULT NULL,
  `endpoint` text NOT NULL,
  `endpoint_hash` char(64) NOT NULL,
  `p256dh` text NOT NULL,
  `auth` varchar(255) NOT NULL,
  `user_agent` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `failure_count` int(11) NOT NULL DEFAULT 0,
  `last_http_code` int(11) DEFAULT NULL,
  `last_error` text DEFAULT NULL,
  `last_failure_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_push_subscriptions_endpoint_hash` (`endpoint_hash`),
  KEY `idx_push_subscriptions_user_active` (`user_id`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. IN-APP NOTIFICATIONS
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` varchar(50) NOT NULL,
  `title` varchar(191) NOT NULL,
  `message` text NOT NULL,
  `url` text DEFAULT NULL,
  `type` varchar(30) NOT NULL DEFAULT 'system',
  `campaign_id` bigint(20) unsigned DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `read_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user_created` (`user_id`, `created_at`),
  KEY `idx_notifications_user_read_created` (`user_id`, `is_read`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. CAMPAIGNS
CREATE TABLE IF NOT EXISTS `campaigns` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(191) NOT NULL,
  `message` text NOT NULL,
  `image_url` text DEFAULT NULL,
  `target_type` varchar(60) NOT NULL,
  `filters_json` longtext DEFAULT NULL,
  `scheduled_at` datetime DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'draft',
  `created_by` varchar(80) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_campaigns_status_scheduled` (`status`, `scheduled_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. CAMPAIGN DELIVERY LOGS
CREATE TABLE IF NOT EXISTS `campaign_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `campaign_id` bigint(20) unsigned NOT NULL,
  `subscription_id` bigint(20) unsigned DEFAULT NULL,
  `status` varchar(20) NOT NULL,
  `error_message` text DEFAULT NULL,
  `sent_at` datetime DEFAULT NULL,
  `clicked_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_campaign_logs_campaign_status_sent` (`campaign_id`, `status`, `sent_at`),
  KEY `idx_campaign_logs_subscription_created` (`subscription_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. HEALTH PROBE EVENTS
CREATE TABLE IF NOT EXISTS `health_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `probe` varchar(40) NOT NULL,
  `status` varchar(20) NOT NULL,
  `latency_ms` int(11) DEFAULT NULL,
  `error` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_health_events_probe_created` (`probe`, `created_at`),
  KEY `idx_health_events_status_created` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. SYSTEM ERROR FEED
CREATE TABLE IF NOT EXISTS `system_errors` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `service` varchar(80) NOT NULL,
  `level` varchar(20) NOT NULL DEFAULT 'ERROR',
  `message` text NOT NULL,
  `context_json` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_system_errors_service_created` (`service`, `created_at`),
  KEY `idx_system_errors_level_created` (`level`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- INITIALIZE SETTINGS & ADMIN
INSERT IGNORE INTO `site_settings` (`id`, `site_name`, `support_email`) VALUES (1, 'Splaro', 'info@splaro.co');
