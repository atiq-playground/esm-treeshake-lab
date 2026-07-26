export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
};

export type AdminUser = PublicUser & {
  dateOfBirth: string;
  status: "active" | "suspended";
  createdAt: string;
};
