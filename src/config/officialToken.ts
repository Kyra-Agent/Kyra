import { robinhoodChain } from "./productChains";
import {
  getOfficialKyraTokenAddress,
  kyraTokenSymbol,
} from "./transferTransactionPolicy";

const contractAddress = getOfficialKyraTokenAddress();

export const officialKyraToken = Object.freeze({
  name: "Kyra",
  symbol: kyraTokenSymbol,
  chain: robinhoodChain,
  contractAddress,
  published: contractAddress !== null,
  explorerUrl: contractAddress
    ? `${robinhoodChain.explorerUrl}/token/${contractAddress}`
    : null,
  announcementUrl: "https://x.com/Kyra_Agent",
});
