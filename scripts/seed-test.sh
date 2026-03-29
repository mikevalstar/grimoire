#!/usr/bin/env bash
#
# Seed a .g-test/ grimoire directory with sample documents for local testing.
# Removes any existing .g-test/ first so it's always a clean slate.
#
# Usage: ./scripts/seed-test.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_DIR="$PROJECT_ROOT/.g-test"
CLI="node $PROJECT_ROOT/apps/cli/dist/index.mjs"

# Build first to ensure CLI is up to date
echo "Building CLI..."
(cd "$PROJECT_ROOT" && vp run -r build) > /dev/null 2>&1
echo "Build complete."

# Clean slate
if [ -d "$TEST_DIR" ]; then
  echo "Removing existing .g-test/..."
  rm -rf "$TEST_DIR"
fi

mkdir -p "$TEST_DIR"

G="$CLI --cwd $TEST_DIR"

echo "Initializing grimoire..."
$G init --name "Test Project" --description "A sample project for local testing" --skip-skills > /dev/null

# --- Features ---
echo "Creating features..."

$G feature create \
  --title "User Authentication" \
  --id feat-user-auth \
  --priority high \
  --tag security --tag users \
  --body "# User Authentication

Allow users to sign in via OAuth providers (Google, GitHub).
Includes session management and role-based access control.

## Acceptance Criteria
- Users can sign in with Google OAuth
- Users can sign in with GitHub OAuth
- Sessions persist across browser restarts
- Role-based permissions enforced on all routes" > /dev/null

$G feature create \
  --title "Payment Processing" \
  --id feat-payments \
  --priority critical \
  --status in-progress \
  --tag billing --tag stripe \
  --body "# Payment Processing

Integrate Stripe for subscription billing and one-time payments.

## Acceptance Criteria
- Users can subscribe to monthly/annual plans
- One-time purchases for add-ons
- Invoices generated and emailed
- Webhook handling for payment events" > /dev/null

$G feature create \
  --title "Notification System" \
  --id feat-notifications \
  --priority medium \
  --tag notifications --tag email \
  --body "# Notification System

Send email and in-app notifications for important events.

## Acceptance Criteria
- Email notifications for account events
- In-app notification bell with unread count
- User preferences for notification channels" > /dev/null

# --- Requirements ---
echo "Creating requirements..."

$G requirement create \
  --title "OAuth 2.0 Login Flow" \
  --id req-oauth-login \
  --feature feat-user-auth \
  --priority high \
  --status approved \
  --tag oauth --tag login \
  --body "# OAuth 2.0 Login Flow

Implement OAuth 2.0 authorization code flow with PKCE for Google and GitHub.

## Technical Details
- Use \`passport.js\` with Google and GitHub strategies
- Store refresh tokens encrypted at rest
- Token rotation on each refresh" > /dev/null

$G requirement create \
  --title "Session Management" \
  --id req-session-mgmt \
  --feature feat-user-auth \
  --priority high \
  --status draft \
  --tag session --tag security \
  --body "# Session Management

Manage user sessions with secure cookie-based tokens.

## Technical Details
- JWT access tokens (15 min expiry)
- Refresh tokens stored in httpOnly cookies
- Session revocation via token blocklist" > /dev/null

$G requirement create \
  --title "Stripe Integration" \
  --id req-stripe-integration \
  --feature feat-payments \
  --priority critical \
  --status in-progress \
  --tag stripe --tag api \
  --body "# Stripe Integration

Connect to Stripe API for payment processing and subscription management.

## Technical Details
- Stripe SDK v14+
- Webhook signature verification
- Idempotency keys on all mutation requests" > /dev/null

# --- Tasks ---
echo "Creating tasks..."

$G task create \
  --title "Setup Google OAuth Provider" \
  --id task-google-oauth \
  --requirement req-oauth-login \
  --feature feat-user-auth \
  --priority high \
  --status in-progress \
  --tag oauth --tag google \
  --body "# Setup Google OAuth Provider

1. Register app in Google Cloud Console
2. Configure OAuth consent screen
3. Implement passport-google-oauth20 strategy
4. Add callback route at /auth/google/callback
5. Write integration tests" > /dev/null

$G task create \
  --title "Setup GitHub OAuth Provider" \
  --id task-github-oauth \
  --requirement req-oauth-login \
  --feature feat-user-auth \
  --priority high \
  --status todo \
  --tag oauth --tag github \
  --body "# Setup GitHub OAuth Provider

1. Register OAuth app in GitHub Developer Settings
2. Implement passport-github2 strategy
3. Add callback route at /auth/github/callback
4. Map GitHub profile fields to user model
5. Write integration tests" > /dev/null

$G task create \
  --title "Implement JWT Token Flow" \
  --id task-jwt-flow \
  --requirement req-session-mgmt \
  --feature feat-user-auth \
  --priority high \
  --status todo \
  --tag jwt --tag auth \
  --body "# Implement JWT Token Flow

- Generate signed JWT access tokens on login
- Implement refresh token rotation
- Add middleware to validate tokens on protected routes
- Handle token expiry gracefully on the client" > /dev/null

$G task create \
  --title "Create Stripe Webhook Handler" \
  --id task-stripe-webhooks \
  --requirement req-stripe-integration \
  --feature feat-payments \
  --priority critical \
  --status todo \
  --tag stripe --tag webhooks \
  --body "# Create Stripe Webhook Handler

Handle the following events:
- \`checkout.session.completed\`
- \`invoice.payment_succeeded\`
- \`invoice.payment_failed\`
- \`customer.subscription.updated\`
- \`customer.subscription.deleted\`

Verify webhook signatures. Use idempotency to prevent duplicate processing." > /dev/null

$G task create \
  --title "Write Auth Integration Tests" \
  --id task-auth-tests \
  --requirement req-oauth-login \
  --feature feat-user-auth \
  --priority medium \
  --status todo \
  --tag testing --tag auth \
  --body "# Write Auth Integration Tests

- Test full OAuth flow with mocked providers
- Test token refresh and rotation
- Test session revocation
- Test role-based access on protected routes" > /dev/null

# --- Decisions ---
echo "Creating decisions..."

$G decision create \
  --title "Use JWT Over Server-Side Sessions" \
  --id adr-jwt-over-sessions \
  --status accepted \
  --tag auth --tag architecture \
  --feature feat-user-auth \
  --body "# Use JWT Over Server-Side Sessions

## Context
We need to choose a session management strategy that scales horizontally
and works well with our API-first architecture.

## Decision
Use short-lived JWT access tokens (15 min) with rotating refresh tokens
stored in httpOnly cookies.

## Consequences
- Stateless auth enables horizontal scaling without session stores
- Token revocation requires a blocklist (adds complexity)
- Short-lived tokens limit exposure window

## Alternatives Considered
- **Server-side sessions (Redis):** Simpler revocation but adds infrastructure dependency
- **Opaque tokens:** Requires DB lookup on every request" > /dev/null

$G decision create \
  --title "Use Stripe Over Square for Payments" \
  --id adr-stripe-over-square \
  --status accepted \
  --tag payments --tag architecture \
  --feature feat-payments \
  --body "# Use Stripe Over Square for Payments

## Context
Need to select a payment processor that supports subscriptions,
one-time payments, and has strong developer tooling.

## Decision
Use Stripe as the sole payment processor.

## Consequences
- Excellent developer experience and documentation
- Strong webhook support for event-driven architecture
- Higher transaction fees than some alternatives (2.9% + 30c)

## Alternatives Considered
- **Square:** Good for in-person, weaker subscription support
- **Braintree:** Owned by PayPal, less modern DX" > /dev/null

$G decision create \
  --title "Use React with Vite for Frontend" \
  --id adr-react-vite \
  --status proposed \
  --tag frontend --tag architecture \
  --body "# Use React with Vite for Frontend

## Context
Choosing a frontend framework and build tool for the web UI.

## Decision
React 19 with Vite for fast development iteration and broad ecosystem.

## Consequences
- Large ecosystem and hiring pool
- Vite provides fast HMR and build times
- No SSR needed (local tool), so SPA is sufficient

## Alternatives Considered
- **Svelte:** Smaller bundle but smaller ecosystem
- **Vue:** Good option but team has more React experience" > /dev/null

# --- Update some documents to make it more realistic ---
echo "Applying updates..."

$G feature update feat-user-auth --status in-progress > /dev/null
$G requirement update req-oauth-login --status in-progress > /dev/null

echo ""
echo "Done! Test grimoire seeded at .g-test/"
echo ""
echo "Try:"
echo "  node apps/cli/dist/index.mjs feature list --cwd .g-test"
echo "  node apps/cli/dist/index.mjs task list --status todo --cwd .g-test"
echo "  node apps/cli/dist/index.mjs decision get adr-jwt-over-sessions --cwd .g-test"
