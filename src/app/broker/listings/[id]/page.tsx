'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeftIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  ListingForm,
  BrokerListing,
  UNIT_AMENITIES,
  BUILDING_AMENITIES,
  NYC_BOROUGHS,
  NYC_NEIGHBORHOODS,
} from '@/types/broker';
import ImageUploader from '@/components/broker/ImageUploader';

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [listing, setListing] = useState<BrokerListing | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const [form, setForm] = useState<ListingForm>({
    street: '',
    unit: '',
    city: 'New York',
    state: 'NY',
    zip: '',
    neighborhood: '',
    borough: 'Manhattan',
    price: 0,
    beds: 1,
    baths: 1,
    sqft: undefined,
    description: '',
    availableDate: '',
    leaseTermMonths: 12,
    noFee: false,
    furnished: false,
    petPolicy: 'no_pets',
    virtualTourUrl: '',
    unitAmenities: [],
    buildingAmenities: [],
    contactName: '',
    contactEmail: '',
    contactPhone: '',
  });

  useEffect(() => {
    fetchListing();
  }, [id]);

  const fetchListing = async () => {
    try {
      const res = await fetch(`/api/broker/listings/${id}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/broker/login');
          return;
        }
        throw new Error('Failed to fetch listing');
      }
      const data = await res.json();
      setListing(data.listing);
      setImages(data.listing.images || []);

      // Populate form
      const l = data.listing;
      setForm({
        street: l.address.street,
        unit: l.address.unit || '',
        city: l.address.city,
        state: l.address.state,
        zip: l.address.zip,
        neighborhood: l.address.neighborhood || '',
        borough: l.address.borough || 'Manhattan',
        price: l.price,
        beds: l.beds,
        baths: l.baths,
        sqft: l.sqft,
        description: l.description || '',
        availableDate: l.availableDate ? new Date(l.availableDate).toISOString().split('T')[0] : '',
        leaseTermMonths: l.leaseTermMonths || 12,
        noFee: l.noFee,
        furnished: l.furnished,
        petPolicy: l.petPolicy,
        virtualTourUrl: l.virtualTourUrl || '',
        unitAmenities: l.unitAmenities || [],
        buildingAmenities: l.buildingAmenities || [],
        contactName: l.contactName || '',
        contactEmail: l.contactEmail || '',
        contactPhone: l.contactPhone || '',
      });
    } catch (err) {
      setError('Failed to load listing');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateForm = <K extends keyof ListingForm>(field: K, value: ListingForm[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const toggleAmenity = (type: 'unit' | 'building', amenity: string) => {
    const field = type === 'unit' ? 'unitAmenities' : 'buildingAmenities';
    const current = form[field];
    if (current.includes(amenity)) {
      updateForm(field, current.filter(a => a !== amenity));
    } else {
      updateForm(field, [...current, amenity]);
    }
  };

  const handleSubmit = async (e: React.FormEvent, newStatus?: string) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const body: Record<string, unknown> = { ...form };
      if (newStatus) {
        body.status = newStatus;
      }

      const res = await fetch(`/api/broker/listings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update listing');
        return;
      }

      router.push('/broker/dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/broker/listings/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete listing');
        return;
      }

      router.push('/broker/dashboard');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
      setShowDeleteConfirm(false);
    }
  };

  const neighborhoods = form.borough ? NYC_NEIGHBORHOODS[form.borough] || [] : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">Listing not found</h2>
          <Link href="/broker/dashboard" className="mt-4 text-indigo-600 hover:text-indigo-700">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Listing?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This action cannot be undone. The listing will be permanently removed.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/broker/dashboard"
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Edit Listing</h1>
              <p className="text-sm text-gray-500">{listing.address.street}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              listing.status === 'active'
                ? 'bg-green-100 text-green-700'
                : listing.status === 'draft'
                ? 'bg-gray-100 text-gray-700'
                : listing.status === 'rented'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {listing.status}
            </span>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={(e) => handleSubmit(e)} className="space-y-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm">
              {error}
            </div>
          )}

          {/* Address Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Address</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label htmlFor="street" className="block text-sm font-medium text-gray-700">
                    Street address *
                  </label>
                  <input
                    type="text"
                    id="street"
                    required
                    value={form.street}
                    onChange={(e) => updateForm('street', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="unit" className="block text-sm font-medium text-gray-700">
                    Unit
                  </label>
                  <input
                    type="text"
                    id="unit"
                    value={form.unit}
                    onChange={(e) => updateForm('unit', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="borough" className="block text-sm font-medium text-gray-700">
                    Borough *
                  </label>
                  <select
                    id="borough"
                    value={form.borough}
                    onChange={(e) => {
                      updateForm('borough', e.target.value);
                      updateForm('neighborhood', '');
                    }}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    {NYC_BOROUGHS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="neighborhood" className="block text-sm font-medium text-gray-700">
                    Neighborhood
                  </label>
                  <select
                    id="neighborhood"
                    value={form.neighborhood}
                    onChange={(e) => updateForm('neighborhood', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Select...</option>
                    {neighborhoods.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    City *
                  </label>
                  <input
                    type="text"
                    id="city"
                    required
                    value={form.city}
                    onChange={(e) => updateForm('city', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="zip" className="block text-sm font-medium text-gray-700">
                    ZIP code *
                  </label>
                  <input
                    type="text"
                    id="zip"
                    required
                    value={form.zip}
                    onChange={(e) => updateForm('zip', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Details Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                    Monthly rent *
                  </label>
                  <div className="mt-1 relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      id="price"
                      required
                      min={0}
                      value={form.price || ''}
                      onChange={(e) => updateForm('price', parseInt(e.target.value) || 0)}
                      className="block w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="beds" className="block text-sm font-medium text-gray-700">
                    Bedrooms *
                  </label>
                  <select
                    id="beds"
                    value={form.beds}
                    onChange={(e) => updateForm('beds', parseInt(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value={0}>Studio</option>
                    <option value={1}>1 BR</option>
                    <option value={2}>2 BR</option>
                    <option value={3}>3 BR</option>
                    <option value={4}>4 BR</option>
                    <option value={5}>5+ BR</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="baths" className="block text-sm font-medium text-gray-700">
                    Bathrooms *
                  </label>
                  <select
                    id="baths"
                    value={form.baths}
                    onChange={(e) => updateForm('baths', parseFloat(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value={1}>1</option>
                    <option value={1.5}>1.5</option>
                    <option value={2}>2</option>
                    <option value={2.5}>2.5</option>
                    <option value={3}>3+</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="sqft" className="block text-sm font-medium text-gray-700">
                    Sq ft
                  </label>
                  <input
                    type="number"
                    id="sqft"
                    min={0}
                    value={form.sqft || ''}
                    onChange={(e) => updateForm('sqft', parseInt(e.target.value) || undefined)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="availableDate" className="block text-sm font-medium text-gray-700">
                    Available date
                  </label>
                  <input
                    type="date"
                    id="availableDate"
                    value={form.availableDate}
                    onChange={(e) => updateForm('availableDate', e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="leaseTermMonths" className="block text-sm font-medium text-gray-700">
                    Lease term
                  </label>
                  <select
                    id="leaseTermMonths"
                    value={form.leaseTermMonths}
                    onChange={(e) => updateForm('leaseTermMonths', parseInt(e.target.value))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                    <option value={18}>18 months</option>
                    <option value={24}>24 months</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.noFee}
                    onChange={(e) => updateForm('noFee', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">No fee</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.furnished}
                    onChange={(e) => updateForm('furnished', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-gray-700">Furnished</span>
                </label>
              </div>

              <div>
                <label htmlFor="petPolicy" className="block text-sm font-medium text-gray-700">
                  Pet policy
                </label>
                <select
                  id="petPolicy"
                  value={form.petPolicy}
                  onChange={(e) => updateForm('petPolicy', e.target.value as ListingForm['petPolicy'])}
                  className="mt-1 block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="no_pets">No pets</option>
                  <option value="cats_ok">Cats OK</option>
                  <option value="dogs_ok">Dogs OK</option>
                  <option value="all_pets">All pets welcome</option>
                </select>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
            <textarea
              id="description"
              rows={5}
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              placeholder="Describe the apartment..."
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Photos Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Photos</h2>
            <ImageUploader
              listingId={id}
              images={images}
              onImagesChange={setImages}
            />
          </div>

          {/* Amenities Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Amenities</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Unit amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {UNIT_AMENITIES.map(amenity => (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => toggleAmenity('unit', amenity)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        form.unitAmenities.includes(amenity)
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {amenity}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">Building amenities</h3>
                <div className="flex flex-wrap gap-2">
                  {BUILDING_AMENITIES.map(amenity => (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => toggleAmenity('building', amenity)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        form.buildingAmenities.includes(amenity)
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                          : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {amenity}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Virtual Tour Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Virtual Tour</h2>
            <div>
              <label htmlFor="virtualTourUrl" className="block text-sm font-medium text-gray-700">
                Virtual tour URL
              </label>
              <input
                type="url"
                id="virtualTourUrl"
                value={form.virtualTourUrl}
                onChange={(e) => updateForm('virtualTourUrl', e.target.value)}
                placeholder="https://..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Contact Override Section */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Contact Information</h2>
            <p className="text-sm text-gray-500 mb-4">
              Override your profile contact info for this listing (optional)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label htmlFor="contactName" className="block text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  type="text"
                  id="contactName"
                  value={form.contactName}
                  onChange={(e) => updateForm('contactName', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="contactEmail"
                  value={form.contactEmail}
                  onChange={(e) => updateForm('contactEmail', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  id="contactPhone"
                  value={form.contactPhone}
                  onChange={(e) => updateForm('contactPhone', e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <div>
              {listing.status === 'active' && (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, 'off_market')}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-amber-700 hover:text-amber-800"
                >
                  Mark off market
                </button>
              )}
              {listing.status === 'active' && (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e, 'rented')}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium text-blue-700 hover:text-blue-800"
                >
                  Mark as rented
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/broker/dashboard"
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save changes
              </button>
              {(listing.status === 'draft' || listing.status === 'off_market') && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={(e) => handleSubmit(e, 'active')}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Publish'}
                </button>
              )}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
