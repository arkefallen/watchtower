# Recorded Etherscan fixtures

This directory is populated only by an explicit, user-authorized capture.
The recorder never runs as part of tests or application startup:

```text
pnpm exec tsx scripts/record-fixtures.ts --live \
  --url "https://api.etherscan.io/v2/api?..." \
  --output base-txlist.json
```

Review captured responses before using them in deterministic tests. Do not
commit API keys, private keys, or unreviewed wallet data.
