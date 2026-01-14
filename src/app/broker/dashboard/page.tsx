'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PlusIcon, HomeIcon, EyeIcon, EnvelopeIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { BrokerListing } from '@/types/broker';

interface BrokerData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  licenseVerified: boolean;
  status: string;
}

interface Stats {
  totalListings: number;
  activeListings: number;
  totalViews: number;
  totalInquiries: number;
  recentLeads: number;
}

export default function BrokerDashboardPage() {
  const router = useRouter();
  const [broker, setBroker] = useState<BrokerData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [listings, setListings] = useState<BrokerListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch broker info and stats
      const meRes = await fetch('/api/broker/me');
      if (!meRes.ok) {
        router.push('/broker/login');
        return;
      }
      const meData = await meRes.json();
      setBroker(meData.broker);
      setStats(meData.stats);

      // Fetch listings
      const listingsRes = await fetch('/api/broker/listings');
      if (listingsRes.ok) {
        const listingsData = await listingsRes.json();
        setListings(listingsData.listings);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/broker/logout', { method: 'POST' });
    router.push('/broker/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-bold text-indigo-600">
              PadBuzz
            </Link>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600 font-medium">Broker Portal</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {broker?.firstName} {broker?.lastName}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        {broker?.status === 'pending' && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-800 text-sm">
              <strong>Account pending verification.</strong> Your license is being verified. You can still create listings.
            </p>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <HomeIcon className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.activeListings || 0}</p>
                <p className="text-sm text-gray-500">Active Listings</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <EyeIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalViews || 0}</p>
                <p className="text-sm text-gray-500">Total Views</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <EnvelopeIcon className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.totalInquiries || 0}</p>
                <p className="text-sm text-gray-500">Inquiries</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <ChartBarIcon className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats?.recentLeads || 0}</p>
                <p className="text-sm text-gray-500">Leads (7d)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Listings Section */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Your Listings</h2>
            <Link
              href="/broker/listings/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Add Listing
            </Link>
          </div>

          {listings.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <HomeIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No listings yet</h3>
              <p className="text-gray-500 mb-4">Create your first listing to get started.</p>
              <Link
                href="/broker/listings/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Add Listing
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {listings.map((listing) => (
                <div key={listing._id?.toString()} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-gray-900">
                        {listing.address.street}
                        {listing.address.unit && ` #${listing.address.unit}`}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
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
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      ${listing.price.toLocaleString()}/mo · {listing.beds === 0 ? 'Studio' : `${listing.beds}BR`} · {listing.address.neighborhood || listing.address.city}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{listing.views} views</span>
                    <span>{listing.inquiries} inquiries</span>
                    <Link
                      href={`/broker/listings/${listing._id}`}
                      className="text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
