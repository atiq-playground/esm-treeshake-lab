# Assemble migration handoff

Type: grilling
Status: open
Blocked by: 01, 03, 04

## Question

What is the final executable migration handoff for transforming this repo into the agreed monorepo — ordered checklist only, no implementation in this ticket?

Must cover: root Nx/Bun workspace files, creating `@service/core` / `@service/account-public` / `@service/account-admin` with agreed APIs, moving the Next app to `apps/web` / `@apps/web`, demo route that imports both account SDKs and calls one method each, and verification commands from the tree-shake research. Output is a single handoff artifact linked from this issue; when this closes, the map destination is met.
