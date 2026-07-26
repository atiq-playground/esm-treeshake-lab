# Lock account SDK demo API

Type: grilling
Status: open

## Question

What exact `export namespace` APIs do `@service/account-public` and `@service/account-admin` expose for the lab, and which **one** method does the `apps/web` demo call on each?

Decide method names, responsibilities (including any use of `@service/core` `getAppConfig` / `setAppConfig`), heavy dummy payloads on unused methods, and stable marker strings (e.g. `EXECUTING_…`) used later to prove tree-shaking in the Next production build.
