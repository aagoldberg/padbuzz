import { MongoClient, ObjectId, Db } from 'mongodb';
import { Broker, Brokerage, BrokerListing, Lead, BrokerSession } from '@/types/broker';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

// MongoDB connection
const uri = process.env.MONGODB_URI || '';
let client: MongoClient | null = null;
let db: Db | null = null;

async function getDb(): Promise<Db> {
  if (db) return db;

  if (!uri) {
    throw new Error('MONGODB_URI not configured');
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db('padbuzz');

  // Create indexes
  await db.collection('brokers').createIndex({ email: 1 }, { unique: true });
  await db.collection('brokers').createIndex({ licenseNumber: 1, licenseState: 1 });
  await db.collection('broker_sessions').createIndex({ token: 1 }, { unique: true });
  await db.collection('broker_sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('broker_listings').createIndex({ brokerId: 1 });
  await db.collection('broker_listings').createIndex({ status: 1 });
  await db.collection('leads').createIndex({ brokerId: 1, status: 1 });

  return db;
}

// ============ Broker Auth ============

export async function createBroker(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  licenseNumber: string;
  licenseState: string;
  brokerageName?: string;
}): Promise<Broker> {
  const db = await getDb();

  // Check if email exists
  const existing = await db.collection('brokers').findOne({ email: data.email.toLowerCase() });
  if (existing) {
    throw new Error('Email already registered');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(data.password, 12);

  const broker: Broker = {
    email: data.email.toLowerCase(),
    passwordHash,
    firstName: data.firstName,
    lastName: data.lastName,
    phone: data.phone,
    licenseNumber: data.licenseNumber,
    licenseState: data.licenseState.toUpperCase(),
    licenseVerified: false,
    role: 'agent',
    brokerageName: data.brokerageName,
    emailNotifications: true,
    createdAt: new Date(),
    status: 'pending',
  };

  const result = await db.collection('brokers').insertOne(broker);
  broker._id = result.insertedId;

  return broker;
}

export async function authenticateBroker(email: string, password: string): Promise<Broker | null> {
  const db = await getDb();

  const broker = await db.collection<Broker>('brokers').findOne({
    email: email.toLowerCase(),
  });

  if (!broker) return null;

  const valid = await bcrypt.compare(password, broker.passwordHash);
  if (!valid) return null;

  // Update last login
  await db.collection('brokers').updateOne(
    { _id: broker._id },
    { $set: { lastLoginAt: new Date() } }
  );

  return broker;
}

export async function createSession(brokerId: ObjectId, userAgent?: string, ipAddress?: string): Promise<string> {
  const db = await getDb();

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const session: BrokerSession = {
    brokerId,
    token,
    expiresAt,
    createdAt: new Date(),
    userAgent,
    ipAddress,
  };

  await db.collection('broker_sessions').insertOne(session);

  return token;
}

export async function validateSession(token: string): Promise<Broker | null> {
  const db = await getDb();

  const session = await db.collection<BrokerSession>('broker_sessions').findOne({
    token,
    expiresAt: { $gt: new Date() },
  });

  if (!session) return null;

  const broker = await db.collection<Broker>('brokers').findOne({
    _id: session.brokerId,
  });

  return broker;
}

export async function deleteSession(token: string): Promise<void> {
  const db = await getDb();
  await db.collection('broker_sessions').deleteOne({ token });
}

export async function getBrokerById(id: string | ObjectId): Promise<Broker | null> {
  const db = await getDb();
  const objectId = typeof id === 'string' ? new ObjectId(id) : id;
  return db.collection<Broker>('brokers').findOne({ _id: objectId });
}

export async function updateBroker(id: string | ObjectId, updates: Partial<Broker>): Promise<void> {
  const db = await getDb();
  const objectId = typeof id === 'string' ? new ObjectId(id) : id;

  // Don't allow updating sensitive fields directly
  const { passwordHash, _id, ...safeUpdates } = updates;

  await db.collection('brokers').updateOne(
    { _id: objectId },
    { $set: safeUpdates }
  );
}

// ============ Broker Listings ============

export async function createBrokerListing(brokerId: ObjectId, data: Omit<BrokerListing, '_id' | 'brokerId' | 'createdAt' | 'updatedAt' | 'views' | 'saves' | 'inquiries'>): Promise<BrokerListing> {
  const db = await getDb();

  const listing: BrokerListing = {
    ...data,
    brokerId,
    views: 0,
    saves: 0,
    inquiries: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection('broker_listings').insertOne(listing);
  listing._id = result.insertedId;

  return listing;
}

export async function getBrokerListings(brokerId: ObjectId, options?: {
  status?: BrokerListing['status'];
  limit?: number;
  skip?: number;
}): Promise<BrokerListing[]> {
  const db = await getDb();

  const query: Record<string, unknown> = { brokerId };
  if (options?.status) {
    query.status = options.status;
  }

  return db.collection<BrokerListing>('broker_listings')
    .find(query)
    .sort({ updatedAt: -1 })
    .skip(options?.skip || 0)
    .limit(options?.limit || 50)
    .toArray();
}

export async function getBrokerListingById(id: string | ObjectId): Promise<BrokerListing | null> {
  const db = await getDb();
  const objectId = typeof id === 'string' ? new ObjectId(id) : id;
  return db.collection<BrokerListing>('broker_listings').findOne({ _id: objectId });
}

export async function updateBrokerListing(
  id: string | ObjectId,
  brokerId: ObjectId,
  updates: Partial<BrokerListing>
): Promise<boolean> {
  const db = await getDb();
  const objectId = typeof id === 'string' ? new ObjectId(id) : id;

  // Ensure broker owns this listing
  const result = await db.collection('broker_listings').updateOne(
    { _id: objectId, brokerId },
    { $set: { ...updates, updatedAt: new Date() } }
  );

  return result.modifiedCount > 0;
}

export async function deleteBrokerListing(id: string | ObjectId, brokerId: ObjectId): Promise<boolean> {
  const db = await getDb();
  const objectId = typeof id === 'string' ? new ObjectId(id) : id;

  const result = await db.collection('broker_listings').deleteOne({
    _id: objectId,
    brokerId,
  });

  return result.deletedCount > 0;
}

export async function getBrokerStats(brokerId: ObjectId): Promise<{
  totalListings: number;
  activeListings: number;
  totalViews: number;
  totalInquiries: number;
  recentLeads: number;
}> {
  const db = await getDb();

  const [listingStats] = await db.collection<BrokerListing>('broker_listings').aggregate([
    { $match: { brokerId } },
    {
      $group: {
        _id: null,
        totalListings: { $sum: 1 },
        activeListings: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
        },
        totalViews: { $sum: '$views' },
        totalInquiries: { $sum: '$inquiries' },
      },
    },
  ]).toArray();

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentLeads = await db.collection('leads').countDocuments({
    brokerId,
    createdAt: { $gte: weekAgo },
  });

  return {
    totalListings: listingStats?.totalListings || 0,
    activeListings: listingStats?.activeListings || 0,
    totalViews: listingStats?.totalViews || 0,
    totalInquiries: listingStats?.totalInquiries || 0,
    recentLeads,
  };
}

// ============ Leads ============

export async function createLead(data: Omit<Lead, '_id' | 'createdAt' | 'updatedAt' | 'status'>): Promise<Lead> {
  const db = await getDb();

  const lead: Lead = {
    ...data,
    status: 'new',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await db.collection('leads').insertOne(lead);
  lead._id = result.insertedId;

  // Increment inquiry count on listing
  await db.collection('broker_listings').updateOne(
    { _id: data.listingId },
    { $inc: { inquiries: 1 } }
  );

  return lead;
}

export async function getBrokerLeads(brokerId: ObjectId, options?: {
  status?: Lead['status'];
  limit?: number;
}): Promise<Lead[]> {
  const db = await getDb();

  const query: Record<string, unknown> = { brokerId };
  if (options?.status) {
    query.status = options.status;
  }

  return db.collection<Lead>('leads')
    .find(query)
    .sort({ createdAt: -1 })
    .limit(options?.limit || 50)
    .toArray();
}

export async function updateLeadStatus(
  leadId: string | ObjectId,
  brokerId: ObjectId,
  status: Lead['status']
): Promise<boolean> {
  const db = await getDb();
  const objectId = typeof leadId === 'string' ? new ObjectId(leadId) : leadId;

  const updates: Partial<Lead> = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'contacted') {
    updates.respondedAt = new Date();
  }

  const result = await db.collection('leads').updateOne(
    { _id: objectId, brokerId },
    { $set: updates }
  );

  return result.modifiedCount > 0;
}

// ============ Public Queries ============

export async function getActiveBrokerListings(options?: {
  borough?: string;
  neighborhood?: string;
  minPrice?: number;
  maxPrice?: number;
  beds?: number;
  limit?: number;
  skip?: number;
}): Promise<BrokerListing[]> {
  const db = await getDb();

  const query: Record<string, unknown> = { status: 'active' };

  if (options?.borough) {
    query['address.borough'] = options.borough;
  }
  if (options?.neighborhood) {
    query['address.neighborhood'] = options.neighborhood;
  }
  if (options?.minPrice || options?.maxPrice) {
    query.price = {};
    if (options.minPrice) (query.price as Record<string, number>).$gte = options.minPrice;
    if (options.maxPrice) (query.price as Record<string, number>).$lte = options.maxPrice;
  }
  if (options?.beds !== undefined) {
    query.beds = options.beds;
  }

  return db.collection<BrokerListing>('broker_listings')
    .find(query)
    .sort({ publishedAt: -1 })
    .skip(options?.skip || 0)
    .limit(options?.limit || 50)
    .toArray();
}

export async function incrementListingViews(id: string | ObjectId): Promise<void> {
  const db = await getDb();
  const objectId = typeof id === 'string' ? new ObjectId(id) : id;

  await db.collection('broker_listings').updateOne(
    { _id: objectId },
    { $inc: { views: 1 } }
  );
}
