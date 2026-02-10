const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

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

  // Exclude electron, dist, and web-build folders from webpack
  config.module.rules.forEach(rule => {
    if (rule.oneOf) {
      rule.oneOf.forEach(oneOfRule => {
        if (oneOfRule.exclude) {
          if (Array.isArray(oneOfRule.exclude)) {
            oneOfRule.exclude.push(
              path.resolve(__dirname, 'electron'),
              path.resolve(__dirname, 'dist'),
              path.resolve(__dirname, 'web-build')
            );
          }
        }
      });
    }
    if (rule.exclude) {
      if (Array.isArray(rule.exclude)) {
        rule.exclude.push(
          path.resolve(__dirname, 'electron'),
          path.resolve(__dirname, 'dist'),
          path.resolve(__dirname, 'web-build')
        );
      }
    }
  });

  // Add explicit exclude rule
  config.module.rules.unshift({
    test: /\.(js|jsx|ts|tsx)$/,
    include: [
      path.resolve(__dirname, 'electron'),
      path.resolve(__dirname, 'dist'),
      path.resolve(__dirname, 'web-build')
    ],
    use: 'null-loader'
  });

  return config;
};
