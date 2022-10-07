import { Button, Flex, Form, Modal, useForm } from '@ergolabs/ui-kit';
import { t, Trans } from '@lingui/macro';
import React, { FC, useState } from 'react';
import { first } from 'rxjs';

import { panalytics } from '../../../../../../common/analytics';
import { TxId } from '../../../../../../common/types';
import { CurrencyPreview } from '../../../../../../components/CurrencyPreview/CurrencyPreview';
import { SwapFormModel } from '../../../../../../pages/Swap/SwapFormModel';
import { ergoPaySwap } from '../../../../operations/swap/ergopaySwap';
import { SwapConfirmationInfo } from '../../common/SwapConfirmationInfo/SwapConfirmationInfo';

export interface ErgoPayOpenWalletContentProps {
  readonly value: Required<SwapFormModel>;
  readonly onTxRegister: (p: TxId) => void;
}

export const ErgoPayOpenWalletContent: FC<ErgoPayOpenWalletContentProps> = ({
  value,
  onTxRegister,
}) => {
  const form = useForm<SwapFormModel>(value);
  const [loading, setLoading] = useState<boolean>(false);

  const swapOperation = async () => {
    if (value.pool && value.fromAmount && value.toAmount) {
      panalytics.confirmSwap(value);
      setLoading(true);
      ergoPaySwap(value.pool as any, value.fromAmount, value.toAmount)
        .pipe(first())
        .subscribe({
          next: (txId) => {
            setLoading(false);
            onTxRegister(txId);
          },
          error: () => setLoading(false),
        });
    }
  };

  return (
    <>
      <Modal.Title>
        <Trans>Confirm swap</Trans>
      </Modal.Title>
      <Modal.Content width={496}>
        <Form form={form} onSubmit={swapOperation}>
          <Flex direction="col">
            <Flex.Item marginBottom={1}>
              <CurrencyPreview value={value.fromAmount} label={t`From`} />
            </Flex.Item>
            <Flex.Item marginBottom={4}>
              <CurrencyPreview value={value.toAmount} label={t`To`} />
            </Flex.Item>
            <Flex.Item marginBottom={4}>
              <SwapConfirmationInfo value={value} />
            </Flex.Item>
            <Flex.Item>
              <Button
                size="extra-large"
                type="primary"
                htmlType="submit"
                block
                loading={loading}
              >
                {t`Open Wallet`}
              </Button>
            </Flex.Item>
          </Flex>
        </Form>
      </Modal.Content>
    </>
  );
};
