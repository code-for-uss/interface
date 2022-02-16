/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain,react-hooks/exhaustive-deps */
import './AddLiquidity.less';

import { PoolId } from '@ergolabs/ergo-dex-sdk';
import { AssetInfo } from '@ergolabs/ergo-sdk/build/main/entities/assetInfo';
import { Skeleton } from 'antd';
import React, { useEffect, useMemo } from 'react';
import { useParams } from 'react-router';
import {
  BehaviorSubject,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  map,
  of,
  skip,
  switchMap,
} from 'rxjs';

import { getAmmPoolById, getAmmPoolsByAssetPair } from '../../api/ammPools';
import { useAssetsBalance } from '../../api/assetBalance';
import { getAvailableAssetFor, tokenAssets$ } from '../../api/assets';
import {
  useObservable,
  useSubject,
  useSubscription,
} from '../../common/hooks/useObservable';
import { Currency } from '../../common/models/Currency';
import { ActionForm } from '../../components/common/ActionForm/ActionForm';
import { PoolSelect } from '../../components/common/PoolSelect/PoolSelect';
import { TokenControlFormItem } from '../../components/common/TokenControl/TokenControl';
import { TokeSelectFormItem } from '../../components/common/TokenControl/TokenSelect/TokenSelect';
import {
  openConfirmationModal,
  Operation,
} from '../../components/ConfirmationModal/ConfirmationModal';
import { Page } from '../../components/Page/Page';
import { Button, Flex, Form, Typography, useForm } from '../../ergodex-cdk';
import { useMaxTotalFees, useNetworkAsset } from '../../services/new/core';
import { AddLiquidityConfirmationModal } from './AddLiquidityConfirmationModal/AddLiquidityConfirmationModal';
import { AddLiquidityFormModel } from './FormModel';

const getAssetsByToken = (tokenId?: string) => {
  return tokenId ? getAvailableAssetFor(tokenId) : of([]);
};

const getAvailablePools = (xId?: string, yId?: string) =>
  xId && yId ? getAmmPoolsByAssetPair(xId, yId) : of([]);

const normalizeAmount = (
  amount: Currency,
  networkAsset: AssetInfo,
  fee: Currency,
): Currency =>
  amount.asset.id === networkAsset.id ? amount.minus(fee) : amount;

const AddLiquidity = (): JSX.Element => {
  const [balance] = useAssetsBalance();
  const totalFees = useMaxTotalFees();
  const networkAsset = useNetworkAsset();
  const { poolId } = useParams<{ poolId?: PoolId }>();
  const form = useForm<AddLiquidityFormModel>({
    x: undefined,
    y: undefined,
    pool: undefined,
    xAmount: undefined,
    yAmount: undefined,
  });
  const [pools, updatePools, poolsLoading] = useSubject(getAvailablePools);
  const [isPairSelected] = useObservable(
    combineLatest([
      form.controls.x.valueChangesWithSystem$,
      form.controls.y.valueChangesWithSystem$,
    ]).pipe(
      debounceTime(100),
      map(([x, y]) => !!x && !!y),
    ),
  );

  useEffect(() => {
    if (!poolId) {
      form.patchValue({ x: networkAsset });
    }
  }, [networkAsset]);

  const updateYAssets$ = useMemo(
    () => new BehaviorSubject<string | undefined>(undefined),
    [],
  );
  const yAssets$ = useMemo(
    () => updateYAssets$.pipe(switchMap(getAssetsByToken)),
    [],
  );

  useSubscription(form.controls.x.valueChanges$, () =>
    form.patchValue({
      y: undefined,
      pool: undefined,
      yAmount: undefined,
      xAmount: undefined,
    }),
  );

  useSubscription(
    combineLatest([
      form.controls.x.valueChangesWithSystem$,
      form.controls.y.valueChangesWithSystem$.pipe(skip(1)),
    ]).pipe(debounceTime(100)),
    ([x, y]) => {
      updatePools(x?.id, y?.id);
    },
  );

  useSubscription(
    of(poolId).pipe(
      filter(Boolean),
      switchMap((poolId) => getAmmPoolById(poolId)),
      distinctUntilChanged((poolA, poolB) => poolA?.id === poolB?.id),
    ),
    (pool) => {
      form.patchValue(
        {
          x: pool?.x.asset,
          y: pool?.y.asset,
        },
        { emitEvent: 'system' },
      );
    },
  );

  useSubscription(
    combineLatest([
      form.controls.xAmount.valueChanges$.pipe(skip(1)),
      form.controls.pool.valueChanges$,
    ]).pipe(debounceTime(100)),
    ([amount]) =>
      form.controls.yAmount.patchValue(
        amount ? form.value.pool!.calculateDepositAmount(amount) : undefined,
        { emitEvent: 'silent' },
      ),
  );

  useSubscription(
    form.controls.yAmount.valueChanges$.pipe(skip(1)),
    (amount) => {
      form.controls.xAmount.patchValue(
        amount ? form.value.pool!.calculateDepositAmount(amount) : undefined,
        { emitEvent: 'system' },
      );
    },
    [],
  );

  useSubscription(
    form.controls.x.valueChangesWithSilent$,
    (token: AssetInfo | undefined) => updateYAssets$.next(token?.id),
  );

  const getInsufficientTokenNameForFee = ({
    xAmount,
  }: Required<AddLiquidityFormModel>): string | undefined => {
    const totalFeesWithAmount = xAmount.isAssetEquals(networkAsset)
      ? xAmount.plus(totalFees)
      : totalFees;

    return totalFeesWithAmount.gt(balance.get(networkAsset))
      ? networkAsset.name
      : undefined;
  };

  const getInsufficientTokenNameForTx = ({
    xAmount,
    yAmount,
  }: Required<AddLiquidityFormModel>): string | undefined => {
    if (xAmount.gt(balance.get(xAmount.asset))) {
      return xAmount.asset.name;
    }

    if (yAmount.gt(balance.get(yAmount.asset))) {
      return yAmount.asset.name;
    }

    return undefined;
  };

  const isAmountNotEntered = ({
    xAmount,
    yAmount,
  }: AddLiquidityFormModel): boolean => {
    if (
      (!xAmount?.isPositive() && yAmount?.isPositive()) ||
      (!yAmount?.isPositive() && xAmount?.isPositive())
    ) {
      return false;
    }

    return !xAmount?.isPositive() || !yAmount?.isPositive();
  };

  const getMinValueForToken = ({
    xAmount,
    yAmount,
    x,
    y,
    pool,
  }: AddLiquidityFormModel): Currency | undefined => {
    if (!xAmount?.isPositive() && yAmount?.isPositive() && pool) {
      return pool.calculateDepositAmount(new Currency(1n, x)).plus(1n);
    }
    if (!yAmount?.isPositive() && xAmount?.isPositive() && pool) {
      return pool.calculateDepositAmount(new Currency(1n, y));
    }
    return undefined;
  };

  const isTokensNotSelected = (value: AddLiquidityFormModel): boolean => {
    return !value.pool;
  };

  const addLiquidityAction = (value: Required<AddLiquidityFormModel>) => {
    openConfirmationModal(
      (next) => {
        return (
          <AddLiquidityConfirmationModal
            value={value}
            onClose={(request: Promise<any>) =>
              next(
                request.then((tx) => {
                  resetForm();
                  return tx;
                }),
              )
            }
          />
        );
      },
      Operation.ADD_LIQUIDITY,
      {
        xAsset: value.xAmount!,
        yAsset: value.yAmount!,
      },
    );
  };

  const handleMaxLiquidityBtn = () => {
    if (!form.value.x || !form.value.y || !form.value.pool) {
      return;
    }

    let newXAmount = normalizeAmount(
      balance.get(form.value.x),
      networkAsset,
      totalFees,
    );
    let newYAmount = normalizeAmount(
      form.value.pool.calculateDepositAmount(newXAmount),
      networkAsset,
      totalFees,
    );

    if (
      newXAmount.isPositive() &&
      newYAmount.isPositive() &&
      newYAmount.lte(balance.get(form.value.y))
    ) {
      form.patchValue(
        {
          xAmount: newXAmount,
          yAmount: newYAmount,
        },
        { emitEvent: 'silent' },
      );
      return;
    }

    newYAmount = normalizeAmount(
      balance.get(form.value.y),
      networkAsset,
      totalFees,
    );
    newXAmount = normalizeAmount(
      form.value.pool.calculateDepositAmount(newYAmount),
      networkAsset,
      totalFees,
    );

    if (
      newYAmount.isPositive() &&
      newXAmount.isPositive() &&
      newXAmount.lte(balance.get(form.value.x))
    ) {
      form.patchValue(
        {
          xAmount: newXAmount,
          yAmount: newYAmount,
        },
        { emitEvent: 'silent' },
      );
      return;
    }

    if (balance.get(form.value.x).isPositive()) {
      form.patchValue(
        {
          xAmount: balance.get(form.value.x),
          yAmount: form.value.pool.calculateDepositAmount(
            balance.get(form.value.x),
          ),
        },
        { emitEvent: 'silent' },
      );
      return;
    } else {
      form.patchValue(
        {
          yAmount: balance.get(form.value.y),
          xAmount: form.value.pool.calculateDepositAmount(
            balance.get(form.value.y),
          ),
        },
        { emitEvent: 'silent' },
      );
    }
  };

  const resetForm = () =>
    form.patchValue(
      {
        xAmount: undefined,
        yAmount: undefined,
      },
      { emitEvent: 'silent' },
    );

  return (
    <Page title="Add liquidity" width={480} withBackButton backTo="/pool">
      {!poolId || !poolsLoading ? (
        <ActionForm
          form={form}
          actionButton="Add liquidity"
          getMinValueForToken={getMinValueForToken}
          getInsufficientTokenNameForFee={getInsufficientTokenNameForFee}
          getInsufficientTokenNameForTx={getInsufficientTokenNameForTx}
          isAmountNotEntered={isAmountNotEntered}
          isTokensNotSelected={isTokensNotSelected}
          action={addLiquidityAction}
        >
          <Flex direction="col">
            <Flex.Item marginBottom={4}>
              <Typography.Body strong>Select Pair</Typography.Body>
              <Flex justify="center" align="center">
                <Flex.Item marginRight={2} style={{ width: '100%' }}>
                  <TokeSelectFormItem name="x" assets$={tokenAssets$} />
                </Flex.Item>
                <Flex.Item style={{ width: '100%' }}>
                  <TokeSelectFormItem name="y" assets$={yAssets$} />
                </Flex.Item>
              </Flex>
            </Flex.Item>
            <Flex.Item
              marginBottom={4}
              style={{ opacity: isPairSelected ? '' : '0.3' }}
            >
              <Typography.Body strong>Select Pool</Typography.Body>
              <Form.Item name="pool">
                {({ value, onChange }) => (
                  <PoolSelect
                    positions={pools}
                    value={value}
                    onChange={onChange}
                  />
                )}
              </Form.Item>
            </Flex.Item>
            <Flex.Item />
            <Flex.Item
              marginBottom={4}
              style={{ opacity: isPairSelected ? '' : '0.3' }}
            >
              <Flex direction="col">
                <Flex.Item marginBottom={2}>
                  <Flex justify="space-between">
                    <Typography.Body strong>Liquidity</Typography.Body>
                    <Button
                      type="default"
                      size="small"
                      disabled={!isPairSelected}
                      onClick={handleMaxLiquidityBtn}
                    >
                      Add max liquidity
                    </Button>
                  </Flex>
                </Flex.Item>
                <Flex.Item marginBottom={2}>
                  <TokenControlFormItem
                    bordered
                    readonly="asset"
                    disabled={!isPairSelected}
                    amountName="xAmount"
                    tokenName="x"
                    assets$={tokenAssets$}
                  />
                </Flex.Item>
                <Flex.Item>
                  <TokenControlFormItem
                    bordered
                    readonly="asset"
                    disabled={!isPairSelected}
                    amountName="yAmount"
                    tokenName="y"
                    assets$={yAssets$}
                  />
                </Flex.Item>
              </Flex>
            </Flex.Item>
          </Flex>
        </ActionForm>
      ) : (
        <Skeleton active />
      )}
    </Page>
  );
};
export { AddLiquidity };