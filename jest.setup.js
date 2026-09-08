/* global jest */
jest.mock('@react-native-community/netinfo', () =>
  require('@react-native-community/netinfo/jest/netinfo-mock.js')
);

// Bottom-sheet library ships a Jest mock (see @lodev09/react-native-true-sheet
// "Testing with Jest" guide). The mock renders sheet children as a plain View
// and exposes instance present()/dismiss() as jest.fn, so component tests can
// drive wrinkles through the trigger/Done and assert method calls.
jest.mock('@lodev09/react-native-true-sheet', () =>
  require('@lodev09/react-native-true-sheet/mock')
);