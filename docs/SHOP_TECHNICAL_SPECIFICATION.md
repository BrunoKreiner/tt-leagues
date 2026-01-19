# Table Tennis Shop - Technical Specification Document

## Document Purpose

This document provides a comprehensive technical specification for implementing an online table tennis equipment shop integrated with the existing TT Leagues application. This specification is designed to be followed by an agentic development system to implement the complete shop functionality.

**Version:** 1.0  
**Date:** 2025-01-XX  
**Status:** Draft for Implementation

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [API Specification](#api-specification)
5. [Frontend Components](#frontend-components)
6. [Integration Points](#integration-points)
7. [Implementation Phases](#implementation-phases)
8. [Testing Requirements](#testing-requirements)
9. [Deployment Guide](#deployment-guide)
10. [Security Considerations](#security-considerations)

---

## 1. Overview

### 1.1 Project Scope

Build a complete e-commerce system for table tennis equipment (blades, rubbers) and services (gluing, boosting, personal recommendations) that:
- Integrates seamlessly with existing TT Leagues application
- Shares authentication system with TT Leagues
- Provides admin panel for inventory management
- Supports order tracking and fulfillment
- Handles Swiss market (CHF, VAT, shipping)

### 1.2 Technology Stack

**Backend:**
- Node.js + Express (existing)
- PostgreSQL (via Vercel Postgres)
- JWT authentication (existing)
- Vercel Serverless Functions

**Frontend:**
- React + Vite (existing)
- React Router (existing)
- Tailwind CSS (existing)
- shadcn/ui components (existing)
- React Hook Form + Zod validation (existing)
- i18next for translations (existing)

**Payment:**
- Stripe (recommended) or PayPal
- Swiss payment options (TWINT) - future consideration

**Deployment:**
- Vercel (frontend + backend)
- Vercel Postgres (database)

### 1.3 Key Features

1. **Product Catalog**
   - Blades (with variants: weight, handle type, etc.)
   - Rubbers (with variants: color, thickness, hardness)
   - Services (gluing, boosting, recommendations)

2. **Shopping Experience**
   - Product browsing with filters
   - Shopping cart
   - Checkout flow
   - Order tracking

3. **Admin Features**
   - Product management (CRUD)
   - Inventory management
   - Order management
   - Analytics dashboard

4. **User Features**
   - Order history
   - Order tracking
   - Saved addresses
   - Wishlist (optional)

---

## 2. Architecture

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Vercel)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Shop Pages  │  │  Cart/Checkout│  │  Order Track │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Admin Shop │  │  Product Mgmt │  │  Analytics   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            │
┌─────────────────────────────────────────────────────────────┐
│              Backend API (Vercel Serverless)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Shop Routes │  │  Order Routes│  │  Admin Routes│     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Auth Middle│  │  Validation   │  │  Payment     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SQL Queries
                            │
┌─────────────────────────────────────────────────────────────┐
│              Vercel Postgres Database                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Products    │  │  Orders      │  │  Cart        │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Inventory  │  │  Users       │  │  Payments    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Webhooks
                            │
┌─────────────────────────────────────────────────────────────┐
│              External Services                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Stripe      │  │  Email (SMTP)│  │  Shipping API │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Directory Structure

```
tt-leagues/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── shop.js          # NEW: Shop product routes
│   │   │   ├── cart.js           # NEW: Shopping cart routes
│   │   │   ├── orders.js         # NEW: Order management routes
│   │   │   ├── payments.js        # NEW: Payment processing routes
│   │   │   └── admin.js           # MODIFY: Add shop admin routes
│   │   ├── models/
│   │   │   ├── shop.js            # NEW: Shop data models
│   │   │   └── database.js        # MODIFY: Add shop tables
│   │   └── middleware/
│   │       └── shopValidation.js  # NEW: Shop-specific validation
│   └── database/
│       └── schema_shop.sql        # NEW: Shop database schema
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ShopPage.jsx       # NEW: Main shop page
│   │   │   ├── ProductPage.jsx    # NEW: Product detail page
│   │   │   ├── CartPage.jsx       # NEW: Shopping cart
│   │   │   ├── CheckoutPage.jsx   # NEW: Checkout flow
│   │   │   ├── OrderHistoryPage.jsx # NEW: User order history
│   │   │   ├── OrderDetailPage.jsx  # NEW: Order details
│   │   │   └── AdminShopPage.jsx  # NEW: Admin shop management
│   │   ├── components/
│   │   │   ├── shop/
│   │   │   │   ├── ProductCard.jsx
│   │   │   │   ├── ProductFilter.jsx
│   │   │   │   ├── CartItem.jsx
│   │   │   │   ├── OrderStatusBadge.jsx
│   │   │   │   └── ProductVariantSelector.jsx
│   │   │   └── admin/
│   │   │       └── ProductManagement.jsx
│   │   └── services/
│   │       └── api.js              # MODIFY: Add shop API methods
│   └── public/
│       └── locales/
│           ├── en/
│           │   └── common.json    # MODIFY: Add shop translations
│           └── de/
│               └── common.json    # MODIFY: Add shop translations
```

---

## 3. Database Schema

### 3.1 Products Table

```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('blade', 'rubber', 'service')),
    base_price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'CHF',
    stock_quantity INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_service BOOLEAN DEFAULT false,
    service_duration INTEGER, -- minutes, for services only
    images JSONB DEFAULT '[]', -- array of image URLs
    specifications JSONB DEFAULT '{}', -- flexible specs storage
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_active ON products(is_active);
```

### 3.2 Product Variants Table

```sql
CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- e.g., "Red 2.0mm", "FL Handle"
    sku VARCHAR(100) UNIQUE,
    price_modifier DECIMAL(10, 2) DEFAULT 0, -- added to base_price
    stock_quantity INTEGER DEFAULT 0,
    attributes JSONB DEFAULT '{}', -- {color: "red", thickness: "2.0", handle: "FL"}
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
```

### 3.3 Shopping Cart Table

```sql
CREATE TABLE cart_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id, variant_id)
);

CREATE INDEX idx_cart_user ON cart_items(user_id);
```

### 3.4 Orders Table

```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL, -- e.g., "ORD-2025-001234"
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'shipping', 'delivered', 'cancelled', 'refunded')),
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0, -- VAT 7.7%
    shipping_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'CHF',
    payment_status VARCHAR(20) DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    payment_method VARCHAR(50),
    payment_intent_id VARCHAR(255), -- Stripe payment intent ID
    shipping_address JSONB NOT NULL, -- {name, street, city, zip, country}
    billing_address JSONB,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at);
```

### 3.5 Order Items Table

```sql
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    product_name VARCHAR(200) NOT NULL, -- snapshot at time of order
    variant_name VARCHAR(100),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
```

### 3.6 Order Status History Table

```sql
CREATE TABLE order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    notes TEXT,
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_status_history_order ON order_status_history(order_id);
```

### 3.7 Inventory Logs Table

```sql
CREATE TABLE inventory_logs (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
    variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
    change_amount INTEGER NOT NULL, -- positive for additions, negative for deductions
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL,
    reason VARCHAR(100), -- 'sale', 'restock', 'adjustment', 'return'
    order_id INTEGER REFERENCES orders(id),
    admin_id INTEGER REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX idx_inventory_logs_variant ON inventory_logs(variant_id);
```

### 3.8 User Addresses Table

```sql
CREATE TABLE user_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50), -- 'Home', 'Work', etc.
    name VARCHAR(100) NOT NULL,
    street VARCHAR(200) NOT NULL,
    city VARCHAR(100) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) DEFAULT 'Switzerland',
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_addresses_user ON user_addresses(user_id);
```

### 3.9 Migration Script

Create `backend/database/migrations/001_shop_schema.sql`:

```sql
-- Run all CREATE TABLE statements above
-- Add foreign key constraints
-- Create indexes
-- Insert default data if needed
```

---

## 4. API Specification

### 4.1 Product Routes (`/api/shop/products`)

#### GET `/api/shop/products`
Get paginated list of products with filters.

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 20, max: 100)
- `category` (string: 'blade', 'rubber', 'service')
- `search` (string: search in name/description)
- `min_price` (decimal)
- `max_price` (decimal)
- `in_stock` (boolean)
- `sort` (string: 'price_asc', 'price_desc', 'name_asc', 'name_desc', 'newest')

**Response:**
```json
{
  "data": {
    "products": [
      {
        "id": 1,
        "name": "Butterfly Viscaria",
        "slug": "butterfly-viscaria",
        "description": "...",
        "category": "blade",
        "base_price": 89.90,
        "currency": "CHF",
        "stock_quantity": 5,
        "images": ["url1", "url2"],
        "specifications": {...},
        "variants": [
          {
            "id": 1,
            "name": "FL Handle",
            "price_modifier": 0,
            "stock_quantity": 3,
            "attributes": {"handle": "FL"}
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "pages": 3
    }
  }
}
```

#### GET `/api/shop/products/:id`
Get single product with all details.

**Response:**
```json
{
  "data": {
    "product": {
      "id": 1,
      "name": "...",
      "variants": [...],
      "specifications": {...}
    }
  }
}
```

#### GET `/api/shop/products/:slug`
Get product by slug (for SEO-friendly URLs).

### 4.2 Cart Routes (`/api/shop/cart`)

#### GET `/api/shop/cart`
Get current user's cart items.

**Authentication:** Required

**Response:**
```json
{
  "data": {
    "items": [
      {
        "id": 1,
        "product": {...},
        "variant": {...},
        "quantity": 2,
        "unit_price": 89.90,
        "total_price": 179.80
      }
    ],
    "subtotal": 179.80,
    "tax": 13.84,
    "total": 193.64
  }
}
```

#### POST `/api/shop/cart`
Add item to cart.

**Authentication:** Required

**Body:**
```json
{
  "product_id": 1,
  "variant_id": 2, // optional
  "quantity": 1
}
```

**Response:**
```json
{
  "data": {
    "cart_item": {...}
  },
  "message": "Item added to cart"
}
```

#### PUT `/api/shop/cart/:id`
Update cart item quantity.

**Authentication:** Required

**Body:**
```json
{
  "quantity": 3
}
```

#### DELETE `/api/shop/cart/:id`
Remove item from cart.

**Authentication:** Required

#### DELETE `/api/shop/cart`
Clear entire cart.

**Authentication:** Required

### 4.3 Order Routes (`/api/shop/orders`)

#### POST `/api/shop/orders`
Create new order from cart.

**Authentication:** Required

**Body:**
```json
{
  "shipping_address_id": 1, // or provide full address
  "shipping_address": {
    "name": "...",
    "street": "...",
    "city": "...",
    "zip": "...",
    "country": "Switzerland"
  },
  "billing_address": {...}, // optional, uses shipping if not provided
  "payment_method": "stripe",
  "notes": "..." // optional
}
```

**Response:**
```json
{
  "data": {
    "order": {
      "id": 1,
      "order_number": "ORD-2025-001234",
      "status": "pending",
      "total": 193.64,
      "payment_intent_id": "pi_xxx" // for Stripe
    }
  }
}
```

#### GET `/api/shop/orders`
Get user's order history.

**Authentication:** Required

**Query Parameters:**
- `page` (integer)
- `limit` (integer)
- `status` (string: filter by status)

**Response:**
```json
{
  "data": {
    "orders": [...],
    "pagination": {...}
  }
}
```

#### GET `/api/shop/orders/:id`
Get single order details.

**Authentication:** Required (must be order owner or admin)

**Response:**
```json
{
  "data": {
    "order": {
      "id": 1,
      "order_number": "ORD-2025-001234",
      "status": "processing",
      "items": [...],
      "status_history": [...],
      "shipping_address": {...}
    }
  }
}
```

#### POST `/api/shop/orders/:id/cancel`
Cancel an order (if status allows).

**Authentication:** Required (must be order owner)

### 4.4 Payment Routes (`/api/shop/payments`)

#### POST `/api/shop/payments/create-intent`
Create Stripe payment intent.

**Authentication:** Required

**Body:**
```json
{
  "order_id": 1
}
```

**Response:**
```json
{
  "data": {
    "client_secret": "pi_xxx_secret_xxx"
  }
}
```

#### POST `/api/shop/payments/webhook`
Stripe webhook endpoint (no authentication, uses Stripe signature).

**Body:** Stripe webhook event

**Handles:**
- `payment_intent.succeeded` → Update order payment_status to 'paid'
- `payment_intent.payment_failed` → Update order payment_status to 'failed'

### 4.5 Address Routes (`/api/shop/addresses`)

#### GET `/api/shop/addresses`
Get user's saved addresses.

**Authentication:** Required

#### POST `/api/shop/addresses`
Create new address.

**Authentication:** Required

**Body:**
```json
{
  "label": "Home",
  "name": "John Doe",
  "street": "Main St 123",
  "city": "Zurich",
  "zip_code": "8000",
  "country": "Switzerland",
  "is_default": true
}
```

#### PUT `/api/shop/addresses/:id`
Update address.

**Authentication:** Required (must be owner)

#### DELETE `/api/shop/addresses/:id`
Delete address.

**Authentication:** Required (must be owner)

### 4.6 Admin Shop Routes (`/api/admin/shop`)

#### POST `/api/admin/shop/products`
Create new product.

**Authentication:** Required (admin only)

**Body:**
```json
{
  "name": "Butterfly Viscaria",
  "slug": "butterfly-viscaria",
  "description": "...",
  "category": "blade",
  "base_price": 89.90,
  "stock_quantity": 10,
  "images": ["url1", "url2"],
  "specifications": {
    "weight": "88g",
    "speed": "OFF+"
  },
  "variants": [
    {
      "name": "FL Handle",
      "price_modifier": 0,
      "stock_quantity": 5,
      "attributes": {"handle": "FL"}
    }
  ]
}
```

#### PUT `/api/admin/shop/products/:id`
Update product.

**Authentication:** Required (admin only)

#### DELETE `/api/admin/shop/products/:id`
Delete product (soft delete: set is_active = false).

**Authentication:** Required (admin only)

#### POST `/api/admin/shop/products/:id/variants`
Add variant to product.

**Authentication:** Required (admin only)

#### PUT `/api/admin/shop/products/:id/variants/:variantId`
Update variant.

**Authentication:** Required (admin only)

#### DELETE `/api/admin/shop/products/:id/variants/:variantId`
Delete variant.

**Authentication:** Required (admin only)

#### POST `/api/admin/shop/inventory/adjust`
Adjust inventory manually.

**Authentication:** Required (admin only)

**Body:**
```json
{
  "product_id": 1,
  "variant_id": 2, // optional
  "change_amount": 5, // positive or negative
  "reason": "restock",
  "notes": "Received new shipment"
}
```

#### GET `/api/admin/shop/orders`
Get all orders (admin view).

**Authentication:** Required (admin only)

**Query Parameters:**
- `page`, `limit`, `status`, `user_id`, `date_from`, `date_to`

#### PUT `/api/admin/shop/orders/:id/status`
Update order status.

**Authentication:** Required (admin only)

**Body:**
```json
{
  "status": "shipping",
  "notes": "Shipped via Swiss Post",
  "tracking_number": "123456789" // optional
}
```

#### GET `/api/admin/shop/analytics`
Get shop analytics.

**Authentication:** Required (admin only)

**Query Parameters:**
- `period` (string: 'day', 'week', 'month', 'year')
- `start_date`, `end_date`

**Response:**
```json
{
  "data": {
    "revenue": {
      "total": 10000.00,
      "period": "month"
    },
    "orders": {
      "total": 45,
      "pending": 5,
      "processing": 10,
      "shipping": 15,
      "delivered": 15
    },
    "top_products": [...],
    "low_stock": [...]
  }
}
```

---

## 5. Frontend Components

### 5.1 Shop Page (`ShopPage.jsx`)

**Location:** `frontend/src/pages/ShopPage.jsx`

**Features:**
- Product grid/list view toggle
- Category filter (blades, rubbers, services)
- Price range filter
- Search functionality
- Sort options
- Pagination
- Responsive design

**State Management:**
- Products list
- Filters state
- Pagination state
- Loading state

**Components Used:**
- `ProductCard` (for each product)
- `ProductFilter` (sidebar filters)
- `Pagination` (existing component)

### 5.2 Product Detail Page (`ProductPage.jsx`)

**Location:** `frontend/src/pages/ProductPage.jsx`

**Features:**
- Product images gallery
- Product specifications
- Variant selector (color, thickness, handle type)
- Add to cart button
- Stock status display
- Related products section

**Components Used:**
- `ProductVariantSelector`
- `Button` (add to cart)
- `Badge` (stock status)

### 5.3 Shopping Cart Page (`CartPage.jsx`)

**Location:** `frontend/src/pages/CartPage.jsx`

**Features:**
- List of cart items
- Quantity adjustment
- Remove items
- Price breakdown (subtotal, tax, shipping, total)
- Proceed to checkout button
- Empty cart state

**Components Used:**
- `CartItem` (for each item)
- `Button` (checkout, remove)

### 5.4 Checkout Page (`CheckoutPage.jsx`)

**Location:** `frontend/src/pages/CheckoutPage.jsx`

**Features:**
- Order summary
- Shipping address selection/input
- Billing address (optional, defaults to shipping)
- Payment method selection
- Stripe payment element integration
- Order notes
- Form validation
- Loading states

**Steps:**
1. Review cart
2. Select/enter shipping address
3. Select payment method
4. Enter payment details
5. Confirm order
6. Redirect to order confirmation

### 5.5 Order History Page (`OrderHistoryPage.jsx`)

**Location:** `frontend/src/pages/OrderHistoryPage.jsx`

**Features:**
- List of user's orders
- Order status badges
- Order date, total
- Filter by status
- Link to order details
- Empty state

### 5.6 Order Detail Page (`OrderDetailPage.jsx`)

**Location:** `frontend/src/pages/OrderDetailPage.jsx`

**Features:**
- Order information
- Order items list
- Status timeline
- Shipping address
- Payment information
- Tracking number (if available)
- Cancel order button (if allowed)

### 5.7 Admin Shop Page (`AdminShopPage.jsx`)

**Location:** `frontend/src/pages/AdminShopPage.jsx`

**Features:**
- Product management (CRUD)
- Inventory management
- Order management
- Analytics dashboard
- Low stock alerts

**Tabs/Sections:**
1. Products
2. Orders
3. Inventory
4. Analytics

### 5.8 Reusable Components

#### `ProductCard.jsx`
- Product image
- Product name
- Price
- Stock status
- Quick view/add to cart

#### `ProductFilter.jsx`
- Category filter
- Price range slider
- In stock toggle
- Search input

#### `ProductVariantSelector.jsx`
- Variant options (radio buttons, dropdowns)
- Price updates based on variant
- Stock status per variant

#### `CartItem.jsx`
- Product image
- Product name + variant
- Quantity selector
- Price
- Remove button

#### `OrderStatusBadge.jsx`
- Status badge with color coding
- Status text

---

## 6. Integration Points

### 6.1 Authentication Integration

**Reuse existing auth system:**
- Same JWT tokens
- Same user table
- Same authentication middleware
- Shop routes use `authenticateToken` middleware

**Modifications:**
- No changes needed to auth system
- Shop routes check `req.user` for user info

### 6.2 Wiki Integration

**Add shop link to wiki page:**

In `frontend/src/pages/TtcBadenWettingenWikiPage.jsx`:

```jsx
// In Material section, add link:
<Link to="/shop" className="text-blue-400 hover:text-blue-300 underline">
  {t('wiki.material.shopLink')}
</Link>
```

**Translation keys:**
```json
{
  "wiki": {
    "material": {
      "shopLink": "Visit our online shop"
    }
  }
}
```

### 6.3 Navigation Integration

**Add shop link to main navigation:**

In `frontend/src/components/layout/Layout.jsx`:

```jsx
const navigation = [
  // ... existing items
  { name: t('nav.shop'), href: '/shop', icon: ShoppingBag },
];
```

### 6.4 Footer Integration

**Shop links in footer:**

In `frontend/src/components/layout/SiteFooter.jsx`:

```jsx
<Link to="/shop" className="text-gray-400 hover:text-gray-200 underline">
  {t('footer.shop')}
</Link>
```

### 6.5 Admin Panel Integration

**Add shop section to admin page:**

In `frontend/src/pages/AdminPage.jsx`:

- Add new tab/section for "Shop Management"
- Link to `AdminShopPage`

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1)

**Backend:**
1. Create database schema
   - Run migration script
   - Verify tables created
   - Test foreign keys

2. Create shop models
   - `backend/src/models/shop.js`
   - Product CRUD methods
   - Cart methods
   - Order methods

3. Create basic API routes
   - Product routes (GET list, GET by id)
   - Cart routes (GET, POST, PUT, DELETE)
   - Basic validation

**Frontend:**
1. Create shop page structure
   - `ShopPage.jsx` (basic layout)
   - `ProductCard.jsx`
   - API service methods

2. Add navigation links
   - Shop link in header
   - Shop link in wiki

**Testing:**
- Test database schema
- Test API endpoints with Postman/curl
- Test basic frontend rendering

### Phase 2: Core Shopping (Week 2)

**Backend:**
1. Complete product routes
   - Filters, search, pagination
   - Variant handling

2. Complete cart functionality
   - Add/remove/update items
   - Cart calculations

3. Order creation
   - Create order from cart
   - Order number generation
   - Status tracking

**Frontend:**
1. Product listing
   - Filters
   - Search
   - Pagination

2. Product detail page
   - Variant selection
   - Add to cart

3. Cart page
   - Item management
   - Price calculations

**Testing:**
- End-to-end cart flow
- Order creation
- Edge cases (out of stock, etc.)

### Phase 3: Checkout & Payment (Week 3)

**Backend:**
1. Address management
   - CRUD addresses
   - Default address

2. Payment integration
   - Stripe setup
   - Payment intent creation
   - Webhook handling

3. Order status updates
   - Status transitions
   - History tracking

**Frontend:**
1. Checkout page
   - Address selection
   - Payment form
   - Stripe Elements

2. Order confirmation
   - Success page
   - Order details

**Testing:**
- Payment flow
- Webhook handling
- Order status updates

### Phase 4: Admin Features (Week 4)

**Backend:**
1. Admin product management
   - CRUD products
   - Variant management
   - Image upload

2. Inventory management
   - Stock adjustments
   - Inventory logs

3. Order management
   - View all orders
   - Update status
   - Tracking numbers

4. Analytics
   - Revenue reports
   - Order statistics
   - Low stock alerts

**Frontend:**
1. Admin shop page
   - Product management UI
   - Order management UI
   - Analytics dashboard

**Testing:**
- Admin workflows
- Permission checks
- Analytics accuracy

### Phase 5: Polish & Optimization (Week 5)

**Backend:**
1. Performance optimization
   - Database indexes
   - Query optimization
   - Caching (if needed)

2. Error handling
   - Comprehensive error messages
   - Logging

**Frontend:**
1. UI/UX improvements
   - Loading states
   - Error states
   - Empty states
   - Animations

2. SEO optimization
   - Meta tags
   - Structured data
   - Sitemap

3. Translations
   - Complete i18n
   - German translations

**Testing:**
- Performance testing
- Cross-browser testing
- Mobile responsiveness
- Accessibility

---

## 8. Testing Requirements

### 8.1 Unit Tests

**Backend:**
- Product model methods
- Cart calculations
- Order creation logic
- Inventory updates
- Price calculations (with VAT)

**Frontend:**
- Component rendering
- Form validation
- State management

### 8.2 Integration Tests

- API endpoint testing
- Database operations
- Payment flow
- Order workflow

### 8.3 E2E Tests

- Complete shopping flow:
  1. Browse products
  2. Add to cart
  3. Checkout
  4. Payment
  5. Order confirmation
  6. Order tracking

### 8.4 Test Cases

**Product Management:**
- Create product with variants
- Update product
- Delete product (soft delete)
- Filter products
- Search products

**Cart:**
- Add item to cart
- Update quantity
- Remove item
- Clear cart
- Cart persistence across sessions

**Orders:**
- Create order from cart
- Order number uniqueness
- Status transitions
- Cancel order (if allowed)
- Order history

**Payment:**
- Create payment intent
- Process payment
- Handle payment failure
- Webhook processing

**Admin:**
- Product CRUD
- Inventory adjustments
- Order status updates
- Analytics accuracy

---

## 9. Deployment Guide

### 9.1 Prerequisites

1. **Vercel Account**
   - Sign up at vercel.com
   - Connect GitHub repository

2. **Vercel Postgres**
   - Create database in Vercel dashboard
   - Note connection string

3. **Stripe Account**
   - Sign up at stripe.com
   - Get API keys (test and live)

### 9.2 Database Setup

1. **Create database:**
   ```bash
   # In Vercel dashboard: Storage -> Postgres -> Create
   ```

2. **Run migrations:**
   ```bash
   # Option 1: Via Vercel CLI
   vercel env pull
   # Update DATABASE_URL in local .env
   psql $DATABASE_URL < backend/database/migrations/001_shop_schema.sql
   
   # Option 2: Via Vercel dashboard SQL editor
   # Copy/paste migration SQL
   ```

3. **Verify tables:**
   ```sql
   \dt -- List tables
   SELECT COUNT(*) FROM products;
   ```

### 9.3 Backend Deployment

1. **Environment Variables (Vercel):**
   ```
   NODE_ENV=production
   JWT_SECRET=<your-secret>
   DATABASE_URL=<vercel-postgres-url>
   FRONTEND_URL=https://your-frontend.vercel.app
   STRIPE_SECRET_KEY=<stripe-secret-key>
   STRIPE_WEBHOOK_SECRET=<stripe-webhook-secret>
   ```

2. **Deploy:**
   ```bash
   # Push to GitHub
   git push origin main
   
   # Vercel auto-deploys
   # Or manually: vercel --prod
   ```

3. **Configure webhook:**
   - In Stripe dashboard: Webhooks
   - Add endpoint: `https://your-backend.vercel.app/api/shop/payments/webhook`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`

### 9.4 Frontend Deployment

1. **Environment Variables:**
   ```
   VITE_API_URL=https://your-backend.vercel.app
   ```

2. **Deploy:**
   ```bash
   # Push to GitHub
   # Vercel auto-deploys
   ```

### 9.5 Post-Deployment Checklist

- [ ] Database tables created
- [ ] API endpoints responding
- [ ] Frontend loads correctly
- [ ] Authentication works
- [ ] Products display
- [ ] Cart functionality works
- [ ] Payment test (Stripe test mode)
- [ ] Webhook receiving events
- [ ] Admin panel accessible
- [ ] Email notifications (if implemented)

---

## 10. Security Considerations

### 10.1 Authentication & Authorization

- All shop routes require authentication (except public product listing)
- Admin routes require admin role check
- Order access: users can only view their own orders
- Payment webhook: verify Stripe signature

### 10.2 Input Validation

- Validate all user inputs
- Sanitize product descriptions
- Validate prices (prevent negative, prevent injection)
- Validate quantities (positive integers)
- Validate addresses

### 10.3 Payment Security

- Never store credit card details
- Use Stripe Elements (PCI compliant)
- Verify payment webhooks with signature
- Idempotency keys for payment intents

### 10.4 Data Protection

- Encrypt sensitive data
- GDPR compliance (user data export/deletion)
- Secure database connections (SSL)
- Rate limiting on API endpoints

### 10.5 Inventory Protection

- Prevent overselling (check stock before order)
- Atomic inventory updates (use transactions)
- Log all inventory changes
- Alert on suspicious activity

---

## 11. Additional Considerations

### 11.1 Email Notifications

**Recommended service:** SendGrid, Resend, or Vercel's email service

**Emails to send:**
- Order confirmation
- Payment confirmation
- Shipping notification
- Order status updates
- Order cancellation

### 11.2 Image Storage

**Options:**
1. Vercel Blob Storage (recommended)
2. Cloudinary
3. AWS S3
4. ImgBB (free tier)

**Implementation:**
- Upload endpoint in admin panel
- Store URLs in database
- Optimize images (resize, compress)

### 11.3 Shipping Integration

**Swiss Post API:**
- Calculate shipping costs
- Generate labels
- Track packages

**Alternative:**
- Manual shipping cost entry
- Flat rate shipping
- Free shipping threshold

### 11.4 VAT Calculation

**Swiss VAT:**
- Standard rate: 7.7%
- Reduced rate: 2.5% (some products)
- Calculate on subtotal (before shipping)

**Implementation:**
```javascript
const calculateVAT = (subtotal, rate = 0.077) => {
  return Math.round(subtotal * rate * 100) / 100;
};
```

### 11.5 Order Number Generation

**Format:** `ORD-YYYY-XXXXXX`

**Implementation:**
```javascript
const generateOrderNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `ORD-${year}-${random}`;
};
```

---

## 12. Translation Keys

### 12.1 English (`en/common.json`)

Add to existing file:

```json
{
  "shop": {
    "title": "Shop",
    "nav": "Shop",
    "categories": {
      "all": "All Products",
      "blades": "Blades",
      "rubbers": "Rubbers",
      "services": "Services"
    },
    "product": {
      "addToCart": "Add to Cart",
      "outOfStock": "Out of Stock",
      "inStock": "In Stock",
      "lowStock": "Only {{count}} left",
      "price": "Price",
      "specifications": "Specifications",
      "variants": "Options"
    },
    "cart": {
      "title": "Shopping Cart",
      "empty": "Your cart is empty",
      "subtotal": "Subtotal",
      "tax": "VAT (7.7%)",
      "shipping": "Shipping",
      "total": "Total",
      "checkout": "Proceed to Checkout",
      "remove": "Remove",
      "update": "Update Cart"
    },
    "checkout": {
      "title": "Checkout",
      "shippingAddress": "Shipping Address",
      "billingAddress": "Billing Address",
      "paymentMethod": "Payment Method",
      "orderNotes": "Order Notes (optional)",
      "placeOrder": "Place Order",
      "processing": "Processing..."
    },
    "order": {
      "title": "Order",
      "orderNumber": "Order #{{number}}",
      "status": {
        "pending": "Pending",
        "processing": "Processing",
        "shipping": "Shipping",
        "delivered": "Delivered",
        "cancelled": "Cancelled"
      },
      "history": "Order History",
      "details": "Order Details",
      "items": "Items",
      "cancel": "Cancel Order"
    }
  }
}
```

### 12.2 German (`de/common.json`)

Add German translations for all shop keys.

---

## 13. Implementation Checklist

### Backend
- [ ] Database schema created
- [ ] Migration script tested
- [ ] Product routes implemented
- [ ] Cart routes implemented
- [ ] Order routes implemented
- [ ] Payment routes implemented
- [ ] Address routes implemented
- [ ] Admin routes implemented
- [ ] Validation middleware
- [ ] Error handling
- [ ] Unit tests
- [ ] Integration tests

### Frontend
- [ ] Shop page
- [ ] Product detail page
- [ ] Cart page
- [ ] Checkout page
- [ ] Order history page
- [ ] Order detail page
- [ ] Admin shop page
- [ ] Product components
- [ ] Cart components
- [ ] Navigation integration
- [ ] Wiki integration
- [ ] Translations (EN/DE)
- [ ] Responsive design
- [ ] Loading states
- [ ] Error states

### Deployment
- [ ] Vercel Postgres setup
- [ ] Environment variables configured
- [ ] Backend deployed
- [ ] Frontend deployed
- [ ] Stripe configured
- [ ] Webhook configured
- [ ] Database migrations run
- [ ] Smoke tests passed

### Documentation
- [ ] API documentation
- [ ] Admin guide
- [ ] User guide (optional)

---

## 14. Future Enhancements

- Product reviews and ratings
- Wishlist functionality
- Product recommendations
- Discount codes/coupons
- Loyalty program
- Multi-currency support
- Mobile app
- Advanced analytics
- Automated email campaigns
- Abandoned cart recovery

---

## End of Specification

This document should be used as a complete guide for implementing the online shop system. Each section provides detailed requirements and implementation guidance.

**Next Steps:**
1. Review and approve specification
2. Create GitHub repository (if separate)
3. Set up Vercel projects
4. Begin Phase 1 implementation
5. Follow phases sequentially
6. Test thoroughly before production launch
