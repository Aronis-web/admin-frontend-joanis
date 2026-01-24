# 🔍 Sentry Integration - Error Tracking & Performance Monitoring

## 📋 Overview

Sentry has been integrated into the application to provide:
- **Automatic error tracking** in production
- **Performance monitoring** for slow screens and API calls
- **Breadcrumbs** for debugging user flows
- **User context** for better error attribution
- **Release tracking** for version-specific issues

---

## 🚀 Setup Instructions

### 1. Create a Sentry Account

1. Go to [sentry.io](https://sentry.io) and create an account
2. Create a new project for **React Native**
3. Copy your **DSN** (Data Source Name) from the project settings

### 2. Configure Environment Variables

#### For Local Development (.env):
```bash
# Add to your .env file
EXPO_PUBLIC_SENTRY_DSN=https://[your-key]@[your-org].ingest.sentry.io/[project-id]
EXPO_PUBLIC_SENTRY_ENABLED=true
EXPO_PUBLIC_ENVIRONMENT=development
EXPO_PUBLIC_APP_VERSION=1.0.0
EXPO_PUBLIC_BUILD_NUMBER=1
```

#### For EAS Builds:
Run the setup script:
```powershell
.\scripts\setup-sentry-secrets.ps1
```

Or manually set secrets:
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_DSN --value "your-dsn-here"
eas secret:create --scope project --name EXPO_PUBLIC_SENTRY_ENABLED --value "true"
eas secret:create --scope project --name EXPO_PUBLIC_ENVIRONMENT --value "production"
```

### 3. Install Sentry SDK

```bash
npx expo install @sentry/react-native
```

### 4. Build and Deploy

```bash
# Build for production with Sentry enabled
eas build --platform android --profile production
eas build --platform ios --profile production
```

---

## 🔧 Configuration

### Sentry Configuration (`src/config/sentry.ts`)

The Sentry configuration includes:

```typescript
{
  dsn: config.SENTRY_DSN,
  environment: 'production',
  release: config.APP_VERSION,

  // Performance Monitoring
  tracesSampleRate: 0.2, // 20% of transactions
  enableAutoSessionTracking: true,

  // Error Tracking
  enableNative: true,
  enableNativeCrashHandling: true,

  // Privacy
  beforeSend: (event) => {
    // Remove sensitive data
    // Remove auth headers, tokens, passwords
  }
}
```

### Automatic Features

✅ **Automatic Error Capture**
- All unhandled errors are automatically sent to Sentry
- React component errors caught by Error Boundaries
- Native crashes (iOS/Android)

✅ **Performance Monitoring**
- Screen load times
- API call durations
- User interaction tracking
- Slow/frozen frames detection

✅ **Breadcrumbs**
- Navigation events
- API calls
- User interactions
- Console logs (dev only)

✅ **User Context**
- User ID, email, username
- Company and site context
- Automatically set on login
- Cleared on logout

---

## 📊 Usage Examples

### Manual Error Capture

```typescript
import { captureException, captureMessage } from '@/config/sentry';

// Capture an exception
try {
  await riskyOperation();
} catch (error) {
  captureException(error, {
    context: 'riskyOperation',
    userId: user.id,
  });
}

// Capture a message
captureMessage('Something unexpected happened', 'warning', {
  screen: 'ProductsScreen',
  action: 'loadProducts',
});
```

### Using the Logger (Automatic Sentry Integration)

```typescript
import { logger } from '@/utils/logger';

// Errors are automatically sent to Sentry
logger.error('API call failed', error);

// Critical warnings are sent to Sentry
logger.warn('CRITICAL: Low memory detected');

// Info logs create breadcrumbs for context
logger.info('User viewed product', { productId: '123' });
```

### Performance Tracking

```typescript
import { startTransaction } from '@/config/sentry';

const transaction = startTransaction('load-products', 'http');

try {
  const products = await fetchProducts();
  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('error');
  throw error;
} finally {
  transaction.finish();
}
```

### Custom Breadcrumbs

```typescript
import { addSentryBreadcrumb } from '@/config/sentry';

addSentryBreadcrumb(
  'User filtered products',
  'user-action',
  'info',
  { filter: 'active', count: 42 }
);
```

---

## 🔒 Privacy & Security

### Data Sanitization

Sentry is configured to **automatically remove sensitive data**:

❌ **Removed from events:**
- Authorization headers
- API tokens
- Passwords
- API keys
- Refresh tokens

❌ **Removed from breadcrumbs:**
- Console logs in production
- Sensitive query parameters
- Authentication data

✅ **Safe to send:**
- Error messages
- Stack traces
- User IDs (non-sensitive)
- Screen names
- API endpoints (without tokens)

### beforeSend Hook

```typescript
beforeSend(event, hint) {
  // Remove authorization headers
  if (event.request?.headers) {
    delete event.request.headers['Authorization'];
  }

  // Sanitize URLs
  if (event.request?.query_string) {
    event.request.query_string = event.request.query_string
      .replace(/token=[^&]*/gi, 'token=[REDACTED]');
  }

  return event;
}
```

---

## 📈 Monitoring & Alerts

### Sentry Dashboard

Access your Sentry dashboard at: `https://sentry.io/organizations/[your-org]/issues/`

**Key Metrics:**
- Error frequency and trends
- Affected users
- Release comparisons
- Performance bottlenecks

### Setting Up Alerts

1. Go to **Alerts** in Sentry dashboard
2. Create alert rules for:
   - High error rate (> 10 errors/minute)
   - New error types
   - Performance degradation
   - Crash rate increase

3. Configure notifications:
   - Email
   - Slack
   - PagerDuty
   - Custom webhooks

### Release Tracking

Sentry automatically tracks releases using:
- `APP_VERSION` from environment
- `BUILD_NUMBER` for distribution tracking

**View releases:**
```
https://sentry.io/organizations/[your-org]/releases/
```

---

## 🧪 Testing Sentry Integration

### Test Error Capture

Add a test button in development:

```typescript
import { captureException } from '@/config/sentry';

const testSentry = () => {
  try {
    throw new Error('Test error from React Native app');
  } catch (error) {
    captureException(error, {
      test: true,
      screen: 'TestScreen',
    });
  }
};

<Button onPress={testSentry} title="Test Sentry" />
```

### Verify in Sentry

1. Trigger the test error
2. Go to Sentry dashboard
3. Check **Issues** tab
4. Verify error appears with:
   - Correct environment
   - User context
   - Breadcrumbs
   - Stack trace

---

## 🔍 Debugging

### Enable Debug Mode

```typescript
// In src/config/sentry.ts
Sentry.init({
  // ... other config
  debug: true, // Enable debug logs
});
```

### Check Sentry Status

```typescript
import * as Sentry from '@sentry/react-native';

// Check if Sentry is enabled
console.log('Sentry enabled:', Sentry.getCurrentHub().getClient() !== undefined);
```

### Common Issues

**Issue: Events not appearing in Sentry**
- ✅ Check DSN is correct
- ✅ Verify `SENTRY_ENABLED=true`
- ✅ Check network connectivity
- ✅ Verify environment is not 'development' (unless explicitly enabled)

**Issue: Too many events**
- ✅ Adjust `tracesSampleRate` (lower = fewer events)
- ✅ Add filters in `beforeSend`
- ✅ Set up rate limiting in Sentry dashboard

**Issue: Sensitive data in events**
- ✅ Review `beforeSend` hook
- ✅ Check breadcrumb filtering
- ✅ Add more sensitive keys to sanitization list

---

## 📚 Best Practices

### 1. Use Appropriate Log Levels

```typescript
// ✅ Good
logger.error('API call failed', error); // Sent to Sentry
logger.warn('CRITICAL: Auth token expired'); // Sent to Sentry
logger.info('User viewed screen'); // Breadcrumb only

// ❌ Avoid
logger.error('User clicked button'); // Too noisy
```

### 2. Add Context to Errors

```typescript
// ✅ Good
captureException(error, {
  screen: 'ProductsScreen',
  action: 'loadProducts',
  userId: user.id,
  productCount: products.length,
});

// ❌ Avoid
captureException(error); // No context
```

### 3. Set User Context Early

```typescript
// Set user context immediately after login
setSentryUser({
  id: user.id,
  email: user.email,
  username: user.name,
  companyId: company.id,
  siteId: site.id,
});
```

### 4. Use Transactions for Performance

```typescript
// Track important operations
const transaction = startTransaction('checkout-flow', 'user-flow');
// ... perform checkout
transaction.finish();
```

### 5. Monitor Release Health

- Tag releases with version numbers
- Compare error rates between releases
- Set up alerts for new releases
- Monitor crash-free sessions

---

## 🎯 Performance Optimization

### Reduce Event Volume

```typescript
// Adjust sample rates
tracesSampleRate: 0.1, // 10% of transactions

// Filter events
beforeSend(event) {
  // Ignore specific errors
  if (event.message?.includes('Network request failed')) {
    return null; // Don't send
  }
  return event;
}
```

### Batch Events

Sentry automatically batches events, but you can configure:

```typescript
maxBreadcrumbs: 50, // Reduce from 100
```

---

## 📦 Package Information

**Installed Package:**
```json
{
  "@sentry/react-native": "^5.x.x"
}
```

**Dependencies:**
- Automatic native module linking (Expo)
- No additional native configuration needed

---

## 🔗 Resources

- [Sentry React Native Docs](https://docs.sentry.io/platforms/react-native/)
- [Sentry Dashboard](https://sentry.io)
- [Performance Monitoring Guide](https://docs.sentry.io/platforms/react-native/performance/)
- [Release Health](https://docs.sentry.io/product/releases/health/)

---

## ✅ Checklist

- [ ] Sentry account created
- [ ] Project created in Sentry
- [ ] DSN configured in environment variables
- [ ] EAS secrets set up
- [ ] Test error sent and verified
- [ ] User context working
- [ ] Performance monitoring enabled
- [ ] Alerts configured
- [ ] Team notified about Sentry integration

---

**Status:** ✅ Fully Configured
**Last Updated:** 2025
**Maintained By:** Development Team
