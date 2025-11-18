import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, Alert, 
  ActivityIndicator, TouchableOpacity, SafeAreaView, Image, ScrollView
} from 'react-native';
import { useLocalSearchParams, Stack, router, useFocusEffect } from 'expo-router';
import api from '../../src/api'; 
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

export default function ExpenseDetailScreen() {
  const { expenseId } = useLocalSearchParams<{ expenseId: string }>(); 
  const [expense, setExpense] = useState<any>(null);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        try {
          const userInfo = await SecureStore.getItemAsync('userInfo');
          console.log('Raw userInfo from SecureStore:', userInfo);
          
          if (userInfo) {
            const parsed = JSON.parse(userInfo);
            console.log('Parsed userInfo:', parsed);
            
            const uId = parsed._id || (parsed.user && parsed.user._id);
            console.log('Extracted userId:', uId);
            setCurrentUserId(uId);
            
            // IMPORTANT: Set currentUserId BEFORE fetching
            if (expenseId) {
              // Fetch with the userId we just got
              await fetchExpenseDetailsWithUserId(uId);
            }
          } else {
            console.log('No userInfo found in SecureStore');
            if (expenseId) {
              fetchExpenseDetails();
            }
          }
        } catch (error) {
          console.error('Error loading user info:', error);
        }
      };
      loadData();
      return () => {};
    }, [expenseId])
  );

  const fetchExpenseDetailsWithUserId = async (userId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/expenses/${expenseId}`);
      console.log('Expense:', response.data.expense.description);
      console.log('Settlements for this expense:', JSON.stringify(response.data.settlements, null, 2));
      
      setExpense(response.data.expense);
      setSettlements(response.data.settlements || []);
    } catch (error: any) {
      console.error('Error fetching expense:', error);
      Alert.alert('Error', 'Failed to load expense details.');
    } finally {
      setLoading(false);
    }
  };

  const renderSettlementAction = (item: any, index: number) => {
    if (item.amount < 0.01) return null;

    // Safely get creditor and debtor info
    const creditorName = item.creditor?.username || 'Someone';
    const debtorName = item.debtor?.username || 'Someone';

    if (item.isCurrentUserDebtor) {
      // I OWE MONEY - I am the debtor
      const isPending = item.status === 'paid_pending_verification';
      const isCompleted = item.status === 'completed';
      
      return (
        <Animatable.View animation="fadeInUp" delay={index * 100} key={index} style={styles.actionCard}>
           <View style={styles.actionHeader}>
             <Ionicons 
               name={isCompleted ? "checkmark-circle" : "alert-circle-outline"} 
               size={24} 
               color={isCompleted ? "#1D976C" : "#D9534F"} 
             />
             <Text style={styles.actionTitle}>Your Share</Text>
           </View>
           
           <Text style={[styles.debtAmount, {color: isCompleted ? '#1D976C' : '#D9534F'}]}>
             ₹{item.amount.toFixed(2)}
           </Text>
           <Text style={styles.debtDesc}>
             {isCompleted ? '✓ Paid to' : 'You owe'} {creditorName}
           </Text>
           
           {isPending ? (
             <View style={styles.pendingContainer}>
               <Ionicons name="time-outline" size={20} color="#FFA500" />
               <Text style={styles.pendingText}>Payment Verification Pending</Text>
             </View>
           ) : isCompleted ? (
             <View style={[styles.pendingContainer, {backgroundColor: '#f0fdf4'}]}>
               <Ionicons name="checkmark-circle" size={20} color="#1D976C" />
               <Text style={[styles.pendingText, {color: '#1D976C'}]}>Payment Completed</Text>
             </View>
           ) : (
             <TouchableOpacity 
               style={styles.payButton}
               onPress={() => {
                 router.push({
                   pathname: '/settle-payment',
                   params: { 
                     settlementId: item._id,
                     amount: item.amount.toString(), 
                     creditorName: creditorName,
                     creditorId: item.creditor._id,
                     groupId: expense.group._id,
                   }
                 });
               }}
             >
               <Text style={styles.payButtonText}>Pay Now</Text>
               <Ionicons name="arrow-forward" size={18} color="white" style={{marginLeft: 5}}/>
             </TouchableOpacity>
           )}
        </Animatable.View>
      );
    }
    
    if (item.isCurrentUserCreditor) {
      // SOMEONE OWES ME - I am the creditor
      const isPending = item.status === 'pending';
      const isAwaitingVerification = item.status === 'paid_pending_verification';
      const isCompleted = item.status === 'completed';
      
      return (
        <Animatable.View animation="fadeInUp" delay={index * 100} key={index} style={styles.actionCard}>
           <View style={styles.actionHeader}>
             <Ionicons 
               name={isCompleted ? "checkmark-circle" : "time-outline"} 
               size={24} 
               color={isCompleted ? "#1D976C" : "#FFA500"} 
             />
             <Text style={styles.actionTitle}>{debtorName}'s Share</Text>
           </View>
           <Text style={[styles.debtAmount, {color: isCompleted ? '#1D976C' : '#FFA500'}]}>
             ₹{item.amount.toFixed(2)}
           </Text>
           <Text style={styles.debtDesc}>
             {isCompleted ? 'Payment received from' : 'Owes you from'} {debtorName}
           </Text>
           
           {isCompleted ? (
             <View style={[styles.pendingContainer, {backgroundColor: '#f0fdf4'}]}>
               <Ionicons name="checkmark-circle" size={20} color="#1D976C" />
               <Text style={[styles.pendingText, {color: '#1D976C'}]}>Payment Verified</Text>
             </View>
           ) : isAwaitingVerification ? (
             <TouchableOpacity 
               style={styles.verifyButton}
               onPress={() => router.push(`/verify-payment/${item._id}`)}
             >
               <Ionicons name="checkmark-outline" size={20} color="white" />
               <Text style={styles.payButtonText}>Verify Payment</Text>
             </TouchableOpacity>
           ) : isPending ? (
             <View style={styles.pendingContainer}>
               <Ionicons name="time-outline" size={20} color="#FFA500" />
               <Text style={styles.pendingText}>Awaiting Payment</Text>
             </View>
           ) : null}
        </Animatable.View>
      );
    }
    return null;
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1D976C" /></View>;
  }

  if (!expense) return null;

  const mySettlements = settlements.filter((s: any) => {
    const isDebtor = s.isCurrentUserDebtor === true;
    const isCreditor = s.isCurrentUserCreditor === true;
    console.log(`Filtering settlement ${s._id}: isDebtor=${isDebtor}, isCreditor=${isCreditor}, status=${s.status}`);
    return isDebtor || isCreditor;
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Expense Details' }} />
      <ScrollView style={styles.container}>
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.desc}>{expense.description}</Text>
          <Text style={styles.amount}>₹{expense.amount.toFixed(2)}</Text>
          <Text style={styles.meta}>Paid by {expense.paidBy.username} • {new Date(expense.date).toLocaleDateString()}</Text>
        </View>
        
        {/* Pay / Status Section */}
        {mySettlements.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Settlement Status</Text>
            {mySettlements.map((item, idx) => renderSettlementAction(item, idx))}
          </View>
        ) : (
          <View style={styles.section}>
             <Text style={styles.sectionTitle}>Settlement</Text>
             <Text style={{color: '#888', fontStyle:'italic'}}>You are not involved in this expense.</Text>
          </View>
        )}

        {/* Bill Image */}
        {expense.billImage && expense.billImage.length > 0 && (
           <View style={styles.section}>
             <Text style={styles.sectionTitle}>Bill Proof</Text>
             <Image 
               source={{ uri: `${api.defaults.baseURL?.replace('/api', '')}${expense.billImage}` }} 
               style={styles.billImage} 
             />
           </View>
        )}

        {/* Full Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Full Split Breakdown ({expense.splitType})</Text>
          <View style={styles.listContainer}>
            {expense.splits.map((split: any, idx: number) => (
              <View key={idx} style={styles.splitItem}>
                <Text style={styles.splitName}>{split.user.username}</Text>
                <Text style={styles.splitAmount}>₹{split.amount.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: {
    backgroundColor: 'white', padding: 24, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#eee'
  },
  desc: { fontSize: 24, fontWeight: 'bold', color: '#333', textAlign: 'center' },
  amount: { fontSize: 40, fontWeight: '800', color: '#1D976C', marginVertical: 10 },
  meta: { fontSize: 14, color: '#888' },
  
  section: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  
  actionCard: {
    backgroundColor: 'white', borderRadius: 12, padding: 20, marginBottom: 15,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
  },
  actionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  actionTitle: { fontSize: 14, color: '#888', fontWeight: '600', marginLeft: 5, textTransform: 'uppercase' },
  debtAmount: { fontSize: 28, fontWeight: 'bold', marginBottom: 5 },
  debtDesc: { fontSize: 16, color: '#333', marginBottom: 15 },
  
  payButton: {
    backgroundColor: '#D9534F', paddingVertical: 14, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center'
  },
  verifyButton: {
    backgroundColor: '#1D976C', paddingVertical: 14, borderRadius: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center'
  },
  payButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

  pendingContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    backgroundColor: '#fffaf0', padding: 10, borderRadius: 8
  },
  pendingText: { color: '#FFA500', fontWeight: 'bold', marginLeft: 5 },

  billImage: {
    width: '100%', height: 250, borderRadius: 12, backgroundColor: '#ddd', resizeMode: 'cover'
  },
  
  listContainer: {
    backgroundColor: 'white', borderRadius: 12, overflow: 'hidden'
  },
  splitItem: {
    flexDirection: 'row', justifyContent: 'space-between', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0'
  },
  splitName: { fontSize: 16, color: '#333' },
  splitAmount: { fontSize: 16, fontWeight: 'bold', color: '#333' },
});