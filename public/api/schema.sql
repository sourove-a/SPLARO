-- SPLARO INSTITUTIONAL DATABASE SCHEMA
-- Optimized for Hostinger MySQL/MariaDB Compatibility

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- 1. PRODUCTS REGISTRY
CREATE TABLE IF NOT EXISTS `products` (
  `id` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `brand` varchar(100) NOT NULL,
  `price` int(11) NOT NULL,
  `image` text NOT NULL,
  `category` varchar(100) NOT NULL,
  `type` varchar(50) NOT NULL,
  `description` longtext DEFAULT NULL,
  `sizes` longtext DEFAULT NULL,
  `colors` longtext DEFAULT NULL,
  `materials` longtext DEFAULT NULL,
  `tags` longtext DEFAULT NULL,
  `featured` tinyint(1) DEFAULT 0,
  `sku` varchar(100) DEFAULT NULL,
  `stock` int(11) DEFAULT 50,
  `weight` varchar(50) DEFAULT NULL,
  `dimensions` longtext DEFAULT NULL,
  `variations` longtext DEFAULT NULL,
  `additional_images` longtext DEFAULT NULL,
  `size_chart_image` text DEFAULT NULL,
  `discount_percentage` int(11) DEFAULT NULL,
  `sub_category` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
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

-- INITIALIZE SETTINGS & ADMIN
INSERT IGNORE INTO `site_settings` (`id`, `site_name`, `support_email`) VALUES (1, 'Splaro', 'info@splaro.co');
