import { Home, Brain, Camera, Bell, TrendingUp, Shield, Zap } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'About & Methodology - PadBuzz',
  description: 'Learn how PadBuzz uses AI to analyze apartment listings and find you the best deals in NYC.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Home className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">PadBuzz</span>
            </Link>
            <Link
              href="/"
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Back to Search
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            About PadBuzz
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered apartment hunting that saves you time and finds you better deals in NYC.
          </p>
        </div>

        {/* What is PadBuzz */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What is PadBuzz?</h2>
          <p className="text-gray-600 mb-4">
            PadBuzz is an AI-powered apartment search tool designed for NYC renters. Instead of
            manually scrolling through hundreds of listings, you tell us what you&apos;re looking for,
            and our AI analyzes each apartment against your preferences.
          </p>
          <p className="text-gray-600">
            We evaluate not just the listing details, but also analyze photos to assess cleanliness,
            natural light, and renovation quality - things that are hard to filter for but crucial
            to your living experience.
          </p>
        </section>

        {/* How It Works */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">How It Works</h2>

          <div className="space-y-8">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <span className="text-indigo-600 font-bold">1</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Set Your Preferences</h3>
                <p className="text-gray-600">
                  Tell us your budget, bedroom requirements, must-have amenities, preferred
                  neighborhoods, and deal breakers. The more specific you are, the better our
                  AI can match apartments to your needs.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <span className="text-indigo-600 font-bold">2</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">AI Analyzes Listings</h3>
                <p className="text-gray-600">
                  When you click &quot;AI Analysis&quot; on a listing, our system performs a multi-step
                  analysis combining image recognition and natural language understanding to
                  evaluate the apartment comprehensively.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <span className="text-indigo-600 font-bold">3</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Get Personalized Scores</h3>
                <p className="text-gray-600">
                  Each apartment receives a match score (how well it fits your preferences) and
                  a deal score (how good the value is for the price). Exceptional deals are
                  highlighted so you don&apos;t miss them.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Methodology */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Our Methodology</h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Image Analysis */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Camera className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Image Analysis</h3>
              <p className="text-gray-600 text-sm mb-3">
                We use a Vision Language Model (Qwen2.5-VL) to analyze up to 3 photos per listing.
                Each image is rated on:
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>&#8226; Cleanliness (1-10)</li>
                <li>&#8226; Natural light (1-10)</li>
                <li>&#8226; Renovation/modernity (1-10)</li>
                <li>&#8226; Spaciousness (1-10)</li>
              </ul>
            </div>

            {/* Text Analysis */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <Brain className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Listing Analysis</h3>
              <p className="text-gray-600 text-sm mb-3">
                Claude AI analyzes the full listing against your preferences, considering:
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>&#8226; Price vs. your budget</li>
                <li>&#8226; Amenities vs. your must-haves</li>
                <li>&#8226; Location vs. preferred neighborhoods</li>
                <li>&#8226; Deal breaker detection</li>
                <li>&#8226; Image quality ratings</li>
              </ul>
            </div>

            {/* Match Score */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Match Score (1-10)</h3>
              <p className="text-gray-600 text-sm">
                How well the apartment matches YOUR specific preferences. A 9/10 means the
                apartment hits almost all your criteria. This is personalized - the same
                apartment might be a 9 for you and a 5 for someone else.
              </p>
            </div>

            {/* Deal Score */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Deal Score (0-100)</h3>
              <p className="text-gray-600 text-sm">
                How good the value is regardless of your preferences. A high deal score means
                the apartment is underpriced for what you get. Factors include: price vs.
                neighborhood average, quality vs. price ratio, no-fee status, and rent stabilization.
              </p>
            </div>
          </div>
        </section>

        {/* Deal Ratings */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Deal Ratings Explained</h2>

          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Rating</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Deal Score</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">What It Means</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Exceptional
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">90+</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Rare find. Significantly underpriced. Act fast.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      Great
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">80-89</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Above average value. Worth serious consideration.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Good
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">70-79</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Fair price for the quality. Solid option.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      Fair
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">50-69</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Market rate. Nothing special, but not overpriced.</td>
                </tr>
                <tr>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      Poor
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">&lt;50</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Overpriced for what you get. Proceed with caution.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Technology</h2>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-900">Image Analysis:</span>
                <span className="text-gray-600 ml-2">Qwen2.5-VL-7B (via HuggingFace)</span>
              </div>
              <div>
                <span className="font-medium text-gray-900">Text Analysis:</span>
                <span className="text-gray-600 ml-2">Claude (Anthropic)</span>
              </div>
              <div>
                <span className="font-medium text-gray-900">Database:</span>
                <span className="text-gray-600 ml-2">MongoDB Atlas</span>
              </div>
              <div>
                <span className="font-medium text-gray-900">Hosting:</span>
                <span className="text-gray-600 ml-2">Vercel</span>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy */}
        <section className="mb-16">
          <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Your Privacy</h3>
                <p className="text-gray-600 text-sm">
                  Your preferences are stored locally in your browser. We don&apos;t create accounts
                  or track your searches. Analysis requests are processed in real-time and not stored
                  (except for exceptional deal alerts if you subscribe).
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Start Searching
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-gray-500 text-sm">
            PadBuzz - AI-Powered Apartment Search for NYC
          </p>
        </div>
      </footer>
    </div>
  );
}
