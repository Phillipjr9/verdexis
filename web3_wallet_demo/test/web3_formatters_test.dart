import 'package:flutter_test/flutter_test.dart';
import 'package:web3_wallet_demo/services/web3_formatters.dart';

void main() {
  group('web3 formatters', () {
    test('formats wei balances into readable ether values', () {
      expect(formatWeiToEth('0x0'), '0');
      expect(formatWeiToEth('0xde0b6b3a7640000'), '1');
      expect(formatWeiToEth('0x16345785d8a0000'), '0.1');
    });

    test('converts ether amounts into wei hex values', () {
      expect(ethToWeiHex('1'), '0xDE0B6B3A7640000');
      expect(ethToWeiHex('0.000001'), '0xE8D4A51000');
      expect(() => ethToWeiHex('1.0000000000000000001'),
          throwsA(isA<ArgumentError>()));
    });

    test('validates ethereum addresses and chain names', () {
      expect(isValidEthereumAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F'), isTrue);
      expect(isValidEthereumAddress('0x1234'), isFalse);
      expect(getChainDisplayName('0x1'), 'Ethereum Mainnet');
      expect(getChainDisplayName('0xaa36a7'), 'Sepolia');
    });
  });
}
