import React from 'react';
import { FC } from 'react';
import styled from 'styled-components';

import { useObservable } from '../../../../../common/hooks/useObservable';
import { Flex, Typography } from '../../../../../ergodex-cdk';
import { selectedWallet$ } from '../../../../../gateway/api/wallets';
import { getShortAddress } from '../../../../../utils/string/addres';
import { DataTag } from '../../../../common/DataTag/DataTag';

export interface AddressTagProps {
  readonly address?: string;
  readonly className?: string;
}

export const AddressTag: FC<AddressTagProps> = ({ address, className }) => {
  const addressToRender = address ? getShortAddress(address) : '';
  const [selectedWallet] = useObservable(selectedWallet$);

  return (
    <DataTag
      secondary
      className={className}
      content={
        <Flex align="center">
          <Flex.Item align="center" marginRight={1}>
            {selectedWallet?.previewIcon}
          </Flex.Item>
          <Typography.Body
            secondary
            style={{ whiteSpace: 'nowrap', fontSize: '16px' }}
          >
            {addressToRender}
          </Typography.Body>
        </Flex>
      }
    />
  );
};