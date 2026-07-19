import 'package:web3dart/web3dart.dart';

String formatWeiToEth(String balanceHex) {
  final normalized = balanceHex.trim();
  if (!normalized.startsWith('0x')) {
    throw ArgumentError('Balance must be a hex string.');
  }

  final wei = BigInt.parse(normalized.substring(2), radix: 16);
  final etherUnit = BigInt.from(10).pow(18);
  final whole = (wei / etherUnit).toInt();
  final remainder = wei % etherUnit;

  if (remainder == BigInt.zero) {
    return whole.toString();
  }

  final fraction =
      remainder.toString().padLeft(18, '0').replaceFirst(RegExp(r'0+$'), '');
  return '$whole.$fraction';
}

EtherAmount ethToWei(String amountEth) {
  final normalized = amountEth.trim();
  if (normalized.isEmpty) {
    throw ArgumentError('Amount cannot be empty.');
  }

  final parts = normalized.split('.');
  if (parts.length > 2) {
    throw ArgumentError('Invalid amount format.');
  }

  final wholePart = parts.first.isEmpty ? '0' : parts.first;
  if (!RegExp(r'^\d+$').hasMatch(wholePart)) {
    throw ArgumentError('Invalid amount format.');
  }

  final fractionPart = parts.length == 2 ? parts[1] : '';
  if (!RegExp(r'^\d*$').hasMatch(fractionPart)) {
    throw ArgumentError('Invalid amount format.');
  }

  if (fractionPart.length > 18) {
    throw ArgumentError('Amount has too many decimal places.');
  }

  final paddedFraction = fractionPart.padRight(18, '0');
  final wei = BigInt.parse(wholePart) * BigInt.from(10).pow(18) +
      BigInt.parse(paddedFraction);
  return EtherAmount.inWei(wei);
}

String ethToWeiHex(String amountEth) {
  final normalized = amountEth.trim();
  if (normalized.isEmpty) {
    throw ArgumentError('Amount cannot be empty.');
  }

  final parts = normalized.split('.');
  if (parts.length > 2) {
    throw ArgumentError('Invalid amount format.');
  }

  final wholePart = parts.first.isEmpty ? '0' : parts.first;
  if (!RegExp(r'^\d+$').hasMatch(wholePart)) {
    throw ArgumentError('Invalid amount format.');
  }

  final fractionPart = parts.length == 2 ? parts[1] : '';
  if (!RegExp(r'^\d*$').hasMatch(fractionPart)) {
    throw ArgumentError('Invalid amount format.');
  }

  if (fractionPart.length > 18) {
    throw ArgumentError('Amount has too many decimal places.');
  }

  final paddedFraction = fractionPart.padRight(18, '0');
  final wei = BigInt.parse(wholePart) * BigInt.from(10).pow(18) +
      BigInt.parse(paddedFraction);
  return '0x${wei.toRadixString(16).toUpperCase()}';
}

bool isValidEthereumAddress(String address) {
  final normalized = address.trim();
  if (!normalized.startsWith('0x') || normalized.length != 42) {
    return false;
  }
  return RegExp(r'^0x[a-fA-F0-9]{40}$').hasMatch(normalized);
}

String getChainDisplayName(String? chainId) {
  switch (chainId) {
    case '0x1':
      return 'Ethereum Mainnet';
    case '0x5':
      return 'Goerli';
    case '0xaa36a7':
      return 'Sepolia';
    case '0x89':
      return 'Polygon';
    case '0x13881':
      return 'Mumbai';
    case '0x539':
      return 'Ganache';
    default:
      return chainId ?? 'Unknown network';
  }
}
