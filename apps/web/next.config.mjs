const nextConfig = {
  transpilePackages: ["@oyano/shared"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/start",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
