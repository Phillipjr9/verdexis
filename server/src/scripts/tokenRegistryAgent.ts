import "dotenv/config";
import axios from "axios";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { MintLayout } from "@solana/spl-token";
import Anthropic from "@anthropic-ai/sdk";
import { pathToFileURL } from "node:url";
import { prisma } from "../db.js";

interface TokenData {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  blockchain: "solana" | "ethereum";
  holder_count?: number;
  total_supply?: string;
  liquidity_usd?: number;
  verified_contract?: boolean;
  risk_score?: number;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  risk_level: "low" | "medium" | "high";
}

interface RegistryEntry {
  token: TokenData;
  added_at: string;
  validated_by: string;
}

class SolanaTokenFetcher {
  private connection: Connection;

  constructor(endpoint?: string) {
    this.connection = new Connection(endpoint ?? clusterApiUrl("mainnet-beta"), "confirmed");
  }

  async fetchTokenMetadata(mintAddress: string): Promise<Partial<TokenData>> {
    try {
      const mint = new PublicKey(mintAddress);
      const accountInfo = await this.connection.getAccountInfo(mint);

      if (!accountInfo) {
        throw new Error("Mint account not found");
      }

      const parsedMint = MintLayout.decode(accountInfo.data);
      const supply = parsedMint.supply.toString();
      const decimals = parsedMint.decimals;
      const largestAccounts = await this.connection.getTokenLargestAccounts(mint);

      return {
        chainId: 101,
        address: mintAddress,
        decimals,
        blockchain: "solana",
        total_supply: supply,
        holder_count: largestAccounts.value.length,
      };
    } catch (error) {
      throw new Error(`Failed to fetch Solana token: ${error}`);
    }
  }

  async fetchMetaplexMetadata(mintAddress: string): Promise<{ name: string; symbol: string; uri: string }> {
    void mintAddress;
    return {
      name: "Token",
      symbol: "TKN",
      uri: "",
    };
  }
}

class EthereumTokenFetcher {
  private etherscanApiKey: string;
  private rpcEndpoint: string;

  constructor(etherscanApiKey: string, rpcEndpoint?: string) {
    this.etherscanApiKey = etherscanApiKey;
    this.rpcEndpoint = rpcEndpoint ?? "https://ethereum-rpc.publicnode.com";
  }

  async fetchTokenInfo(contractAddress: string): Promise<Partial<TokenData>> {
    try {
      if (!this.etherscanApiKey) {
        return {
          chainId: 1,
          address: contractAddress,
          name: "Unknown",
          symbol: "UNK",
          decimals: 18,
          blockchain: "ethereum",
        };
      }

      const response = await axios.get("https://api.etherscan.io/api", {
        params: {
          module: "token",
          action: "tokeninfo",
          contractaddress: contractAddress,
          apikey: this.etherscanApiKey,
        },
      });

      if (response.data.status !== "1") {
        throw new Error(response.data.message ?? "Unable to resolve token info");
      }

      const result = response.data.result?.[0];
      if (!result) {
        throw new Error("No token info returned");
      }

      return {
        chainId: 1,
        address: contractAddress,
        name: result.TokenName,
        symbol: result.TokenSymbol,
        decimals: Number.parseInt(result.TokenDecimal, 10),
        total_supply: result.TotalSupply,
        blockchain: "ethereum",
      };
    } catch (error) {
      throw new Error(`Failed to fetch Ethereum token: ${error}`);
    }
  }

  async getHolderCount(contractAddress: string): Promise<number> {
    try {
      if (!this.etherscanApiKey) {
        return 0;
      }

      const response = await axios.get("https://api.etherscan.io/api", {
        params: {
          module: "token",
          action: "tokenholdercount",
          contractaddress: contractAddress,
          apikey: this.etherscanApiKey,
        },
      });

      return Number.parseInt(response.data.result, 10) || 0;
    } catch (error) {
      console.error("Failed to get holder count:", error);
      return 0;
    }
  }

  async checkContractSecurity(contractAddress: string): Promise<{ verified_contract: boolean; open_source: boolean }> {
    try {
      if (!this.etherscanApiKey) {
        return { verified_contract: false, open_source: false };
      }

      const response = await axios.get("https://api.etherscan.io/api", {
        params: {
          module: "contract",
          action: "getabi",
          address: contractAddress,
          apikey: this.etherscanApiKey,
        },
      });

      const verified = response.data.status === "1";
      return { verified_contract: verified, open_source: verified };
    } catch {
      return { verified_contract: false, open_source: false };
    }
  }

  async getTokenBalance(ownerAddress: string, contractAddress: string, decimals: number): Promise<number | null> {
    try {
      const normalizedOwner = ownerAddress.startsWith("0x") ? ownerAddress : `0x${ownerAddress}`;
      const normalizedContract = contractAddress.startsWith("0x") ? contractAddress : `0x${contractAddress}`;
      const data = `0x70a08231${normalizedOwner.slice(2).padStart(64, "0")}`;
      const response = await axios.post(
        this.rpcEndpoint,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: normalizedContract, data }, "latest"],
        },
        { timeout: 10000 },
      );

      const result = response.data?.result;
      if (!result || result === "0x") {
        return 0;
      }

      const raw = BigInt(result);
      const scale = 10n ** BigInt(decimals);
      const whole = raw / scale;
      const fraction = raw % scale;
      const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
      return fractionStr ? Number(`${whole}.${fractionStr}`) : Number(whole);
    } catch {
      return null;
    }
  }
}

class TokenValidator {
  validate(token: TokenData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let risk_score = 0;

    if (!token.name || token.name.length === 0) {
      errors.push("Token name is required");
    }
    if (!token.symbol || token.symbol.length === 0) {
      errors.push("Token symbol is required");
    }
    if (token.decimals < 0 || token.decimals > 255) {
      errors.push("Decimals must be between 0 and 255");
    }

    if (token.blockchain === "solana") {
      if (!this.isValidBase58Address(token.address)) {
        errors.push("Invalid Solana address format");
      }
    } else if (token.blockchain === "ethereum") {
      if (!this.isValidEthereumAddress(token.address)) {
        errors.push("Invalid Ethereum address format");
      }
    }

    if (token.holder_count && token.holder_count < 100) {
      warnings.push("Low holder count - less decentralized");
      risk_score += 25;
    }

    if (token.holder_count && token.holder_count < 10) {
      errors.push("Insufficient holder distribution");
      risk_score += 40;
    }

    if (!token.verified_contract && token.blockchain === "ethereum") {
      warnings.push("Contract not verified on Etherscan");
      risk_score += 15;
    }

    const risk_level = risk_score > 60 ? "high" : risk_score > 30 ? "medium" : "low";

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      risk_level,
    };
  }

  private isValidBase58Address(address: string): boolean {
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
    return base58Regex.test(address);
  }

  private isValidEthereumAddress(address: string): boolean {
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;
    return ethRegex.test(address);
  }
}

class TokenRegistryAgent {
  private client: Anthropic | null;
  private solanaFetcher: SolanaTokenFetcher;
  private ethereumFetcher: EthereumTokenFetcher;
  private validator: TokenValidator;
  private registry: RegistryEntry[] = [];

  constructor(
    anthropicApiKey: string | undefined,
    etherscanApiKey: string | undefined,
    solanaEndpoint?: string,
    ethereumRpcEndpoint?: string,
  ) {
    this.client = anthropicApiKey ? new Anthropic({ apiKey: anthropicApiKey }) : null;
    this.solanaFetcher = new SolanaTokenFetcher(solanaEndpoint);
    this.ethereumFetcher = new EthereumTokenFetcher(etherscanApiKey ?? "", ethereumRpcEndpoint);
    this.validator = new TokenValidator();
  }

  async processQuery(userQuery: string): Promise<string> {
    console.log("\n🤖 Token Registry Agent Processing Query...\n");
    console.log(userQuery);

    if (!this.client) {
      return this.processQueryWithoutAnthropic(userQuery);
    }

    const messages = [{ role: "user" as const, content: userQuery }];
    const response = await this.client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      system: "You are a token registry assistant. Fetch metadata, validate the token, and report the risk assessment.",
      messages,
    });

    const textParts = response.content.filter((block) => block.type === "text");
    const text = textParts.map((block) => (block.type === "text" ? block.text : "")).join("\n");
    return text || "No response returned.";
  }

  async runQuery(userQuery: string): Promise<string> {
    return this.processQueryWithoutAnthropic(userQuery);
  }

  async registerToken(input: {
    query?: string;
    chain?: "solana" | "ethereum";
    address?: string;
    name?: string;
    symbol?: string;
    decimals?: number;
    userId?: string;
    amount?: number;
    avgPrice?: number;
    type?: "crypto" | "stock" | "etf";
    mode?: "add" | "set";
    walletAddress?: string;
  }): Promise<string> {
    const query = input.query?.trim() ?? "";
    const requestedChain = input.chain;
    const requestedAddress = input.address?.trim() ?? "";
    const userId = input.userId?.trim();
    const amount = typeof input.amount === "number" ? input.amount : 0;
    const avgPrice = typeof input.avgPrice === "number" ? input.avgPrice : 0;
    const walletAddress = input.walletAddress?.trim();
    const tokenType = input.type ?? "crypto";
    const mode = input.mode === "set" ? "set" : "add";

    let chain: "solana" | "ethereum" | undefined = requestedChain;
    let address = requestedAddress;

    if (!chain || !address) {
      const parsed = this.extractTokenRequest(query);
      if (parsed) {
        chain = parsed.chain;
        address = parsed.address;
      }
    }

    if (!chain || !address) {
      return JSON.stringify({ success: false, error: "Missing token chain or address" }, null, 2);
    }

    try {
      let token: Partial<TokenData> = {};
      try {
        if (chain === "solana") {
          token = await this.solanaFetcher.fetchTokenMetadata(address);
          token.blockchain = "solana";
          const metaplexMetadata = await this.solanaFetcher.fetchMetaplexMetadata(address);
          token.name = input.name ?? metaplexMetadata.name;
          token.symbol = input.symbol ?? metaplexMetadata.symbol;
        } else {
          token = await this.ethereumFetcher.fetchTokenInfo(address);
          const holderCount = await this.ethereumFetcher.getHolderCount(address);
          const security = await this.ethereumFetcher.checkContractSecurity(address);
          token.blockchain = "ethereum";
          token.holder_count = holderCount;
          token.verified_contract = security.verified_contract;
          token.name = input.name ?? token.name ?? "Unknown";
          token.symbol = input.symbol ?? token.symbol ?? "UNK";
        }
      } catch {
        const fallback = this.getTokenFallback(chain, address, input.name, input.symbol, input.decimals);
        token = {
          chainId: fallback.chainId ?? (chain === "solana" ? 101 : 1),
          address,
          name: fallback.name ?? "Unknown",
          symbol: fallback.symbol ?? (chain === "solana" ? "TOKEN" : "UNK"),
          decimals: fallback.decimals ?? 18,
          blockchain: chain,
        };
      }

      const normalizedToken: TokenData = {
        chainId: token.chainId ?? (chain === "solana" ? 101 : 1),
        address,
        name: token.name ?? input.name ?? "Unknown",
        symbol: (token.symbol ?? input.symbol ?? (chain === "solana" ? "TOKEN" : "UNK")).toUpperCase(),
        decimals: token.decimals ?? input.decimals ?? 18,
        blockchain: chain,
        holder_count: token.holder_count,
        total_supply: token.total_supply,
        verified_contract: token.verified_contract,
        liquidity_usd: token.liquidity_usd,
        ...(token.logoURI ? { logoURI: token.logoURI } : {}),
      };

      let effectiveAmount = amount;
      let resolvedFromWallet = false;
      if (walletAddress) {
        const walletBalance = chain === "solana"
          ? await this.resolveSolanaWalletBalance(address, walletAddress)
          : await this.ethereumFetcher.getTokenBalance(walletAddress, address, normalizedToken.decimals);

        if (walletBalance !== null) {
          effectiveAmount = walletBalance;
          resolvedFromWallet = true;
        }
      }

      const validation = this.validator.validate(normalizedToken);
      const shouldAdd = validation.valid && validation.risk_level === "low";

      if (shouldAdd) {
        this.registry.push({
          token: normalizedToken,
          added_at: new Date().toISOString(),
          validated_by: "ai-agent",
        });
      }

      let holding: unknown = null;
      if (userId && amount >= 0) {
        holding = await prisma.holding.upsert({
          where: {
            userId_symbol: {
              userId,
              symbol: normalizedToken.symbol,
            },
          },
          create: {
            userId,
            symbol: normalizedToken.symbol,
            name: normalizedToken.name,
            amount: effectiveAmount,
            avgPrice,
            type: tokenType,
          },
          update: {
            name: normalizedToken.name,
            ...(mode === "set"
              ? { amount: effectiveAmount }
              : { amount: { increment: effectiveAmount } }),
            ...(avgPrice > 0 ? { avgPrice } : {}),
            type: tokenType,
          },
        });
      }

      return JSON.stringify(
        {
          success: true,
          token: normalizedToken,
          validation,
          registered_to_registry: shouldAdd,
          resolved_from_wallet: resolvedFromWallet,
          effective_amount: effectiveAmount,
          holding,
          registry_status: this.getRegistryStatus(),
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          registry_status: this.getRegistryStatus(),
        },
        null,
        2,
      );
    }
  }

  private async processQueryWithoutAnthropic(userQuery: string): Promise<string> {
    const lower = userQuery.toLowerCase();
    if (lower.includes("registry status") || lower.includes("current registry") || lower.includes("how many tokens")) {
      return JSON.stringify({
        success: true,
        registry_status: this.getRegistryStatus(),
      }, null, 2);
    }

    const tokenRequest = this.extractTokenRequest(userQuery);
    if (!tokenRequest) {
      return "I could not determine a token request from the query. Provide a token address and chain.";
    }

    const { chain, address } = tokenRequest;

    try {
      let token: Partial<TokenData> = {};
      if (chain === "solana") {
        token = await this.solanaFetcher.fetchTokenMetadata(address);
        token.blockchain = "solana";
        const metaplexMetadata = await this.solanaFetcher.fetchMetaplexMetadata(address);
        token.name = metaplexMetadata.name;
        token.symbol = metaplexMetadata.symbol;
      } else {
        token = await this.ethereumFetcher.fetchTokenInfo(address);
        const holderCount = await this.ethereumFetcher.getHolderCount(address);
        const security = await this.ethereumFetcher.checkContractSecurity(address);
        token.blockchain = "ethereum";
        token.holder_count = holderCount;
        token.verified_contract = security.verified_contract;
      }

      const normalizedToken: TokenData = {
        chainId: token.chainId ?? (chain === "solana" ? 101 : 1),
        address,
        name: token.name ?? "Unknown",
        symbol: token.symbol ?? (chain === "solana" ? "TOKEN" : "UNK"),
        decimals: token.decimals ?? 18,
        blockchain: chain,
        holder_count: token.holder_count,
        total_supply: token.total_supply,
        verified_contract: token.verified_contract,
        liquidity_usd: token.liquidity_usd,
        logoURI: token.logoURI,
      };

      const validation = this.validator.validate(normalizedToken);
      const shouldAdd = validation.valid && validation.risk_level === "low";

      if (shouldAdd) {
        this.registry.push({
          token: normalizedToken,
          added_at: new Date().toISOString(),
          validated_by: "ai-agent",
        });
      }

      return JSON.stringify(
        {
          success: true,
          token: normalizedToken,
          validation,
          added_to_registry: shouldAdd,
          registry_status: this.getRegistryStatus(),
        },
        null,
        2,
      );
    } catch (error) {
      return JSON.stringify(
        {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          registry_status: this.getRegistryStatus(),
        },
        null,
        2,
      );
    }
  }

  private async resolveSolanaWalletBalance(mintAddress: string, walletAddress: string): Promise<number | null> {
    try {
      const connection = new Connection(process.env["SOLANA_RPC_ENDPOINT"] ?? clusterApiUrl("mainnet-beta"), "confirmed");
      const owner = new PublicKey(walletAddress);
      const mint = new PublicKey(mintAddress);
      const accounts = await connection.getParsedTokenAccountsByOwner(owner, { mint });
      if (!accounts.value.length) {
        return 0;
      }

      const account = accounts.value[0];
      const amount = account.account.data.parsed.info.tokenAmount?.amount;
      const decimals = account.account.data.parsed.info.tokenAmount?.decimals;
      if (typeof amount === "string" && typeof decimals === "number") {
        const raw = BigInt(amount);
        const scale = 10n ** BigInt(decimals);
        const whole = raw / scale;
        const fraction = raw % scale;
        const fractionStr = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
        return fractionStr ? Number(`${whole}.${fractionStr}`) : Number(whole);
      }

      return null;
    } catch {
      return null;
    }
  }

  private getTokenFallback(
    chain: "solana" | "ethereum",
    address: string,
    name?: string,
    symbol?: string,
    decimals?: number,
  ): Partial<TokenData> {
    const known = chain === "solana"
      ? {
          "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { name: "USD Coin", symbol: "USDC", decimals: 6 },
          "Es9vMfrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { name: "USD Tether", symbol: "USDT", decimals: 6 },
          "So11111111111111111111111111111111111111112": { name: "Solana", symbol: "SOL", decimals: 9 },
        }
      : {
          "0xdAC17F958D2ee523a2206206994597C13D831ec7": { name: "Tether USD", symbol: "USDT", decimals: 6 },
          "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": { name: "USD Coin", symbol: "USDC", decimals: 6 },
          "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": { name: "Wrapped BTC", symbol: "WBTC", decimals: 8 },
        };

    const fallback = known[address as keyof typeof known];
    return {
      chainId: chain === "solana" ? 101 : 1,
      name: name ?? fallback?.name ?? "Unknown",
      symbol: (symbol ?? fallback?.symbol ?? "TOKEN").toUpperCase(),
      decimals: decimals ?? fallback?.decimals ?? 18,
    };
  }

  private extractTokenRequest(query: string): { chain: "solana" | "ethereum"; address: string } | null {
    const lower = query.toLowerCase();

    if (lower.includes("registry status") || lower.includes("current registry") || lower.includes("how many tokens")) {
      return null;
    }

    if (lower.includes("usdc") || lower.includes("solana")) {
      const addressMatch = query.match(/(?:mint|address)[:=]?\s*([1-9A-HJ-NP-Za-km-z]{32,44})/i);
      if (addressMatch?.[1]) {
        const candidate = addressMatch[1];
        if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(candidate)) {
          return { chain: "solana", address: candidate };
        }
      }

      if (lower.includes("usdc")) {
        return {
          chain: "solana",
          address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        };
      }
    }

    if (lower.includes("ethereum") || lower.includes("eth") || lower.includes("usdt")) {
      const addressMatch = query.match(/0x[a-fA-F0-9]{40}/);
      if (addressMatch) {
        return { chain: "ethereum", address: addressMatch[0] };
      }

      if (lower.includes("usdt")) {
        return {
          chain: "ethereum",
          address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        };
      }
    }

    return null;
  }

  getRegistryStatus(): { total_tokens: number; solana_tokens: number; ethereum_tokens: number } {
    return {
      total_tokens: this.registry.length,
      solana_tokens: this.registry.filter((entry) => entry.token.blockchain === "solana").length,
      ethereum_tokens: this.registry.filter((entry) => entry.token.blockchain === "ethereum").length,
    };
  }
}

async function main(): Promise<void> {
  const agent = new TokenRegistryAgent(
    process.env["ANTHROPIC_API_KEY"],
    process.env["ETHERSCAN_API_KEY"],
    process.env["SOLANA_RPC_ENDPOINT"],
  );

  const queries = [
    "Fetch and validate the USDC token on Solana (mint: EPjFWaLb3hyMa8PDvGktro6YgiKWSZsSLqIAEs8huJu). If it passes validation with low risk, add it to the registry.",
    "Fetch and validate USDT on Ethereum (0xdAC17F958D2ee523a2206206994597C13D831ec7). Check contract verification and holder count. Report if it's safe to list.",
    "Show me the current registry status - how many tokens do we have listed across blockchains?",
  ];

  for (const query of queries) {
    const result = await agent.processQuery(query);
    console.log("\n" + "=".repeat(80) + "\n");
    console.log(result);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { TokenRegistryAgent, SolanaTokenFetcher, EthereumTokenFetcher, TokenValidator };
