// (app)/verify-payment/[settlementId].tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Alert, 
  ActivityIndicator, Image, TouchableOpacity 
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import api from '../../src/api';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context'; // <-- FIX 1: Correct Import

export default function VerifyPaymentScreen() {
  const { settlementId } = useLocalSearchParams<{ settlementId: string }>();
  const [settlement, setSettlement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettlement = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/settlements/${settlementId}`);
        setSettlement(response.data.settlement);
      } catch (error: any) {
        console.error('Failed to fetch settlement:', error.response?.data || error);
        Alert.alert('Error', 'Could not load payment details.');
      } finally {
        setLoading(false);
      }
    };
    if (settlementId) {
      fetchSettlement();
    }
  }, [settlementId]);

  const handleVerification = async (status: 'verified' | 'rejected') => {
    try {
      await api.patch(`/settlements/${settlementId}/verify`, { status });
      Alert.alert('Success', `Payment has been marked as ${status}.`);
      router.back(); 
    } catch (error: any) {
      console.error('Verification failed:', error.response?.data || error);
      Alert.alert('Error', 'Could not update status.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D976C" />
      </View>
    );
  }

  // --- FIX 2: Defensive Rendering ---
  // We use "?." to prevent crashes if data is missing
  const debtorName = settlement?.debtor?.username || 'Someone';
  const amountPaid = settlement?.amount_paid || 0;
  const proofUrl = settlement?.payment_proof_url ? 
    `${api.defaults.baseURL.replace('/api', '')}${settlement.payment_proof_url}` 
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Verify Payment' }} />
      
      <Text style={styles.infoText}>
        <Text style={{fontWeight: 'bold'}}>{debtorName}</Text> claims they paid you:
      </Text>
      <Text style={styles.amount}>₹{amountPaid.toFixed(2)}</Text>
      
      <Text style={styles.subtitle}>Payment Proof Screenshot:</Text>
      
      {proofUrl ? (
        <Image
          source={{ uri: proofUrl }} 
          style={styles.proofImage}
        />
      ) : (
        <View style={styles.proofImageError}>
          <Text>No proof image uploaded.</Text>
        </View>
      )}
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.rejectButton]} 
          onPress={() => handleVerification('rejected')}
        >
          <Ionicons name="close-outline" size={24} color="white" />
          <Text style={styles.buttonText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.button, styles.approveButton]} 
          onPress={() => handleVerification('verified')}
        >
          <Ionicons name="checkmark-outline" size={24} color="white" />
          <Text style={styles.buttonText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: 'white' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  infoText: { fontSize: 18, marginBottom: 5, textAlign: 'center', color: '#333' },
  amount: { 
    fontSize: 42, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    color: '#1D976C',
    textAlign: 'center'
  },
  subtitle: { 
    fontSize: 20, 
    fontWeight: '600', 
    marginBottom: 10, 
    textAlign: 'center'
  },
  proofImage: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    resizeMode: 'contain', 
    borderColor: 'gray',
    borderWidth: 1,
    backgroundColor: '#f9f9f9'
  },
  proofImageError: {
    width: '100%',
    height: 300,
    borderRadius: 10,
    borderColor: 'gray',
    borderWidth: 1,
    backgroundColor: '#f9f9f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 30,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  approveButton: {
    backgroundColor: '#1D976C', // Green
  },
  rejectButton: {
    backgroundColor: '#D9534F', // Red
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  }
});