/**
 * Re-eksport rejestru providerów z shared (bliźniak theme/mapping.ts i theme/models.ts).
 * Trzyma importy klienta przy jednej ścieżce '../theme/providers'.
 */
export { AGENT_PROVIDERS, resolveProvider } from '@agent-citadel/shared';
export type { ProviderInfo } from '@agent-citadel/shared';
