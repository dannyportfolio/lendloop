const authConfig = {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN || "https://clerk.placeholder.domain",
      applicationID: "convex",
    },
  ],
};

export default authConfig;
