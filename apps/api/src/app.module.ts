import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { resolve } from 'path'
import { BullModule } from '@nestjs/bullmq'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { AppThrottlerGuard } from './common/app-throttler.guard'
import { AdminAuthGuard } from './common/auth/admin-auth.guard'
import { PrismaService } from './common/prisma.service'
import { FinanceAuditService } from './common/finance-audit.service'
import { RedisService } from './common/redis.service'
import { CacheService } from './common/cache.service'
import { RequestIdMiddleware } from './common/request-id.middleware'

// Feature modules
import { TelegramService } from './modules/telegram/telegram.service'
import { AutomationService } from './modules/automation/automation.service'
import { CourierService } from './modules/courier/courier.service'
import { CourierProcessor } from './modules/courier/courier.processor'
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
import { ProductAdvancedService } from './modules/products/product-advanced.service'
import { NotificationsService } from './modules/notifications/notifications.service'
import { AdminTelegramHubService } from './modules/notifications/admin-telegram-hub.service'
import { OrderNotificationsService } from './modules/notifications/order-notifications.service'
import { OrderEventsService } from './modules/orders/order-events.service'
import { SmsService } from './modules/notifications/sms.service'
import { EmailService } from './modules/email/email.service'
import { InvoiceService } from './modules/invoices/invoice.service'

// Finance
import { PartnersService, PartnerTransactionsService } from './modules/finance/partners.service'
import { ExpensesService } from './modules/finance/expenses.service'
import { ProfitLossService } from './modules/finance/profit-loss.service'
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
import { ProductsController } from './modules/products/products.controller'
import { CustomersController } from './modules/customers/customers.controller'
import { CustomersService } from './modules/customers/customers.service'
import { SearchController } from './modules/search/search.controller'
import { SeoController } from './modules/seo/seo.controller'
import { PaymentsController } from './modules/payments/payments.controller'
import { AutomationController } from './modules/automation/automation.controller'
import { MarketingController } from './modules/marketing/marketing.controller'
import {
  PartnersController,
  PartnerTransactionsController,
} from './modules/finance/finance.controllers'
import {
  ExpensesController,
  ProfitLossController,
  DailyClosingController,
} from './modules/finance/finance-reports.controller'
import {
  TelegramWebhookController,
  TelegramFinanceController,
} from './modules/telegram/telegram.controller'
import { SettingsController } from './modules/settings/settings.controller'
import { StorefrontController } from './modules/storefront/storefront.controller'
import { StorefrontOrdersService } from './modules/storefront/storefront-orders.service'
import { StorefrontAuthService } from './modules/storefront/storefront-auth.service'
import { StorefrontWishlistService } from './modules/storefront/storefront-wishlist.service'
import { StorefrontOtpService } from './modules/storefront/storefront-otp.service'
import { CategoriesController } from './modules/categories/categories.controller'
import { CollectionsController } from './modules/collections/collections.controller'
import { BrandsController } from './modules/brands/brands.controller'
import { BannersController } from './modules/banners/banners.controller'
import { RedirectsController } from './modules/redirects/redirects.controller'
import { PlatformController } from './modules/platform/platform.controller'
import { PlatformService } from './modules/platform/platform.service'
import { CouponsController, StorefrontCouponsController } from './modules/coupons/coupons.controller'
import { CommerceOsService } from './modules/commerce-os/commerce-os.service'
import {
  CommerceOsController,
  MobileAuthController,
} from './modules/commerce-os/commerce-os.controller'
import { AdminHubController } from './modules/admin-hub/admin-hub.controller'
import { AdminHubService } from './modules/admin-hub/admin-hub.service'
import { AnalyticsController, AnalyticsService } from './modules/analytics'
import { AiExecutiveController, AiProductAgentController, AiService } from './modules/ai'
import { AuthController, AuthService } from './modules/auth'
import { ContentController, ContentService, LegalPagesService } from './modules/content'
import { GoogleSheetsController, GoogleSheetsService } from './modules/google-sheets'
import { ReportsController, ReportsService } from './modules/reports'
import { RmaController, RmaService } from './modules/rma'
import { CourierController } from './modules/courier/courier.controller'
import { NotificationsController } from './modules/notifications/notifications.controller'
import { InvoiceController } from './modules/invoices/invoice.controller'
import { PosController } from './modules/pos/pos.controller'
import { PosService } from './modules/pos/pos.service'
import { SaasController, SaasService } from './modules/saas'
import { SecurityController, SecurityService } from './modules/security'
import { WebhooksController, WebhooksService } from './modules/webhooks'
import { PrintController, PrintService } from './modules/print'
import {
  AgentController,
  AgentService,
} from './modules/agent'
import { AgentToolsService } from './modules/agent/tools/agent-tools.service'
import { AgentDiagnosticsService } from './modules/agent/diagnostics/agent-diagnostics.service'
import { PromptManager } from './modules/agent/prompts/prompt.manager'
import { ConversationStore } from './modules/agent/memory/conversation.store'
import { ModelRouter } from './modules/agent/providers/model-router'
import {
  IntegrationsController,
  IntegrationsService,
  EncryptionService,
  TelegramIntegrationService,
  AiIntegrationService,
  IntegrationAuditService,
} from './modules/integrations'
import {
  GoogleWorkspaceController,
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

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '.env.local'),
        resolve(process.cwd(), '../../.env'),
        resolve(process.cwd(), '../../.env.local'),
      ],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: Number(process.env['THROTTLE_TTL_MS'] ?? '60000'),
        limit: Number(process.env['THROTTLE_LIMIT'] ?? (process.env.NODE_ENV === 'production' ? '200' : '1000')),
      },
    ]),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: {
          host: process.env['REDIS_HOST'] ?? 'localhost',
          port: parseInt(process.env['REDIS_PORT'] ?? '6379'),
          password: process.env['REDIS_PASSWORD'] || undefined,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          enableOfflineQueue: false,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: 'courier' },
      { name: 'invoices' },
      { name: 'sheets' },
      { name: 'ai-jobs' },
      { name: 'marketing' },
      { name: 'google-sync' },
    ),
  ],
  controllers: [
    AppController,
    DashboardController,
    CommerceFinanceController,
    OrdersController,
    ProductsController,
    CustomersController,
    SearchController,
    SeoController,
    PaymentsController,
    AutomationController,
    MarketingController,
    PartnersController,
    PartnerTransactionsController,
    ExpensesController,
    ProfitLossController,
    DailyClosingController,
    GoogleSheetsController,
    ReportsController,
    AiProductAgentController,
    AiExecutiveController,
    AnalyticsController,
    AuthController,
    ContentController,
    RmaController,
    SaasController,
    SecurityController,
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
    CouponsController,
    StorefrontCouponsController,
    AdminHubController,
    AgentController,
    IntegrationsController,
    GoogleWorkspaceController,
    LoyaltyController,
    CourierController,
    NotificationsController,
    InvoiceController,
    PosController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: AppThrottlerGuard },
    { provide: APP_GUARD, useClass: AdminAuthGuard },
    PrismaService,
    FinanceAuditService,
    RedisService,
    CacheService,
    MetaCapiService,
    DashboardService,
    CommerceFinanceService,
    TelegramService,
    AutomationService,
    CourierService,
    CourierProcessor,
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
    ProductAdvancedService,
    NotificationsService,
    AdminTelegramHubService,
    OrderNotificationsService,
    OrderEventsService,
    SmsService,
    EmailService,
    InvoiceService,
    PosService,
    PartnersService,
    PartnerTransactionsService,
    ExpensesService,
    ProfitLossService,
    DailyClosingService,
    GoogleSheetsFinanceService,
    FinanceReportsService,
    AIProductAgentService,
    AnalyticsService,
    AiService,
    AuthService,
    ContentService,
    LegalPagesService,
    GoogleSheetsService,
    ReportsService,
    RmaService,
    SaasService,
    SecurityService,
    WebhooksService,
    PrintService,
    CommerceOsService,
    PlatformService,
    StorefrontOrdersService,
    StorefrontAuthService,
    StorefrontWishlistService,
    StorefrontOtpService,
    CustomersService,
    AdminHubService,
    AgentService,
    AgentToolsService,
    PromptManager,
    ConversationStore,
    AgentDiagnosticsService,
    ModelRouter,
    EncryptionService,
    IntegrationsService,
    TelegramIntegrationService,
    AiIntegrationService,
    IntegrationAuditService,
    GoogleWorkspaceService,
    GoogleOAuthService,
    GoogleClientService,
    GoogleSheetsSyncService,
    GoogleGmailService,
    GoogleDriveService,
    GoogleSyncQueueService,
    GoogleSyncProcessor,
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
