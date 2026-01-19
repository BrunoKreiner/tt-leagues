# Shop Implementation Quick Guide

This is a condensed guide for implementing the shop system. Refer to `SHOP_TECHNICAL_SPECIFICATION.md` for complete details.

## Quick Start Checklist

### 1. Database Setup (Day 1)
```bash
# 1. Create Vercel Postgres database
# 2. Run migration: backend/database/migrations/001_shop_schema.sql
# 3. Verify tables created
```

### 2. Backend Setup (Day 1-2)
```bash
# Create files:
backend/src/routes/shop.js
backend/src/routes/cart.js
backend/src/routes/orders.js
backend/src/routes/payments.js
backend/src/models/shop.js
backend/src/middleware/shopValidation.js

# Modify:
backend/src/routes/admin.js (add shop admin routes)
backend/src/models/database.js (add shop table methods)
```

### 3. Frontend Setup (Day 2-3)
```bash
# Create pages:
frontend/src/pages/ShopPage.jsx
frontend/src/pages/ProductPage.jsx
frontend/src/pages/CartPage.jsx
frontend/src/pages/CheckoutPage.jsx
frontend/src/pages/OrderHistoryPage.jsx
frontend/src/pages/OrderDetailPage.jsx
frontend/src/pages/AdminShopPage.jsx

# Create components:
frontend/src/components/shop/ProductCard.jsx
frontend/src/components/shop/ProductFilter.jsx
frontend/src/components/shop/CartItem.jsx
frontend/src/components/shop/ProductVariantSelector.jsx
frontend/src/components/shop/OrderStatusBadge.jsx

# Modify:
frontend/src/services/api.js (add shop API methods)
frontend/src/components/layout/Layout.jsx (add shop nav link)
frontend/src/pages/TtcBadenWettingenWikiPage.jsx (add shop link)
frontend/public/locales/en/common.json (add translations)
frontend/public/locales/de/common.json (add translations)
```

### 4. Integration Steps

#### Step 1: Add Shop Route to App
```jsx
// frontend/src/App.jsx
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
// ... add routes
<Route path="/shop" element={<ShopPage />} />
<Route path="/shop/product/:id" element={<ProductPage />} />
```

#### Step 2: Add Navigation Link
```jsx
// frontend/src/components/layout/Layout.jsx
import { ShoppingBag } from 'lucide-react';
const navigation = [
  // ... existing
  { name: t('nav.shop'), href: '/shop', icon: ShoppingBag },
];
```

#### Step 3: Add Wiki Link
```jsx
// frontend/src/pages/TtcBadenWettingenWikiPage.jsx
// In Material section:
<Link to="/shop" className="text-blue-400 hover:text-blue-300 underline">
  {t('wiki.material.shopLink')}
</Link>
```

### 5. API Endpoints Priority

**Must Have (Phase 1):**
- GET `/api/shop/products` - List products
- GET `/api/shop/products/:id` - Product details
- GET `/api/shop/cart` - Get cart
- POST `/api/shop/cart` - Add to cart
- PUT `/api/shop/cart/:id` - Update cart item
- DELETE `/api/shop/cart/:id` - Remove from cart

**Important (Phase 2):**
- POST `/api/shop/orders` - Create order
- GET `/api/shop/orders` - Order history
- GET `/api/shop/orders/:id` - Order details

**Critical (Phase 3):**
- POST `/api/shop/payments/create-intent` - Payment
- POST `/api/shop/payments/webhook` - Stripe webhook

**Admin (Phase 4):**
- POST `/api/admin/shop/products` - Create product
- PUT `/api/admin/shop/products/:id` - Update product
- GET `/api/admin/shop/orders` - All orders
- PUT `/api/admin/shop/orders/:id/status` - Update status

### 6. Key Functions to Implement

#### Order Number Generation
```javascript
const generateOrderNumber = () => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `ORD-${year}-${random}`;
};
```

#### VAT Calculation (Swiss 7.7%)
```javascript
const calculateVAT = (subtotal, rate = 0.077) => {
  return Math.round(subtotal * rate * 100) / 100;
};
```

#### Stock Check Before Order
```javascript
// In order creation, check stock for each item
const checkStock = async (productId, variantId, quantity) => {
  const stock = variantId 
    ? await getVariantStock(variantId)
    : await getProductStock(productId);
  if (stock < quantity) {
    throw new Error('Insufficient stock');
  }
};
```

### 7. Stripe Integration

#### Setup
1. Install: `npm install @stripe/stripe-js`
2. Get keys from Stripe dashboard
3. Set environment variables:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`

#### Payment Intent Creation
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const createPaymentIntent = async (amount, currency = 'chf') => {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: currency.toLowerCase(),
  });
  return paymentIntent;
};
```

#### Webhook Verification
```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const verifyWebhook = (req) => {
  const sig = req.headers['stripe-signature'];
  return stripe.webhooks.constructEvent(
    req.body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );
};
```

### 8. Testing Checklist

**Manual Testing:**
- [ ] Browse products
- [ ] Filter products
- [ ] View product details
- [ ] Add to cart
- [ ] Update cart quantity
- [ ] Remove from cart
- [ ] Proceed to checkout
- [ ] Enter shipping address
- [ ] Complete payment (test mode)
- [ ] View order confirmation
- [ ] View order history
- [ ] Track order status
- [ ] Admin: Create product
- [ ] Admin: Update product
- [ ] Admin: Manage inventory
- [ ] Admin: Update order status

**Edge Cases:**
- [ ] Add out-of-stock item
- [ ] Cart with multiple variants
- [ ] Cancel order
- [ ] Payment failure
- [ ] Empty cart checkout
- [ ] Invalid address

### 9. Deployment Steps

1. **Database:**
   - Create Vercel Postgres
   - Run migration SQL
   - Verify tables

2. **Backend:**
   - Set environment variables
   - Deploy to Vercel
   - Test API endpoints

3. **Frontend:**
   - Set `VITE_API_URL`
   - Deploy to Vercel
   - Test shop pages

4. **Stripe:**
   - Configure webhook URL
   - Test payment flow
   - Switch to live mode when ready

### 10. Common Issues & Solutions

**Issue: Cart not persisting**
- Check user authentication
- Verify cart table foreign keys
- Check session/cookie settings

**Issue: Payment failing**
- Verify Stripe keys
- Check webhook URL
- Verify payment intent amount (must be in cents)

**Issue: Stock not updating**
- Check transaction isolation
- Verify inventory log triggers
- Check admin permissions

**Issue: Order status not updating**
- Verify admin authentication
- Check status transition rules
- Verify database constraints

---

## Implementation Order

1. **Database** → Create schema, test queries
2. **Backend Models** → Product, Cart, Order models
3. **Backend Routes** → API endpoints
4. **Frontend API Service** → API client methods
5. **Frontend Pages** → Shop, Product, Cart pages
6. **Frontend Components** → Reusable components
7. **Checkout Flow** → Address, Payment integration
8. **Admin Panel** → Product & order management
9. **Testing** → Manual + automated tests
10. **Deployment** → Vercel setup, deployment

---

Refer to `SHOP_TECHNICAL_SPECIFICATION.md` for complete implementation details.
