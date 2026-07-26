import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No R2 incremental cache: static docs + bake-at-build metrics are enough.
export default defineCloudflareConfig();
