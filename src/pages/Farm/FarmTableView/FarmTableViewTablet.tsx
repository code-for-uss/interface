import { Button, Flex } from '@ergolabs/ui-kit';
import { Trans } from '@lingui/macro';
import React from 'react';

import { LmPool } from '../../../common/models/LmPool';
import { DataTag } from '../../../components/common/DataTag/DataTag';
import { InfoTooltip } from '../../../components/InfoTooltip/InfoTooltip';
import { ExpandComponentProps } from '../../../components/TableView/common/Expand';
import { TableView } from '../../../components/TableView/TableView';
import { LiquiditySearchState } from '../../Liquidity/common/tableViewStates/LiquiditySearchState/LiquiditySearchState';
import { FarmPairColumn } from '../FarmPairColumn/FarmPairColumn';
import { LineProgress } from '../LineProgress/LineProgress';
import { FarmTableLoadingState } from './FarmTableLoadingState';

type Props = {
  expandComponent: React.FC<ExpandComponentProps<any>>;
  items: any;
  openStakeModal: (pool: LmPool) => void;
  loading: boolean | undefined;
};

export const FarmTableViewTablet = ({
  items,
  expandComponent,
  openStakeModal,
  loading,
}: Props) => {
  return (
    <TableView
      items={items}
      itemKey="id"
      itemHeight={80}
      maxHeight={600}
      gap={2}
      tableHeaderPadding={[0, 6]}
      tableItemViewPadding={[0, 4]}
      expand={{
        height: 300,
        accordion: true,
        component: expandComponent,
      }}
      expandPadding={[0, 0]}
    >
      <TableView.Column
        minWidth={290}
        maxWidth={290}
        headerMinWidth={282}
        headerMaxWidth={282}
        title={<Trans>Pair</Trans>}
      >
        {(lmPool) => <FarmPairColumn lmPool={lmPool} status="Scheduled" />}
      </TableView.Column>

      <TableView.Column
        minWidth={132}
        maxWidth={132}
        title={
          <InfoTooltip
            width={194}
            placement="top"
            content={
              <Trans>
                345 Neta out of 1000 Neta have already been distributed
              </Trans>
            }
          >
            <Trans>Distributed</Trans>
          </InfoTooltip>
        }
      >
        {/*{(lmPool: LmPool) => <AprColumn lmPool={poolMapper(lmPool)} />}*/}
        {/*{(lmPool) => <Progress percent={90} />}*/}
        {(lmPool) => <LineProgress percent={60} height={24} width="100px" />}
      </TableView.Column>
      <TableView.Column width="100%" title={<Trans>APY</Trans>}>
        {/*{(lmPool) => <TvlOrVolume24Column usd={poolMapper(lmPool).volume} />}*/}
        {(lmPool) => (
          <Flex justify="space-between">
            <DataTag content={<div>30%</div>} />
            <Flex.Item marginRight={8}>
              <Button
                type="primary"
                onClick={(event) => {
                  openStakeModal(lmPool);
                  event.stopPropagation();
                }}
              >
                Stake
              </Button>
            </Flex.Item>
          </Flex>
        )}
      </TableView.Column>
      <TableView.State name="loading" condition={loading}>
        <FarmTableLoadingState />
      </TableView.State>
      <TableView.State name="search" condition={!items.length}>
        <LiquiditySearchState />
      </TableView.State>
    </TableView>
  );
};
