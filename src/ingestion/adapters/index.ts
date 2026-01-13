import { SourceAdapter, SourceConfig } from '../types';
import { CraigslistAdapter } from './craigslist';
import { GenericBrokerAdapter } from './generic-broker';

// Adapter registry
type AdapterFactory = (config: SourceConfig) => SourceAdapter;

const adapterFactories: Record<string, AdapterFactory> = {
  'craigslist': (config) => new CraigslistAdapter(config),
  'generic-broker': (config) => new GenericBrokerAdapter(config),

  // Placeholder adapters for future implementation
  'renthop': (config) => new GenericBrokerAdapter(config), // TODO: Custom RentHop adapter
  'leasebreak': (config) => new GenericBrokerAdapter(config), // TODO: Custom LeaseBreak adapter
  'cityrealty': (config) => new GenericBrokerAdapter(config), // TODO: Custom CityRealty adapter
  'nybits': (config) => new GenericBrokerAdapter(config), // TODO: Custom NYBits adapter
  'naked-apartments': (config) => new GenericBrokerAdapter(config), // TODO: Custom adapter
};

/**
 * Create an adapter instance for a given source configuration
 */
export function createAdapter(config: SourceConfig): SourceAdapter {
  const parserName = config.scrapeConfig.parser;
  const factory = adapterFactories[parserName];

  if (!factory) {
    console.warn(`No adapter found for parser "${parserName}", using generic-broker`);
    return new GenericBrokerAdapter(config);
  }

  return factory(config);
}

/**
 * Get list of supported parser types
 */
export function getSupportedParsers(): string[] {
  return Object.keys(adapterFactories);
}

/**
 * Register a custom adapter factory
 */
export function registerAdapter(parserName: string, factory: AdapterFactory): void {
  adapterFactories[parserName] = factory;
}

// Re-export adapter classes
export { CraigslistAdapter } from './craigslist';
export { GenericBrokerAdapter } from './generic-broker';
export { BaseAdapter } from './base';
