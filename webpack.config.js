const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      babel: {
        dangerouslyAddModulePathsToTranspile: ['@expo/vector-icons']
      }
    },
    argv
  );

  // Customize the config before returning it
  // Add any webpack customizations here if needed

  return config;
};
