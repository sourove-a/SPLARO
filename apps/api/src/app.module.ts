import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { resolve } from 'path'
import { BullModule } from '@nestjs/bullmq'
import { noopQueueProviders, redisQueuesEnabled } from './common/noop-queue.providers'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule } from '@nestjs/throttler'
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { AppThrottlerGuard } from './common/app-throttler.guard'
import { RedisThrottlerStorage } from './common/redis-throttler.storage'
import { RedisModule } from './common/redis.module'
import { AdminAuthGuard } from './common/auth/admin-auth.guard'
import { FeatureFlagGuard } from './common/auth/feature-flag.guard'
import { AdminSessionResolver } from './common/auth/admin-session.resolver'
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter'
import { LoggingInterceptor } from './common/interceptors/logging.interceptor'
import { validateEnv } from './common/config/env.validation'
import { PrismaService } from './common/prisma.service'
import { FinanceAuditService } from './common/finance-audit.service'
import { bullmqConnectionOptions } from './common/bullmq-connection-options'
import { PresenceService } from './common/presence.service'
import { CacheService } from './common/cache.service'
import { RequestIdMiddleware } from './common/request-id.middleware'
import { R2StorageService } from './common/r2-storage.service'

// Feature modules
import { TelegramService } from './modules/telegram/telegram.service'
import { AutomationService } from './modules/automation/automation.service'
import { AutomationCron } from './modules/automation/automation.cron'
import { CourierService } from './modules/courier/courier.service'
import { CourierProcessor } from './modules/courier/courier.processor'
import { MarketingProcessor } from './modules/marketing/marketing.processor'
import { OrderSideEffectsProcessor } from './modules/orders/order-side-effects.processor'
import { SteadfastService } from './modules/courier/providers/steadfast.service'
import { RedxService } from './modules/courier/providers/redx.service'
import { PathaoService } from './modules/courier/providers/pathao.service'
import { PaperflyService } from './modules/courier/providers/paperfly.service'
import { SundarbanService } from './modules/courier/providers/sundarban.service'
import { SaParibahonService } from './modules/courier/providers/sa-paribahan.service'
import { SeoService } from './modules/seo/seo.service'
import { SearchService } from './modules/search/search.service'
import { LoyaltyService } from './modules/loyalty/loyalty.service'
import { LoyaltyController } from './modules/loyalty/loyalty.controller'
import { MarketingService } from './modules/marketing/marketing.service'
import { MetaCapiService } from './modules/marketing/meta-capi.service'
import { BkashService } from './modules/payments/bkash.service'
import { NagadService } from './modules/payments/nagad.service'
import { SslCommerzService } from './modules/payments/sslcommerz.service'
import { PaymentConfirmationService } from './modules/payments/payment-confirmation.service'
import { StockReservationService } from './modules/payments/stock-reservation.service'
import { NotificationsService } from './modules/notifications/notifications.service'
import { StockAlertsCron } from './modules/notifications/stock-alerts.cron'
import { AdminTelegramHubService } from './modules/notifications/admin-telegram-hub.service'
import { ServerErrorAlertService } from './modules/notifications/server-error-alert.service'
import { StockAlertService } from './modules/notifications/stock-alert.service'
import { BackInStockCron } from './modules/notifications/back-in-stock.cron'
import { OrderNotificationsService } from './modules/notifications/order-notifications.service'
import { OrderEventsService } from './modules/orders/order-events.service'
import { OrderStatusService } from './modules/orders/order-status.service'
import { OrderEditService } from './modules/orders/order-edit.service'
import { OrderSideEffectsQueueService } from './modules/orders/order-side-effects-queue.service'
import { CommerceEventOutboxService } from './modules/orders/commerce-event-outbox.service'
import { SmsService } from './modules/notifications/sms.service'
import { EmailService } from './modules/email/email.service'
import { InvoiceService } from './modules/invoices/invoice.service'

// Finance
import { PartnersService, PartnerTransactionsService } from './modules/finance/partners.service'
import { ExpensesService } from './modules/finance/expenses.service'
import { ProfitLossService } from './modules/finance/profit-loss.service'
import { FinanceOverviewService } from './modules/finance/finance-overview.service'
import {
  DailyClosingService,
  GoogleSheetsFinanceService,
  FinanceReportsService,
} from './modules/finance/finance-support.service'
import { AIProductAgentService } from './modules/finance/ai-product-agent.service'

// Controllers
import { AppController } from './app.controller'
import { DashboardController } from './modules/dashboard/dashboard.controller'
import { DashboardService } from './modules/dashboard/dashboard.service'
import { CommerceFinanceController } from './modules/commerce-finance/commerce-finance.controller'
import { CommerceFinanceService } from './modules/commerce-finance/commerce-finance.service'
import { OrdersController } from './modules/orders/orders.controller'
import { ProductAdvancedService } from './modules/products/product-advanced.service'
import { VariantSkuService } from './modules/products/variant-sku.service'
import { BarcodeSequenceService } from './modules/products/barcode-sequence.service'
import { ProductPublishCron } from './modules/products/product-publish.cron'
import { ProductsController } from './modules/products/products.controller'
import { ProductTranslateService } from './modules/products/product-translate.service'
import { CustomersController } from './modules/customers/customers.controller'
import { CustomersService } from './modules/customers/customers.service'
import { WholesaleController } from './modules/wholesale/wholesale.controller'
import { WholesaleService } from './modules/wholesale/wholesale.service'
import { SearchController } from './modules/search/search.controller'
import { SeoController } from './modules/seo/seo.controller'
import { PaymentsController } from './modules/payments/payments.controller'
import { AutomationController } from './modules/automation/automation.controller'
import { MarketingController } from './modules/marketing/marketing.controller'
import {
  PartnersController,
  PartnerInvitesController,
  PartnerTransactionsController,
} from './modules/finance/finance.controllers'
import {
  ExpensesController,
  ProfitLossController,
  DailyClosingController,
} from './modules/finance/finance-reports.controller'
import { AdminFinanceController } from './modules/finance/admin-finance.controller'
import {
  TelegramWebhookController,
  TelegramFinanceController,
} from './modules/telegram/telegram.controller'
import { SettingsController } from './modules/settings/settings.controller'
import { NavBuilderService } from './modules/settings/nav-builder.service'
import { StorefrontController } from './modules/storefront/storefront.controller'
import { StorefrontOrdersService } from './modules/storefront/storefront-orders.service'
import { StorefrontAuthService } from './modules/storefront/storefront-auth.service'
import { GoogleIdTokenService } from './modules/storefront/google-id-token.service'
import { StorefrontWishlistService } from './modules/storefront/storefront-wishlist.service'
import { StorefrontReturnsService } from './modules/storefront/storefront-returns.service'
import { StorefrontOtpService } from './modules/storefront/storefront-otp.service'
import { CategoriesController } from './modules/categories/categories.controller'
import { CollectionsController } from './modules/collections/collections.controller'
import { BrandsController } from './modules/brands/brands.controller'
import { BannersController } from './modules/banners/banners.controller'
import { RedirectsController } from './modules/redirects/redirects.controller'
import { PlatformController } from './modules/platform/platform.controller'
import { PlatformService } from './modules/platform/platform.service'
import { MediaController } from './modules/media/media.controller'
import { MediaService } from './modules/media/media.service'
import { CouponsController, StorefrontCouponsController, StorefrontPromosController } from './modules/coupons/coupons.controller'
import { CommerceOsService } from './modules/commerce-os/commerce-os.service'
import {
  CommerceOsController,
  MobileAuthController,
} from './modules/commerce-os/commerce-os.controller'
import { AdminHubController } from './modules/admin-hub/admin-hub.controller'
import { AdminHubService } from './modules/admin-hub/admin-hub.service'
import { ProcurementMailerService } from './modules/admin-hub/procurement-mailer.service'
import { AnalyticsController, AnalyticsService } from './modules/analytics'
import { AiProductAgentController, AiService } from './modules/ai'
import { ManusController, ManusService } from './modules/manus'
import { AuthController, AuthService, AdminLoginTokenService } from './modules/auth'
import { PurgeDemoCatalogService } from './modules/catalog/purge-demo-catalog.service'
import { SeedDemoCatalogService } from './modules/catalog/seed-demo-catalog.service'
import { ContentController, ContentService, FootwearConfigService, LegalPagesService } from './modules/content'
import { GoogleSheetsController, GoogleSheetsService } from './modules/google-sheets'
import { ReportsController, ReportsService } from './modules/reports'
import { ExportCenterController } from './modules/exports/export-center.controller'
import { RmaController, RmaService } from './modules/rma'
import { CourierController } from './modules/courier/courier.controller'
import { SteadfastWebhookController } from './modules/courier/steadfast-webhook.controller'
import { SteadfastWebhookService } from './modules/courier/steadfast-webhook.service'
import { NotificationsController } from './modules/notifications/notifications.controller'
import { InvoiceController } from './modules/invoices/invoice.controller'
import { RealtimeController } from './modules/realtime/realtime.controller'
import { RealtimeBusService } from './common/realtime/realtime-bus.service'
import { RealtimePublisher } from './common/realtime/realtime.publisher'
import { PosController } from './modules/pos/pos.controller'
import { FulfillmentController } from './modules/fulfillment/fulfillment.controller'
import { FulfillmentService } from './modules/fulfillment/fulfillment.service'
import { PosService } from './modules/pos/pos.service'
import { SaasController, SaasService } from './modules/saas'
import { DatabaseConnectionService, SecurityController, SecurityService } from './modules/security'
import { McpController } from './modules/mcp/mcp.controller'
import { McpTokenService } from './modules/mcp/mcp-token.service'
import { WebhooksController, WebhooksService } from './modules/webhooks'
import { FunnelController, FunnelService } from './modules/funnel'
import { PrintController, PrintService } from './modules/print'
import {
  AgentController,
  AgentService,
} from './modules/agent'
import { AgentToolsService } from './modules/agent/tools/agent-tools.service'
import { AgentDiagnosticsService } from './modules/agent/diagnostics/agent-diagnostics.service'
import { AgentLoopService } from './modules/agent/agent-loop.service'
import { AgentAuditService } from './modules/agent/agent-audit.service'
import { AgentConfirmationsService } from './modules/agent/agent-confirmations.service'
import { AgentCostService } from './modules/agent/agent-cost.service'
import { SeoDailyBriefCron } from './modules/agent/seo-daily-brief.cron'
import { PromptManager } from './modules/agent/prompts/prompt.manager'
import { ConversationStore } from './modules/agent/memory/conversation.store'
import { ModelRouter } from './modules/agent/providers/model-router'
import {
  IntegrationsController,
  IntegrationsService,
  EncryptionService,
  TelegramIntegrationService,
  AiIntegrationService,
  PaymentIntegrationService,
  InfrastructureIntegrationService,
  SmsIntegrationService,
  IntegrationAuditService,
} from './modules/integrations'
import {
  GoogleWorkspaceController,
  GoogleSearchConsoleController,
  GoogleSearchConsoleService,
  GoogleWorkspaceService,
  GoogleOAuthService,
  GoogleClientService,
  GoogleSheetsSyncService,
  GoogleGmailService,
  GoogleDriveService,
  GoogleSyncQueueService,
  GoogleSyncProcessor,
  GoogleAuditService,
  GoogleServiceAccountService,
} from './modules/google-workspace'
import { GoogleSheetsLiveCron } from './modules/google-workspace/google-sheets-live.cron'

const queueImports = redisQueuesEnabled()
  ? [
      BullModule.forRootAsync({
        useFactory: () => ({
          connection: bullmqConnectionOptions(),
        }),
      }),
      BullModule.registerQueue(
        { name: 'courier' },
        { name: 'invoices' },
        { name: 'sheets' },
        { name: 'ai-jobs' },
        { name: 'marketing' },
        { name: 'google-sync' },
        { name: 'order-side-effects' },
      ),
    ]
  : []

const queueWorkerProviders = redisQueuesEnabled()
  ? [CourierProcessor, GoogleSyncProcessor, OrderSideEffectsProcessor, MarketingProcessor]
  : noopQueueProviders()

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '.env.local'),
        resolve(process.cwd(), '../../.env'),
        resolve(process.cwd(), '../../.env.local'),
      ],
    }),
    ScheduleModule.forRoot(),
    // Counters live in Redis so the declared limit is the real limit across all
    // PM2 cluster workers, not per-worker (see RedisThrottlerStorage).
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [
          {
            ttl: Number(process.env['THROTTLE_TTL_MS'] ?? '60000'),
            limit: Number(
              process.env['THROTTLE_LIMIT'] ??
                (process.env.NODE_ENV === 'production' ? '200' : '1000'),
            ),
          },
        ],
        storage,
      }),
    }),
    ...queueImports,
  ],
  controllers: [
    AppController,
    DashboardController,
    CommerceFinanceController,
    OrdersController,
    ProductsController,
    CustomersController,
    WholesaleController,
    SearchController,
    SeoController,
    PaymentsController,
    AutomationController,
    MarketingController,
  PartnersController,
  PartnerInvitesController,
  PartnerTransactionsController,
    ExpensesController,
    ProfitLossController,
    DailyClosingController,
    AdminFinanceController,
    GoogleSheetsController,
    ReportsController,
    ExportCenterController,
    AiProductAgentController,
    ManusController,
    AnalyticsController,
    AuthController,
    ContentController,
    RmaController,
    SaasController,
    SecurityController,
    McpController,
    WebhooksController,
    PrintController,
    TelegramWebhookController,
    TelegramFinanceController,
    CommerceOsController,
    MobileAuthController,
    SettingsController,
    StorefrontController,
    CategoriesController,
    CollectionsController,
    BrandsController,
    BannersController,
    RedirectsController,
    PlatformController,
    MediaController,
    CouponsController,
    StorefrontCouponsController,
    StorefrontPromosController,
    AdminHubController,
    AgentController,
    IntegrationsController,
    GoogleWorkspaceController,
    GoogleSearchConsoleController,
    LoyaltyController,
    CourierController,
    SteadfastWebhookController,
    NotificationsController,
    InvoiceController,
    RealtimeController,
    PosController,
    FulfillmentController,
    FunnelController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    // Feature flags before auth — disabled modules return 403 without requiring login
    { provide: APP_GUARD, useClass: FeatureFlagGuard },
    { provide: APP_GUARD, useClass: AdminAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    PrismaService,
    R2StorageService,
    FinanceAuditService,
    RealtimeBusService,
    RealtimePublisher,
    CacheService,
    PresenceService,
    AdminSessionResolver,
    McpTokenService,
    MetaCapiService,
    FunnelService,
    DashboardService,
    CommerceFinanceService,
    TelegramService,
    AutomationService,
    AutomationCron,
    CourierService,
    SteadfastWebhookService,
    ...queueWorkerProviders,
    SteadfastService,
    RedxService,
    PathaoService,
    PaperflyService,
    SundarbanService,
    SaParibahonService,
    SeoService,
    SearchService,
    LoyaltyService,
    MarketingService,
    BkashService,
    NagadService,
    SslCommerzService,
    PaymentConfirmationService,
    StockReservationService,
    ProductAdvancedService,
    VariantSkuService,
    BarcodeSequenceService,
    ProductTranslateService,
    ProductPublishCron,
    NotificationsService,
    StockAlertsCron,
    AdminTelegramHubService,
    ServerErrorAlertService,
    StockAlertService,
    BackInStockCron,
    OrderNotificationsService,
    OrderEventsService,
    OrderStatusService,
    OrderEditService,
    FulfillmentService,
    OrderSideEffectsQueueService,
    CommerceEventOutboxService,
    SmsService,
    EmailService,
    InvoiceService,
    PosService,
    PartnersService,
    PartnerTransactionsService,
    ExpensesService,
    ProfitLossService,
    FinanceOverviewService,
    DailyClosingService,
    GoogleSheetsFinanceService,
    FinanceReportsService,
    AIProductAgentService,
    AnalyticsService,
    AiService,
    ManusService,
    AuthService,
    AdminLoginTokenService,
    ContentService,
    LegalPagesService,
    FootwearConfigService,
    PurgeDemoCatalogService,
    SeedDemoCatalogService,
    NavBuilderService,
    GoogleSheetsService,
    ReportsService,
    RmaService,
    SaasService,
    SecurityService,
    DatabaseConnectionService,
    WebhooksService,
    PrintService,
    CommerceOsService,
    PlatformService,
    MediaService,
    StorefrontOrdersService,
    StorefrontAuthService,
    GoogleIdTokenService,
    StorefrontWishlistService,
    StorefrontReturnsService,
    StorefrontOtpService,
    CustomersService,
    WholesaleService,
    AdminHubService,
    ProcurementMailerService,
    AgentService,
    AgentToolsService,
    AgentLoopService,
    AgentAuditService,
    AgentConfirmationsService,
    AgentCostService,
    SeoDailyBriefCron,
    PromptManager,
    ConversationStore,
    AgentDiagnosticsService,
    ModelRouter,
    EncryptionService,
    IntegrationsService,
    TelegramIntegrationService,
    AiIntegrationService,
    PaymentIntegrationService,
    InfrastructureIntegrationService,
    SmsIntegrationService,
    IntegrationAuditService,
    GoogleWorkspaceService,
    GoogleSearchConsoleService,
    GoogleOAuthService,
    GoogleClientService,
    GoogleSheetsSyncService,
    GoogleGmailService,
    GoogleDriveService,
    GoogleSyncQueueService,
    ...(redisQueuesEnabled() ? [GoogleSyncProcessor] : []),
    GoogleAuditService,
    GoogleSheetsLiveCron,
    GoogleServiceAccountService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
