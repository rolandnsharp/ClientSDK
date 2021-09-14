import config from '../../config';
import { SigningStargateClient, MsgTransferEncodeObject } from '@cosmjs/stargate';
import { StdFee } from '@cosmjs/launchpad';
import { setupWallet, setupCosmosWallet } from '../../wallet';
import { NativeDexClient } from '../client';
import Long from 'long'
import * as IbcTransferV1Tx from "@cosmjs/stargate/build/codec/ibc/applications/transfer/v1/tx";

const timeoutInMinutes = 45;
const timeoutTimestampInSeconds = Math.floor(
  new Date().getTime() / 1000 + 60 * timeoutInMinutes,
);
const timeoutTimestampNanoseconds = Long
    .fromNumber(timeoutTimestampInSeconds)
    .multiply(1_000_000_000);

export const exportTokenIBC = async (symbol: string, amount: string) => {
    
    const wallet = await setupWallet();
    const [firstAccount] = await wallet.getAccounts();
    const sender = firstAccount.address;

    const receiverWallet = await setupCosmosWallet();
    const [receiverFirstAccount] = await receiverWallet.getAccounts();
    const receiver = receiverFirstAccount.address

    // look up ibc denom and channel id from dex entries
    const dex = await NativeDexClient.connect(config.sifRpc);
    const { entries } = (await dex.query.tokenregistry.Entries({})).registry;
    const { denom, ibcChannelId } = entries.find(entry => entry.baseDenom === symbol);
    console.log(entries);
    

    const unsignedTransferMsg: MsgTransferEncodeObject = {
        typeUrl: "/ibc.applications.transfer.v1.MsgTransfer",
        value: IbcTransferV1Tx.MsgTransfer.fromPartial({
          sourcePort: "transfer",
          sourceChannel: ibcChannelId,
          sender,
          receiver,
          token: { denom, amount },
          timeoutHeight: {
            // revisionHeight: timeoutHeight,
            // revisionHeight: timeoutHeight,
          },
          timeoutTimestamp: timeoutTimestampNanoseconds,
        }),
    };
    const client = await SigningStargateClient.connectWithSigner(
        config.sifRpc,
        wallet
    );
    const fee: StdFee = {
        amount: [{ denom: 'rowan', amount: '150000' }],
        gas: '300000',
    };
    const txnStatus = await client.signAndBroadcast(
        firstAccount.address,
        [unsignedTransferMsg],
        fee
    );
    return txnStatus;
};
