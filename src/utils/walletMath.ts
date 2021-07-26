import { ErgoBox } from 'ergo-dex-sdk/build/module/ergo';
import { evaluate } from 'mathjs';
import { AmmPool } from 'ergo-dex-sdk';
import { AssetAmount } from 'ergo-dex-sdk/build/module/ergo';

export const calculateAvailableAmount = (
  tokenId: string,
  boxes: ErgoBox[],
): bigint => {
  return boxes
    .flatMap(({ assets }) => assets)
    .filter((a) => a.tokenId == tokenId)
    .map(({ amount }) => amount)
    .reduce((acc, x) => acc + x, 0n);
};

export const inputToFractions = (input: string, numDecimals?: number): bigint =>
  BigInt(evaluate(`${input}*10^${numDecimals || 0}`).toFixed(0));

export const inputToRender = (
  input: bigint | number,
  numDecimals?: number,
): string => String(evaluate(`${input}/10^${numDecimals || 0}`));

type BaseInputParameters = {
  baseInput: AssetAmount;
  baseInputAmount: bigint;
  minOutput: AssetAmount;
};

export const getBaseInputParameters = (
  pool: AmmPool,
  {
    inputAmount,
    inputAssetAmount,
    slippage,
  }: { inputAmount: string; inputAssetAmount: AssetAmount; slippage: number },
): BaseInputParameters => {
  const baseInputAmount = BigInt(
    evaluate(
      `${inputAmount} * 10^${inputAssetAmount.asset.decimals ?? 0}`,
    ).toFixed(0),
  );
  const baseInput = pool.x.withAmount(BigInt(baseInputAmount));
  const minOutput = pool.outputAmount(baseInput, slippage);

  return {
    baseInput,
    baseInputAmount,
    minOutput,
  };
};
