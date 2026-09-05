# ADR 0002: Explicit chain-adapter construction

Status: Accepted
Date: 2026-09-05

## Decision

`getAdapter(chain, factories)` uses explicit dependency injection. The caller
provides a factory for the requested chain, and the registry returns that
adapter. The registry does not create network clients, read credentials, or
perform external I/O.

The Phase 0 acceptance shorthand `getAdapter('base')` is resolved as
`getAdapter('base', { base: () => configuredAdapter })`. Base and BSC factories
are backed by the configured Etherscan client; Robinhood is backed by the
selected read-only provider from P0-T18.

## Rationale

This preserves the `ChainAdapter` boundary, keeps all provider I/O in the
rate-limited client/worker composition root, and makes unit tests deterministic
without hidden network access.
