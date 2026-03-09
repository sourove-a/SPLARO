# Splaro Admin UI Pages

Complete admin dashboard pages for managing all core business operations.

## Pages Created

### 1. Categories Management
**File:** `/app/admin/categories/page.tsx`

Features:
- Create, read, update, delete categories
- Support for parent-child category relationships (subcategories)
- Auto-slug generation from category name
- Display order sorting
- Active/inactive toggle
- Product count per category
- Category image URLs
- Responsive modal form for editing

### 2. Inventory Management
**File:** `/app/admin/inventory/page.tsx`

Features:
- Stock movement logging (STOCK_IN, STOCK_OUT, ADJUSTMENT, RETURN, DAMAGE)
- Low stock alerts with threshold warnings
- Out of stock tracking
- Movement history table with before/after quantities
- Quick status badges for movement types
- Reason and reference tracking
- Date-based sorting

### 3. Reviews & Ratings
**File:** `/app/admin/reviews/page.tsx`

Features:
- Review approval workflow (PENDING, APPROVED, REJECTED, HIDDEN)
- Star rating display (1-5 stars)
- Featured review marking
- Filter by status
- Quick action buttons for status changes
- Product association display
- Customer information (name, email)
- Review date tracking

### 4. Returns & Requests
**File:** `/app/admin/returns/page.tsx`

Features:
- Return/Exchange/Cancellation request tracking
- Multi-status workflow (PENDING, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED)
- Filter by type and status
- Expandable detail cards
- Reason tracking
- Order association with total amount
- Customer details
- Refund management capabilities

### 5. Media Library
**File:** `/app/admin/media/page.tsx`

Features:
- Image/document/video upload
- File preview (images shown as thumbnails)
- File metadata (size, type, upload date)
- Copy URL to clipboard
- Delete functionality
- Filter by media type
- File size formatting
- Responsive grid layout

### 6. Content Pages
**File:** `/app/admin/content/page.tsx`

Features:
- Create static pages (about, terms, privacy, etc.)
- Markdown content support
- SEO meta description
- Published/unpublished toggle
- Featured page marking
- Full CRUD operations
- Slug-based URL routing
- Creation and update timestamps

## Technical Stack

- **Framework:** Next.js 13+ (App Router)
- **Styling:** Tailwind CSS with custom color scheme
- **Icons:** lucide-react
- **State Management:** React hooks (useState, useCallback, useEffect)
- **Authentication:** Admin key via localStorage and x-admin-key header

## Common Features

All pages include:
- Loading states
- Error handling with user feedback
- Refresh buttons
- Filter/search capabilities
- CRUD operations
- Dark theme with white/opacity color scheme
- Responsive design
- Modal forms for editing
- Confirmation dialogs for destructive actions

## API Endpoints Required

### Categories
- GET `/api/admin/categories` - List all
- POST `/api/admin/categories` - Create
- PATCH `/api/admin/categories/:id` - Update
- DELETE `/api/admin/categories/:id` - Delete

### Inventory
- GET `/api/admin/inventory` - Get logs and stats
- POST `/api/admin/inventory` - Log movement

### Reviews
- GET `/api/admin/reviews` - List with filters
- PATCH `/api/admin/reviews/:id` - Update status
- DELETE `/api/admin/reviews/:id` - Delete

### Returns
- GET `/api/admin/returns` - List with filters
- PATCH `/api/admin/returns/:id` - Update status

### Media
- GET `/api/admin/media` - List files
- POST `/api/admin/media` - Upload file
- DELETE `/api/admin/media/:id` - Delete file

### Content
- GET `/api/admin/content` - List pages
- POST `/api/admin/content` - Create page
- PATCH `/api/admin/content/:id` - Update page
- DELETE `/api/admin/content/:id` - Delete page

## Authentication

All API calls require:
- Header: `x-admin-key` (retrieved from localStorage)
- Content-Type: `application/json` (for POST/PATCH requests)

## Directory Structure

```
app/admin/
├── categories/
│   └── page.tsx          (Category CRUD)
├── inventory/
│   └── page.tsx          (Stock management)
├── reviews/
│   └── page.tsx          (Review moderation)
├── returns/
│   └── page.tsx          (Return request handling)
├── media/
│   └── page.tsx          (Media library)
└── content/
    └── page.tsx          (Static page management)
```

## Usage Notes

1. Admin key is stored in localStorage under `splaro_admin_key`
2. All pages are client-side rendered with 'use client' directive
3. Modal forms prevent scrolling with fixed positioning
4. Confirmation dialogs prevent accidental deletions
5. Auto-slug generation simplifies URL slug input
6. All times use ISO date format for consistency
7. Icons from lucide-react for consistent UI

## Styling Guidelines

- Primary text: `text-white`
- Secondary text: `text-white/50` to `text-white/70`
- Background: `bg-white/7` to `bg-white/15`
- Borders: `border-white/12` to `border-white/28`
- Hover states: `hover:bg-white/10` and color transitions
- Success: Green colors (`text-emerald-400`, `bg-emerald-500/20`)
- Warning: Orange colors (`text-orange-400`, `bg-orange-500/20`)
- Error: Red colors (`text-red-400`, `bg-red-500/20`)
