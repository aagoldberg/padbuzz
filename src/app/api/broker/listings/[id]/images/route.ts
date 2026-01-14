import { NextRequest, NextResponse } from 'next/server';
import { validateSession, getBrokerListingById, updateBrokerListing } from '@/lib/broker-db';
import { ObjectId } from 'mongodb';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'broker-listings');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('broker_session')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const broker = await validateSession(token);
  if (!broker) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
  }

  const listing = await getBrokerListingById(id);

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  if (listing.brokerId.toString() !== broker._id?.toString()) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    if (!files.length) {
      return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
    }

    const uploadedUrls: string[] = [];

    for (const file of files) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        continue;
      }

      // Validate file size (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        continue;
      }

      const ext = file.name.split('.').pop() || 'jpg';
      const filename = `${id}-${randomUUID()}.${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      await writeFile(filepath, buffer);

      uploadedUrls.push(`/uploads/broker-listings/${filename}`);
    }

    if (!uploadedUrls.length) {
      return NextResponse.json(
        { error: 'No valid images uploaded' },
        { status: 400 }
      );
    }

    // Update listing with new images
    const currentImages = listing.images || [];
    const newImages = [...currentImages, ...uploadedUrls];

    await updateBrokerListing(id, broker._id!, { images: newImages });

    return NextResponse.json({
      message: 'Images uploaded',
      images: newImages,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload images' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get('broker_session')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const broker = await validateSession(token);
  if (!broker) {
    return NextResponse.json({ error: 'Session expired' }, { status: 401 });
  }

  const { id } = await params;

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid listing ID' }, { status: 400 });
  }

  const listing = await getBrokerListingById(id);

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
  }

  if (listing.brokerId.toString() !== broker._id?.toString()) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { imageUrl } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'Image URL required' }, { status: 400 });
    }

    // Remove from listing
    const currentImages = listing.images || [];
    const newImages = currentImages.filter(img => img !== imageUrl);

    await updateBrokerListing(id, broker._id!, { images: newImages });

    // Try to delete the file
    if (imageUrl.startsWith('/uploads/broker-listings/')) {
      const filename = imageUrl.split('/').pop();
      if (filename) {
        const filepath = path.join(UPLOAD_DIR, filename);
        try {
          await unlink(filepath);
        } catch {
          // File might not exist, ignore
        }
      }
    }

    return NextResponse.json({
      message: 'Image deleted',
      images: newImages,
    });
  } catch (error) {
    console.error('Delete image error:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}
