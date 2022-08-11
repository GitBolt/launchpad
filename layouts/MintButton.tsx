import Button from '@material-ui/core/Button';
import { CandyMachineAccount } from '@/components/mintCandymachine';
import { CircularProgress } from '@material-ui/core';
import { GatewayStatus, useGateway } from '@civic/solana-gateway-react';
import React, { useEffect, useState, useRef } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
  findGatewayToken,
  getGatewayTokenAddressForOwnerAndGatekeeperNetwork,
  onGatewayTokenChange,
  removeAccountChangeListener,
} from '@identity.com/solana-gateway-ts';
import { SiteData } from '@/types/projectData';

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

// eslint-disable-next-line react/function-component-definition
export const MintButton = ({
  onMint,
  candyMachine,
  isMinting,
  rpcUrl,
  setIsMinting,
  isActive,
  siteData,
  style,
}: {
  onMint: () => Promise<void>;
  candyMachine?: CandyMachineAccount;
  isMinting: boolean;
  setIsMinting: (val: boolean) => void;
  isActive: boolean;
  rpcUrl: string;
  siteData: SiteData
  style?: any
}) => {
  const wallet = useWallet();
  const connection = useConnection();
  const [verified, setVerified] = useState(false);
  const { requestGatewayToken, gatewayStatus } = useGateway();
  const [webSocketSubscriptionId, setWebSocketSubscriptionId] = useState(-1);
  const [clicked, setClicked] = useState(false);

  const getMintButtonContent = () => {
    if (candyMachine?.state.isSoldOut) {
      return 'Sold out';
    }
    if (isMinting) {
      return <CircularProgress />;
    }
    if (!isActive) return 'Not active';
    return 'Mint';
  };

  useEffect(() => {
    const mint = async () => {
      await removeAccountChangeListener(
        connection.connection,
        webSocketSubscriptionId,
      );
      await onMint();

      setClicked(false);
      setVerified(false);
    };
    if (verified && clicked) {
      mint();
    }
  }, [
    verified,
    clicked,
    connection.connection,
    onMint,
    webSocketSubscriptionId,
  ]);

  const previousGatewayStatus = usePrevious(gatewayStatus);
  useEffect(() => {
    const fromStates = [
      GatewayStatus.NOT_REQUESTED,
      GatewayStatus.REFRESH_TOKEN_REQUIRED,
    ];
    const invalidToStates = [...fromStates, GatewayStatus.UNKNOWN];
    if (
      fromStates.find((state) => previousGatewayStatus === state)
      && !invalidToStates.find((state) => gatewayStatus === state)
    ) {
      setIsMinting(true);
    }
  }, [setIsMinting, previousGatewayStatus, gatewayStatus]);

  return (
    <Button
      style={style || {
        borderRadius: '3rem',
        height: '3.5rem',
        width: '100%',
        marginTop: '2rem',
        background: siteData.buttonBgColor,
        filter: isMinting || !isActive ? 'brightness(70%)' : '',
        color: siteData.buttonFontColor,
        transition: '0ms',
        marginBottom: '2rem',
        fontSize: '1rem',
        fontWeight: '600',
        textTransform: 'none',
      }}
      disabled={isMinting || !isActive}
      onClick={async () => {
        if (candyMachine?.state.isActive && candyMachine?.state.gatekeeper) {
          const network = candyMachine.state.gatekeeper.gatekeeperNetwork.toBase58();
          if (network === 'ignREusXmGrscGNUesoU9mxfds9AiYTezUKex2PsZV6') {
            if (gatewayStatus === GatewayStatus.ACTIVE) {
              await onMint();
            } else {
              // setIsMinting(true);
              await requestGatewayToken();
              console.log('after: ', gatewayStatus);
            }
          } else if (
            network === 'ttib7tuX8PTWPqFsmUFQTj78MbRhUmqxidJRDv4hRRE'
            || network === 'tibePmPaoTgrs929rWpu755EXaxC7M3SthVCf6GzjZt'
          ) {
            setClicked(true);
            const gatewayToken = await findGatewayToken(
              connection.connection,
              wallet.publicKey!,
              candyMachine.state.gatekeeper.gatekeeperNetwork,
            );

            if (gatewayToken?.isValid()) {
              await onMint();
            } else {
              let endpoint = rpcUrl;
              if (endpoint.endsWith('/')) endpoint = endpoint.slice(0, -1);
              if (!endpoint.startsWith('https')) endpoint = `https${endpoint.slice(4)}`;

              window.open(
                `https://verify.encore.fans/?endpoint=${endpoint}&gkNetwork=${network}`,
                '_blank',
              );

              const gatewayTokenAddress = await getGatewayTokenAddressForOwnerAndGatekeeperNetwork(
                wallet.publicKey!,
                candyMachine.state.gatekeeper.gatekeeperNetwork,
              );

              setWebSocketSubscriptionId(
                onGatewayTokenChange(
                  connection.connection,
                  gatewayTokenAddress,
                  () => setVerified(true),
                  'confirmed',
                ),
              );
            }
          } else {
            setClicked(false);
            throw new Error(`Unknown Gatekeeper Network: ${network}`);
          }
        } else {
          await onMint();
          setClicked(false);
        }
      }}
      variant="contained"
    >
      {getMintButtonContent()}
    </Button>
  );
};