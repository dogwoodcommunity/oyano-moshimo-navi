const nextConfig = {
  transpilePackages: ["@oyano/shared"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/home",
        permanent: false
      }
    ];
  }
};

export default nextConfig;
