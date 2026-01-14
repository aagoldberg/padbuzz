import { Home, Brain, Camera, TrendingUp, Shield, Zap, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';

export const metadata = {
  title: 'About & Methodology - PadBuzz',
  description: 'Learn how PadBuzz uses AI to analyze apartment listings and find you the best deals in NYC.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-gray-200/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Home className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">PadBuzz</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-gray-600">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back to Search
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Hero */}
        <div className="text-center mb-20">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-6">
            Apartment hunting, <span className="text-indigo-600">reinvented.</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            We built an AI agent that analyzes thousands of NYC listings so you don't have to. 
            Find hidden gems, avoid bad deals, and save hours of scrolling.
          </p>
        </div>

        {/* What is PadBuzz */}
        <section className="mb-20">
          <div className="bg-white rounded-2xl p-8 md:p-10 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">The Problem with Search</h2>
            <div className="space-y-4 text-gray-600 leading-relaxed text-lg">
              <p>
                PadBuzz is an AI-powered apartment search tool designed for NYC renters. Instead of
                manually scrolling through hundreds of listings, you tell us what you&apos;re looking for,
                and our AI analyzes each apartment against your preferences.
              </p>
              <p>
                We evaluate not just the listing details, but also analyze photos to assess cleanliness,
                natural light, and renovation quality - things that are hard to filter for but crucial
                to your living experience.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">How It Works</h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-2xl font-bold text-indigo-600">1</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Set Preferences</h3>
              <p className="text-gray-600 leading-relaxed">
                Tell us your budget, must-haves, and deal breakers. The more specific you are, the better our AI can match apartments to your needs.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative">
              <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-2xl font-bold text-indigo-600">2</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">AI Analysis</h3>
              <p className="text-gray-600 leading-relaxed">
                Our system performs a multi-step analysis combining image recognition and natural language understanding to evaluate every detail.
              </p>
            </div>

            {/* Step 3 */}
            <div className="relative">
              <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-2xl font-bold text-indigo-600">3</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Get Scores</h3>
              <p className="text-gray-600 leading-relaxed">
                Each apartment receives a personalized Match Score and an objective Deal Score. We highlight the exceptional finds for you.
              </p>
            </div>
          </div>
        </section>

        {/* Methodology */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">Our Methodology</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Image Analysis */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-6">
                <Camera className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Image Analysis</h3>
              <p className="text-gray-600 mb-4">
                We use a Vision Language Model (Qwen2.5-VL) to analyze listing photos. Each image is rated on:
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm font-medium text-gray-700">
                <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">Cleanliness</span>
                <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">Natural Light</span>
                <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">Renovation</span>
                <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">Spaciousness</span>
              </div>
            </div>

            {/* Text Analysis */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <Brain className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Listing Analysis</h3>
              <p className="text-gray-600 mb-4">
                Claude AI analyzes the full listing against your preferences, considering:
              </p>
              <div className="flex flex-wrap gap-2 text-sm font-medium text-gray-700">
                <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">Price vs. Budget</span>
                <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">Amenities Match</span>
                <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">Location</span>
                <span className="bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">Deal Breakers</span>
              </div>
            </div>

            {/* Match Score */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Match Score (1-10)</h3>
              <p className="text-gray-600">
                How well the apartment matches YOUR specific preferences. A 9/10 means it hits almost all your criteria. This is completely personalized to you.
              </p>
            </div>

            {/* Deal Score */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Deal Score (0-100)</h3>
              <p className="text-gray-600">
                An objective value rating. A high score means the apartment is underpriced for its quality and location. We factor in fee status, stabilization, and comps.
              </p>
            </div>
          </div>
        </section>

        {/* Deal Ratings */}
        <section className="mb-20">
          <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">Deal Ratings Explained</h2>

          <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Rating</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Score</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
                        Exceptional
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-600">90+</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">Rare find. Significantly underpriced. Act fast.</td>
                  </tr>
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                        Great
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-600">80-89</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">Above average value. Worth serious consideration.</td>
                  </tr>
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                        Good
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-600">70-79</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">Fair price for the quality. Solid option.</td>
                  </tr>
                  <tr className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                        Fair
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-600">50-69</td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">Market rate. Nothing special, but not overpriced.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-20">
          <div className="bg-gray-900 rounded-3xl p-8 md:p-12 text-white overflow-hidden relative">
             <div className="absolute top-0 right-0 p-32 bg-indigo-600 rounded-full blur-3xl opacity-20 -mr-16 -mt-16 pointer-events-none" />
             
            <h2 className="text-2xl font-bold mb-8 relative z-10">Under the Hood</h2>
            <div className="grid md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-1">
                <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">Image Analysis</span>
                <p className="font-semibold text-lg">Qwen2.5-VL-7B</p>
              </div>
              <div className="space-y-1">
                <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">Reasoning Engine</span>
                <p className="font-semibold text-lg">Claude 3.5 Sonnet</p>
              </div>
              <div className="space-y-1">
                <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">Database</span>
                <p className="font-semibold text-lg">MongoDB Atlas</p>
              </div>
              <div className="space-y-1">
                <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">Infrastructure</span>
                <p className="font-semibold text-lg">Vercel & Next.js 15</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <Link href="/">
            <Button size="lg" className="px-12 py-4 text-lg shadow-xl shadow-indigo-200">
              Start Your Search
            </Button>
          </Link>
          <p className="mt-6 text-gray-400 text-sm">
            PadBuzz is an independent project and not affiliated with StreetEasy.
          </p>
        </section>
      </main>
    </div>
  );
}
