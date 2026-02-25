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
  PRIMARY KEY (`id`)
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
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. IDENTITY VAULT (USERS)
CREATE TABLE IF NOT EXISTS `users` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `role` varchar(20) DEFAULT 'USER',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
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

-- INITIALIZE SETTINGS & ADMIN
INSERT IGNORE INTO `site_settings` (`id`, `site_name`, `support_email`) VALUES (1, 'Splaro', 'info@splaro.co');
