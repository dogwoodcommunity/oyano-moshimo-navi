import type { ProviderListingRecord } from "./providerDirectory";

// Server page only. Public, reviewed information; never copy private application rows.
// Keep empty until publication is separately approved. See docs/PROVIDER_DIRECTORY.md.
export const providerDirectoryCatalog: readonly ProviderListingRecord[] = [];
