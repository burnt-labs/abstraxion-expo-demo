import { useState, useEffect } from "react";
import { View, StyleSheet, Text, TouchableOpacity, Alert, TextInput, ScrollView, Clipboard, Linking } from "react-native";
import {
  useAbstraxionAccount,
  useAbstraxionSigningClient,
  useAbstraxionClient,
} from "@burnt-labs/abstraxion-react-native";
import type { ExecuteResult } from "@cosmjs/cosmwasm-stargate";
import {GithubProfile} from "@/components/GithubProfile";

if (!process.env.EXPO_PUBLIC_USER_MAP_CONTRACT_ADDRESS) {
  throw new Error("EXPO_PUBLIC_USER_MAP_CONTRACT_ADDRESS is not set in your environment file");
}

type ExecuteResultOrUndefined = ExecuteResult | undefined;
type QueryResult = {
  users?: string[];
  value?: string;
  map?: Array<[string, string]>;
};

// Add retry utility function
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> => {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${i + 1} failed:`, error);
      if (i < maxRetries - 1) {
        await sleep(delay * Math.pow(2, i)); // Exponential backoff
      }
    }
  }

  throw lastError;
};

export default function Index() {
  // Abstraxion hooks
  const { data: account, logout, login, isConnected, isConnecting } = useAbstraxionAccount();
  const { client, signArb } = useAbstraxionSigningClient();
  const { client: queryClient } = useAbstraxionClient();

  // State variables
  const [loading, setLoading] = useState(false);
  const [isOperationInProgress, setIsOperationInProgress] = useState(false);
  const [isTransactionPending, setIsTransactionPending] = useState(false);
  const [executeResult, setExecuteResult] = useState<ExecuteResultOrUndefined>(undefined);
  const [queryResult, setQueryResult] = useState<QueryResult>({});
  const [jsonInput, setJsonInput] = useState<string>("");
  const [selectedAddress, setSelectedAddress] = useState<string>("");
  const [jsonError, setJsonError] = useState<string>("");
  const [showValueByUserForm, setShowValueByUserForm] = useState<boolean>(false);
  const [showUpdateJsonForm, setShowUpdateJsonForm] = useState<boolean>(true);
  const [addressInput, setAddressInput] = useState<string>("");
  const [activeView, setActiveView] = useState<string>("updateJson");
  const [balance, setBalance] = useState<string>("0");

  // Add effect to fetch user's JSON data when they log in
  useEffect(() => {
    const fetchUserData = async () => {
      if (account?.bech32Address && queryClient) {
        try {
          const response = await retryOperation(async () => {
            return await queryClient.queryContractSmart(process.env.EXPO_PUBLIC_USER_MAP_CONTRACT_ADDRESS, {
              get_value_by_user: {
                address: account.bech32Address
              }
            });
          });

          if (response && typeof response === 'string') {
            setJsonInput(response);
          } else {
            console.log("No existing data found for user");
            setJsonInput("{}");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          Alert.alert(
            "Error",
            `Failed to fetch user data: ${errorMessage}. Please check your network connection and try again.`
          );
          setJsonInput("{}");
        }
      }
    };

    fetchUserData();
  }, [account?.bech32Address, queryClient]);

  // Add effect to fetch balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (account?.bech32Address && queryClient) {
        try {
          const response = await queryClient.getBalance(account.bech32Address, "uxion");
          setBalance(response.amount);
        } catch (error) {
          console.error("Error fetching balance:", error);
        }
      }
    };

    fetchBalance();
  }, [account?.bech32Address, queryClient]);

  const clearResults = () => {
    setQueryResult({});
    setExecuteResult(undefined);
  };

  // Effect to handle account changes
  useEffect(() => {
    if (account?.bech32Address) {
      setShowUpdateJsonForm(true);
      setActiveView("updateJson");
      clearResults();
    }
  }, [account?.bech32Address]);

  // Query functions
  const getUsers = async () => {
    setIsOperationInProgress(true);
    setLoading(true);
    clearResults();
    setActiveView("users");
    setShowUpdateJsonForm(false);
    setShowValueByUserForm(false);
    try {
      if (!queryClient) throw new Error("Query client is not defined");
      const response = await queryClient.queryContractSmart(process.env.EXPO_PUBLIC_USER_MAP_CONTRACT_ADDRESS, { get_users: {} });
      setQueryResult({ users: response });
    } catch (error) {
      Alert.alert("Error", "Error querying users");
    } finally {
      setLoading(false);
      setIsOperationInProgress(false);
    }
  };

  const getMap = async () => {
    setIsOperationInProgress(true);
    setLoading(true);
    clearResults();
    setActiveView("map");
    setShowUpdateJsonForm(false);
    setShowValueByUserForm(false);
    try {
      if (!queryClient) throw new Error("Query client is not defined");
      const response = await queryClient.queryContractSmart(process.env.EXPO_PUBLIC_USER_MAP_CONTRACT_ADDRESS, { get_map: {} });
      setQueryResult({ map: response });
    } catch (error) {
      Alert.alert("Error", "Error querying map");
    } finally {
      setLoading(false);
      setIsOperationInProgress(false);
    }
  };

  const getValueByUser = async (address: string) => {
    setIsOperationInProgress(true);
    setLoading(true);
    clearResults();
    setActiveView("value");
    setShowUpdateJsonForm(false);
    setShowValueByUserForm(false);
    try {
      if (!queryClient) throw new Error("Query client is not defined");
      const response = await queryClient.queryContractSmart(process.env.EXPO_PUBLIC_USER_MAP_CONTRACT_ADDRESS, {
        get_value_by_user: { address }
      });
      setQueryResult({ value: response });
      setSelectedAddress(address);
    } catch (error) {
      Alert.alert("Error", "Error querying value");
    } finally {
      setLoading(false);
      setIsOperationInProgress(false);
    }
  };

  const validateJson = (jsonString: string): boolean => {
    try {
      JSON.parse(jsonString);
      setJsonError("");
      return true;
    } catch (error) {
      setJsonError("Invalid JSON format");
      return false;
    }
  };

  const formatJson = (jsonString: string): string => {
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      return jsonString;
    }
  };

  const handleFormatJson = () => {
    if (validateJson(jsonInput)) {
      setJsonInput(formatJson(jsonInput));
    }
  };

  // Update JSON value with retry logic
  const updateValue = async () => {
    if (!validateJson(jsonInput)) {
      return;
    }
    setIsOperationInProgress(true);
    setLoading(true);
    setIsTransactionPending(true);
    try {
      if (!client || !account) throw new Error("Client or account not defined");

      // Check balance before proceeding
      const currentBalance = await queryClient?.getBalance(account.bech32Address, "uxion");
      if (!currentBalance || Number(currentBalance.amount) < 184) {
        Alert.alert(
          "Insufficient Funds",
          `You need at least 0.000184 XION to execute this transaction.\nYour current balance: ${Number(currentBalance?.amount || 0) / 1000000} XION`
        );
        return;
      }

      const msg = {
        update: {
          value: jsonInput
        }
      };

      // Execute with retry
      const res = await retryOperation(async () => {
        return await client.execute(
          account.bech32Address,
          process.env.EXPO_PUBLIC_USER_MAP_CONTRACT_ADDRESS,
          msg,
          "auto"
        );
      });

      setExecuteResult(res);
      console.log("Transaction successful:", res);

      // Show success confirmation
      Alert.alert(
        "Success",
        "Your JSON data has been successfully updated on the blockchain.",
        [{ text: "OK" }]
      );

      // Refresh data with retry
      const updatedData = await retryOperation(async () => {
        if (!queryClient) throw new Error("Query client not available");
        return await queryClient.queryContractSmart(process.env.EXPO_PUBLIC_USER_MAP_CONTRACT_ADDRESS, {
          get_value_by_user: {
            address: account.bech32Address
          }
        });
      });

      if (updatedData && typeof updatedData === 'string') {
        setJsonInput(updatedData);
      }
    } catch (error) {
      console.error("Error executing transaction:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

      // Handle specific error cases
      if (errorMessage.includes("insufficient funds")) {
        Alert.alert(
          "Insufficient Funds",
          "You don't have enough XION to cover the transaction fees. Please ensure you have at least 0.000184 XION in your account."
        );
      } else {
        Alert.alert(
          "Error",
          `Failed to update JSON data: ${errorMessage}. Please check your network connection and try again.`
        );
      }
    } finally {
      setLoading(false);
      setIsOperationInProgress(false);
      setIsTransactionPending(false);
    }
  };

  function handleLogout() {
    logout();
    clearResults();
  }

  const copyToClipboard = async (text: string) => {
    try {
      await Clipboard.setString(text);
      Alert.alert("Success", "Address copied to clipboard!");
    } catch (error) {
      Alert.alert("Error", "Failed to copy address");
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text style={styles.title}>User Map Dapp</Text>
        <GithubProfile />

      {!isConnected ? (
        <View style={styles.connectButtonContainer}>
          <TouchableOpacity
            onPress={login}
            style={[styles.menuButton, styles.fullWidthButton, isConnecting && styles.disabledButton]}
            disabled={isConnecting}
          >
            <Text style={styles.buttonText}>
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mainContainer}>
          {/* Row 1: Account Info */}
          <View style={styles.accountInfoContainer}>
            <Text style={styles.accountLabel}>Connected Account:</Text>
            <View style={styles.addressContainer}>
              <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="middle">
                {account?.bech32Address}
              </Text>
              <TouchableOpacity
                onPress={() => account?.bech32Address && copyToClipboard(account.bech32Address)}
                style={styles.copyButton}
              >
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={logout}
              style={[styles.menuButton, styles.logoutButton, styles.fullWidthButton, (loading || isOperationInProgress) && styles.disabledButton]}
              disabled={loading || isOperationInProgress}
            >
              <Text style={styles.buttonText}>Logout</Text>
            </TouchableOpacity>
          </View>

          {/* Row 2: Menu Buttons */}
          <View style={styles.menuContainer}>
            <TouchableOpacity
              onPress={getUsers}
              style={[styles.menuButton, (loading || isOperationInProgress) && styles.disabledButton]}
              disabled={loading || isOperationInProgress}
            >
              <Text style={styles.buttonText}>Get Users</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={getMap}
              style={[styles.menuButton, (loading || isOperationInProgress) && styles.disabledButton]}
              disabled={loading || isOperationInProgress}
            >
              <Text style={styles.buttonText}>Get Map</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setShowValueByUserForm(true);
                setShowUpdateJsonForm(false);
                clearResults();
                setActiveView("valueForm");
              }}
              style={[styles.menuButton, (loading || isOperationInProgress) && styles.disabledButton]}
              disabled={loading || isOperationInProgress}
            >
              <Text style={styles.buttonText}>Get Value by User</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setShowUpdateJsonForm(true);
                setShowValueByUserForm(false);
                clearResults();
                setActiveView("updateJson");
              }}
              style={[styles.menuButton, (loading || isOperationInProgress) && styles.disabledButton]}
              disabled={loading || isOperationInProgress}
            >
              <Text style={styles.buttonText}>Update JSON</Text>
            </TouchableOpacity>
          </View>

          {/* Row 3: Results */}
          <View style={styles.resultsContainer}>
            {showValueByUserForm && (
              <View style={styles.formSection}>
                <Text style={styles.label}>Enter User Address:</Text>
                <TextInput
                  style={styles.input}
                  value={addressInput}
                  onChangeText={setAddressInput}
                  placeholder="xion1..."
                  placeholderTextColor="#666"
                />
                <TouchableOpacity
                  onPress={() => getValueByUser(addressInput)}
                  style={[styles.menuButton, (loading || isOperationInProgress) && styles.disabledButton]}
                  disabled={loading || isOperationInProgress}
                >
                  <Text style={styles.buttonText}>Get Value</Text>
                </TouchableOpacity>
              </View>
            )}

            {showUpdateJsonForm && account?.bech32Address && (
              <View style={styles.formSection}>
                <TextInput
                  style={[styles.jsonInput, jsonError ? styles.errorInput : null]}
                  value={jsonInput}
                  onChangeText={(text) => {
                    setJsonInput(text);
                    validateJson(text);
                  }}
                  placeholder="Enter JSON data..."
                  placeholderTextColor="#666"
                  multiline
                />
                {jsonError ? (
                  <Text style={styles.errorText}>{jsonError}</Text>
                ) : null}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    onPress={updateValue}
                    style={[styles.menuButton, (loading || isOperationInProgress || !!jsonError || isTransactionPending) && styles.disabledButton]}
                    disabled={loading || isOperationInProgress || !!jsonError || isTransactionPending}
                  >
                    <Text style={styles.buttonText}>Submit JSON</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleFormatJson}
                    style={[styles.menuButton, (loading || isOperationInProgress) && styles.disabledButton]}
                    disabled={loading || isOperationInProgress}
                  >
                    <Text style={styles.buttonText}>Format JSON</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Query Results */}
            {activeView === "users" && queryResult.users && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Users:</Text>
                {queryResult.users.map((user, index) => (
                  <View key={index} style={styles.userRow}>
                    <Text style={styles.userAddress}>{user}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        getValueByUser(user);
                        setActiveView("value");
                      }}
                      style={styles.smallButton}
                    >
                      <Text style={styles.buttonText}>View Value</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {activeView === "value" && queryResult.value && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Value for {selectedAddress}:</Text>
                <Text style={styles.resultText}>{queryResult.value}</Text>
              </View>
            )}

            {activeView === "map" && queryResult.map && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Map Contents:</Text>
                {queryResult.map.map(([address, value], index) => (
                  <View key={index} style={styles.mapItem}>
                    <Text style={styles.mapAddress}>Address: {address}</Text>
                    <Text style={styles.mapValue}>Value: {value}</Text>
                  </View>
                ))}
              </View>
            )}

            {executeResult && (
              <View style={styles.resultCard}>
                <Text style={styles.resultTitle}>Transaction Details:</Text>
                <Text style={styles.resultText}>
                  Transaction Hash: {executeResult.transactionHash}
                </Text>
                <Text style={styles.resultText}>
                  Block Height: {executeResult.height}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Linking.openURL(`https://www.mintscan.io/xion-testnet/tx/${executeResult.transactionHash}?height=${executeResult.height}`);
                  }}
                  style={styles.linkButton}
                >
                  <Text style={styles.linkText}>View on Mintscan</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  contentContainer: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
    textAlign: "center",
  },
  mainContainer: {
    flex: 1,
    gap: 20,
  },
  accountInfoContainer: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  accountLabel: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f5f5f5",
    padding: 10,
    borderRadius: 5,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: "#666",
    marginRight: 10,
  },
  copyButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  copyButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  menuContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingVertical: 10,
  },
  menuButton: {
    padding: 15,
    borderRadius: 5,
    backgroundColor: "#2196F3",
    alignItems: "center",
    flex: 1,
    minWidth: 120,
    maxWidth: '48%',
  },
  resultsContainer: {
    flex: 1,
    gap: 20,
    marginBottom: 20,
  },
  formSection: {
    gap: 10,
  },
  label: {
    fontSize: 16,
    color: "#333",
    marginBottom: 5,
  },
  input: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ddd",
    color: "#000",
  },
  jsonInput: {
    backgroundColor: "#fff",
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#ddd",
    color: "#000",
    minHeight: 200,
    textAlignVertical: "top",
  },
  errorInput: {
    borderColor: "#ff0000",
  },
  errorText: {
    color: "#ff0000",
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: 'wrap',
    gap: 10,
  },
  resultCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
    borderWidth: 2,
    borderColor: "#2196F3",
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333",
  },
  resultText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  userRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  userAddress: {
    flex: 1,
    fontSize: 14,
    color: "#666",
  },
  smallButton: {
    padding: 8,
    borderRadius: 5,
    backgroundColor: "#2196F3",
    marginLeft: 10,
  },
  mapItem: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  mapAddress: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  mapValue: {
    fontSize: 14,
    color: "#666",
  },
  balanceText: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "right",
  },
  connectButtonContainer: {
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  fullWidthButton: {
    width: '100%',
    maxWidth: '100%',
  },
  linkButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#2196F3',
    borderRadius: 5,
    alignItems: 'center',
  },
  linkText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  logoutButton: {
    marginTop: 15,
    backgroundColor: '#dc3545',
    width: '100%',
    maxWidth: '100%',
  },
});
