/* eslint-env jest */
// AsyncStorage has no native module in the jest environment — use its official mock
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
