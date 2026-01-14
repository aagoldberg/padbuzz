# PadBuzz Broker Integration Plan

## Executive Summary

This document outlines the strategy for enabling brokers to submit and manage listings directly on PadBuzz, following industry standards used by platforms like StreetEasy, Zillow, and MLS systems.

---

## Industry Standards Research

### Data Standards

**RESO Web API** (Real Estate Standards Organization)
- As of January 2025, RESO Web API has fully replaced the deprecated RETS standard
- Uses RESTful principles, JSON data format, and OAuth for security
- Over 650 MLSs are certified on RESO Web API
- Source: [RESO Web API FAQ](https://www.reso.org/knowledge-base/reso-web-api-faq/)

**RESO Data Dictionary 2.0**
- Industry-standard field definitions for property listings
- Ensures consistency across platforms
- Source: [RESO Data Dictionary](https://www.reso.org/data-dictionary/)

### How Major Platforms Handle Broker Data

**StreetEasy**
- Accepts XML feeds via HTTP (polled every 3 hours)
- Also supports direct entry via "Agent Tools" portal
- Feed contains all active listings; missing listings assumed off-market
- Character encoding: UTF-8, special characters escaped
- Source: [StreetEasy Feed Format](https://streeteasy.com/home/feed_format)

**Zillow**
- Supports RETS syndication schema
- Requires MLS submission within 1 day of public marketing
- Photo minimum: 415x330 pixels
- One listing per address policy
- Large multifamily (25+ units) requires paid listing
- Source: [Zillow Broker Feeds Spec](https://www.zillow.com/static/pdf/feeds/ZillowBrokerFeedsTechnicalSpecV1.0.20.pdf)

**ListHub (CoStar)**
- Centralized syndication to 100+ sites from single feed
- Broker-controlled distribution settings
- Office codes identify listing ownership
- Source: [ListHub Overview](https://www.grar.org/listhub/)

---

## Recommended Implementation Phases

### Phase 1: Broker Portal MVP

**1.1 Authentication & Verification**
- Email + password authentication
- License verification workflow:
  - Self-service: NY DOS license lookup API integration
  - Manual fallback: Upload license + admin approval
- Company/brokerage association

**1.2 Manual Listing Entry**
```
Core Fields (Required):
- Address (street, unit, city, state, zip)
- Price (rent amount)
- Bedrooms, Bathrooms
- Available date
- At least 3 photos (min 800x600)
- Contact info

Optional Fields:
- Square footage
- Amenities (checkboxes)
- Description (rich text)
- No-fee indicator
- Pet policy
- Virtual tour URL
```

**1.3 Broker Dashboard**
- Active listings grid with status indicators
- Edit/update existing listings
- Mark listings as rented/off-market
- Lead/inquiry inbox
- Basic analytics (views, saves, inquiries)

### Phase 2: XML Feed Ingestion

**2.1 Feed Format Support**
Accept industry-standard XML feeds:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<listings>
  <listing>
    <id>BROKER-123</id>
    <status>active</status>
    <address>
      <street>123 Main St</street>
      <unit>4A</unit>
      <city>Brooklyn</city>
      <state>NY</state>
      <zip>11201</zip>
    </address>
    <price currency="USD">3500</price>
    <bedrooms>2</bedrooms>
    <bathrooms>1</bathrooms>
    <sqft>850</sqft>
    <description><![CDATA[Spacious 2BR...]]></description>
    <photos>
      <photo url="https://..." order="1" />
    </photos>
    <amenities>
      <amenity>Dishwasher</amenity>
      <amenity>Laundry In Unit</amenity>
    </amenities>
    <agent>
      <name>John Smith</name>
      <email>john@broker.com</email>
      <phone>212-555-1234</phone>
    </agent>
    <noFee>true</noFee>
    <availableDate>2026-02-01</availableDate>
  </listing>
</listings>
```

**2.2 Feed Processing**
- Broker provides feed URL (HTTP/HTTPS)
- PadBuzz polls feed every 3 hours (configurable)
- Listings not in feed marked as off-market
- Deduplication by broker ID + address
- Photo validation and CDN upload

**2.3 Feed Management UI**
- Feed URL configuration
- Feed health monitoring
- Error logs and validation reports
- Manual sync trigger

### Phase 3: API Access

**3.1 REST API for Listings**
```
POST   /api/broker/listings          Create listing
GET    /api/broker/listings          List my listings
GET    /api/broker/listings/:id      Get listing details
PUT    /api/broker/listings/:id      Update listing
DELETE /api/broker/listings/:id      Remove listing
POST   /api/broker/listings/:id/photos  Upload photos
```

**3.2 Webhook Support**
- Lead notifications (new inquiry)
- Listing status changes
- Feed processing results

**3.3 API Key Management**
- Generate/revoke API keys
- Rate limiting (1000 requests/hour)
- Usage analytics

### Phase 4: Advanced Features

**4.1 MLS Integration**
- Partner with NYC-area MLSs (REBNY RLS, Hudson Gateway)
- RESO Web API client implementation
- Automatic listing sync

**4.2 Brokerage Management**
- Multi-agent accounts under one brokerage
- Role-based permissions (admin, agent, viewer)
- Brokerage-level settings and branding

**4.3 Premium Features**
- Featured listings / priority placement
- Enhanced analytics
- Lead routing rules
- CRM integrations (Zapier, webhook)

---

## Database Schema Extensions

```typescript
// New collections

interface Broker {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string;
  licenseNumber: string;
  licenseState: string;
  licenseVerified: boolean;
  licenseVerifiedAt?: Date;
  brokerageId?: ObjectId;
  role: 'admin' | 'agent';
  apiKeys: ApiKey[];
  feedConfig?: FeedConfig;
  createdAt: Date;
  lastLoginAt?: Date;
}

interface Brokerage {
  _id: ObjectId;
  name: string;
  address: string;
  phone: string;
  website?: string;
  logo?: string;
  primaryContactId: ObjectId;
  settings: {
    defaultNoFee: boolean;
    syndicationEnabled: boolean;
  };
  createdAt: Date;
}

interface ApiKey {
  key: string;
  name: string;
  createdAt: Date;
  lastUsedAt?: Date;
  rateLimit: number;
}

interface FeedConfig {
  url: string;
  format: 'xml' | 'json';
  pollIntervalHours: number;
  lastPolledAt?: Date;
  lastSuccessAt?: Date;
  errorCount: number;
  enabled: boolean;
}

// Extend existing Listing schema
interface Listing {
  // ... existing fields ...

  // Broker fields
  brokerId?: ObjectId;
  brokerageId?: ObjectId;
  brokerListingId?: string; // Their internal ID
  source: 'streeteasy' | 'broker_portal' | 'broker_feed' | 'broker_api';
  agentName?: string;
  agentEmail?: string;
  agentPhone?: string;
}
```

---

## API Endpoints

### Broker Authentication
```
POST /api/broker/register     Create account
POST /api/broker/login        Login
POST /api/broker/verify-license  Verify license
GET  /api/broker/me           Get profile
PUT  /api/broker/me           Update profile
```

### Listing Management
```
POST   /api/broker/listings
GET    /api/broker/listings
GET    /api/broker/listings/:id
PUT    /api/broker/listings/:id
DELETE /api/broker/listings/:id
POST   /api/broker/listings/:id/photos
DELETE /api/broker/listings/:id/photos/:photoId
```

### Feed Management
```
GET  /api/broker/feed/config
PUT  /api/broker/feed/config
POST /api/broker/feed/sync    Trigger manual sync
GET  /api/broker/feed/logs
```

### Analytics
```
GET /api/broker/analytics/overview
GET /api/broker/analytics/listings/:id
GET /api/broker/leads
```

---

## UI Components Needed

### Broker Portal Pages
1. `/broker/register` - Registration with license info
2. `/broker/login` - Login page
3. `/broker/dashboard` - Overview with stats
4. `/broker/listings` - Listing management grid
5. `/broker/listings/new` - Create listing form
6. `/broker/listings/:id/edit` - Edit listing form
7. `/broker/feed` - Feed configuration
8. `/broker/leads` - Inquiry inbox
9. `/broker/settings` - Profile & API keys
10. `/broker/analytics` - Performance metrics

### Listing Form Fields
```
Basic Info:
  - Address (autocomplete)
  - Unit number
  - Price
  - Bedrooms (0-10)
  - Bathrooms (1-5)
  - Square footage

Details:
  - Description (rich text)
  - Available date
  - Lease term
  - No fee checkbox
  - Pet policy

Photos:
  - Drag-drop upload
  - Reorder capability
  - Min 3, max 20

Amenities:
  - Checkbox grid
  - Unit amenities
  - Building amenities

Contact:
  - Agent name
  - Agent email
  - Agent phone
  - Preferred contact method
```

---

## Implementation Timeline

### Month 1: Foundation
- [ ] Broker authentication system
- [ ] License verification workflow
- [ ] Basic broker dashboard
- [ ] Manual listing entry form

### Month 2: Core Features
- [ ] Photo upload & management
- [ ] Listing edit/update/delete
- [ ] Lead capture & inbox
- [ ] Basic analytics

### Month 3: Feed Integration
- [ ] XML feed parser
- [ ] Feed polling service
- [ ] Feed management UI
- [ ] Error handling & logging

### Month 4: API & Polish
- [ ] REST API for listings
- [ ] API key management
- [ ] Webhook notifications
- [ ] Documentation

---

## Competitive Advantages

PadBuzz can differentiate from StreetEasy/Zillow by offering:

1. **AI-Powered Photo Analysis** - Automatic quality scoring gives brokers feedback on listing presentation
2. **No Gatekeeping** - Direct access without MLS membership requirements
3. **Transparent Pricing** - Clear, affordable pricing vs. StreetEasy's per-listing fees
4. **Better Analytics** - More detailed insights on listing performance
5. **Faster Onboarding** - Streamlined verification process
6. **NYC Focus** - Features tailored to NYC rental market specifics

---

## Sources

- [RESO Data Dictionary](https://www.reso.org/data-dictionary/)
- [RESO Web API FAQ](https://www.reso.org/knowledge-base/reso-web-api-faq/)
- [StreetEasy Feed Format](https://streeteasy.com/home/feed_format)
- [Zillow Broker Feeds Technical Spec](https://www.zillow.com/static/pdf/feeds/ZillowBrokerFeedsTechnicalSpecV1.0.20.pdf)
- [NAR RETS Standards](https://www.nar.realtor/real-estate-transaction-standards-rets)
- [ListHub Syndication](https://www.grar.org/listhub/)
- [Real Estate Bees - RESO Web API Guide](https://realestatebees.com/reso-web-api/)
