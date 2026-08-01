# Retired admin module panels

The admin app is 100% DC: every route renders a screen from `components/dc`
(or a DC-native panel such as `ProductEditPanel` / `OrderDetailPanel`), and
`lib/modules/registry.ts` is now a plain href allow-list with no component map.

All pre-DC panels were deleted rather than parked here — git history is the
archive. The last commit that still contained them is `185f99bb`; recover any
single file with:

```bash
git show 185f99bb:apps/admin/src/components/modules/<Panel>.tsx
```

## What replaced what

| Retired | Replacement |
|---------|-------------|
| `ModuleWorkspace` + `registry` component map | `DC_BESPOKE` map in `app/dashboard/[...slug]/page.tsx` |
| `GenericModulePanel`, `ModuleLockedState`, `ModuleStatusBanner`, `ModulePanelShell` | `DcModuleHost` + `DcSoftLockPanel` |
| `CatalogModulePanel`, `LiveCategoriesPanel`, `ProductReviewsPanel`, `LiveProductCodesPanel` | `DcProducts`, `DcCategories`, `DcCollections`, `DcProductReviews`, `DcInventory` |
| `OrdersPanel`, `OrdersModulePanel` list router | `DcOrders` (detail stays in `OrderDetailPanel`) |
| `CommerceModulePanel`, `GrowthModulePanel` | `DcCustomers`, `DcCustomer360` |
| `CommerceFinanceModulePanel`, `InvoiceDetailPanel` | `DcReturnsRma` + soft-lock on legacy invoice URLs |
| `FinanceModulePanel`, `FinanceDashboard`, `FinanceSubNav`, `ProfitLossPanel`, `DailyClosingPanel`, `GoogleSheetsPanel`, `TelegramPanel`, `FinanceAuditLogsPanel` | `DcFinanceOverview`, `DcProfitLoss`, `DcDailyClosing`, `DcGoogleSheets`, `DcPartnerHub` |
| `ContentModulePanel`, `ContentLivePanels`, `LegalPagesPanel`, `SettingsPanel`, `StorefrontControlPanel`, `MenuBuilderPanel`, `CatalogVisibilityPanel`, `ShopFiltersPanel`, `HomepageVisibilityPanel`, `NewsletterAdminPreview`, `OurStoryAdminPanel` | `DcHomePage`, `DcHeroSlider`, `DcMenuControl`, `DcLegalPages`, `DcMediaLibrary` |
| `MarketingModulePanel`, `MarketingLivePanels`, `CouponsLivePanel`, `EmailSmsPanel` | `DcCampaigns`, `DcCoupons`, `DcSmsCenter` |
| `SeoModulePanel`, `SeoLivePanels`, `SeoHealthPanel` | `DcSeoHealth` |
| `AiCenterModulePanel`, `AiLivePanels` | `DcAiCommandBrain` + `AiCommandCenterPanel` |
| `AutomationModulePanel`, `AutomationRulesPanel`, `AIProductAgentPanel` | `DcAutomationRules`, `DcGoogleSheets` |
| `SecurityModulePanel`, `SecuritySubNav` | `DcSecurityCenter`, `DcAdminUsers` |
| `OperationsHubPanel`, `OpsModulePanel`, `WmsModulePanel`, `PackingStationPanel` | `DcOperationsHub`, `DcCourierHub`, `DcPackingStation`, `DcWarehouseStock`, `DcPurchaseOrders` |
| `SystemModulePanel`, `PlatformModulePanels`, `SaaSModulePanel`, `AnalyticsModulePanel`, `MediaModulePanel`, `ExecutiveDashboard`, `EnterpriseLivePanels`, `PosPanel`, `GoogleWorkspacePanels` | `DcApiHealth`, `DcAnalytics`, `DcMediaLibrary`, `DcExports`, or soft-lock |
| `TelegramBotConfigPanel` | `DcTelegramBot` + `DcTelegramSetupForm` |
| `BulkCsvPanel`, `BulkCsvImportModal` | `DcBulkCsv` |
| `SmsCenterPanel` | `DcSmsCenter` |
| `ApiHealthPanel` | `DcApiHealth` |
| `HandoffPageChrome`, `AdminPageShell`, `AdminHeader`, `AdminSidebar`, `PremiumDashboard` | `DcShell`, `DcSidebar`, `DcPageHead` |
| Barrel files `components/{products,orders,marketing,content,security,seo,ai,automation,courier}/index.ts` | DC screens import concrete paths |

Do not reintroduce any of these. New admin UI goes in `components/dc`.
