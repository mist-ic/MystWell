module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          alias: {
            '@': '.',
          },
        },
      ],
      [
        'transform-remove-console',
        {
          exclude: ['error', 'warn', 'info', 'log'],
        },
      ],
    ],
    env: {
      production: {
        plugins: [
          'transform-remove-console',
          'react-native-paper/babel',
        ],
      },
    },
  };
}; 