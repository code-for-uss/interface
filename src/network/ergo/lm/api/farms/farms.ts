import { LmPool as BaseLmPool } from '@ergolabs/ergo-dex-sdk';
import uniqBy from 'lodash/uniqBy';
import {
  combineLatest,
  debounceTime,
  defaultIfEmpty,
  map,
  Observable,
  of,
  publishReplay,
  refCount,
  startWith,
  switchMap,
  zip,
} from 'rxjs';

import { applicationConfig } from '../../../../../applicationConfig';
import { AmmPool } from '../../../../../common/models/AmmPool';
import { Balance } from '../../../../../common/models/Balance';
import { Farm } from '../../../../../common/models/Farm';
import { ammPools$ } from '../../../api/ammPools/ammPools';
import { lpBalance$ } from '../../../api/balance/lpBalance';
import { mapToAssetInfo } from '../../../api/common/assetInfoManager';
import { rawLmPools$ } from '../../../api/common/rawLmPools';
import { convertToConvenientNetworkAsset } from '../../../api/ergoUsdRatio/ergoUsdRatio';
import { networkContext$ } from '../../../api/networkContext/networkContext';
import { ErgoFarm, ErgoLmPoolParams } from '../../models/ErgoFarm';
import {
  rawStakesWithRedeemerKey$,
  RawStakeWithRedeemerKey,
} from '../stakes/stakes';

const toFarm = (params: ErgoLmPoolParams): Observable<Farm> =>
  zip(
    [
      params.lmPool.lq.asset,
      params.lmPool.tt.asset,
      params.lmPool.vlq.asset,
      params.lmPool.budget.asset,
    ].map((asset) => mapToAssetInfo(asset.id)),
  ).pipe(
    switchMap(([lq, tt, vlq, reward]) =>
      combineLatest([
        convertToConvenientNetworkAsset.rate(
          reward || params.lmPool.budget.asset,
        ),
        convertToConvenientNetworkAsset.rate(params.ammPool.x.asset),
        convertToConvenientNetworkAsset.rate(params.ammPool.y.asset),
      ]).pipe(
        debounceTime(100),
        map(() => [lq, tt, vlq, reward]),
      ),
    ),
    map(
      ([lq, tt, vlq, reward]) =>
        new ErgoFarm(params, {
          lq: lq || params.lmPool.lq.asset,
          vlq: vlq || params.lmPool.vlq.asset,
          tt: tt || params.lmPool.tt.asset,
          reward: reward || params.lmPool.budget.asset,
        }),
    ),
  );

const toFarmStreams = (
  rawLmPools: BaseLmPool[],
  ammPools: AmmPool[],
  stakes: RawStakeWithRedeemerKey[],
  lpBalance: Balance,
  currentHeight: number,
): Observable<Farm>[] =>
  rawLmPools.reduce<Observable<Farm>[]>((acc, rawLmPool) => {
    const ammPoolByLq = ammPools.find(
      (ammPool) => ammPool.lp.asset.id === rawLmPool.lq.asset.id,
    );

    if (ammPoolByLq) {
      acc.push(
        toFarm({
          lmPool: rawLmPool,
          ammPool: ammPoolByLq,
          currentHeight,
          balanceLq: lpBalance.get(rawLmPool.lq.asset),
          stakes: stakes.filter((s) => s.poolId === rawLmPool.id),
        }),
      );
    }
    return acc;
  }, []);

export const allFarms$ = combineLatest([
  rawLmPools$,
  ammPools$,
  rawStakesWithRedeemerKey$,
  lpBalance$.pipe(startWith(new Balance([]))),
  networkContext$,
]).pipe(
  debounceTime(100),
  switchMap(([rawLmPools, ammPools, stakes, lpBalance, networkContext]) =>
    combineLatest(
      toFarmStreams(
        rawLmPools,
        ammPools,
        stakes,
        lpBalance,
        networkContext.height,
      ),
    ).pipe(defaultIfEmpty([])),
  ),
  publishReplay(1),
  refCount(),
);

export const farms$ = allFarms$.pipe(
  map((lmPools) =>
    lmPools.filter(
      (lmPool) => !applicationConfig.blacklistedPools.includes(lmPool.id),
    ),
  ),
  map((farms) => uniqBy(farms, 'id')),
  publishReplay(1),
  refCount(),
);