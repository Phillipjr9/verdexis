// ignore_for_file: deprecated_member_use, avoid_web_libraries_in_flutter

import 'dart:async';
import 'dart:convert';
import 'dart:js_util' as js_util;

import 'package:bip39/bip39.dart' as bip39;
import 'package:convert/convert.dart';
import 'package:ed25519_hd_key/ed25519_hd_key.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart';
import 'package:web3dart/web3dart.dart';

import 'web3_formatters.dart';

class WalletService {
  static const _storage = FlutterSecureStorage();
  static const _privateKeyKey = 'wallet_private_key';

  // RPC URLs for different chains
  static const Map<String, String> _rpcUrls = {
    '1': 'https://cloudflare-eth.com', // Mainnet
    '5': 'https://rpc.ankr.com/eth_goerli', // Goerli
    '11155111': 'https://rpc.sepolia.org', // Sepolia
    '137': 'https://polygon-rpc.com', // Polygon Mainnet
    '80001': 'https://rpc.ankr.com/polygon_mumbai', // Mumbai Testnet
  };

  String? _currentChainId = '1';
  String? get walletConnectUri => null; // Not used in RPC mode


  String generateMnemonic() {
    return bip39.generateMnemonic();
  }

  Future<String> privateKeyFromMnemonic(String mnemonic) async {
    final clean = mnemonic.trim();
    if (!bip39.validateMnemonic(clean)) {
      throw Exception('Invalid mnemonic phrase');
    }

    final seed = bip39.mnemonicToSeed(clean);
    final master = await ED25519_HD_KEY.getMasterKeyFromSeed(seed);
    final privateKeyHex = hex.encode(master.key);

    await _storage.write(key: _privateKeyKey, value: privateKeyHex);
    return privateKeyHex;
  }

  Future<String?> getSavedPrivateKey() async {
    return _storage.read(key: _privateKeyKey);
  }

  Future<String> addressFromPrivateKey(String privateKeyHex) async {
    final key = EthPrivateKey.fromHex(privateKeyHex);
    return key.address.hexEip55;
  }

  Future<void> clearWallet() async {
    await _storage.delete(key: _privateKeyKey);
  }

  bool get isMetaMaskAvailable => kIsWeb && _getInjectedProvider() != null;

  String _getRpcUrlForChain(String chainId) {
    if (_rpcUrls.containsKey(chainId)) {
      return _rpcUrls[chainId]!;
    }
    return 'https://cloudflare-eth.com'; // Default to mainnet
  }

  /// Send transaction directly using local private key and RPC
  Future<String?> sendTransactionWithLocalKey({
    required String privateKeyHex,
    required String to,
    required String amountEth,
    String chainId = '1',
  }) async {
    try {
      final key = EthPrivateKey.fromHex(privateKeyHex);
      final rpcUrl = _getRpcUrlForChain(chainId);
      final httpClient = Client();
      final web3client = Web3Client(rpcUrl, httpClient);

      try {
        final amountWei = ethToWei(amountEth);
        final tx = Transaction(
          to: EthereumAddress.fromHex(to),
          from: key.address,
          value: amountWei,
          maxGas: 21000,
        );

        final txHash = await web3client.sendTransaction(
          key,
          tx,
          chainId: int.tryParse(chainId),
        );

        return txHash;
      } finally {
        web3client.dispose();
        httpClient.close();
      }
    } catch (e) {
      throw Exception('Failed to send transaction: $e');
    }
  }

  /// Get balance from RPC using local key or address
  Future<String?> getBalanceWithLocalKey({
    required String privateKeyHex,
    String chainId = '1',
  }) async {
    try {
      final key = EthPrivateKey.fromHex(privateKeyHex);
      final rpcUrl = _getRpcUrlForChain(chainId);
      final httpClient = Client();
      final web3client = Web3Client(rpcUrl, httpClient);

      try {
        final balance = await web3client.getBalance(key.address);
        return '0x${balance.getInWei.toRadixString(16)}';
      } finally {
        web3client.dispose();
        httpClient.close();
      }
    } catch (e) {
      throw Exception('Failed to get balance: $e');
    }
  }

  /// Sign message with local private key
  Future<String?> signMessageWithLocalKey({
    required String privateKeyHex,
    required String message,
  }) async {
    try {
      final key = EthPrivateKey.fromHex(privateKeyHex);
      final messageBytes = utf8.encode(message);
      final signature = await key.signPersonalMessage(messageBytes);
      // Signature is Uint8List, convert to hex string
      return '0x${hex.encode(signature)}';
    } catch (e) {
      throw Exception('Failed to sign message: $e');
    }
  }

  /// Connect wallet (returns current address)
  Future<String?> connectWallet({bool useWalletConnect = false}) async {
    if (!kIsWeb) {
      throw Exception('Use local wallet on mobile.');
    }

    final provider = _getInjectedProvider();
    if (provider == null) {
      throw Exception(
          'No injected Ethereum wallet found. Install MetaMask or compatible wallet.');
    }

    final payload = js_util.jsify({'method': 'eth_requestAccounts'});
    final accounts = await js_util.promiseToFuture<dynamic>(
      js_util.callMethod(provider, 'request', [payload]),
    ) as List<dynamic>?;

    if (accounts == null || accounts.isEmpty) {
      return null;
    }

    return accounts.first?.toString();
  }

  /// Get current connected address
  Future<String?> getCurrentAddress({bool useWalletConnect = false}) async {
    if (!kIsWeb) {
      return null;
    }

    final provider = _getInjectedProvider();
    if (provider == null) {
      return null;
    }

    final payload = js_util.jsify({'method': 'eth_accounts'});
    final accounts = await js_util.promiseToFuture<dynamic>(
      js_util.callMethod(provider, 'request', [payload]),
    ) as List<dynamic>?;

    if (accounts == null || accounts.isEmpty) {
      return null;
    }

    return accounts.first?.toString();
  }

  /// Get current chain ID
  Future<String?> getChainId({bool useWalletConnect = false}) async {
    if (!kIsWeb) {
      return _currentChainId;
    }

    final provider = _getInjectedProvider();
    if (provider == null) {
      return _currentChainId;
    }

    final payload = js_util.jsify({'method': 'eth_chainId'});
    final chainId = await js_util.promiseToFuture<dynamic>(
      js_util.callMethod(provider, 'request', [payload]),
    );

    _currentChainId = chainId?.toString();
    return _currentChainId;
  }

  /// Get balance
  Future<String?> getBalance({String? address, bool useWalletConnect = false}) async {
    if (!kIsWeb) {
      return null;
    }

    final provider = _getInjectedProvider();
    if (provider == null) {
      throw Exception('No injected Ethereum wallet found.');
    }

    final targetAddress = address ?? await getCurrentAddress();
    if (targetAddress == null || targetAddress.isEmpty) {
      throw Exception('No wallet account connected.');
    }

    final payload = js_util.jsify({
      'method': 'eth_getBalance',
      'params': [targetAddress, 'latest'],
    });

    final balance = await js_util.promiseToFuture<dynamic>(
      js_util.callMethod(provider, 'request', [payload]),
    );

    return balance?.toString();
  }

  /// Send transaction via injected provider
  Future<String?> sendTransaction(
      {required String to,
      required String amountEth,
      String? from,
      bool useWalletConnect = false}) async {
    if (!kIsWeb) {
      throw Exception('Browser wallet signing only on web.');
    }

    final provider = _getInjectedProvider();
    if (provider == null) {
      throw Exception('No injected Ethereum wallet found.');
    }

    final targetAddress = from ?? await getCurrentAddress();
    if (targetAddress == null || targetAddress.isEmpty) {
      throw Exception('No wallet account connected.');
    }

    final normalizedTo = to.trim();
    if (normalizedTo.isEmpty || !normalizedTo.startsWith('0x')) {
      throw Exception('Enter valid recipient address beginning with 0x.');
    }

    final valueHex = ethToWeiHex(amountEth);

    final payload = js_util.jsify({
      'method': 'eth_sendTransaction',
      'params': [
        {
          'from': targetAddress,
          'to': normalizedTo,
          'value': valueHex,
          'gas': '0x5208',
        }
      ],
    });

    return (await js_util.promiseToFuture<dynamic>(
      js_util.callMethod(provider, 'request', [payload]),
    ))?.toString();
  }

  /// Sign message via injected provider
  Future<String?> signMessage(String message,
      {String? address, bool useWalletConnect = false}) async {
    if (!kIsWeb) {
      throw Exception('Browser wallet signing only on web.');
    }

    final provider = _getInjectedProvider();
    if (provider == null) {
      throw Exception('No injected Ethereum wallet found.');
    }

    final targetAddress = address ?? await getCurrentAddress();
    if (targetAddress == null || targetAddress.isEmpty) {
      throw Exception('No wallet account connected.');
    }

    final payload = js_util.jsify({
      'method': 'personal_sign',
      'params': [
        '0x${hex.encode(utf8.encode(message))}',
        targetAddress,
      ],
    });

    return (await js_util.promiseToFuture<dynamic>(
      js_util.callMethod(provider, 'request', [payload]),
    ))?.toString();
  }


  Object? _getInjectedProvider() {
    if (!kIsWeb) {
      return null;
    }

    try {
      return js_util.getProperty(js_util.globalThis, 'ethereum');
    } catch (_) {
      return null;
    }
  }
}
