import {
  registerPublicServices,
  Svc0Service,
} from "@lab/smoke-singleton-register";

registerPublicServices({ baseUrl: "http://lab.invalid" });
export const result = Svc0Service.used();
