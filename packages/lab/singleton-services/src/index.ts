export type LabSingletonConfig = {
  baseUrl: string;
};

export type ConfigurableService = {
  configure(cfg: LabSingletonConfig): void;
};

export function getRoot(): typeof globalThis {
  return globalThis;
}

const publicRegistry: ConfigurableService[] = [];
const adminRegistry: ConfigurableService[] = [];

export function registerPublicService(svc: ConfigurableService): void {
  if (!publicRegistry.includes(svc)) {
    publicRegistry.push(svc);
  }
}

export function registerAdminService(svc: ConfigurableService): void {
  if (!adminRegistry.includes(svc)) {
    adminRegistry.push(svc);
  }
}

export function registerPublicServices(cfg: LabSingletonConfig): void {
  for (const svc of publicRegistry) {
    svc.configure(cfg);
  }
}

export function registerAdminServices(cfg: LabSingletonConfig): void {
  for (const svc of adminRegistry) {
    svc.configure(cfg);
  }
}

/** Test helper: not used by fixtures. */
export function resetLabRegistriesForTests(): void {
  publicRegistry.length = 0;
  adminRegistry.length = 0;
}
