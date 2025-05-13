import { useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, Alert } from "react-native";
import {
  useAbstraxionAccount,
  useAbstraxionSigningClient,
} from "@burnt-labs/abstraxion-react-native";
import {SpotifyProfile} from "@/components/SpotifyProfile";

export default function Index() {
  // Abstraxion hooks
  const {
    data: account,
    logout,
    login,
    isConnected,
    isConnecting,
  } = useAbstraxionAccount();
  const { client, signArb } = useAbstraxionSigningClient();

  const [signArbResponse, setSignArbResponse] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loadingInstantiate, setLoadingInstantiate] = useState(false);

  async function handleInstantiate() {
    setLoadingInstantiate(true);
    try {
      // Sample treasury contract instantiate msg
      const msg = {
        type_urls: ["/cosmwasm.wasm.v1.MsgInstantiateContract"],
        grant_configs: [
          {
            description: "Ability to instantiate contracts",
            optional: false,
            authorization: {
              type_url: "/cosmos.authz.v1beta1.GenericAuthorization",
              value: "CigvY29zbXdhc20ud2FzbS52MS5Nc2dJbnN0YW50aWF0ZUNvbnRyYWN0",
            },
          },
        ],
        fee_config: {
          description: "Sample fee config for testnet-2",
          allowance: {
            type_url: "/cosmos.feegrant.v1beta1.BasicAllowance",
            value: "Cg8KBXV4aW9uEgY1MDAwMDA=",
          },
        },
        admin: account.bech32Address,
      };

      const instantiateRes = await client?.instantiate(
        account.bech32Address,
        33,
        msg,
        "instantiate on expo demo",
        "auto"
      );

      console.log(instantiateRes);

      if (!instantiateRes) {
        throw new Error("Instantiate failed.");
      }

      setTxHash(instantiateRes.transactionHash);
    } catch (error) {
      Alert.alert("Error", (error as Error).message);
    } finally {
      setLoadingInstantiate(false);
    }
  }

  async function handleSign(): Promise<void> {
    if (client?.granteeAddress) {
      const response = await signArb?.(
        client.granteeAddress,
        "abstraxion challenge"
      );
      if (response) setSignArbResponse(response);
    }
  }

  function handleLogout() {
    logout();
    setSignArbResponse("");
    setTxHash("");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Abstraxion React-Native Demo</Text>
      <SpotifyProfile />
      {isConnected ? (
        <>
          <TouchableOpacity
            onPress={handleInstantiate}
            style={styles.button}
            disabled={loadingInstantiate}
          >
            <Text style={styles.buttonText}>
              {loadingInstantiate ? "Loading..." : "Sample instantiate"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSign} style={styles.button}>
            <Text style={styles.buttonText}>Sign Arb</Text>
          </TouchableOpacity>
        </>
      ) : null}
      {isConnected ? (
        <TouchableOpacity onPress={handleLogout} style={styles.button}>
          <Text style={styles.buttonText}>Logout</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={login}
          style={[styles.button, isConnecting && styles.disabledButton]}
          disabled={isConnecting}
        >
          <Text style={styles.buttonText}>
            {isConnecting ? "Connecting..." : "Login"}
          </Text>
        </TouchableOpacity>
      )}
      {signArbResponse || txHash ? (
        <View style={styles.card}>
          {signArbResponse ? (
            <Text style={styles.responseText}>{signArbResponse}</Text>
          ) : null}
          {txHash ? <Text style={styles.responseText}>{txHash}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  button: {
    marginVertical: 10,
    padding: 15,
    borderRadius: 5,
    backgroundColor: "#2196F3",
    width: "80%",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
  },
  card: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    width: "90%",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  responseText: {
    color: "#000",
    marginTop: 10,
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: "#B0BEC5",
  },
});
