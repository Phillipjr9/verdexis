import 'package:flutter/material.dart';
import '../services/wallet_service.dart';
import '../services/web3_formatters.dart';

class CreateWalletPage extends StatefulWidget {
  const CreateWalletPage({super.key});

  @override
  State<CreateWalletPage> createState() => _CreateWalletPageState();
}

class _CreateWalletPageState extends State<CreateWalletPage> {
  final _walletService = WalletService();

  String? _mnemonic;
  String? _privateKey;
  String? _address;
  String? _connectedAddress;
  String? _chainId;
  String? _balance;
  String? _signature;
  String? _transactionHash;
  String? _error;
  bool _busy = false;

  final TextEditingController _recipientController = TextEditingController();
  final TextEditingController _amountController =
      TextEditingController(text: '0.0001');

  @override
  void dispose() {
    _recipientController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  Future<void> _createWallet() async {
    setState(() {
      _busy = true;
      _error = null;
      _mnemonic = null;
      _privateKey = null;
      _address = null;
    });

    try {
      final mnemonic = _walletService.generateMnemonic();
      final privateKey = await _walletService.privateKeyFromMnemonic(mnemonic);
      final address = await _walletService.addressFromPrivateKey(privateKey);

      setState(() {
        _mnemonic = mnemonic;
        _privateKey = privateKey;
        _address = address;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _loadExisting() async {
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final key = await _walletService.getSavedPrivateKey();
      if (key == null) {
        setState(() => _error = 'No saved wallet key found.');
      } else {
        final address = await _walletService.addressFromPrivateKey(key);
        setState(() {
          _privateKey = key;
          _address = address;
        });
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _clearWallet() async {
    await _walletService.clearWallet();
    setState(() {
      _mnemonic = null;
      _privateKey = null;
      _address = null;
      _error = null;
    });
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Wallet cleared from secure storage')),
    );
  }

  Future<void> _connectExternalWallet() async {
    setState(() {
      _busy = true;
      _error = null;
      _signature = null;
      _transactionHash = null;
    });

    try {
      final connectedAddress = await _walletService.connectWallet();
      if (connectedAddress == null || connectedAddress.isEmpty) {
        throw Exception('No account was selected in the wallet.');
      }

      final chainId = await _walletService.getChainId();
      final balance =
          await _walletService.getBalance(address: connectedAddress);
      setState(() {
        _connectedAddress = connectedAddress;
        _chainId = chainId;
        _balance = balance;
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _getRealBalance() async {
    if (_connectedAddress == null) {
      setState(() => _error = 'Connect a wallet first.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final balance = await _walletService.getBalance(address: _connectedAddress);
      setState(() => _balance = balance);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _getLocalBalance() async {
    if (_privateKey == null) {
      setState(() => _error = 'Generate or load a local wallet first.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final balance = await _walletService.getBalanceWithLocalKey(
          privateKeyHex: _privateKey!);
      setState(() => _balance = balance);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _sendLocalTransaction() async {
    if (_privateKey == null) {
      setState(() => _error = 'Generate or load a local wallet first.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
      _transactionHash = null;
    });

    try {
      final txHash = await _walletService.sendTransactionWithLocalKey(
        privateKeyHex: _privateKey!,
        to: _recipientController.text,
        amountEth: _amountController.text,
      );
      setState(() => _transactionHash = txHash);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _signLocalMessage() async {
    if (_privateKey == null) {
      setState(() => _error = 'Generate or load a local wallet first.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
      _signature = null;
    });

    try {
      final signature = await _walletService.signMessageWithLocalKey(
        privateKeyHex: _privateKey!,
        message: 'Verdexis local wallet integration test',
      );
      setState(() => _signature = signature);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _sendRealTransaction() async {
    if (_connectedAddress == null) {
      setState(() => _error = 'Connect a wallet first.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
      _transactionHash = null;
    });

    try {
      final txHash = await _walletService.sendTransaction(
        to: _recipientController.text,
        amountEth: _amountController.text,
        from: _connectedAddress,
      );
      setState(() => _transactionHash = txHash);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  Future<void> _signDemoMessage() async {
    setState(() {
      _busy = true;
      _error = null;
      _signature = null;
    });

    try {
      final signature = await _walletService.signMessage(
        'Verdexis wallet integration test',
        address: _connectedAddress,
      );
      setState(() => _signature = signature);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hiddenKey = _privateKey == null
        ? null
        : '${_privateKey!.substring(0, 8)}...${_privateKey!.substring(_privateKey!.length - 8)}';

    return Scaffold(
      appBar: AppBar(title: const Text('Real Wallet Integration')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: ListView(
          children: [
            const Text(
              'Use a local wallet with direct RPC for real transactions. On web, you can still connect MetaMask for browser-backed signing.',
              style: TextStyle(fontSize: 14),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: _busy ? null : _connectExternalWallet,
              child: Text(_busy ? 'Connecting...' : 'Connect Browser Wallet'),
            ),
            const SizedBox(height: 8),
            if (_connectedAddress != null) ...[
              const Text('Connected account:',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              SelectableText(_connectedAddress!),
              const SizedBox(height: 8),
              if (_chainId != null) ...[
                Text('Network: ${getChainDisplayName(_chainId)}'),
                const SizedBox(height: 8),
              ],
              if (_balance != null) ...[
                Text('Balance: ${formatWeiToEth(_balance!)} ETH'),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: _recipientController,
                decoration: const InputDecoration(
                  labelText: 'Recipient address',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _amountController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Amount in ETH',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _busy ? null : _getRealBalance,
                      child: const Text('Get Balance'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _busy ? null : _sendRealTransaction,
                      child: const Text('Send Transaction'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: _busy || _connectedAddress == null
                    ? null
                    : _signDemoMessage,
                child: const Text('Sign Demo Message'),
              ),
              const SizedBox(height: 12),
              if (_transactionHash != null) ...[
                const Text('Transaction hash:',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                SelectableText(_transactionHash!),
                const SizedBox(height: 12),
              ],
              if (_signature != null) ...[
                const Text('Signature:',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 6),
                SelectableText(_signature!),
                const SizedBox(height: 12),
              ],
            ],
            const Divider(height: 24),
            const Text('Local wallet (direct RPC)',
                style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            ElevatedButton(
              onPressed: _busy ? null : _createWallet,
              child: Text(_busy ? 'Creating...' : 'Generate New Local Wallet'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: _busy ? null : _loadExisting,
              child: const Text('Load Saved Local Wallet'),
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: _busy ? null : _clearWallet,
              child: const Text('Clear Saved Local Wallet'),
            ),
            const SizedBox(height: 16),
            if (_address != null) ...[
              TextField(
                controller: _recipientController,
                decoration: const InputDecoration(
                  labelText: 'Recipient address',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _amountController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Amount in ETH',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _busy ? null : _getLocalBalance,
                      child: const Text('Get Local Balance'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _busy ? null : _sendLocalTransaction,
                      child: const Text('Send Local Transaction'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: _busy || _privateKey == null
                    ? null
                    : _signLocalMessage,
                child: const Text('Sign Local Demo Message'),
              ),
              const SizedBox(height: 12),
            ],
            if (_mnemonic != null) ...[
              const Text(
                'Recovery Phrase (save offline):',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              SelectableText(_mnemonic!),
              const SizedBox(height: 16),
            ],
            if (_address != null) ...[
              const Text('Local address:',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              SelectableText(_address!),
              const SizedBox(height: 16),
            ],
            if (hiddenKey != null) ...[
              const Text('Private key (masked):',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 6),
              SelectableText(hiddenKey),
              const SizedBox(height: 16),
            ],
            if (_error != null)
              Text(
                _error!,
                style: const TextStyle(color: Colors.redAccent),
              ),
            const SizedBox(height: 20),
            const Text(
              'Tip: this page now supports a real browser wallet connection. Use it on a web browser with MetaMask installed.',
              style: TextStyle(fontSize: 12, color: Colors.white70),
            ),
          ],
        ),
      ),
    );
  }
}
