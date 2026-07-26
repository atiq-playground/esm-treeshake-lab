import {
  registerPublicServices,
  Svc0Service,
} from "@lab/singleton-register";

registerPublicServices({ baseUrl: "http://lab.invalid" });
export const result = Svc0Service.used();
