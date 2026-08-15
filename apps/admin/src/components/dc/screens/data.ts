/**
 * Screen definitions ported from the design prototype
 * (`design_handoff_splaro_admin/SPLARO Admin.dc.html` — `SCREENS`, `MODULE_PAGES`,
 * `EMPTY`, `SKEL`, `TAB_BLOCKS`, `NOTIFS`).
 *
 * Fabricated API error strings used to live here as `ERRORS`. They were removed:
 * every screen prints the real failure from its own request instead.
 *
 * The copy, ordering and numbers are the designer's. Treat this file as the
 * design expressed as data: change it to match the prototype, not by taste.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import { B, K, type DcBlock, type DcTabItem } from '../blocks/types'

/** Render context handed to screens that own internal tab state. */
export interface ScreenCtx {
  tab: Record<string, string>
}

export type ScreenDef = DcBlock[] | ((s: ScreenCtx) => DcBlock[])

/** `[icon, title, body, cta]` */
export type EmptyDef = [string, string, string, string]
/** `[title, group, status, sync, actions]` */
export type ModulePageTuple = [
  string,
  string,
  string,
  string,
  Array<[label: string, icon: string, kind: string]>,
]
/** `[title, sub, time, icon, tone, screen]` */
export type NotifTuple = [string, string, string, string, string, string]

export interface PageAction {
  label: string
  icon: string
  kind?: string
}

export interface PageMeta {
  title: string
  group: string
  status: string
  sync: string
  back?: string
  actions: PageAction[]
}

/** Content sub-pages that hang off the Content group's own tab strip. */
const CONTENT_PAGES: Record<string, PageMeta> = {}

const MODULE_PAGES: Record<string, ModulePageTuple> = {
  analytics:   ['Analytics','Overview','live','refreshed 2m ago',[['Last 14 days','icon-calendar','ghost'],['Export','icon-download','ghost']]],
  returns:     ['Returns / RMA','Commerce','live','synced 4m ago',[['Return policy','icon-scale','ghost'],['New RMA','icon-plus','primary']]],
  reviews:     ['Product Reviews','Catalog','live','synced 1m ago',[['Moderation rules','icon-shield','ghost']]],
  collections: ['Collections','Catalog','live','synced 6m ago',[['Reorder','icon-arrow-up-down','ghost'],['New collection','icon-plus','primary']]],
  categories:  ['Categories','Catalog','live','synced 6m ago',[['New category','icon-plus','primary']]],
  inventory:   ['Inventory','Catalog','live','stock synced 40s ago',[['Stock count','icon-clipboard-list','ghost'],['Restock PO','icon-plus','primary']]],
  operations:  ['Operations Hub','Operations','live','live session',[['Assign staff','icon-user-cog','ghost']]],
  finance:     ['Profit & Cash Flow','Finance','live','synced 3m ago',[['Export','icon-download','ghost']]],
  pl:          ['Profit & Loss','Finance','live','July, provisional',[['Choose month','icon-calendar','ghost'],['Export','icon-download','ghost']]],
  campaigns:   ['Campaigns','Marketing','live','synced 8m ago',[['New campaign','icon-plus','primary']]],
  coupons:     ['Coupons','Marketing','live','synced 8m ago',[['New coupon','icon-plus','primary']]],
  homepage:    ['Home Page','Content','live','published 2h ago',[['Preview','icon-external-link','ghost'],['Publish','icon-check','primary']]],
  hero:        ['Hero Slider','Content','live','published 2h ago',[['Add slide','icon-plus','primary']]],
  media:       ['Media Library','Content','live','R2 synced',[['Upload','icon-upload','primary']]],
  menu:        ['Menu Control','Content','live','published 2h ago',[['Publish','icon-check','primary']]],
  legal:       ['Legal Pages','Content','live','updated 12 Jul',[['Preview','icon-external-link','ghost']]],
  integrations:['All Integrations','Integrations','live','health checked 1m ago',[['Add integration','icon-plus','primary']]],
  telegram:    ['Telegram Bot','Integrations','live','bot online',[['Send test','icon-send','ghost']]],
  apihealth:   ['API Health','Integrations','live','probe 15s ago',[['Run probe','icon-activity','ghost']]],
  ai:          ['AI Command Brain','Intelligence','beta','model gpt-4o-mini',[['Guardrails','icon-shield','ghost']]],
  seo:         ['SEO Health','Intelligence','live','crawled 06:00',[['Recrawl','icon-refresh-cw','ghost']]],
  automation:  ['Automation Rules','Intelligence','live','worker running',[['New rule','icon-plus','primary']]],
  security:    ['Security Center','Security','live','audit live',[['Force logout all','icon-log-out','ghost']]],
  staff:       ['Admin Users','Security','live','synced 5m ago',[['Invite admin','icon-plus','primary']]],
  exports:     ['Export Center','System','live','queue empty',[['New export','icon-plus','primary']]],
  bulk:        ['Bulk & CSV','Catalog','live','no job running',[['Download template','icon-download','ghost'],['Import CSV','icon-upload','primary']]],
  wms:         ['Warehouse & Stock','Operations','live','bins synced 30s ago',[['Record movement','icon-plus','ghost'],['New transfer','icon-arrow-up-down','primary']]],
  procurement: ['Purchase Orders','Operations','live','synced 4m ago',[['Suppliers','icon-users','ghost'],['New PO','icon-plus','primary']]],
  sms:         ['SMS Center','Integrations','live','BDBulkSMS reachable',[['Send test','icon-send','ghost'],['New template','icon-plus','primary']]],
  sheets:      ['Google Sheets','Integrations','live','cron ran 5m ago',[['Open spreadsheet','icon-external-link','ghost'],['Sync now','icon-refresh-cw','primary']]],
};

const SCREENS: Record<string, ScreenDef> = {
  analytics: [
    B.hero('Revenue · last 14 days','৳21,40,800','+12.6%','ok','1,157 orders · ৳6,84,300 came in the last 7 days alone',
      [ K('Sessions','48,210','+12.6% vs previous'), K('Conversion','2.4%','target 2.6%'), K('Avg order value','৳3,665','−2.1% week on week') ]),
    B.chart('Revenue · last 14 days','৳6,84,300',[38,52,44,61,73,49,88,67,55,79,92,71,84,96],['14','15','16','17','18','19','20','21','22','23','24','25','26','27'],'main'),
    B.list('Devices','share of sessions',[
      { icon:'icon-smartphone', color:'var(--violet)', title:'Mobile', sub:'Android 71% · iOS 29%', value:'82%' },
      { icon:'icon-monitor', color:'var(--info)', title:'Desktop', sub:'mostly repeat buyers', value:'14%' },
      { icon:'icon-tablet', color:'var(--ink-2)', title:'Tablet', sub:'lowest conversion', value:'4%' },
      { icon:'icon-clock', color:'var(--warn)', title:'Peak hour', sub:'21:00 – 23:00 Dhaka time', value:'26%' },
    ],'side'),
    B.table('Traffic & conversion','last 14 days',['Source','Sessions>','Orders>','Revenue>','Conv>'],[
      [{s:['Facebook / Meta ads','paid social']},{n:'21,480'},{n:'512'},{n:'৳18,60,400'},{b:[24,'var(--ok)','2.4%']}],
      [{s:['Instagram profile','organic social']},{n:'11,240'},{n:'268'},{n:'৳9,84,200'},{b:[24,'var(--ok)','2.4%']}],
      [{s:['Google search','organic']},{n:'8,910'},{n:'242'},{n:'৳8,12,600'},{b:[27,'var(--ok)','2.7%']}],
      [{s:['Direct / WhatsApp','shared links']},{n:'4,760'},{n:'109'},{n:'৳4,02,900'},{b:[23,'var(--warn)','2.3%']}],
      [{s:['Telegram channel','broadcast']},{n:'1,820'},{n:'26'},{n:'৳96,400'},{b:[14,'var(--warn)','1.4%']}],
    ]),
  ],

  returns: [
    B.banner('warn','icon-triangle-alert','3 RMAs are older than 7 days — Steadfast reverse pickup has not been booked for them yet.'),
    B.seg([ {label:'Requested',n:6,dot:'var(--warn)'}, {label:'Approved',n:4,dot:'var(--info)'}, {label:'In transit',n:3,dot:'var(--info)'}, {label:'Refunded',n:11,dot:'var(--ok)'}, {label:'Rejected',n:2,dot:'var(--bad)'} ]),
    B.kpis([ K('Open RMAs','13','৳1,42,300 at risk','var(--warn)'), K('Awaiting pickup','5','2 booked today'), K('Refunded · 30d','৳96,400','18 orders'), K('Return rate','4.2%','store target under 5%','var(--ok)') ]),
    B.table('Return requests','13 open',['RMA','Order','Customer','Reason','Stage','Refund>','Age>'],[
      [{m:'RMA-0219'},{m:'SPL-1036'},{s:['Farhana Akter','01733-448275','mono']},{s:['Size too small','Noor Embroidered Abaya · M']},{c:'Requested',tone:'warn'},{n:'৳18,600'},{mute:'9 days'}],
      [{m:'RMA-0218'},{m:'SPL-1033'},{s:['Sabbir Rahman','01755-903664','mono']},{s:['Colour differs from photo','Jamdani Weave Saree']},{c:'Approved',tone:'info'},{n:'৳27,900'},{mute:'8 days'}],
      [{m:'RMA-0217'},{m:'SPL-1029'},{s:['Tasnia Haque','01611-902774','mono']},{s:['Damaged in transit','Rimjhim Chiffon Gown']},{c:'In transit',tone:'info'},{n:'৳19,400'},{mute:'7 days'}],
      [{m:'RMA-0216'},{m:'SPL-1027'},{s:['Nabila Karim','01912-330118','mono']},{s:['Wrong item shipped','Zohra Pearl Clutch']},{c:'Refunded'},{n:'৳6,800'},{mute:'5 days'}],
      [{m:'RMA-0215'},{m:'SPL-1024'},{s:['Zarin Tasnim','01622-775019','mono']},{s:['Changed her mind','after 9 days — outside policy']},{c:'Rejected',tone:'bad'},{n:'৳0'},{mute:'4 days'}],
      [{m:'RMA-0214'},{m:'SPL-1021'},{s:['Mehjabin Rahman','01777-512640','mono']},{s:['Exchange for L','Meherjaan Silk Kaftan']},{c:'Approved',tone:'info'},{n:'exchange'},{mute:'3 days'}],
    ]),
  ],

  reviews: [
    B.kpis([ K('Awaiting moderation','7','oldest waiting 2 days','var(--warn)'), K('Published','412','on 96 products'), K('Average rating','4.6','of 5 · 1,284 reviews','var(--ok)'), K('Flagged','2','profanity filter','var(--bad)') ]),
    B.cards('Awaiting moderation','340px',[
      { title:'Meherjaan Silk Kaftan', sub:'Nusrat Jahan · verified buyer · SPL-1042', stars:5, starLabel:'5.0',
        body:'Kapor onek shundor, exactly like the photos. Delivery was two days early and the gift box was perfect.',
        chip:'PENDING', tone:'warn', actions:[['Publish','primary','Review published','Now visible on the product page.'],['Reject','ghost','Review rejected','Kept in moderation history.']] },
      { title:'Noor Embroidered Abaya', sub:'Sadia Islam · verified buyer · SPL-1040', stars:4, starLabel:'4.0',
        body:'Fabric quality is excellent for the price. The sleeves ran slightly long for me but the tailoring is neat.',
        chip:'PENDING', tone:'warn', actions:[['Publish','primary','Review published','Now visible on the product page.'],['Reject','ghost','Review rejected','Kept in moderation history.']] },
      { title:'Jamdani Weave Saree', sub:'Anonymous · unverified · no order match', stars:1, starLabel:'1.0',
        body:'Contains blocked words and no matching order — flagged automatically by the moderation filter.',
        chip:'FLAGGED', tone:'bad', actions:[['Delete','ghost','Review deleted','Removed and the account was noted.'],['Keep hidden','ghost','Left hidden','Stays out of the storefront.']] },
      { title:'Zohra Pearl Clutch', sub:'Farhana Akter · verified buyer · SPL-1036', stars:5, starLabel:'5.0',
        body:'Chotto but onek premium feel. Perfect with the abaya I bought last month.',
        chip:'PENDING', tone:'warn', actions:[['Publish','primary','Review published','Now visible on the product page.'],['Reject','ghost','Review rejected','Kept in moderation history.']] },
    ]),
    B.list('Rating spread','1,284 published reviews',[
      { icon:'icon-star', color:'var(--ok)', title:'5 stars', sub:'842 reviews', value:'66%' },
      { icon:'icon-star', color:'var(--ok)', title:'4 stars', sub:'298 reviews', value:'23%' },
      { icon:'icon-star', color:'var(--warn)', title:'3 stars', sub:'92 reviews', value:'7%' },
      { icon:'icon-star', color:'var(--bad)', title:'2 stars and below', sub:'52 reviews · mostly sizing', value:'4%' },
    ]),
  ],

  collections: [
    B.kpis([ K('Collections','12','8 shown in the menu'), K('Scheduled','2','Eid Edit ends 04 Aug','var(--warn)'), K('Products assigned','167','17 products in none'), K('Best performer','Eid Edit','৳8,40,200 in 30 days','var(--ok)') ]),
    B.cards('','300px',[
      { title:'The Eid Edit', sub:'Hand-picked festive pieces', thumb:true, chip:'LIVE', tone:'ok',
        rows:[['Products','42'],['Schedule','ends 04 Aug'],['Revenue · 30d','৳8,40,200']], actions:[['Edit','ghost','Collection editor','Drag products to reorder them.']] },
      { title:'New In', sub:'Auto-fills from the last 21 days', thumb:true, chip:'AUTO', tone:'vio',
        rows:[['Products','18'],['Rule','created within 21 days'],['Revenue · 30d','৳3,12,600']], actions:[['Edit rule','ghost','Automation rule','Auto-collections refresh every hour.']] },
      { title:'Heritage Saree', sub:'Jamdani and Tangail weaves', thumb:true, chip:'LIVE', tone:'ok',
        rows:[['Products','24'],['Schedule','always on'],['Revenue · 30d','৳4,68,900']], actions:[['Edit','ghost','Collection editor','Drag products to reorder them.']] },
      { title:'Everyday Cotton', sub:'Kurti and two-piece sets', thumb:true, chip:'LIVE', tone:'ok',
        rows:[['Products','31'],['Schedule','always on'],['Revenue · 30d','৳2,04,300']], actions:[['Edit','ghost','Collection editor','Drag products to reorder them.']] },
      { title:'Winter Preview', sub:'Shawl and layered sets', thumb:true, chip:'DRAFT', tone:'mute',
        rows:[['Products','9'],['Schedule','opens 01 Oct'],['Revenue · 30d','—']], actions:[['Publish','primary','Collection published','Winter Preview is live on the storefront.']] },
      { title:'Sale · up to 40%', sub:'Markdown pool, price-rule driven', thumb:true, chip:'LIVE', tone:'warn',
        rows:[['Products','22'],['Rule','stock older than 90 days'],['Revenue · 30d','৳1,86,400']], actions:[['Edit rule','ghost','Automation rule','Markdown pool refreshes nightly.']] },
    ]),
  ],

  categories: [
    B.table('Category tree','12 categories · drag to reorder',['Category','Path','Products>','Storefront','In menu'],[
      [{s:['Abaya','Signature and everyday abaya']},{m:'/abaya'},{n:'42'},{c:'Visible'},{c:'Yes',tone:'info'}],
      [{s:['   ↳ Signature','hand-finished, limited runs']},{m:'/abaya/signature'},{n:'18'},{c:'Visible'},{c:'Yes',tone:'info'}],
      [{s:['   ↳ Everyday','machine-washable crepe']},{m:'/abaya/everyday'},{n:'24'},{c:'Visible'},{c:'No',tone:'mute'}],
      [{s:['Kaftan','Eid and occasion wear']},{m:'/kaftan'},{n:'28'},{c:'Visible'},{c:'Yes',tone:'info'}],
      [{s:['Saree','Jamdani, Tangail, silk']},{m:'/saree'},{n:'24'},{c:'Visible'},{c:'Yes',tone:'info'}],
      [{s:['Kurti','Everyday cotton']},{m:'/kurti'},{n:'31'},{c:'Visible'},{c:'Yes',tone:'info'}],
      [{s:['Gown','Occasion and party']},{m:'/gown'},{n:'16'},{c:'Visible'},{c:'No',tone:'mute'}],
      [{s:['Accessories','Clutch, scarf, jewellery']},{m:'/accessories'},{n:'19'},{c:'Visible'},{c:'Yes',tone:'info'}],
      [{s:['Winter','Seasonal — hidden until October']},{m:'/winter'},{n:'9'},{c:'Hidden',tone:'mute'},{c:'No',tone:'mute'}],
    ],'main'),
    B.list('Rules that apply here','',[
      { icon:'icon-link', color:'var(--violet)', title:'Slug is permanent', sub:'Changing a path creates a 301 from the old URL', value:'ON' },
      { icon:'icon-search', color:'var(--info)', title:'Meilisearch facets', sub:'Category drives storefront filters', value:'SYNCED' },
      { icon:'icon-eye-off', color:'var(--warn)', title:'Hidden ≠ unpublished', sub:'Products stay reachable by direct link', value:'NOTE' },
      { icon:'icon-folder-tree', color:'var(--ink-2)', title:'Depth limit', sub:'Two levels — the storefront menu cannot render three', value:'2' },
    ],'side'),
  ],

  inventory: [
    B.hero('Revenue at risk in the next 14 days','৳3,84,000','4 SKUs','bad','If nothing is ordered this week, these lines go dark before the stock arrives — Islampur takes 6 days.',
      [ K('Dead stock','৳2,18,600','65 units, 0 sold in 30 days','var(--warn)'), K('Units on hand','2,418','৳48,60,000 at cost'), K('Cover across catalog','5.2 weeks','healthy band is 4 – 8') ]),
    B.decide('Order these now','supplier lead time 6 days · quantities are 4 weeks of cover at current velocity',[
      { sev:'bad', title:'Rangeen Cotton Kurti', sku:'SPL-KRT-337', badge:'Out of stock · 2 days',
        decision:'Order 36 units', deadline:'today',
        stats:[['Sells','9 / week'],['Cover','0 days'],['Lands','03 Aug']],
        note:'Still published and taking add-to-carts — roughly ৳39,000 lost since Saturday. Unpublish or order today.',
        actions:[['Create PO','primary','PO drafted','36 units · Islampur · expected 03 Aug'],['Unpublish','ghost','Hidden from storefront','Rangeen Cotton Kurti is no longer purchasable.']] },
      { sev:'bad', title:'Noor Embroidered Abaya', sku:'SPL-ABY-221', badge:'6 days of cover',
        decision:'Order 24 units', deadline:'by 31 Jul',
        stats:[['Sells','6.5 / week'],['Cover','6 days'],['Lands','06 Aug']],
        note:'Eid Edit traffic pushed velocity up 40% this week. Ordering on 31 Jul still leaves a 4-day gap — consider 30 units.',
        actions:[['Create PO','primary','PO drafted','24 units · Islampur · expected 06 Aug'],['Snooze 3 days','ghost','Snoozed','Back in this list on 31 Jul.']] },
      { sev:'warn', title:'Jamdani Weave Saree', sku:'SPL-SRE-108', badge:'3 on hand · 1 reserved',
        decision:'Order 12 units', deadline:'by 02 Aug',
        stats:[['Sells','1.4 / week'],['Cover','10 days'],['Margin','৳4,200 ea']],
        note:'Slow mover but the highest margin line in the catalog. Weaver needs 3 weeks, not 6 days — order ahead of the number.',
        actions:[['Create PO','primary','PO drafted','12 units · Tangail weaver · expected 22 Aug'],['View history','ghost','Opening','12-month demand for SPL-SRE-108.']] },
      { sev:'warn', title:'Shiuli Linen Two-piece', sku:'SPL-SET-192', badge:'11 on hand · 3 reserved',
        decision:'Order 20 units', deadline:'by 05 Aug',
        stats:[['Sells','5 / week'],['Cover','11 days'],['Lands','11 Aug']],
        note:'Steady seller with no seasonality. Safe to fold into the same Islampur PO as the Abaya and save one delivery fee.',
        actions:[['Add to Abaya PO','primary','Merged','20 units added to the 31 Jul Islampur PO.'],['Snooze 5 days','ghost','Snoozed','Back in this list on 02 Aug.']] },
    ]),
    B.decide('Dead stock — ৳2,18,600 sitting still','nothing sold in 30+ days · cash you already spent',[
      { sev:'warn', title:'Rimjhim Chiffon Gown', sku:'SPL-GWN-076', badge:'0 sold in 34 days',
        decision:'Discount 25%', deadline:'recovers ~৳78,000',
        stats:[['On hand','16'],['At cost','৳1,04,000'],['Cover','∞']],
        note:'Occasion wear with no occasion until September. A 25% cut still clears ৳1,100 margin per piece.',
        actions:[['Add to Sale','primary','Added to Sale','Rimjhim Chiffon Gown is live at 25% off.'],['Bundle with Kaftan','ghost','Bundle drafted','Gown + Kaftan set at ৳6,900.']] },
      { sev:'bad', title:'Winter Shawl Collection', sku:'SPL-SHW-002', badge:'Season ended 4 months ago',
        decision:'Archive & clear', deadline:'recovers ~৳44,000',
        stats:[['On hand','22'],['At cost','৳66,000'],['Last sold','12 Mar']],
        note:'Holding these until November costs shelf space and ties up ৳66,000. Clear at cost now, reorder fresh in October.',
        actions:[['Clearance at cost','primary','Clearance live','22 shawls listed at ৳3,000.'],['Keep till Nov','ghost','Kept','Reminder set for 01 Oct.']] },
      { sev:'warn', title:'Zohra Pearl Clutch', sku:'SPL-ACC-051', badge:'54 weeks of cover',
        decision:'Stop reordering', deadline:'no action needed',
        stats:[['On hand','27'],['Sells','0.5 / week'],['At cost','৳48,600']],
        note:'Not dead — just badly over-ordered in June. It will sell through on its own; remove it from the auto-PO rule.',
        actions:[['Remove from auto-PO','primary','Rule updated','SPL-ACC-051 no longer auto-reorders.'],['Add as free gift','ghost','Gift rule drafted','Free clutch over ৳8,000.']] },
    ]),
    B.table('Stock by SKU','sorted by days of cover',['Product','SKU','On hand>','Reserved>','Cover>','Reorder at>','Level','Status'],[
      [{s:['Rangeen Cotton Kurti','Kurti · Everyday']},{m:'SPL-KRT-337'},{n:'0'},{n:'0'},{n:'0 d'},{n:'12'},{b:[0,'var(--bad)','0%']},{c:'Out of stock'}],
      [{s:['Noor Embroidered Abaya','Abaya · Signature']},{m:'SPL-ABY-221'},{n:'8'},{n:'2'},{n:'6 d'},{n:'15'},{b:[53,'var(--bad)','53%']},{c:'Critical',tone:'bad'}],
      [{s:['Jamdani Weave Saree','Saree · Heritage']},{m:'SPL-SRE-108'},{n:'3'},{n:'1'},{n:'10 d'},{n:'8'},{b:[38,'var(--warn)','38%']},{c:'Low',tone:'warn'}],
      [{s:['Shiuli Linen Two-piece','Sets · Everyday']},{m:'SPL-SET-192'},{n:'11'},{n:'3'},{n:'11 d'},{n:'15'},{b:[73,'var(--warn)','73%']},{c:'Low',tone:'warn'}],
      [{s:['Meherjaan Silk Kaftan','Kaftan · Eid Edit']},{m:'SPL-KFT-014'},{n:'42'},{n:'6'},{n:'29 d'},{n:'20'},{b:[100,'var(--ok)','210%']},{c:'Healthy',tone:'ok'}],
      [{s:['Rimjhim Chiffon Gown','Gown · Occasion']},{m:'SPL-GWN-076'},{n:'16'},{n:'1'},{n:'—'},{n:'10'},{b:[100,'var(--warn)','no sales']},{c:'Dead stock',tone:'warn'}],
      [{s:['Zohra Pearl Clutch','Accessories']},{m:'SPL-ACC-051'},{n:'27'},{n:'2'},{n:'378 d'},{n:'12'},{b:[100,'var(--warn)','over-stocked']},{c:'Over-stocked',tone:'warn'}],
    ]),
    B.list('Moving fastest','units per week, last 30 days',[
      { icon:'icon-trending-up', color:'var(--ok)', title:'Rangeen Cotton Kurti', sub:'up from 6 — Telegram broadcast on 21 Jul', value:'9.0' },
      { icon:'icon-trending-up', color:'var(--ok)', title:'Noor Embroidered Abaya', sub:'up 40% this week · Eid Edit traffic', value:'6.5' },
      { icon:'icon-trending-up', color:'var(--ink-3)', title:'Shiuli Linen Two-piece', sub:'flat for 6 weeks · reliable base', value:'5.0' },
      { icon:'icon-trending-down', color:'var(--warn)', title:'Meherjaan Silk Kaftan', sub:'down from 4.1 — Eid demand cooling', value:'1.4' },
    ],'half'),
    B.list('Stock movement today','',[
      { icon:'icon-arrow-down-left', color:'var(--ok)', title:'Received from Islampur', sub:'Meherjaan Silk Kaftan · 24 units', value:'+24' },
      { icon:'icon-arrow-up-right', color:'var(--violet)', title:'Reserved by orders', sub:'12 parcels packed today', value:'−18' },
      { icon:'icon-rotate-ccw', color:'var(--info)', title:'Returned to shelf', sub:'RMA-0216 · Zohra Pearl Clutch', value:'+1' },
      { icon:'icon-triangle-alert', color:'var(--bad)', title:'Written off', sub:'water damage during transit', value:'−2' },
    ],'half'),
  ],

  bulk: [
    B.banner('warn','icon-triangle-alert','Stock and publish run against real endpoints. Price does not — the API has POST /products/bulk/stock and POST /products/bulk/publish, but no bulk price route yet. Ask engineering before Eid.'),
    B.kpis([ K('Products in catalog','196','168 published'), K('Matched by current filter','42','Kaftan · Eid Edit'), K('Last bulk run','2 days ago','24 SKUs republished'), K('Rows rejected last import','3','SKU not found','var(--warn)') ]),
    B.cards('Bulk operations','300px',[
      { title:'Update stock', sub:'Set or adjust stock across selected SKUs', icon:'icon-archive', iconColor:'var(--ok)', chip:'LIVE', tone:'ok',
        rows:[['Endpoint','POST /products/bulk/stock'],['Writes','ProductVariant.stock'],['Logged','StockMovementLog · ADJUSTMENT']],
        actions:[['Run on 42 selected','primary','Dry run ready','42 rows · 0 errors. Review the preview below before applying.']] },
      { title:'Publish / unpublish', sub:'Flip visibility for a whole collection at once', icon:'icon-eye', iconColor:'var(--violet)', chip:'LIVE', tone:'ok',
        rows:[['Endpoint','POST /products/bulk/publish'],['Writes','Product.isPublished'],['Storefront','picks up in under 60s']],
        actions:[['Unpublish 42 selected','primary','Dry run ready','42 products would leave the storefront.'],['Publish 42 selected','ghost','Dry run ready','42 products would go live.']] },
      { title:'Change price', sub:'Percentage or flat change across a collection', icon:'icon-tag', iconColor:'var(--ink-3)', chip:'NOT BUILT', tone:'warn',
        rows:[['Endpoint','POST /products/bulk/price — missing'],['Workaround','export CSV, edit, re-import'],['Blocked since','Eid planning, 14 Jul']],
        actions:[['Use CSV instead','ghost','Export started','196 products with price and compare-at columns.']] },
      { title:'Import CSV', sub:'Map columns, dry run, then apply', icon:'icon-upload', iconColor:'var(--info)', chip:'MAPS TO BULK', tone:'info',
        rows:[['Accepts','sku, stock, published'],['Runs as','the two bulk endpoints above'],['Max rows','2,000 per file']],
        actions:[['Choose file','primary','Waiting for a file','Drop a .csv — nothing is written until you approve the preview.']] },
    ]),
    B.table('Dry run · 42 rows from the current filter','nothing is written until you press Apply',['SKU','Product','Now','After','Change','Row status'],[
      [{m:'SPL-KFT-014'},{s:['Meherjaan Silk Kaftan','Kaftan · Eid Edit']},{n:'42'},{n:'60'},{n:'+18'},{c:'Will apply',tone:'ok'}],
      [{m:'SPL-ABY-221'},{s:['Noor Embroidered Abaya','Abaya · Signature']},{n:'8'},{n:'32'},{n:'+24'},{c:'Will apply',tone:'ok'}],
      [{m:'SPL-KRT-337'},{s:['Rangeen Cotton Kurti','Kurti · Everyday']},{n:'0'},{n:'36'},{n:'+36'},{c:'Will apply',tone:'ok'}],
      [{m:'SPL-SET-192'},{s:['Shiuli Linen Two-piece','Sets · Everyday']},{n:'11'},{n:'31'},{n:'+20'},{c:'Will apply',tone:'ok'}],
      [{m:'SPL-SRE-108'},{s:['Jamdani Weave Saree','Saree · Heritage']},{n:'3'},{n:'-2'},{n:'−5'},{c:'Rejected · negative',tone:'bad'}],
      [{m:'SPL-ACC-099'},{s:['Unknown SKU','not in this store']},{v:'—'},{v:'—'},{v:'—'},{c:'Rejected · not found',tone:'bad'}],
      [{m:'SPL-SHW-002'},{s:['Winter Shawl Collection','archived 12 Mar']},{n:'22'},{n:'22'},{v:'no change'},{c:'Skipped',tone:'mute'}],
    ],'main'),
    B.list('CSV you can export today','all three are real endpoints',[
      { icon:'icon-shopping-bag', color:'var(--violet)', title:'Orders', sub:'GET /reports/orders/export-csv · date range and status filters', value:'READY' },
      { icon:'icon-users', color:'var(--info)', title:'Customers', sub:'GET /customers/export-csv?tier= · one row per customer', value:'READY' },
      { icon:'icon-package', color:'var(--ok)', title:'Products template', sub:'sku, stock, published — the shape the importer expects', value:'READY' },
    ],'side'),
    B.list('Rules the importer enforces','',[
      { icon:'icon-shield', color:'var(--ink-2)', title:'Never partial', sub:'if any row is rejected, nothing is written until you confirm', value:'ON' },
      { icon:'icon-file-text', color:'var(--ink-2)', title:'Every row logged', sub:'each change lands in the stock ledger with your name', value:'ON' },
      { icon:'icon-clock', color:'var(--ink-2)', title:'One job at a time', sub:'a second import waits for the first to finish', value:'ON' },
    ],'side'),
  ],

  wms: [
    B.kpis([ K('Available','2,418','across 3 warehouses'), K('Reserved','186','held by unpacked orders','var(--violet)'), K('Damaged','24','write-off pending','var(--bad)'), K('Bins in use','412','of 540') ]),
    B.decide('Transfers waiting on you','a transfer only moves stock when you ship it and again when it is received',[
      { sev:'bad', title:'Banani → Uttara pop-up', sku:'TRF-0044', badge:'In transit · 2 days',
        decision:'Receive 24 units', deadline:'today',
        stats:[['SKU','SPL-KFT-014'],['Sent','26 Jul 11:20'],['Status','IN_TRANSIT']],
        note:'Stock already left Banani, so it counts nowhere until Uttara receives it. The pop-up shows 0 available while this sits open.',
        actions:[['Receive at Uttara','primary','Transfer completed','24 units added at Uttara · logged as TRANSFER +24.'],['Report short','ghost','Discrepancy opened','Count at Uttara differs — record the real quantity.']] },
      { sev:'warn', title:'Islampur intake → Banani', sku:'TRF-0045', badge:'Pending · not shipped',
        decision:'Ship 36 units', deadline:'by 18:00',
        stats:[['SKU','SPL-KRT-337'],['Created','Today 09:40'],['Status','PENDING']],
        note:'This is the Kurti that is out of stock on the storefront. Shipping deducts from Islampur now and credits Banani on receipt.',
        actions:[['Ship from Islampur','primary','Transfer shipped','36 units deducted at Islampur · logged as TRANSFER −36.'],['Cancel transfer','ghost','Transfer cancelled','No stock moved.']] },
    ]),
    B.table('Warehouses','zones → racks → bins',['Warehouse','Code','City','Zones','Available>','Reserved>','Damaged>','Status'],[
      [{s:['Banani main','primary fulfilment']},{m:'BAN-01'},{v:'Dhaka'},{v:'4 zones · 18 racks'},{n:'1,842'},{n:'142'},{n:'11'},{c:'Active',tone:'ok'}],
      [{s:['Islampur intake','goods received from suppliers']},{m:'ISL-02'},{v:'Old Dhaka'},{v:'2 zones · 9 racks'},{n:'486'},{n:'0'},{n:'13'},{c:'Active',tone:'ok'}],
      [{s:['Uttara pop-up','seasonal, Eid only']},{m:'UTT-03'},{v:'Dhaka'},{v:'1 zone · 4 racks'},{n:'90'},{n:'44'},{n:'0'},{c:'Active',tone:'ok'}],
      [{s:['Chattogram hub','opened but never stocked']},{m:'CTG-04'},{v:'Chattogram'},{v:'no zones yet'},{n:'0'},{n:'0'},{n:'0'},{c:'Empty',tone:'mute'}],
    ],'main'),
    B.table('Stock movement ledger','every write, who made it and why — this is the audit trail',['When','SKU','Reason','Before → After','Delta>','By','Note'],[
      [{v:'14:38'},{m:'SPL-KFT-014'},{c:'SALE',tone:'info'},{m:'44 → 42'},{n:'−2'},{v:'system'},{mute:'SPL-1038 packed'}],
      [{v:'13:12'},{m:'SPL-KRT-337'},{c:'ADJUSTMENT',tone:'warn'},{m:'2 → 0'},{n:'−2'},{v:'Shorif'},{mute:'miscount found during stock check'}],
      [{v:'11:50'},{m:'SPL-ACC-051'},{c:'RETURN',tone:'ok'},{m:'26 → 27'},{n:'+1'},{v:'Nadia'},{mute:'RMA-0216 back on shelf'}],
      [{v:'10:04'},{m:'SPL-KFT-014'},{c:'PURCHASE',tone:'ok'},{m:'20 → 44'},{n:'+24'},{v:'Rifat Hasan'},{mute:'GRN-0112 · Islampur'}],
      [{v:'09:41'},{m:'SPL-GWN-076'},{c:'DAMAGE',tone:'bad'},{m:'18 → 16'},{n:'−2'},{v:'Shorif'},{mute:'water damage in transit'}],
      [{v:'Yesterday'},{m:'SPL-ABY-221'},{c:'RESERVATION',tone:'info'},{m:'10 → 8'},{n:'−2'},{v:'system'},{mute:'held for SPL-1040'}],
      [{v:'Yesterday'},{m:'SPL-SET-192'},{c:'AUDIT',tone:'mute'},{m:'12 → 11'},{n:'−1'},{v:'Nadia'},{mute:'monthly count, no explanation found'}],
    ],'main'),
    B.form('Record a movement',[
      { label:'SKU', value:'SPL-KRT-337', mono:true, hint:'Must exist in this store — the API rejects unknown SKUs.' },
      { label:'Delta', value:'−2', mono:true, hint:'Non-zero integer. A negative that takes stock below 0 is refused.' },
      { label:'Reason', value:'ADJUSTMENT', mono:true, hint:'PURCHASE · SALE · TRANSFER · ADJUSTMENT · DAMAGE · RETURN · PRODUCTION · AUDIT · RESERVATION' },
      { label:'Note', value:'Miscount found during the evening stock check.', area:true, hint:'Optional, but an unexplained adjustment is what an audit flags first.' },
    ],'main'),
    B.list('Guards the API enforces','you will see these as errors, not silent failures',[
      { icon:'icon-shield', color:'var(--ink-2)', title:'delta must be a non-zero integer', sub:'0 and decimals are rejected', value:'400' },
      { icon:'icon-shield', color:'var(--ink-2)', title:'Insufficient stock (N available)', sub:'a movement can never drive stock negative', value:'400' },
      { icon:'icon-shield', color:'var(--ink-2)', title:'Transfer is pending, not in transit', sub:'receive only works after ship', value:'400' },
      { icon:'icon-shield', color:'var(--ink-2)', title:'Source and destination must differ', sub:'no self-transfers', value:'400' },
    ],'side'),
  ],

  procurement: [
    B.kpis([ K('Open POs','5','৳6,84,000 on order'), K('Arriving this week','2','48 units'), K('Overdue','1','Tangail weaver, 9 days late','var(--bad)'), K('Received · July','8','all matched to GRN','var(--ok)') ]),
    B.decide('Purchase orders that need you','received goods only count once a GRN is filed',[
      { sev:'bad', title:'Tangail handloom · Jamdani', sku:'PO-0118', badge:'9 days overdue',
        decision:'Chase the weaver', deadline:'promised 19 Jul',
        stats:[['Items','12 sarees'],['Value','৳1,44,000'],['Paid','50% advance']],
        note:'Handloom lead time is 3 weeks, not the 6 days the system assumes. Either move the expected date or the reorder maths stays wrong for this supplier.',
        actions:[['Set lead time to 21 days','primary','Supplier updated','Tangail handloom now uses a 21-day lead time.'],['Call supplier','ghost','Calling','01711-448902 · Rezaul, Tangail handloom.']] },
      { sev:'warn', title:'Islampur wholesale · mixed', sku:'PO-0121', badge:'Delivered, not received',
        decision:'File GRN for 60 units', deadline:'today',
        stats:[['Items','3 SKUs'],['Value','৳2,16,000'],['Arrived','Today 10:04']],
        note:'The van has unloaded but stock still reads zero at Islampur. Until the GRN is filed, none of it can be sold or transferred.',
        actions:[['Receive full order','primary','GRN-0113 filed','60 units added at Islampur · logged as PURCHASE.'],['Receive partial','ghost','Partial receipt','Enter the count per SKU — the shortfall stays open on the PO.']] },
    ]),
    B.table('Purchase orders','',['PO','Supplier','Items','Value>','Expected','Status'],[
      [{m:'PO-0121'},{s:['Islampur wholesale','Old Dhaka']},{v:'3 SKUs · 60 units'},{n:'৳2,16,000'},{v:'Today'},{c:'Delivered',tone:'warn'}],
      [{m:'PO-0120'},{s:['Narayanganj knits','Narayanganj']},{v:'1 SKU · 36 units'},{n:'৳1,08,000'},{v:'03 Aug'},{c:'In production',tone:'info'}],
      [{m:'PO-0119'},{s:['Islampur wholesale','Old Dhaka']},{v:'2 SKUs · 44 units'},{n:'৳1,76,000'},{v:'06 Aug'},{c:'Confirmed',tone:'info'}],
      [{m:'PO-0118'},{s:['Tangail handloom','Tangail']},{v:'1 SKU · 12 units'},{n:'৳1,44,000'},{v:'19 Jul'},{c:'Overdue',tone:'bad'}],
      [{m:'PO-0117'},{s:['Dhaka trims & tags','Banani']},{v:'packaging'},{n:'৳40,000'},{v:'08 Aug'},{c:'Draft',tone:'mute'}],
      [{m:'PO-0116'},{s:['Islampur wholesale','Old Dhaka']},{v:'2 SKUs · 24 units'},{n:'৳96,000'},{v:'22 Jul'},{c:'Received',tone:'ok'}],
    ],'main'),
    B.table('Suppliers','lead time drives every reorder suggestion in Inventory',['Supplier','City','Lead time','On time','Open POs','Spend · 90d>'],[
      [{s:['Islampur wholesale','ready-made, mixed categories']},{v:'Old Dhaka'},{v:'6 days'},{c:'94%',tone:'ok'},{n:'3'},{n:'৳8,40,000'}],
      [{s:['Tangail handloom','Jamdani, made to order']},{v:'Tangail'},{v:'6 days — wrong'},{c:'41%',tone:'bad'},{n:'1'},{n:'৳4,32,000'}],
      [{s:['Narayanganj knits','jersey and linen sets']},{v:'Narayanganj'},{v:'11 days'},{c:'88%',tone:'ok'},{n:'1'},{n:'৳3,24,000'}],
      [{s:['Dhaka trims & tags','boxes, tags, polybags']},{v:'Banani'},{v:'3 days'},{c:'99%',tone:'ok'},{n:'0'},{n:'৳1,20,000'}],
    ],'main'),
    B.list('Goods received · July','',[
      { icon:'icon-arrow-down-left', color:'var(--ok)', title:'GRN-0112 · PO-0116', sub:'Islampur wholesale · 24 units, no shortfall', value:'26 Jul' },
      { icon:'icon-arrow-down-left', color:'var(--ok)', title:'GRN-0111 · PO-0114', sub:'Narayanganj knits · 30 units', value:'21 Jul' },
      { icon:'icon-triangle-alert', color:'var(--warn)', title:'GRN-0110 · PO-0113', sub:'Islampur wholesale · 18 of 20 — 2 short, credit note issued', value:'14 Jul' },
    ],'side'),
    B.list('Where this connects','',[
      { icon:'icon-archive', color:'var(--violet)', title:'Inventory', sub:'“Create PO” on a restock card drafts a PO here', value:'LINKED' },
      { icon:'icon-warehouse', color:'var(--violet)', title:'Warehouse & Stock', sub:'a filed GRN writes PURCHASE rows into the ledger', value:'LINKED' },
      { icon:'icon-chart-no-axes-combined', color:'var(--violet)', title:'Profit & Loss', sub:'PO value lands in cost of goods when received', value:'LINKED' },
    ],'side'),
  ],

  sms: [
    B.banner('warn','icon-triangle-alert','Bangla text is Unicode: 70 characters per SMS, not 160. A three-line Bangla message costs the same as four English ones — the segment count on each template below is the real billing unit.'),
    B.hero('SMS sent · July','18,420','98.2% delivered','ok','Order events are automatic. Campaign blasts are manual and always ask for a confirmation before sending.',
      [ K('Cost · July','৳6,447','৳0.35 per segment'), K('Failed','331','mostly invalid numbers','var(--warn)'), K('Fallback used','412','BDBulkSMS timeouts','var(--warn)') ]),
    B.list('Provider chain','tried in this order — the first one configured wins',[
      { icon:'icon-check', color:'var(--ok)', title:'BDBulkSMS · primary', sub:'bulksmsbd.net · BDBULKSMS_API_KEY set · sender SPLARO', value:'ACTIVE' },
      { icon:'icon-arrow-down', color:'var(--ink-2)', title:'ElitBuzz · fallback', sub:'msg.elitbuzz-bd.com · token set · used 412 times in July', value:'STANDBY' },
      { icon:'icon-arrow-down', color:'var(--ink-3)', title:'GreenWeb · last resort', sub:'api.greenweb.com.bd · credentials not set', value:'NOT SET' },
      { icon:'icon-power', color:'var(--violet)', title:'Master switch', sub:'siteSettings.smsEnabled — off means nothing sends, silently', value:'ON' },
    ],'main'),
    B.table('Templates','segments are what you pay for',['Template','Trigger','Language','Chars','Segments>','Cost / send>','Status'],[
      [{s:['Order confirmed','order id, total, COD amount']},{m:'ORDER_CREATED'},{v:'English'},{n:'138'},{n:'1'},{n:'৳0.35'},{c:'Live',tone:'ok'}],
      [{s:['Packed & label printed','tells the customer to expect a call']},{m:'ORDER_PACKED'},{v:'English'},{n:'112'},{n:'1'},{n:'৳0.35'},{c:'Live',tone:'ok'}],
      [{s:['Shipped with tracking','courier name + consignment number']},{m:'ORDER_SHIPPED'},{v:'English'},{n:'156'},{n:'1'},{n:'৳0.35'},{c:'Live',tone:'ok'}],
      [{s:['Delivered — thank you','asks for a review link']},{m:'ORDER_DELIVERED'},{v:'English'},{n:'134'},{n:'1'},{n:'৳0.35'},{c:'Live',tone:'ok'}],
      [{s:['COD reminder · Bangla','sent the morning of delivery']},{m:'COD_REMINDER'},{v:'Bangla'},{n:'164'},{n:'3'},{n:'৳1.05'},{c:'Live',tone:'ok'}],
      [{s:['Abandoned cart · Bangla','one message, 4 hours after']},{m:'CART_ABANDONED'},{v:'Bangla'},{n:'82'},{n:'2'},{n:'৳0.70'},{c:'Draft',tone:'mute'}],
      [{s:['Login OTP','6-digit code, 5-minute expiry']},{m:'AUTH_OTP'},{v:'English'},{n:'64'},{n:'1'},{n:'৳0.35'},{c:'Live',tone:'ok'}],
    ],'main'),
    B.toggles('Which events send an SMS',[
      { label:'Order confirmed', sub:'fires the moment the order is created, prepaid or COD', on:true },
      { label:'Packed and label printed', sub:'so the customer knows a call is coming', on:true },
      { label:'Shipped with tracking', sub:'includes the Steadfast consignment number', on:true },
      { label:'Delivered', sub:'thank-you and review request', on:true },
      { label:'COD reminder on delivery day', sub:'Bangla · cuts refused parcels', on:true },
      { label:'Abandoned cart after 4 hours', sub:'template is still a draft — nothing sends yet', on:false },
    ],'main'),
    B.table('Recent sends','MessageLog · channel SMS',['Time','To','Template','Provider','Result'],[
      [{v:'14:38'},{m:'01533-907221'},{v:'ORDER_PACKED'},{v:'bdbulksms'},{c:'Delivered',tone:'ok'}],
      [{v:'14:20'},{m:'01711-204556'},{v:'ORDER_CREATED'},{v:'bdbulksms'},{c:'Delivered',tone:'ok'}],
      [{v:'13:04'},{m:'1755903664'},{v:'ORDER_SHIPPED'},{v:'—'},{c:'Invalid phone',tone:'bad'}],
      [{v:'12:41'},{m:'01912-887034'},{v:'COD_REMINDER'},{v:'elitbuzz'},{c:'Delivered · fallback',tone:'warn'}],
      [{v:'11:02'},{m:'01611-330918'},{v:'ORDER_CREATED'},{v:'bdbulksms'},{c:'Delivered',tone:'ok'}],
    ],'main'),
    B.list('Things worth knowing','',[
      { icon:'icon-phone', color:'var(--ink-2)', title:'Numbers are normalised to 880…', sub:'01711-204556 and +880 1711-204556 both become 8801711204556', value:'AUTO' },
      { icon:'icon-zap', color:'var(--ink-2)', title:'Automation can send too', sub:'the SEND_SMS rule action uses this same provider chain', value:'LINKED' },
      { icon:'icon-triangle-alert', color:'var(--warn)', title:'A failed send is not retried', sub:'the log records the provider error; resending is manual', value:'MANUAL' },
    ],'side'),
  ],

  sheets: [
    B.kpis([ K('Sheets connected','4','one spreadsheet, four tabs'), K('Rows pushed today','1,284','last at 14:40','var(--ok)'), K('Cron','every 15 min','GoogleSheetsLiveCron'), K('Failed jobs · 7d','2','both retried and passed','var(--warn)') ]),
    B.banner('info','icon-info','PostgreSQL is the database. Sheets is one-way backup: SPLARO writes, the spreadsheet reads. Editing a cell in Google Sheets changes nothing here and will be overwritten on the next run.'),
    B.table('Sync jobs','last 24 hours',['Job','Tab','Rows','Duration','Ran','Status'],[
      [{s:['Orders export','one row per order, all statuses']},{m:'Orders'},{n:'1,042'},{v:'4.2s'},{v:'14:40'},{c:'Success',tone:'ok'}],
      [{s:['Daily finance','revenue, COD collected, courier fees']},{m:'Hisab'},{n:'31'},{v:'0.9s'},{v:'14:40'},{c:'Success',tone:'ok'}],
      [{s:['Partner ledger','per-partner balance and withdrawals']},{m:'Partners'},{n:'6'},{v:'0.6s'},{v:'14:40'},{c:'Success',tone:'ok'}],
      [{s:['Stock snapshot','on hand and reserved per SKU']},{m:'Stock'},{n:'205'},{v:'2.1s'},{v:'14:40'},{c:'Success',tone:'ok'}],
      [{s:['Orders export','retried after a 429']},{m:'Orders'},{n:'1,038'},{v:'11.4s'},{v:'Yesterday 09:15'},{c:'Retried',tone:'warn'}],
      [{s:['Daily finance','Google quota exceeded']},{m:'Hisab'},{v:'—'},{v:'—'},{v:'26 Jul 18:00'},{c:'Failed · 429',tone:'bad'}],
    ],'main'),
    B.form('Connection',[
      { label:'Spreadsheet ID', value:'1kQ9x_SPLARO_hisab_2026_live', mono:true, hint:'From the sheet URL between /d/ and /edit.' },
      { label:'Service account', value:'splaro-sheets@splaro-prod.iam.gserviceaccount.com', mono:true, hint:'This address must have Editor access on the spreadsheet.' },
      { label:'Private key', value:'••••••••••••••••••••7c31', mono:true, secret:true },
      { label:'Sync interval', value:'15 minutes', hint:'Google allows 300 writes per minute per project. Below 5 minutes you will hit 429s.' },
    ],'main'),
    B.list('What each tab holds','',[
      { icon:'icon-shopping-bag', color:'var(--violet)', title:'Orders', sub:'every order with customer, courier and payment state', value:'1,042' },
      { icon:'icon-chart-no-axes-combined', color:'var(--ok)', title:'Hisab', sub:'daily revenue, COD collected, khoroch, net', value:'31' },
      { icon:'icon-handshake', color:'var(--info)', title:'Partners', sub:'balance and withdrawal history per partner', value:'6' },
      { icon:'icon-archive', color:'var(--warn)', title:'Stock', sub:'on hand and reserved, refreshed every run', value:'205' },
    ],'side'),
    B.list('If a sync fails','',[
      { icon:'icon-refresh-cw', color:'var(--ink-2)', title:'Retry failed jobs', sub:'POST /admin/integrations/google-sheets/retry-failed', value:'ACTION' },
      { icon:'icon-activity', color:'var(--ink-2)', title:'Check status', sub:'GET /admin/integrations/google-sheets/status', value:'PROBE' },
      { icon:'icon-file-text', color:'var(--ink-2)', title:'Read the log', sub:'GET /google-sheets/logs — provider error verbatim', value:'LOG' },
    ],'side'),
  ],

  operations: [
    B.seg([ {label:'To pack',n:9,dot:'var(--warn)'}, {label:'To dispatch',n:5,dot:'var(--violet)'}, {label:'With courier',n:41,dot:'var(--info)'}, {label:'Exceptions',n:3,dot:'var(--bad)'}, {label:'Closed today',n:38,dot:'var(--ok)'} ]),
    B.kpis([ K('Orders per hour','7.4','peak 11 at 15:00'), K('Avg pack time','1m 42s','target under 2m','var(--ok)'), K('SLA breaches','2','older than 24h in Packed','var(--bad)'), K('Staff on shift','4','Shorif, Nadia, Rina, Jamal') ]),
    B.list('Stations','live status',[
      { icon:'icon-scan-line', color:'var(--violet)', title:'Packing bench 1 · Shorif', sub:'SPL-1038 open · 2 items verified', value:'ACTIVE' },
      { icon:'icon-scan-line', color:'var(--violet)', title:'Packing bench 2 · Nadia', sub:'idle 4 minutes · waiting for stock pull', value:'IDLE' },
      { icon:'icon-printer', color:'var(--info)', title:'Label printer', sub:'Zebra ZD230 · 412 labels left on the roll', value:'READY' },
      { icon:'icon-truck', color:'var(--warn)', title:'Courier pickup', sub:'Steadfast rider expected 18:30', value:'2h 10m' },
    ],'main'),
    B.time('Floor log today',[
      { icon:'icon-package-check', color:'var(--ok)', text:'Shorif packed SPL-1038 · 2 items · 1m 12s', time:'14:38' },
      { icon:'icon-x', color:'var(--bad)', text:'SKU mismatch on SPL-1029 — parcel held for recount', time:'14:22' },
      { icon:'icon-truck', color:'var(--info)', text:'9 parcels handed to Steadfast rider · sheet signed', time:'13:40' },
      { icon:'icon-triangle-alert', color:'var(--warn)', text:'Nadia flagged SPL-1027 — packaging damaged in store', time:'14:02' },
      { icon:'icon-user-check', color:'var(--ink-2)', text:'Rina started shift · assigned to stock pulls', time:'12:00' },
    ],'side'),
  ],

  finance: [
    B.hero('Net profit · July','৳6,82,400','+18%','ok','31.9% margin on ৳21,40,800 net revenue',
      [ K('Gross revenue','৳21,40,800','1,157 orders'), K('COD outstanding','৳2,18,400','41 parcels','var(--warn)'), K('Khoroch · Jul','৳4,12,600','salary, courier, packaging','var(--bad)') ]),
    B.chart('Net profit · last 12 months','৳58,40,200',[42,38,51,47,63,58,71,66,79,74,88,96],['Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul'],'main'),
    B.list('Cash position','as of 28 Jul 18:00',[
      { icon:'icon-banknote', color:'var(--ok)', title:'Cash in hand', sub:'counted at daily closing', value:'৳1,42,600' },
      { icon:'icon-smartphone', color:'var(--violet)', title:'bKash merchant', sub:'01711-000111', value:'৳3,86,200' },
      { icon:'icon-landmark', color:'var(--info)', title:'Bank · City Bank', sub:'current account', value:'৳9,24,800' },
      { icon:'icon-credit-card', color:'var(--warn)', title:'SSLCommerz pending', sub:'settles T+2', value:'৳19,640' },
    ],'side'),
    B.table('Settlement by rail','July to date',['Rail','Orders>','Collected>','Fees>','Net>','Status'],[
      [{s:['Cash on delivery','Steadfast collects and remits weekly']},{n:'612'},{n:'৳11,84,200'},{n:'৳71,050'},{n:'৳11,13,150'},{c:'On track',tone:'ok'}],
      [{s:['bKash','merchant account, instant']},{n:'318'},{n:'৳6,12,400'},{n:'৳11,020'},{n:'৳6,01,380'},{c:'Settled'}],
      [{s:['SSLCommerz','cards and net banking, T+2']},{n:'164'},{n:'৳2,84,600'},{n:'৳7,970'},{n:'৳2,76,630'},{c:'Pending',tone:'warn'}],
      [{s:['Nagad','credentials not verified']},{n:'63'},{n:'৳59,600'},{n:'৳1,070'},{n:'৳58,530'},{c:'Paused',tone:'mute'}],
    ]),
  ],

  pl: [
    B.banner('info','icon-info','July is provisional until the daily closing for 31 Jul is locked. Figures exclude unsettled SSLCommerz payouts.'),
    B.hero('Net profit · July 2026','৳6,82,400','+18% vs June','ok','31.9% margin · provisional until 31 Jul is locked',
      [ K('Net revenue','৳21,40,800','after ৳96,500 returns'), K('Gross profit','৳10,95,000','51.1% margin','var(--ok)'), K('Operating cost','৳4,12,600','19.3% of revenue','var(--warn)') ]),
    B.table('Profit & loss · July 2026','provisional',['Line','Amount>','% of revenue>','vs June>'],[
      [{strong:'Gross sales'},{n:'৳22,37,300'},{mute:'104.5%'},{c:'+14%',tone:'ok'}],
      [{v:'Returns and refunds'},{n:'−৳96,500'},{mute:'−4.5%'},{c:'+2%',tone:'warn'}],
      [{strong:'Net revenue'},{n:'৳21,40,800'},{mute:'100%'},{c:'+13%',tone:'ok'}],
      [{v:'Cost of goods'},{n:'−৳9,18,400'},{mute:'−42.9%'},{c:'+11%',tone:'mute'}],
      [{v:'Delivery charges paid'},{n:'−৳1,27,400'},{mute:'−6.0%'},{c:'+9%',tone:'mute'}],
      [{strong:'Gross profit'},{n:'৳10,95,000'},{mute:'51.1%'},{c:'+16%',tone:'ok'}],
      [{v:'Salary and wages'},{n:'−৳1,86,000'},{mute:'−8.7%'},{c:'flat',tone:'mute'}],
      [{v:'Marketing · Meta ads'},{n:'−৳1,12,400'},{mute:'−5.3%'},{c:'+22%',tone:'warn'}],
      [{v:'Packaging'},{n:'−৳48,200'},{mute:'−2.3%'},{c:'+8%',tone:'mute'}],
      [{v:'Rent and utilities'},{n:'−৳45,000'},{mute:'−2.1%'},{c:'flat',tone:'mute'}],
      [{v:'Other khoroch'},{n:'−৳21,000'},{mute:'−1.0%'},{c:'−12%',tone:'ok'}],
      [{strong:'Net profit'},{n:'৳6,82,400'},{mute:'31.9%'},{c:'+18%',tone:'ok'}],
    ]),
    B.list('Partner share of net profit','45 / 35 / 20 split',[
      { icon:'icon-handshake', color:'var(--violet)', title:'Rifat Hasan', sub:'45% share', value:'৳3,07,080' },
      { icon:'icon-handshake', color:'var(--violet)', title:'Mahmud Alam', sub:'35% share', value:'৳2,38,840' },
      { icon:'icon-handshake', color:'var(--violet)', title:'Sumaiya Khan', sub:'20% share', value:'৳1,36,480' },
    ],'half'),
    B.list('Watch these','margin pressure',[
      { icon:'icon-megaphone', color:'var(--warn)', title:'Meta ad spend up 22%', sub:'CAC moved from ৳780 to ৳942', value:'৳1,12,400' },
      { icon:'icon-rotate-ccw', color:'var(--warn)', title:'Refunds up 2%', sub:'mostly sizing on abaya', value:'৳96,500' },
      { icon:'icon-truck', color:'var(--ink-2)', title:'Delivery cost per order', sub:'৳110 average across zones', value:'৳1,27,400' },
    ],'half'),
  ],

  campaigns: [
    B.hero('Revenue attributed · July','৳13,21,200','+34%','ok','62% of all revenue this month came from a campaign',
      [ K('Active campaigns','3','2 scheduled'), K('Best channel','Telegram','7.4% click to order'), K('Ad spend','৳1,12,400','CAC ৳942','var(--warn)') ]),
    B.table('Campaigns','July',['Campaign','Channel','Audience>','Sent>','Orders>','Revenue>','Status'],[
      [{s:['Eid Edit launch','hero + broadcast + ads']},{v:'Telegram + Meta'},{n:'4,820'},{n:'4,820'},{n:'186'},{n:'৳8,40,200'},{c:'Live',tone:'ok'}],
      [{s:['Abandoned cart nudge','2 hours after drop-off']},{v:'Telegram'},{n:'automated'},{n:'612'},{n:'48'},{n:'৳1,84,600'},{c:'Live',tone:'ok'}],
      [{s:['Second-order coupon','WELCOME2 · 10% off']},{v:'SMS'},{n:'first-time buyers'},{n:'1,284'},{n:'92'},{n:'৳2,96,400'},{c:'Live',tone:'ok'}],
      [{s:['Winter preview teaser','opens with the collection']},{v:'Telegram + Email'},{n:'8,940'},{n:'0'},{n:'0'},{n:'—'},{c:'Scheduled',tone:'info'}],
      [{s:['VIP early access','DIAMOND and PLATINUM only']},{v:'WhatsApp'},{n:'46'},{n:'0'},{n:'0'},{n:'—'},{c:'Draft',tone:'mute'}],
      [{s:['Ramadan reminder','last year, kept for reference']},{v:'Telegram'},{n:'6,210'},{n:'6,210'},{n:'241'},{n:'৳9,84,700'},{c:'Ended',tone:'mute'}],
    ]),
  ],

  coupons: [
    B.kpis([ K('Active coupons','5','2 expire this week','var(--warn)'), K('Redemptions · Jul','412','32% of orders'), K('Discount given','৳1,84,600','8.6% of revenue','var(--warn)'), K('Best performer','EID10','218 uses','var(--ok)') ]),
    B.cards('','280px',[
      { title:'EID10', sub:'10% off, no minimum', icon:'icon-tag', iconColor:'var(--violet)', chip:'ACTIVE', tone:'ok',
        rows:[['Used','218 / 500'],['Expires','04 Aug 2026'],['Revenue','৳6,84,200']], actions:[['Pause','ghost','EID10 paused','Checkout stops accepting it immediately.']] },
      { title:'WELCOME2', sub:'৳300 off the second order', icon:'icon-gift', iconColor:'var(--violet)', chip:'ACTIVE', tone:'ok',
        rows:[['Used','92 / unlimited'],['Expires','no expiry'],['Revenue','৳2,96,400']], actions:[['Edit','ghost','Coupon editor','Change value, cap or expiry.']] },
      { title:'FREEDEL', sub:'Free delivery over ৳3,000', icon:'icon-truck', iconColor:'var(--info)', chip:'ACTIVE', tone:'ok',
        rows:[['Used','64 / 200'],['Expires','31 Jul 2026'],['Revenue','৳1,42,800']], actions:[['Extend','ghost','Coupon extended','New expiry set to 31 Aug 2026.']] },
      { title:'VIP15', sub:'15% for DIAMOND and PLATINUM', icon:'icon-star', iconColor:'var(--violet)', chip:'ACTIVE', tone:'ok',
        rows:[['Used','24 / 46'],['Expires','no expiry'],['Revenue','৳4,12,600']], actions:[['Edit','ghost','Coupon editor','Change value, cap or expiry.']] },
      { title:'RAMADAN20', sub:'20% off — last season', icon:'icon-tag', iconColor:'var(--ink-3)', chip:'EXPIRED', tone:'mute',
        rows:[['Used','341 / 400'],['Expired','12 Apr 2026'],['Revenue','৳11,20,400']], actions:[['Duplicate','ghost','Coupon duplicated','Created as RAMADAN20-COPY in draft.']] },
      { title:'STAFF50', sub:'Staff purchase, 50% off', icon:'icon-user-cog', iconColor:'var(--warn)', chip:'RESTRICTED', tone:'warn',
        rows:[['Used','11 / 24'],['Expires','no expiry'],['Revenue','৳48,200']], actions:[['Audit uses','ghost','Usage audit','11 redemptions across 4 staff accounts.']] },
    ]),
  ],

  homepage: [
    B.form('Hero section',[
      { label:'Headline', value:'The Eid Edit — hand-finished in Dhaka' },
      { label:'Sub copy', value:'Limited runs of abaya, kaftan and saree, cut and finished by our own tailors. Free delivery over ৳5,000.', area:true },
      { label:'Primary button', value:'Shop the Edit → /collections/eid-edit', mono:true },
      { label:'Marquee strip', value:'Free delivery over ৳5,000 · 7-day exchange · Made in Bangladesh' },
    ],'main'),
    B.media('Hero media','1920×1080 recommended',['Desktop hero','Mobile hero','Offer band'],'150px','side'),
    B.toggles('Sections on the home page',[
      { label:'Hero slider', sub:'3 slides, autoplay 6s', on:true },
      { label:'New In rail', sub:'pulls the New In collection, 12 products', on:true },
      { label:'Category tiles', sub:'Abaya · Kaftan · Saree · Accessories', on:true },
      { label:'Offer band', sub:'Eid Edit banner between rails', on:true },
      { label:'Instagram strip', sub:'needs a fresh Graph API token', on:false },
      { label:'Newsletter block', sub:'collects phone numbers, not emails', on:true },
    ],'main'),
    B.list('Publish state','',[
      { icon:'icon-check', color:'var(--ok)', title:'Live version', sub:'published 2h ago by Rifat Hasan', value:'v41' },
      { icon:'icon-pencil', color:'var(--warn)', title:'Draft changes', sub:'hero headline and marquee edited', value:'2 edits' },
      { icon:'icon-eye', color:'var(--info)', title:'Preview link', sub:'expires in 24 hours', value:'OPEN' },
    ],'side'),
  ],

  hero: [
    B.media('Slides','3 live · autoplay 6s',['Slide 1 · Eid Edit','Slide 2 · New In','Slide 3 · Free delivery','Add slide'],'190px'),
    B.table('Slide settings','drag to reorder',['#','Slide','Links to','Schedule','Device','Status'],[
      [{m:'1'},{s:['Eid Edit — hand-finished in Dhaka','headline + Shop the Edit button']},{m:'/collections/eid-edit'},{v:'until 04 Aug'},{v:'All'},{c:'Live',tone:'ok'}],
      [{m:'2'},{s:['New In this week','headline only']},{m:'/collections/new-in'},{v:'always on'},{v:'All'},{c:'Live',tone:'ok'}],
      [{m:'3'},{s:['Free delivery over ৳5,000','offer strip style']},{m:'/pages/delivery'},{v:'always on'},{v:'Mobile only'},{c:'Live',tone:'ok'}],
      [{m:'4'},{s:['Winter Preview','waiting on final photography']},{m:'/collections/winter'},{v:'opens 01 Oct'},{v:'All'},{c:'Scheduled',tone:'info'}],
    ]),
  ],

  media: [
    B.kpis([ K('Files','2,418','R2 bucket splaro-media-prod'), K('Storage used','62%','18.6 GB of 30 GB','var(--warn)'), K('Uploaded · 7d','184','mostly Eid Edit shoot'), K('Missing alt text','36','hurts SEO score','var(--bad)') ]),
    B.media('Recent uploads','Eid Edit shoot · 24 Jul',['abaya-noor-front.webp','abaya-noor-back.webp','kaftan-meherjaan-01.webp','saree-jamdani-detail.webp','clutch-zohra-ivory.webp','model-eid-editorial.webp','Drop files here'],'150px','main'),
    B.list('Buckets and rules','',[
      { icon:'icon-server', color:'var(--violet)', title:'splaro-media-prod', sub:'product and content images · public read', value:'18.6 GB' },
      { icon:'icon-server', color:'var(--info)', title:'splaro-invoices', sub:'PDF invoices · private, signed URLs', value:'1.2 GB' },
      { icon:'icon-image', color:'var(--ok)', title:'Auto WebP conversion', sub:'JPEG and PNG converted on upload', value:'ON' },
      { icon:'icon-crop', color:'var(--ok)', title:'Derivative sizes', sub:'320 / 640 / 1080 / 1920 generated', value:'4' },
      { icon:'icon-trash-2', color:'var(--warn)', title:'Orphan files', sub:'not referenced by any product or page', value:'212' },
    ],'side'),
  ],

  menu: [
    B.list('Header menu','5 rows · drag to reorder',[
      { icon:'icon-grip-vertical', color:'var(--ink-3)', title:'New In', sub:'/collections/new-in', value:'VISIBLE' },
      { icon:'icon-grip-vertical', color:'var(--ink-3)', title:'Abaya', sub:'/abaya · dropdown with Signature and Everyday', value:'VISIBLE' },
      { icon:'icon-grip-vertical', color:'var(--ink-3)', title:'Saree', sub:'/saree', value:'VISIBLE' },
      { icon:'icon-grip-vertical', color:'var(--ink-3)', title:'Kaftan', sub:'/kaftan', value:'VISIBLE' },
      { icon:'icon-grip-vertical', color:'var(--ink-3)', title:'Sale', sub:'/collections/sale · highlighted in red', value:'VISIBLE' },
    ],'main'),
    B.list('Footer columns','3 columns',[
      { icon:'icon-columns-3', color:'var(--violet)', title:'Column 1 · About', sub:'Our Story · Stores · Careers', value:'3 links' },
      { icon:'icon-columns-3', color:'var(--violet)', title:'Column 2 · Help', sub:'Delivery · Exchange · Size guide · Contact', value:'4 links' },
      { icon:'icon-columns-3', color:'var(--violet)', title:'Column 3 · Legal', sub:'Terms · Privacy · Refund policy', value:'3 links' },
      { icon:'icon-at-sign', color:'var(--info)', title:'Social row', sub:'Instagram · Facebook · TikTok', value:'3 icons' },
    ],'side'),
    B.banner('info','icon-info','Menu changes go live only after Publish. The storefront caches navigation for 60 seconds.'),
  ],

  legal: [
    B.table('Legal pages','4 pages',['Page','URL','Last updated','Updated by','Status'],[
      [{s:['Terms of service','governs orders and exchanges']},{m:'/pages/terms'},{v:'12 Jul 2026'},{v:'Rifat Hasan'},{c:'Published',tone:'ok'}],
      [{s:['Privacy policy','phone numbers and Google login data']},{m:'/pages/privacy'},{v:'12 Jul 2026'},{v:'Rifat Hasan'},{c:'Published',tone:'ok'}],
      [{s:['Refund and return policy','7-day window, exchange first']},{m:'/pages/refund'},{v:'02 Jun 2026'},{v:'Mahmud Alam'},{c:'Published',tone:'ok'}],
      [{s:['Delivery information','zone charges and timelines']},{m:'/pages/delivery'},{v:'—'},{v:'—'},{c:'Draft',tone:'mute'}],
    ],'main'),
    B.form('Refund policy · excerpt',[
      { label:'Section 1 — window', value:'Exchange or return requests must reach us within 7 days of delivery. The item must be unworn, unwashed and carry its original tags.', area:true },
      { label:'Section 2 — refund method', value:'Refunds go back to the original payment method. COD orders are refunded over bKash within 3 working days of the parcel reaching our warehouse.', area:true },
      { label:'Section 3 — exclusions', value:'Made-to-measure pieces, altered garments and clearance items are exchange-only.', area:true },
    ],'side'),
  ],

  integrations: [
    B.kpis([ K('Connected','7','of 10 available'), K('Failing','1','Nagad credentials','var(--bad)') , K('Webhooks · 24h','1,284','3 retries','var(--ok)'), K('Last health check','1m ago','every 60 seconds') ]),
    B.cards('','280px',[
      { title:'Steadfast Courier', sub:'Booking, tracking and COD remittance', icon:'icon-truck', iconColor:'var(--ok)', chip:'CONNECTED', tone:'ok',
        rows:[['Webhook','delivered 4m ago'],['Parcels · 24h','52']], actions:[['Test call','ghost','Steadfast reachable','Auth OK · 182ms round trip.']] },
      { title:'bKash Merchant', sub:'Instant checkout payments', icon:'icon-smartphone', iconColor:'var(--ok)', chip:'CONNECTED', tone:'ok',
        rows:[['Account','01711-000111'],['Volume · Jul','৳6,12,400']], actions:[['Test call','ghost','bKash reachable','Tokenisation OK.']] },
      { title:'SSLCommerz', sub:'Cards and net banking, T+2 settlement', icon:'icon-credit-card', iconColor:'var(--ok)', chip:'CONNECTED', tone:'ok',
        rows:[['Store ID','splaro_live'],['Pending payout','৳19,640']], actions:[['Test call','ghost','SSLCommerz reachable','Sandbox and live keys both valid.']] },
      { title:'Nagad', sub:'Wallet payments', icon:'icon-smartphone', iconColor:'var(--bad)', chip:'FAILING', tone:'bad',
        rows:[['Error','invalid merchant signature'],['Since','02 Jul']], actions:[['Fix credentials','primary','Opens Payments settings','Re-enter the merchant key and secret.']] },
      { title:'Telegram Bot', sub:'Login codes and order alerts', icon:'icon-send', iconColor:'var(--ok)', chip:'CONNECTED', tone:'ok',
        rows:[['Bot','@splaro_ops_bot'],['Messages · 24h','412']], actions:[['Send test','ghost','Test message sent','Check your personal chat.']] },
      { title:'Google Sheets', sub:'Daily closing and hisab backup', icon:'icon-table', iconColor:'var(--warn)', chip:'STALE', tone:'warn',
        rows:[['Last push','today 06:00'],['Sheet','SPLARO Hisab 2026']], actions:[['Push now','primary','Backup pushed','Daily closing written to the sheet.']] },
      { title:'Cloudflare R2', sub:'Media and invoice storage', icon:'icon-server', iconColor:'var(--ok)', chip:'CONNECTED', tone:'ok',
        rows:[['Bucket','splaro-media-prod'],['Used','18.6 GB of 30 GB']], actions:[['Open bucket','ghost','R2 console','Opens in a new tab.']] },
      { title:'Meilisearch', sub:'Storefront search and facets', icon:'icon-search', iconColor:'var(--ok)', chip:'CONNECTED', tone:'ok',
        rows:[['Index','products_v4 · 184 docs'],['Last reindex','40s ago']], actions:[['Reindex','ghost','Reindex queued','184 products will be rebuilt.']] },
      { title:'Meta Pixel + GA4', sub:'Conversion tracking', icon:'icon-megaphone', iconColor:'var(--ok)', chip:'CONNECTED', tone:'ok',
        rows:[['Pixel','742 118 993 004'],['GA4','G-8QK4TZ2LMN']], actions:[['Verify events','ghost','Events verified','Purchase and AddToCart both firing.']] },
      { title:'WhatsApp Business', sub:'Order updates over WhatsApp', icon:'icon-message-circle', iconColor:'var(--ink-3)', chip:'NOT SET UP', tone:'mute',
        rows:[['Status','no phone number linked'],['Cost','per-message pricing']], actions:[['Connect','primary','Setup started','You need a verified business number.']] },
    ]),
  ],

  telegram: [
    B.kpis([ K('Messages · 24h','412','9 failed','var(--ok)'), K('Subscribers','8,940','ops group + customers'), K('Login codes sent','24','all delivered'), K('Failed sends','9','users who blocked the bot','var(--warn)') ]),
    B.toggles('Alert types',[
      { label:'New order', sub:'to the ops group, with items and address', on:true },
      { label:'Courier booked', sub:'consignment number and rider details', on:true },
      { label:'Delivery failed', sub:'immediate, mentions the on-duty admin', on:true },
      { label:'Low stock', sub:'once a day at 09:00, batched', on:true },
      { label:'Daily closing summary', sub:'after the closing is locked', on:true },
      { label:'Customer order updates', sub:'to the customer, not the group', on:false },
    ],'main'),
    B.list('Bot commands','@splaro_ops_bot',[
      { icon:'icon-terminal', color:'var(--violet)', title:'/orders', sub:'today\u2019s pending orders with totals', value:'ADMIN' },
      { icon:'icon-terminal', color:'var(--violet)', title:'/stock <sku>', sub:'on-hand and reserved for one SKU', value:'ADMIN' },
      { icon:'icon-terminal', color:'var(--violet)', title:'/hisab', sub:'partner balances, read-only', value:'OWNER' },
      { icon:'icon-terminal', color:'var(--info)', title:'/track <order>', sub:'delivery status for customers', value:'PUBLIC' },
      { icon:'icon-terminal', color:'var(--ink-2)', title:'/help', sub:'lists commands the sender may use', value:'PUBLIC' },
    ],'side'),
    B.time('Recent sends',[
      { icon:'icon-shopping-bag', color:'var(--violet)', text:'New order SPL-1042 · ৳12,400 · Nusrat Jahan → ops group', time:'14:20' },
      { icon:'icon-key', color:'var(--info)', text:'Login code sent to Rifat Hasan · expires in 5 minutes', time:'14:02' },
      { icon:'icon-truck', color:'var(--info)', text:'Courier booked SPL-1037 · CN9931 → ops group', time:'13:44' },
      { icon:'icon-x', color:'var(--bad)', text:'Send failed · user 41180 blocked the bot', time:'12:18' },
      { icon:'icon-triangle-alert', color:'var(--warn)', text:'Low stock digest · 4 SKUs below reorder point', time:'09:00' },
    ]),
  ],

  apihealth: [
    B.hero('Uptime · last 30 days','99.96%','2 incidents','warn','18 minutes of downtime, both during Hostinger maintenance windows',
      [ K('p95 latency','142ms','8ms median'), K('Error rate','0.12%','mostly 404 on old links','var(--ok)'), K('Worker queue','3','jobs waiting') ]),
    B.chart('p95 latency by hour','142ms peak',[42,38,35,33,36,41,58,74,86,92,78,64],['06','08','10','12','14','16','18','20','22','00','02','04'],'main'),
    B.list('Services','probe every 15s',[
      { icon:'icon-server', color:'var(--ok)', title:'Nest API · api.splaro.co', sub:'PM2 · 2 instances · uptime 14d', value:'8ms' },
      { icon:'icon-database', color:'var(--ok)', title:'PostgreSQL · Prisma', sub:'18 connections of 40', value:'4ms' },
      { icon:'icon-search', color:'var(--ok)', title:'Meilisearch', sub:'products_v4 index healthy', value:'12ms' },
      { icon:'icon-cog', color:'var(--warn)', title:'Worker · queue', sub:'3 jobs waiting, 1 retry', value:'BUSY' },
      { icon:'icon-globe', color:'var(--ok)', title:'Storefront · splaro.co', sub:'Next.js on Hostinger VPS', value:'96ms' },
    ],'side'),
    B.table('Endpoints · last hour','sorted by p95',['Endpoint','Calls>','p50>','p95>','Errors>','Status'],[
      [{m:'POST /orders'},{n:'184'},{n:'62ms'},{n:'214ms'},{n:'0'},{c:'Healthy',tone:'ok'}],
      [{m:'GET /products'},{n:'4,120'},{n:'11ms'},{n:'48ms'},{n:'0'},{c:'Healthy',tone:'ok'}],
      [{m:'POST /courier/book'},{n:'52'},{n:'180ms'},{n:'412ms'},{n:'1'},{c:'Slow',tone:'warn'}],
      [{m:'GET /customers/:id'},{n:'612'},{n:'18ms'},{n:'64ms'},{n:'0'},{c:'Healthy',tone:'ok'}],
      [{m:'POST /webhooks/steadfast'},{n:'96'},{n:'9ms'},{n:'22ms'},{n:'3'},{c:'Retrying',tone:'warn'}],
    ]),
  ],

  ai: [
    B.banner('info','icon-shield','Every AI action shows a preview and needs one click to apply. Nothing writes to orders, stock or payouts without confirmation.'),
    B.cards('Skills','290px',[
      { title:'Product copy writer', sub:'Title, description and care notes from a photo and 3 keywords', icon:'icon-sparkles', iconColor:'var(--violet)', chip:'READY', tone:'ok',
        rows:[['Used · Jul','48 products'],['Editing needed','about 1 in 4']], actions:[['Run','primary','Copy writer open','Pick a product to draft copy for.']] },
      { title:'Stuck order finder', sub:'Flags parcels sitting in one stage too long', icon:'icon-search', iconColor:'var(--violet)', chip:'READY', tone:'ok',
        rows:[['Found today','2 orders'],['Rule','over 24h in Packed']], actions:[['Run','primary','2 stuck orders','SPL-1038 and SPL-1040 need booking.']] },
      { title:'COD risk scorer', sub:'Scores a phone number before booking', icon:'icon-shield-alert', iconColor:'var(--warn)', chip:'BETA', tone:'warn',
        rows:[['Accuracy','78% on 90 days'],['Blocked so far','3 numbers']], actions:[['Run','primary','Risk scorer','Scored 41 in-transit parcels.']] },
      { title:'Restock planner', sub:'Turns 30-day velocity into a purchase order', icon:'icon-package', iconColor:'var(--violet)', chip:'READY', tone:'ok',
        rows:[['Suggests','92 units'],['Value','৳6,84,000']], actions:[['Run','primary','Draft PO ready','4 SKUs · ৳6,84,000 — review before sending.']] },
      { title:'Hisab explainer', sub:'Answers partner ledger questions in Bangla', icon:'icon-handshake', iconColor:'var(--violet)', chip:'READY', tone:'ok',
        rows:[['Scope','read-only'],['Language','Bangla and English']], actions:[['Ask','primary','Hisab explainer','Ask about any partner balance.']] },
      { title:'Review reply drafter', sub:'Suggests a reply for each published review', icon:'icon-message-square-quote', iconColor:'var(--ink-3)', chip:'OFF', tone:'mute',
        rows:[['Status','disabled by owner'],['Reason','tone needs review']], actions:[['Enable','ghost','Skill enabled','Replies still need manual approval.']] },
    ]),
    B.time('Recent AI actions',[
      { icon:'icon-check', color:'var(--ok)', text:'Product copy applied to Meherjaan Silk Kaftan by Rifat Hasan', time:'13:12' },
      { icon:'icon-eye', color:'var(--info)', text:'Restock plan previewed · not applied', time:'11:40' },
      { icon:'icon-shield-alert', color:'var(--warn)', text:'COD risk 78 flagged for Zarin Tasnim — prepayment asked', time:'10:22' },
      { icon:'icon-x', color:'var(--bad)', text:'Review reply draft rejected — tone too casual', time:'Yesterday' },
    ]),
  ],

  seo: [
    B.hero('SEO score','82 / 100','+6 this month','ok','crawled today at 06:00 · 231 pages checked',
      [ K('Indexed pages','214','of 231 submitted'), K('Broken links','6','4 from old collections','var(--bad)'), K('Missing alt text','36','on 22 products','var(--warn)') ]),
    B.table('Page issues','crawled today',['Page','Title length','Meta description','Issue','Priority'],[
      [{s:['/abaya/signature','Category · 18 products']},{v:'71 chars'},{v:'missing'},{v:'Add a meta description'},{c:'High',tone:'bad'}],
      [{s:['/products/noor-embroidered-abaya','Product']},{v:'92 chars'},{v:'ok'},{v:'Title too long, gets cut in search'},{c:'Medium',tone:'warn'}],
      [{s:['/collections/ramadan-2026','Retired collection']},{v:'—'},{v:'—'},{v:'404 · still linked from the footer'},{c:'High',tone:'bad'}],
      [{s:['/kurti','Category · 31 products']},{v:'44 chars'},{v:'ok'},{v:'36 product images have no alt text'},{c:'Medium',tone:'warn'}],
      [{s:['/pages/delivery','Content page']},{v:'52 chars'},{v:'ok'},{v:'Draft — not in the sitemap yet'},{c:'Low',tone:'mute'}],
    ],'main'),
    B.list('Technical checks','',[
      { icon:'icon-file-code', color:'var(--ok)', title:'sitemap.xml', sub:'231 URLs · submitted to Google', value:'OK' },
      { icon:'icon-bot', color:'var(--ok)', title:'robots.txt', sub:'admin and api paths blocked', value:'OK' },
      { icon:'icon-braces', color:'var(--ok)', title:'Product schema', sub:'price, availability and rating present', value:'OK' },
      { icon:'icon-gauge', color:'var(--warn)', title:'Mobile LCP', sub:'2.8s on 4G — hero image is heavy', value:'SLOW' },
      { icon:'icon-link', color:'var(--bad)', title:'Canonical tags', sub:'6 pages point at the wrong canonical', value:'FIX' },
    ],'side'),
  ],

  automation: [
    B.kpis([ K('Rules active','7','of 9 defined'), K('Runs · today','412','worker healthy','var(--ok)'), K('Actions taken','96','all logged'), K('Failures · 7d','2','both retried and passed','var(--warn)') ]),
    B.toggles('Order and courier rules',[
      { label:'Confirm prepaid orders automatically', sub:'when bKash or SSLCommerz reports payment captured', on:true },
      { label:'Book courier when a parcel is packed', sub:'Steadfast, inside Dhaka only', on:true },
      { label:'Hold COD over ৳20,000 for a call', sub:'moves the order to Pending review instead', on:true },
      { label:'Cancel unpaid prepaid orders after 6 hours', sub:'releases reserved stock back to inventory', on:true },
      { label:'Ask for prepayment when COD risk is above 55', sub:'uses the AI risk score', on:false },
    ],'main'),
    B.toggles('Catalog and marketing rules',[
      { label:'Hide products at zero stock', sub:'keeps the page but removes it from listings', on:false },
      { label:'Move stock older than 90 days into Sale', sub:'markdown pool refreshes nightly', on:true },
      { label:'Send abandoned cart nudge after 2 hours', sub:'Telegram, once per customer per week', on:true },
      { label:'Auto-publish 4-star and 5-star reviews', sub:'profanity filter still applies', on:false },
    ],'main'),
    B.time('Rule log',[
      { icon:'icon-check', color:'var(--ok)', text:'Confirmed SPL-1040 · SSLCommerz payment captured', time:'11:45' },
      { icon:'icon-truck', color:'var(--info)', text:'Booked SPL-1037 with Steadfast · inside Dhaka rule', time:'13:44' },
      { icon:'icon-triangle-alert', color:'var(--warn)', text:'Held SPL-1033 · COD ৳27,900 above the call threshold', time:'Yesterday' },
      { icon:'icon-rotate-ccw', color:'var(--bad)', text:'Cancelled SPL-1019 · unpaid for 6 hours, 2 units released', time:'Yesterday' },
    ],'side'),
  ],

  security: [
    B.kpis([ K('Logins · 24h','18','4 admins'), K('Failed attempts','6','all from one IP','var(--warn)'), K('Active sessions','5','2 on mobile'), K('Telegram 2FA','4 of 5','Jamal has not linked yet','var(--warn)') ]),
    B.table('Audit log','last 24 hours',['When','Who','Action','Target','IP','Result'],[
      [{m:'14:38'},{v:'Shorif'},{v:'Packed parcel'},{m:'SPL-1038'},{m:'103.79.44.15'},{c:'OK',tone:'ok'}],
      [{m:'14:02'},{v:'Rifat Hasan'},{v:'Changed shipping charge'},{m:'settings/shipping'},{m:'103.108.22.14'},{c:'OK',tone:'ok'}],
      [{m:'13:44'},{v:'system'},{v:'Booked courier'},{m:'SPL-1037'},{m:'worker'},{c:'OK',tone:'ok'}],
      [{m:'12:18'},{v:'unknown'},{v:'Login attempt · wrong code'},{m:'auth/telegram'},{m:'45.119.82.7'},{c:'Blocked',tone:'bad'}],
      [{m:'11:04'},{v:'Mahmud Alam'},{v:'Exported partner hisab'},{m:'exports/hisab-jul'},{m:'103.230.41.88'},{c:'OK',tone:'ok'}],
      [{m:'09:30'},{v:'Nadia'},{v:'Refunded order'},{m:'SPL-1027 · ৳6,800'},{m:'103.79.44.20'},{c:'OK',tone:'ok'}],
    ],'main'),
    B.toggles('Policies',[
      { label:'Telegram 2FA for every admin', sub:'login codes go to a personal chat, never a group', on:true },
      { label:'Session timeout after 8 hours', sub:'packing station stays signed in during a shift', on:true },
      { label:'Block after 5 failed attempts', sub:'IP is locked for 30 minutes', on:true },
      { label:'Require a reason for refunds', sub:'stored in the audit log', on:true },
      { label:'Allow admin access outside Bangladesh', sub:'currently blocked at the edge', on:false },
    ],'side'),
  ],

  staff: [
    B.banner('info','icon-info','Roles are fixed in code: Owner sees hisab and payouts, Manager runs orders and catalog, Packer only sees the Packing Station.'),
    B.kpis([ K('Admin users','5','1 invite pending','var(--ink)'), K('Owners','2','Rifat and Mahmud'), K('2FA linked','4 of 5','Jamal pending','var(--warn)'), K('Last invite','22 Jul','sent by Rifat Hasan') ]),
    B.table('Admin users','5 users',['User','Role','Scope','Last login','2FA','Status'],[
      [{s:['Rifat Hasan','rifat@splaro.co']},{c:'Owner',tone:'vio'},{v:'Everything incl. hisab'},{v:'Today 14:02'},{c:'Linked',tone:'ok'},{c:'Active'}],
      [{s:['Mahmud Alam','mahmud@splaro.co']},{c:'Owner',tone:'vio'},{v:'Everything incl. hisab'},{v:'Today 11:04'},{c:'Linked',tone:'ok'},{c:'Active'}],
      [{s:['Nadia Islam','nadia@splaro.co']},{c:'Manager',tone:'info'},{v:'Orders, catalog, customers'},{v:'Today 09:30'},{c:'Linked',tone:'ok'},{c:'Active'}],
      [{s:['Shorif Uddin','shorif@splaro.co']},{c:'Packer',tone:'mute'},{v:'Packing Station only'},{v:'Today 14:38'},{c:'Linked',tone:'ok'},{c:'Active'}],
      [{s:['Jamal Hossain','jamal@splaro.co']},{c:'Packer',tone:'mute'},{v:'Packing Station only'},{v:'Never'},{c:'Pending',tone:'warn'},{c:'Invited',tone:'warn'}],
    ]),
  ],

  exports: [
    B.kpis([ K('Exports · 30d','24','all downloaded'), K('Queued','0','queue empty','var(--ok)'), K('Largest file','8.4 MB','orders-jul-2026.csv'), K('Retention','30 days','files delete automatically','var(--warn)') ]),
    B.table('Recent exports','files expire after 30 days',['File','Type','Range','Requested by','Size>','Status'],[
      [{m:'orders-jul-2026.csv'},{v:'Orders'},{v:'01 – 28 Jul'},{v:'Rifat Hasan'},{n:'8.4 MB'},{c:'Ready',tone:'ok'}],
      [{m:'hisab-jul-2026.xlsx'},{v:'Partner ledger'},{v:'01 – 28 Jul'},{v:'Mahmud Alam'},{n:'412 KB'},{c:'Ready',tone:'ok'}],
      [{m:'customers-all.csv'},{v:'Customers'},{v:'all time'},{v:'Nadia Islam'},{n:'1.2 MB'},{c:'Ready',tone:'ok'}],
      [{m:'inventory-snapshot.csv'},{v:'Inventory'},{v:'28 Jul 18:00'},{v:'system'},{n:'96 KB'},{c:'Ready',tone:'ok'}],
      [{m:'cod-reconciliation-jun.csv'},{v:'Finance'},{v:'01 – 30 Jun'},{v:'Rifat Hasan'},{n:'2.1 MB'},{c:'Expired',tone:'mute'}],
    ]),
    B.list('Scheduled exports','run automatically',[
      { icon:'icon-calendar-clock', color:'var(--violet)', title:'Daily closing → Google Sheets', sub:'every day at 06:00', value:'ON' },
      { icon:'icon-calendar-clock', color:'var(--violet)', title:'Orders CSV → email to owners', sub:'every Monday 08:00', value:'ON' },
      { icon:'icon-calendar-clock', color:'var(--ink-3)', title:'Inventory snapshot', sub:'every day at 18:00', value:'ON' },
    ],'half'),
    B.list('Export rules','',[
      { icon:'icon-shield', color:'var(--warn)', title:'Hisab exports are owner-only', sub:'managers get a 403', value:'ENFORCED' },
      { icon:'icon-eye-off', color:'var(--ok)', title:'Phone numbers masked for packers', sub:'last 3 digits hidden', value:'ON' },
      { icon:'icon-trash-2', color:'var(--ink-2)', title:'Files delete after 30 days', sub:'signed R2 URLs expire with them', value:'30d' },
    ],'half'),
  ],
};

const SKEL: Record<string, Array<[string, string]>> = {
  hero:[['15px','38%'],['46px','56%'],['13px','30%']], kpis:[['12px','48%'],['26px','62%'],['12px','40%']],
  seg:[['13px','100%'],['22px','84%']], chart:[['13px','36%'],['118px','100%']],
  table:[['13px','30%'],['11px','100%'],['11px','100%'],['11px','100%'],['11px','100%'],['11px','100%'],['11px','92%']],
  cards:[['13px','44%'],['11px','100%'],['62px','100%'],['11px','70%']],
  list:[['13px','34%'],['11px','100%'],['11px','100%'],['11px','88%'],['11px','96%']],
  decide:[['13px','38%'],['11px','100%'],['74px','100%'],['74px','100%']],
  toggles:[['13px','40%'],['11px','100%'],['11px','100%'],['11px','92%']],
  form:[['11px','26%'],['38px','100%'],['11px','26%'],['58px','100%']],
  media:[['13px','32%'],['94px','100%'],['11px','58%']],
  timeline:[['13px','30%'],['11px','100%'],['11px','96%'],['11px','88%']],
  banner:[['12px','86%']], tabs:[['31px','100%']], save:[['32px','100%']], beta:[['13px','40%'],['11px','92%']],
  vis:[['13px','36%'],['11px','100%'],['11px','100%'],['11px','100%'],['11px','92%']],
  pub:[['13px','34%'],['52px','100%'],['52px','100%'],['52px','92%']],
};
const EMPTY: Record<string, EmptyDef> = {
  ai:          ['icon-sparkles','No AI skills enabled','Skills stay off until an owner turns them on. Each one previews its change and needs a click to apply — nothing writes on its own.','Enable a skill'],
  analytics:   ['icon-chart-column','No sessions in this range','Analytics reads from GA4 and the orders table. Pick a wider range, or check that the GA4 measurement ID is still set in Marketing settings.','Change date range'],
  operations:  ['icon-network','Floor is quiet','Nothing to pack, dispatch or recount right now. The queue fills the moment an order is confirmed.','Open Orders'],
  finance:     ['icon-chart-no-axes-combined','No transactions this month','Revenue, khoroch and settlements appear here as orders are paid and the daily closing is locked.','Open Daily Closing'],
  pl:          ['icon-trending-up','No closed month yet','A profit and loss statement needs at least one locked daily closing. Lock 28 Jul to see July take shape.','Lock today'],
  integrations:['icon-plug','Nothing connected yet','SPLARO needs at least a courier and one payment rail before the storefront can take real orders. Start with Steadfast and bKash.','Connect Steadfast'],
  telegram:    ['icon-send','Bot is not linked','Create a bot with @BotFather, paste the token in Notifications settings, then message the bot once from your own account.','Link the bot'],
  apihealth:   ['icon-activity','No probe data yet','The health probe runs every 15 seconds once the worker is up. If this stays empty, PM2 is not running the worker process.','Run a probe'],
  security:    ['icon-shield','Audit log is empty','Every admin action is recorded here — logins, settings changes, refunds. An empty log means this is a fresh install.','Review policies'],
  homepage:    ['icon-house','Home page is not built','The storefront is serving an empty layout. Add a hero, one product rail and a category row to have something worth publishing.','Add hero section'],
  hero:        ['icon-sliders-horizontal','No slides yet','The hero area collapses when there are no slides, so the storefront opens straight into the product rails.','Add first slide'],
  menu:        ['icon-menu','No menu rows','Without navigation the storefront only works through search and direct links. Add New In, Abaya and Saree to start.','Add menu row'],
  returns:     ['icon-rotate-ccw','No return requests','Nothing has come back this month. When a customer asks for an exchange, the RMA lands here with the order and reason attached.','Create an RMA'],
  reviews:     ['icon-message-square-quote','Moderation queue is clear','Every review has been actioned. New ones appear here within a minute of being submitted.','Invite reviews'],
  collections: ['icon-layers','No collections yet','Collections group products for the storefront menu and campaigns. Start with one manual collection and one rule-based collection.','New collection'],
  categories:  ['icon-folder-tree','No categories yet','Categories drive the storefront menu, search facets and product URLs. Build the top level first, then one level of children.','New category'],
  inventory:   ['icon-archive','No stock movements today','Nothing received, reserved or written off since midnight. Counts here update the moment a parcel is packed.','Start a stock count'],
  campaigns:   ['icon-megaphone','No campaigns running','A campaign ties a Telegram broadcast, ad set and coupon to one revenue number so you can tell what actually worked.','New campaign'],
  coupons:     ['icon-tag','No coupons live','Discount codes appear here with their cap, expiry and the revenue they brought in.','New coupon'],
  media:       ['icon-image','Media library is empty','Drop product photos here and they upload to R2, convert to WebP and generate four sizes automatically.','Upload files'],
  exports:     ['icon-download','No exports yet','Ask for an orders, customer or hisab export and the file appears here for 30 days.','New export'],
  staff:       ['icon-user-cog','Only you have access','Invite a manager to run orders and catalog, or a packer who only ever sees the Packing Station.','Invite admin'],
  automation:  ['icon-zap','No rules defined','Rules do the boring part — confirming prepaid orders, booking couriers, releasing stock from dead carts.','New rule'],
  seo:         ['icon-globe','No crawl data yet','The crawler runs at 06:00 daily. Run it once now to get a baseline score for all 231 pages.','Run a crawl'],
  legal:       ['icon-scale','No legal pages published','Terms, privacy and refund policy are required before the storefront can take real payments.','Create Terms page'],
};
const NOTIFS: NotifTuple[] = [
  ['SPL-1042 needs confirming', 'Nusrat Jahan · ৳12,400 · bKash paid', '22m', 'icon-shopping-bag', 'vio', 'SPL-1042'],
  ['2 parcels breached 24h in Packed', 'SPL-1038 and SPL-1040 are not booked yet', '40m', 'icon-triangle-alert', 'warn', 'courier'],
  ['Jamdani Weave Saree at 3 units', 'below the reorder point of 8', '1h', 'icon-package', 'warn', 'inventory'],
  ['Nagad is failing', 'invalid merchant signature since 02 Jul', '2h', 'icon-x', 'bad', 'integrations'],
  ['Partner withdrawal approved', 'Sumaiya Khan · ৳40,000 over bKash', '3h', 'icon-banknote', 'ok', 'partners'],
  ['7 reviews waiting on moderation', 'oldest has been waiting 2 days', '5h', 'icon-message-square-quote', 'info', 'reviews'],
  ['Google Sheets backup pushed', 'daily closing for 27 Jul written', '6h', 'icon-table', 'ok', 'exports'],
  ['RMA-0219 opened', 'Farhana Akter · size too small · ৳18,600', 'Yesterday', 'icon-rotate-ccw', 'info', 'returns'],
  ['Daily closing for 26 Jul locked', 'by Rifat Hasan · ৳400 cash short', 'Yesterday', 'icon-calendar-check', 'mute', 'dailyclose'],
];
const FLEX = { full:['1 1 100%','100%'], main:['1 1 56%','340px'], side:['1 1 28%','290px'], half:['1 1 44%','320px'] };

/* ============ CONTENT MODULE ============ */
const CN: DcTabItem[] = [['homepage','Home Page'],['hero','Hero Slider'],['menu','Menu Control'],['legal','Legal Pages'],
  ['footwear','Footwear · beta'],['theme','Theme · beta'],['lookbooks','Lookbooks · beta'],['reels','Reels · beta'],
  ['blog','Blog · beta'],['cms','CMS · beta'],['landing','Landing · beta']];
const subnav = () => B.tabs('nav', CN);
const HOME_TABS: DcTabItem[] = [['brand','Brand & logo'],['contact','Location & contact'],['menu','Menu'],['catalog','Catalog'],
  ['filters','Shop filters'],['footer','Footer'],['homepage','Homepage'],['marquee','Marquee'],['offers','Offers'],
  ['ourStory','Our Story'],['newsletter','Newsletter'],['shipping','Shipping & pay'],['smtp','SMTP & email']];

const menuBlocks = (): DcBlock[] => [
  B.vis('Header links', 'Each row is one link in the storefront header. Hide takes effect immediately — no publish step. Arrows set the order the storefront reads.', [
    { id:'hl-new',    label:'New In',  sub:'/collections/new-in', on:true },
    { id:'hl-abaya',  label:'Abaya',   sub:'/abaya · opens the mega menu', on:true },
    { id:'hl-saree',  label:'Saree',   sub:'/saree', on:true },
    { id:'hl-kaftan', label:'Kaftan',  sub:'/kaftan', on:true },
    { id:'hl-sale',   label:'Sale',    sub:'/collections/sale · highlighted in red', on:true },
    { id:'hl-stores', label:'Stores',  sub:'/pages/stores · page is still a draft', on:false },
  ], 'main', 'header-links', 'Add header link'),
  B.vis('Mega menu behaviour', '', [
    { id:'mm-sync', label:'Auto-sync categories from Catalog', sub:'new categories arrive as Visible; anything you hid stays hidden', on:true, badgeOn:'ON', badgeOff:'OFF', btnOn:'Turn off', btnOff:'Turn on' },
    { id:'mm-hero', label:'Department hero card', sub:'image and copy beside the category list', on:true },
  ], 'side'),
  B.vis('Mega menu · Abaya department', 'Departments come from Categories. Force visible keeps a department in the menu even when it has no products.', [
    { id:'dep-abaya',     label:'Abaya department', sub:'shown in the header mega menu', on:true, badgeOn:'FORCE VISIBLE', badgeOff:'HIDDEN', btnOn:'Hide department', btnOff:'Force visible' },
    { id:'cat-signature', label:'Signature', sub:'/abaya/signature · 18 products', on:true },
    { id:'cat-everyday',  label:'Everyday',  sub:'/abaya/everyday · 24 products', on:true },
    { id:'cat-occasion',  label:'Occasion',  sub:'/abaya/occasion · 9 products', on:false, note:'no sales in 30 days' },
    { id:'cat-plus',      label:'Plus sizes',sub:'/abaya/plus · 6 products', on:false },
  ], 'main', 'mega-abaya'),
  B.media('Department hero image', 'Abaya mega menu · 640×420', ['Abaya dept hero'], '190px', 'side'),
  B.vis('Mega menu · Saree department', 'Hidden categories stay reachable by direct link — they only leave the menu.', [
    { id:'dep-saree',   label:'Saree department', sub:'shown in the header mega menu', on:true, badgeOn:'FORCE VISIBLE', badgeOff:'HIDDEN', btnOn:'Hide department', btnOff:'Force visible' },
    { id:'cat-jamdani', label:'Jamdani',  sub:'/saree/jamdani · 12 products', on:true },
    { id:'cat-tangail', label:'Tangail',  sub:'/saree/tangail · 8 products', on:true },
    { id:'cat-silk',    label:'Silk',     sub:'/saree/silk · 4 products', on:true },
    { id:'cat-bridal',  label:'Bridal',   sub:'/saree/bridal · 0 products', on:false, note:'empty category' },
  ], 'main', 'mega-saree'),
  B.save('menu', 'Visibility and order are already live. Labels and URLs need an explicit save.'),
];

const footerBlocks = (): DcBlock[] => [
  B.vis('Footer link groups', 'Hide a whole group or a single link. An empty group disappears from the storefront automatically.', [
    { id:'fg-about', label:'Column 1 · About',  sub:'Our Story · Stores · Careers', on:true },
    { id:'fg-help',  label:'Column 2 · Help',   sub:'Delivery · Exchange · Size guide · Contact', on:true },
    { id:'fg-legal', label:'Column 3 · Legal',  sub:'Terms · Privacy · Refund policy', on:true },
    { id:'fg-social',label:'Social row',        sub:'Instagram · Facebook · TikTok', on:true },
    { id:'fg-press', label:'Column 4 · Press',  sub:'no links added yet', on:false, note:'empty group' },
  ], 'main', null, 'Add footer group'),
  B.form('Footer copy', [
    { label:'Tagline', value:'SPLARO — luxury womenswear, made in Bangladesh.', hint:'Leave this empty to hide the tagline line entirely.' },
    { label:'Copyright', value:'© 2026 SPLARO. All rights reserved.' },
  ], 'side', 'footer'),
  B.save('footer'),
];

const TAB_BLOCKS: Record<string, () => DcBlock[]> = {
  brand: () => [
    B.form('Store identity', [
      { label:'Store name', value:'SPLARO' },
      { label:'Logo URL · header and footer', value:'/images/logo/splaro-logo-black-premium.webp', mono:true },
      { label:'Store image · share cards', value:'/images/brand/splaro-og-1200x630.webp', mono:true },
      { label:'Footer tagline', value:'SPLARO — luxury womenswear, made in Bangladesh.', hint:'Empty tagline hides the line — that is the only way to remove it.' },
    ], 'main', 'brand'),
    B.media('Logo and store image', 'transparent PNG or WebP', ['Logo · dark bg', 'Logo · light bg', 'Store share image'], '170px', 'side'),
    B.vis('Footer elements', '', [
      { id:'fe-tagline', label:'Tagline line', sub:'reads from the field above', on:true },
      { id:'fe-copy',    label:'Copyright line', sub:'© 2026 SPLARO', on:true },
      { id:'fe-social',  label:'Social icon row', sub:'Instagram · Facebook · TikTok', on:true },
      { id:'fe-payment', label:'Payment badge strip', sub:'bKash · Nagad · Visa · Mastercard', on:false },
    ], 'side'),
    B.save('brand'),
  ],
  contact: () => [
    B.form('Location and contact', [
      { label:'Address', value:'House 42, Road 11, Banani, Dhaka 1213', area:true },
      { label:'Support phone', value:'+880 1711-000111', mono:true },
      { label:'Support email', value:'care@splaro.co', mono:true },
      { label:'WhatsApp number', value:'+880 1711-000111', mono:true, hint:'Used by the floating WhatsApp button on mobile.' },
    ], 'main', 'contact'),
    B.form('Social URLs', [
      { label:'Instagram', value:'instagram.com/splaro.co', mono:true },
      { label:'Facebook', value:'facebook.com/splaro.co', mono:true },
      { label:'TikTok', value:'tiktok.com/@splaro.co', mono:true },
      { label:'YouTube', value:'not set', mono:true, hint:'Empty social URLs are hidden from the footer automatically.' },
    ], 'side', 'contact'),
    B.save('contact'),
  ],
  menu: menuBlocks,
  catalog: () => [
    B.vis('Catalog channel visibility', 'This hides a category from every listing, menu and search facet at once. Products stay reachable by direct link.', [
      { id:'cc-abaya', label:'Abaya', sub:'42 products · 0 hidden', on:true },
      { id:'cc-kaftan', label:'Kaftan', sub:'28 products · 1 hidden', on:true },
      { id:'cc-saree', label:'Saree', sub:'24 products · 0 hidden', on:true },
      { id:'cc-kurti', label:'Kurti', sub:'31 products · 2 hidden', on:true },
      { id:'cc-gown', label:'Gown', sub:'16 products · 0 hidden', on:false },
      { id:'cc-acc', label:'Accessories', sub:'19 products · 0 hidden', on:true },
      { id:'cc-winter', label:'Winter', sub:'9 products · seasonal', on:false, note:'opens 01 Oct' },
    ], 'main'),
    B.list('Hidden product count', 'per channel', [
      { icon:'icon-eye-off', color:'var(--ink-3)', title:'Kurti', sub:'2 products hidden individually', value:'2' },
      { icon:'icon-eye-off', color:'var(--ink-3)', title:'Kaftan', sub:'1 product hidden individually', value:'1' },
      { icon:'icon-eye-off', color:'var(--warn)', title:'Gown', sub:'whole channel hidden', value:'16' },
      { icon:'icon-eye-off', color:'var(--warn)', title:'Winter', sub:'whole channel hidden', value:'9' },
    ], 'side'),
  ],
  filters: () => [
    B.vis('Shop filters', 'Filters the customer sees on category and search pages.', [
      { id:'sf-price', label:'Price range', sub:'steps of ৳2,000 up to ৳40,000', on:true },
      { id:'sf-size', label:'Size', sub:'S · M · L · XL · one size', on:true },
      { id:'sf-colour', label:'Colour', sub:'reads variant swatches', on:true },
      { id:'sf-fabric', label:'Fabric', sub:'silk · cotton · linen · chiffon', on:true },
      { id:'sf-avail', label:'Availability', sub:'hides out-of-stock when on', on:false },
      { id:'sf-sort', label:'Sort control', sub:'newest · price · best selling', on:true },
    ], 'main'),
    B.form('Filter settings', [
      { label:'Price step', value:'৳2,000' },
      { label:'Max price shown', value:'৳40,000' },
    ], 'side', 'filters'),
    B.save('filters'),
  ],
  footer: footerBlocks,
  homepage: () => [
    B.vis('Homepage section visibility', 'These switches are live the moment you press them — there is no draft state. Nothing here needs a save.', [
      { id:'hp-hero', label:'Hero slider', sub:'3 slides · autoplay 6s', on:true },
      { id:'hp-marquee', label:'Marquee strip', sub:'4 items scrolling under the header', on:true },
      { id:'hp-trust', label:'Trust bar', sub:'delivery · exchange · made in Bangladesh', on:true },
      { id:'hp-catalog', label:'Catalog rails', sub:'New In and category tiles', on:true },
      { id:'hp-offer', label:'Special offer band', sub:'Eid Edit banner between rails', on:true },
      { id:'hp-story', label:'Our Story block', sub:'mirrors ourStory.enabled on the Our Story tab', on:true },
      { id:'hp-insta', label:'Instagram strip', sub:'toggle works, but the storefront does not render it yet', on:false, note:'not mounted on storefront yet' },
      { id:'hp-news', label:'Newsletter block', sub:'collects phone numbers, not emails', on:true },
    ], 'main'),
    B.list('What customers see now', 'live storefront order', [
      { icon:'icon-check', color:'var(--ok)', title:'Storefront is serving 6 sections', sub:'hero → marquee → trust → catalog → offer → story', value:'LIVE' },
      { icon:'icon-eye-off', color:'var(--ink-3)', title:'Instagram strip hidden', sub:'component not built yet — honest off', value:'HIDDEN' },
      { icon:'icon-external-link', color:'var(--info)', title:'Preview splaro.co', sub:'opens the live page in a new tab', value:'OPEN' },
    ], 'side'),
  ],
  marquee: () => [
    B.vis('Marquee', 'The strip disappears from the storefront when every item is hidden.', [
      { id:'mq-on', label:'Marquee enabled', sub:'homepage.marquee', on:true, badgeOn:'ENABLED', badgeOff:'DISABLED', btnOn:'Disable', btnOff:'Enable' },
      { id:'mq-1', label:'Free delivery over ৳5,000', sub:'item 1', on:true },
      { id:'mq-2', label:'7-day exchange', sub:'item 2', on:true },
      { id:'mq-3', label:'Made in Bangladesh', sub:'item 3', on:true },
      { id:'mq-4', label:'Eid Edit — last few pieces', sub:'item 4 · ends 04 Aug', on:true },
      { id:'mq-5', label:'Winter preview coming', sub:'item 5 · not for now', on:false },
    ], 'main', null, 'Add marquee item'),
    B.save('marquee'),
  ],
  offers: () => [
    B.vis('Special offer band', '', [
      { id:'of-on', label:'Special offer enabled', sub:'homepage.specialOffer', on:true, badgeOn:'ENABLED', badgeOff:'DISABLED', btnOn:'Disable', btnOff:'Enable' },
      { id:'of-count', label:'Countdown timer', sub:'counts to the end date below', on:true },
    ], 'side'),
    B.form('Offer template', [
      { label:'Eyebrow', value:'LIMITED' },
      { label:'Headline', value:'The Eid Edit — last few pieces' },
      { label:'Body', value:'Hand-finished abaya and kaftan, cut in our own studio. Free delivery over ৳5,000.', area:true },
      { label:'Button', value:'Shop the Edit → /collections/eid-edit', mono:true },
      { label:'Ends', value:'04 Aug 2026, 23:59' },
    ], 'main', 'offers'),
    B.save('offers'),
  ],
  ourStory: () => [
    B.vis('Section', 'Turning this off hides the Our Story block on the homepage as well — the two flags are the same field.', [
      { id:'hp-story', label:'Our Story section', sub:'ourStory.enabled ↔ homepage.ourStory', on:true, badgeOn:'ENABLED', badgeOff:'DISABLED', btnOn:'Disable', btnOff:'Enable' },
    ], 'side'),
    B.form('Story copy', [
      { label:'Eyebrow', value:'SINCE 2024' },
      { label:'Title', value:'Cut, stitched and finished in Dhaka' },
      { label:'Body', value:'SPLARO started with four tailors in Banani and one rule — nothing leaves the studio unless it fits properly. Every piece is still cut and finished by the same team.', area:true },
      { label:'Quote', value:'"Amader kaj holo kapor noy, fit bikri kora." — Rifat Hasan, founder', area:true },
    ], 'main', 'ourStory'),
    B.vis('Story deck cards', 'Each card can be hidden without deleting it. Copy and CTA are edited per card.', [
      { id:'sd-1', label:'The studio', sub:'icon: scissors · CTA: /pages/studio', on:true },
      { id:'sd-2', label:'Our tailors', sub:'icon: users · CTA: /pages/team', on:true },
      { id:'sd-3', label:'Fabric sourcing', sub:'icon: package · CTA: /pages/fabric', on:true },
      { id:'sd-4', label:'Sizing promise', sub:'icon: ruler · CTA: /pages/size-guide', on:false, note:'copy not final' },
    ], 'main', null, 'Add story card'),
    B.vis('Pillars', '', [
      { id:'pl-1', label:'Hand-finished', sub:'every seam checked twice', on:true },
      { id:'pl-2', label:'Made in Bangladesh', sub:'own studio, no middleman', on:true },
      { id:'pl-3', label:'Honest sizing', sub:'measured, not guessed', on:true },
      { id:'pl-4', label:'7-day exchange', sub:'no questions asked', on:true },
    ], 'side', null, 'Add pillar'),
    B.vis('Verified customer stories', 'Only reviews that match a delivered order can appear here.', [
      { id:'cs-on', label:'Customer stories block', sub:'customerStories.enabled', on:true, badgeOn:'ENABLED', badgeOff:'DISABLED', btnOn:'Disable', btnOff:'Enable' },
      { id:'cs-1', label:'Nusrat Jahan · 5★', sub:'verified buyer · SPL-1042', on:true },
      { id:'cs-2', label:'Sadia Islam · 4★', sub:'verified buyer · SPL-1040', on:true },
      { id:'cs-3', label:'Farhana Akter · 5★', sub:'verified buyer · SPL-1036', on:false },
    ], 'main'),
    B.save('ourStory'),
  ],
  newsletter: () => [
    B.vis('Newsletter block', '', [
      { id:'nl-on', label:'Newsletter enabled', sub:'homepage.newsletter', on:true, badgeOn:'ENABLED', badgeOff:'DISABLED', btnOn:'Disable', btnOff:'Enable' },
      { id:'nl-wa', label:'Ask for WhatsApp consent', sub:'extra checkbox under the field', on:true },
    ], 'side'),
    B.form('Newsletter copy', [
      { label:'Title', value:'Get first access to new drops' },
      { label:'Body', value:'One message per drop. Phone number only — we do not send email.', area:true },
      { label:'Button', value:'Notify me' },
      { label:'Success message', value:'Thank you — you will hear from us before the next drop.' },
    ], 'main', 'newsletter'),
    B.save('newsletter'),
  ],
  shipping: () => [
    B.banner('info', 'icon-info', 'These same fields live in Settings → Shipping and Payments. Changing them here changes them there — one source of truth, same Hide / Show language.'),
    B.toggles('Payment rails', [
      { label:'Cash on delivery', sub:'available nationwide', on:true },
      { label:'bKash', sub:'merchant · 01711-000111', on:true },
      { label:'Nagad', sub:'credentials not verified yet', on:false },
      { label:'SSLCommerz', sub:'live store ID · splaro_live', on:true },
    ], 'main'),
    B.form('Delivery charges', [
      { label:'Inside Dhaka', value:'৳70', mono:true },
      { label:'Outside Dhaka', value:'৳130', mono:true },
      { label:'Free delivery over', value:'৳5,000', mono:true, hint:'Set to 0 to switch free delivery off completely.' },
    ], 'side', 'shipping'),
    B.save('shipping'),
  ],
  smtp: () => [
    B.banner('warn', 'icon-triangle-alert', 'SMTP is shared with Settings → Notifications. A wrong host here silently stops order emails — the storefront will not warn the customer.'),
    B.form('SMTP', [
      { label:'Host and port', value:'smtp.zoho.com:587', mono:true },
      { label:'Username', value:'care@splaro.co', mono:true },
      { label:'Password', value:'••••••••••••••••', mono:true },
      { label:'From name', value:'SPLARO' },
    ], 'main', 'smtp'),
    B.vis('Transactional email', '', [
      { id:'em-order', label:'Order confirmation email', sub:'sent on payment captured', on:true },
      { id:'em-ship', label:'Shipped email', sub:'includes the consignment number', on:true },
      { id:'em-review', label:'Review request', sub:'3 days after delivery', on:false },
    ], 'side'),
    B.save('smtp'),
  ],
};

Object.assign(SCREENS, <Record<string, ScreenDef>>{
  homepage: (s: ScreenCtx) => [subnav(), B.tabs('home', HOME_TABS)].concat((TAB_BLOCKS[s.tab['home'] ?? ''] ?? TAB_BLOCKS['ourStory']!)()),
  menu:     (s: ScreenCtx) => [subnav(), B.tabs('menu', HOME_TABS)].concat((TAB_BLOCKS[s.tab['menu'] ?? ''] ?? TAB_BLOCKS['menu']!)()),

  hero: () => [
    subnav(),
    B.banner('info', 'icon-info', 'Order is the list order — there is no drag-and-drop yet, so do not promise it to the team.'),
    B.pub('Hero banners', [
      { id:'hb-1', title:'The Eid Edit — hand-finished in Dhaka', sub:'headline + Shop the Edit button · all devices', url:'/collections/eid-edit', thumb:true, on:true },
      { id:'hb-2', title:'New In this week', sub:'headline only · all devices', url:'/collections/new-in', thumb:true, on:true },
      { id:'hb-3', title:'Free delivery over ৳5,000', sub:'offer strip style · mobile only', url:'/pages/delivery', thumb:true, on:true },
      { id:'hb-4', title:'Winter Preview', sub:'waiting on final photography', url:'/collections/winter', thumb:true, on:false },
      { id:'hb-5', title:'Ramadan 2026', sub:'last season, kept for reference', url:'/collections/ramadan-2026', thumb:true, on:false },
    ], 'full', 'Add hero banner'),
    B.list('Where these come from', '', [
      { icon:'icon-image', color:'var(--violet)', title:'Media Library', sub:'upload the image there, then pick it here', value:'OPEN' },
      { icon:'icon-external-link', color:'var(--info)', title:'Live site preview', sub:'splaro.co with this order applied', value:'OPEN' },
      { icon:'icon-download', color:'var(--ink-2)', title:'Import default banners', sub:'restores the three shipped slides', value:'3' },
    ], 'half'),
    B.vis('Carousel behaviour', '', [
      { id:'hs-auto', label:'Autoplay', sub:'6 seconds per slide', on:true, badgeOn:'ON', badgeOff:'OFF', btnOn:'Turn off', btnOff:'Turn on' },
      { id:'hs-dots', label:'Dot indicators', sub:'shown under the hero on mobile', on:true, badgeOn:'ON', badgeOff:'OFF', btnOn:'Turn off', btnOff:'Turn on' },
    ], 'half'),
  ],

  legal: () => [
    subnav(),
    B.list('Legal pages', 'always editable · no publish flag', [
      { icon:'icon-scale', color:'var(--violet)', title:'Terms of service', sub:'updated 12 Jul by Rifat Hasan', value:'EDITING' },
      { icon:'icon-shield', color:'var(--ink-2)', title:'Privacy policy', sub:'updated 12 Jul', value:'OPEN' },
      { icon:'icon-truck', color:'var(--ink-2)', title:'Shipping policy', sub:'updated 02 Jun', value:'OPEN' },
      { icon:'icon-rotate-ccw', color:'var(--ink-2)', title:'Returns and refunds', sub:'updated 02 Jun', value:'OPEN' },
      { icon:'icon-file-text', color:'var(--ink-2)', title:'Exchange policy', sub:'never edited', value:'OPEN' },
    ], 'side'),
    B.form('Terms of service', [
      { label:'Page title', value:'Terms of service' },
      { label:'Meta description', value:'The terms that govern orders, exchanges and delivery for splaro.co customers.', area:true },
      { label:'URL', value:'/pages/terms', mono:true },
    ], 'main', 'legal'),
    B.vis('Sections', 'Reorder with the arrows. Remove takes the section out of the page — the text is kept in history for 30 days.', [
      { id:'ls-1', label:'1 · Orders and acceptance', sub:'when an order becomes binding', on:true, badgeOn:'SECTION', badgeOff:'SECTION', btnOn:'Remove', btnOff:'Remove' },
      { id:'ls-2', label:'2 · Prices and payment', sub:'BDT, COD limits, prepayment', on:true, badgeOn:'SECTION', badgeOff:'SECTION', btnOn:'Remove', btnOff:'Remove' },
      { id:'ls-3', label:'3 · Delivery', sub:'zones, timelines, failed delivery', on:true, badgeOn:'SECTION', badgeOff:'SECTION', btnOn:'Remove', btnOff:'Remove' },
      { id:'ls-4', label:'4 · Exchange and return', sub:'7-day window, exclusions', on:true, badgeOn:'SECTION', badgeOff:'SECTION', btnOn:'Remove', btnOff:'Remove' },
      { id:'ls-5', label:'5 · Contact', sub:'support hours and channels', on:true, badgeOn:'SECTION', badgeOff:'SECTION', btnOn:'Remove', btnOff:'Remove' },
    ], 'main', 'legal-sections', 'Add section'),
    B.save('legal', 'No unsaved changes. Reset to defaults and Preview are available while editing.'),
  ],

  media: () => [
    B.tabs('media', [['all','All assets','2,418'],['video','Video library · beta','18'],['ugc','UGC gallery · beta','64']]),
    B.banner('info', 'icon-info', 'Library uploads stay inactive until something uses them — a fresh upload will not appear on the storefront on its own.'),
    B.hero('Assets in R2', '2,418', '+184 this week', 'ok', 'splaro-media-prod · 18.6 GB of 30 GB used',
      [ K('Storage used','62%','18.6 GB of 30 GB','var(--warn)'), K('Uploaded · 7d','184','Eid Edit shoot'), K('Missing alt text','36','hurts SEO','var(--bad)') ]),
    B.media('Recent uploads', 'Eid Edit shoot · 24 Jul', ['abaya-noor-front.webp','abaya-noor-back.webp','kaftan-meherjaan-01.webp','saree-jamdani-detail.webp','clutch-zohra-ivory.webp','model-eid-editorial.webp','Drop files here'], '150px', 'main'),
    B.list('Asset lifecycle', 'no section toggles here', [
      { icon:'icon-upload', color:'var(--violet)', title:'Upload as hero banner', sub:'goes straight into the Hero Slider list', value:'PICK' },
      { icon:'icon-image', color:'var(--info)', title:'Upload to library', sub:'inactive until a page uses it', value:'PICK' },
      { icon:'icon-trash-2', color:'var(--warn)', title:'Orphan files', sub:'not referenced by any product or page', value:'212' },
      { icon:'icon-server', color:'var(--ok)', title:'Auto WebP + 4 sizes', sub:'320 / 640 / 1080 / 1920', value:'ON' },
    ], 'side'),
  ],

  footwear: () => [
    subnav(),
    B.vis('Page sections', '', [
      { id:'fw-hero', label:'Hero banner', sub:'heroBanner.visible', on:true },
      { id:'fw-cat', label:'Shop by category', sub:'shopByCategory.visible', on:true },
      { id:'fw-rows', label:'Product rows', sub:'3 rows configured', on:true },
    ], 'main'),
    B.vis('Categories', '', [
      { id:'fw-c1', label:'Sandals', sub:'12 products', on:true },
      { id:'fw-c2', label:'Heels', sub:'8 products', on:true },
      { id:'fw-c3', label:'Flats', sub:'6 products', on:false },
      { id:'fw-c4', label:'Khussa', sub:'4 products', on:true },
    ], 'side'),
    B.vis('Product rows', '', [
      { id:'fw-r1', label:'Row 1 · New arrivals', sub:'productRows[0].visible', on:true },
      { id:'fw-r2', label:'Row 2 · Under ৳3,000', sub:'productRows[1].visible', on:true },
      { id:'fw-r3', label:'Row 3 · Bridal khussa', sub:'productRows[2].visible', on:false },
    ], 'main'),
    B.save('footwear', 'Section visibility is already live. Headlines and copy need a save. Preview opens /footwear.'),
  ],

  theme: () => [
    subnav(),
    B.banner('ok', 'icon-check', 'Theme = storefront branding. Logo, favicon and footer copy save via Settings API — not a CSS theme canvas.'),
    B.table('Brand and theme tokens', 'branding panel', ['Token','Value','Source'], [
      [{ v:'Primary' }, { m:'#' + '712eff' }, { v:'tailwind.config.ts' }],
      [{ v:'Ink · light' }, { m:'#' + '0a0a0a' }, { v:'tailwind.config.ts' }],
      [{ v:'Ink · dark' }, { m:'#' + 'f4f4f6' }, { v:'tailwind.config.ts' }],
      [{ v:'Body font' }, { m:'Inter' }, { v:'next/font' }],
      [{ v:'Bangla font' }, { m:'Noto Sans Bengali' }, { v:'next/font' }],
      [{ v:'Store name' }, { v:'SPLARO' }, { v:'Settings → Branding' }],
      [{ v:'Support phone' }, { m:'+880 1711-000111' }, { v:'Settings → Contact' }],
    ], 'main'),
    B.list('Where to edit', '', [
      { icon:'icon-palette', color:'var(--violet)', title:'Theme tab', sub:'logo, favicon, footer copy', value:'LIVE' },
      { icon:'icon-settings', color:'var(--info)', title:'Full settings', sub:'branding section is the same fields', value:'OPEN' },
    ], 'side'),
  ],

  lookbooks: () => [
    subnav(),
    B.banner('ok', 'icon-check', 'Lookbooks are product collections — create/edit/toggle here; assign products in Collections.'),
    B.pub('Lookbooks', [
      { id:'lb-1', title:'The Eid Edit', sub:'42 products · from collection isActive', thumb:true, on:true, editLabel:'Edit' },
      { id:'lb-2', title:'Heritage Saree', sub:'24 products', thumb:true, on:true, editLabel:'Edit' },
      { id:'lb-3', title:'Everyday Cotton', sub:'31 products', thumb:true, on:true, editLabel:'Edit' },
      { id:'lb-4', title:'Winter Preview', sub:'9 products · collection is a draft', thumb:true, on:false, editLabel:'Edit' },
    ], 'full', 'New lookbook', ['ok', 'Creates a collection', 'Saved via Collections API after verify.']),
  ],

  reels: () => [
    subnav(),
    B.banner('ok', 'icon-check', 'Reels are banners with position=reels. Upload media, then save — green only after the banners API confirms.'),
    B.pub('Reels', [
      { id:'rl-1', title:'Eid Edit studio cut', sub:'18s · 1080×1920 · 4.2 MB', thumb:true, on:true, editLabel:'Details' },
      { id:'rl-2', title:'Jamdani weaving', sub:'24s · 1080×1920 · 6.1 MB', thumb:true, on:true, editLabel:'Details' },
      { id:'rl-3', title:'Behind the fitting', sub:'12s · 1080×1920 · 2.8 MB', thumb:true, on:false, editLabel:'Details' },
    ], 'full', 'Add reel', ['ok', 'Upload then save', 'position=reels on the banners API.']),
  ],

  blog: () => [
    subnav(),
    B.banner('ok', 'icon-check', 'Blog CRUD against /admin/content/blog — draft, publish, delete.'),
    B.tabs('blog', [['all','All','12'],['pub','Published','7'],['draft','Draft','4'],['sched','Scheduled','1']]),
    B.pub('Posts', [
      { id:'bp-1', title:'How to measure yourself for an abaya', sub:'published 18 Jul · 1,240 reads', url:'/blog/measure-abaya', on:true, badgeOn:'PUBLISHED', badgeOff:'DRAFT', btnOff:'Unpublish', btnOn:'Publish' },
      { id:'bp-2', title:'Jamdani, explained', sub:'published 02 Jul · 860 reads', url:'/blog/jamdani-explained', on:true, badgeOn:'PUBLISHED', badgeOff:'DRAFT', btnOff:'Unpublish', btnOn:'Publish' },
      { id:'bp-3', title:'Caring for silk in Dhaka humidity', sub:'draft · started 22 Jul', url:'/blog/silk-care', on:false, badgeOn:'PUBLISHED', badgeOff:'DRAFT', btnOff:'Unpublish', btnOn:'Publish' },
      { id:'bp-4', title:'Eid drop 2026 · behind the scenes', sub:'scheduled for 01 Aug 09:00', url:'/blog/eid-2026-bts', on:false, badgeOn:'PUBLISHED', badgeOff:'SCHEDULED', btnOff:'Publish now', btnOn:'Publish' },
    ], 'full', 'New post', ['ok', 'Created as Draft', 'Nothing is public until you press Publish.']),
  ],

  cms: () => [
    subnav(),
    B.banner('ok', 'icon-check', 'CMS site pages (legal excluded) — create, edit, publish, delete via content pages API.'),
    B.pub('All pages', [
      { id:'cm-1', title:'Campaign FAQ', sub:'site page · CMS', url:'/pages/campaign-faq', on:true, badgeOn:'LIVE', badgeOff:'DRAFT', btnOff:'Unpublish', btnOn:'Publish' },
      { id:'cm-2', title:'Size tips', sub:'site page · CMS', url:'/pages/size-tips', on:true, badgeOn:'LIVE', badgeOff:'DRAFT', btnOff:'Unpublish', btnOn:'Publish' },
      { id:'cm-3', title:'Delivery information', sub:'draft, not in sitemap', url:'/pages/delivery', on:false, badgeOn:'LIVE', badgeOff:'DRAFT', btnOff:'Unpublish', btnOn:'Publish' },
    ], 'full', 'New page', ['ok', 'Starts as draft', 'Publish when ready. Legal stays under Legal Pages.']),
  ],

  landing: () => [
    subnav(),
    B.banner('ok', 'icon-check', 'Campaign landing pages at /lp/{slug}. CRUD via content pages API — publish when ready.'),
    B.pub('Landing pages', [
      { id:'lp-1', title:'Eid Edit · Meta ads', sub:'created 12 Jul · 4,820 visits', url:'/lp/eid-edit-2026', on:true },
      { id:'lp-2', title:'VIP early access', sub:'created 18 Jul · 46 invited', url:'/lp/vip-early-access', on:true },
      { id:'lp-3', title:'Winter preview waitlist', sub:'created 22 Jul · copy not final', url:'/lp/winter-waitlist', on:false },
      { id:'lp-4', title:'Ramadan 2026', sub:'last season · kept for reference', url:'/lp/ramadan-2026', on:false },
    ], 'full', 'New landing page', ['ok', 'Created unpublished', '/lp/untitled — rename it, then publish when the copy is ready.']),
    B.list('Row actions', '', [
      { icon:'icon-pencil', color:'var(--violet)', title:'Edit body / rename', sub:'plain body editor, no WYSIWYG', value:'OPEN' },
      { icon:'icon-copy', color:'var(--info)', title:'Copy URL', sub:'splaro.co/lp/{slug}', value:'COPY' },
      { icon:'icon-trash-2', color:'var(--bad)', title:'Delete', sub:'removed immediately, no recycle bin', value:'CARE' },
    ], 'half'),
  ],
});

Object.assign(CONTENT_PAGES, <Record<string, PageMeta>>{
  homepage: { title:'Home Page', group:'Content', status:'live', sync:'published 2h ago',
    actions:[{label:'Preview',icon:'icon-external-link',kind:'ghost'},{label:'Publish',icon:'icon-check',kind:'primary'}] },
  menu:     { title:'Menu Control', group:'Content', status:'live', sync:'menu cache 60s',
    actions:[{label:'Preview',icon:'icon-external-link',kind:'ghost'},{label:'Publish',icon:'icon-check',kind:'primary'}] },
  hero:     { title:'Hero Slider', group:'Content', status:'live', sync:'3 live slides',
    actions:[{label:'Media Library',icon:'icon-image',kind:'ghost'},{label:'Add hero banner',icon:'icon-plus',kind:'primary'}] },
  legal:    { title:'Legal Pages', group:'Content', status:'live', sync:'updated 12 Jul',
    actions:[{label:'Reset to defaults',icon:'icon-rotate-ccw',kind:'ghost'},{label:'Preview',icon:'icon-external-link',kind:'ghost'}] },
  media:    { title:'Media Library', group:'Content', status:'live', sync:'R2 synced',
    actions:[{label:'Upload',icon:'icon-upload',kind:'primary'}] },
  footwear: { title:'Footwear Page', group:'Content · hidden nav', status:'beta', sync:'/dashboard/footwear-page', back:'homepage',
    actions:[{label:'Preview /footwear',icon:'icon-external-link',kind:'ghost'}] },
  theme:    { title:'Theme Builder', group:'Content · hidden nav', status:'beta', sync:'read-only', back:'homepage', actions:[] },
  lookbooks:{ title:'Lookbooks', group:'Content · hidden nav', status:'beta', sync:'from collections', back:'homepage', actions:[] },
  reels:    { title:'Reels', group:'Content · hidden nav', status:'beta', sync:'18 videos', back:'homepage', actions:[] },
  blog:     { title:'Blog', group:'Content · hidden nav', status:'beta', sync:'12 posts', back:'homepage', actions:[] },
  cms:      { title:'CMS', group:'Content · hidden nav', status:'beta', sync:'aggregate view', back:'homepage', actions:[] },
  landing:  { title:'Landing Pages', group:'Content · hidden nav', status:'beta', sync:'2 live', back:'homepage', actions:[] },
});



export { SCREENS, MODULE_PAGES, EMPTY, SKEL, NOTIFS, CONTENT_PAGES, CN, HOME_TABS }
