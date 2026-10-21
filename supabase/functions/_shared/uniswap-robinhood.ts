// Uniswap V3 on Robinhood Chain (chain 4663), from Uniswap's published
// deployments and checked on chain: SwapRouter02 and QuoterV2 both report
// this factory and WETH9.
export const uniswapV3FactoryAddress =
  "0x1f7d7550B1b028f7571E69A784071F0205FD2EfA" as const;
export const uniswapSwapRouter02Address =
  "0xCaf681a66D020601342297493863E78C959E5cb2" as const;
export const uniswapQuoterV2Address =
  "0x33e885eD0Ec9bF04EcfB19341582aADCb4c8A9E7" as const;
export const robinhoodWethAddress =
  "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73" as const;
export const uniswapV3FeeTiers = [100, 500, 3000, 10000] as const;

// SwapRouter02 routes a swap's output to itself when the recipient is this
// constant, so a later unwrapWETH9 call can pay out native ETH.
export const swapRouterSelfRecipient =
  "0x0000000000000000000000000000000000000002" as const;
