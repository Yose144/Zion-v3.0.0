module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
        alias: {
          '@components': './src/components',
          '@screens': './src/screens',
          '@services': './src/services',
          '@constants': './src/constants',
          '@utils': './src/utils',
          '@context': './src/context',
          '@hooks': './src/hooks',
        },
      },
    ],
  ],
};
