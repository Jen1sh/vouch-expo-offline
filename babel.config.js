module.exports = function (api) {
  api.cache(true);

  return {
    // for bare React Native
    // presets: ['module:@react-native/babel-preset'],

    // or for Expo
    presets: ["babel-preset-expo"],

    // other config
    plugins: [
      [
        "react-native-unistyles/plugin",
        {
          root: "src",
        },
      ],
      ["inline-import", { extensions: [".sql"] }],
    ],
  };
};
