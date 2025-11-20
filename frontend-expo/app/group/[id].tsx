// frontend-expo/app/group/[id].tsx
import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Alert, 
  ActivityIndicator, TouchableOpacity, SafeAreaView, ScrollView
} from 'react-native';
import { Link, useLocalSearchParams, router, useFocusEffect, Stack } from 'expo-router';
import api from '../../src/api'; 
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); 
  const [group, setGroup] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [memberBalances, setMemberBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const userInfo = await SecureStore.getItemAsync('userInfo');
        if (userInfo) {
          const parsed = JSON.parse(userInfo);
          setCurrentUserId(parsed._id || (parsed.user && parsed.user._id));
        }
        if (id) fetchGroupDetails();
      };
      loadData();
    }, [id])
  );

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/groups/${id}`);
      setGroup(response.data.group);
      setExpenses(response.data.expenses || []);
      setSettlements(response.data.settlements || []);
      setMemberBalances(response.data.memberBalances || []);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to fetch group details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    Alert.alert("Delete Group", "Are you sure? This cannot be undone.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await api.delete(`/groups/${id}`); router.replace('/groups'); } 
          catch (error) { Alert.alert('Error', 'Failed to delete'); }
      }}
    ]);
  };

  const renderBalanceItem = (item: any) => {
    const isPositive = item.balance > 0;
    const isSettled = Math.abs(item.balance) < 0.01;
    
    return (
      <View key={item.userId} style={styles.balanceCard}>
        <View style={styles.avatarSmall}>
           <Text style={{fontWeight:'bold', color:'#1D976C'}}>
             {item.username.charAt(0).toUpperCase()}
           </Text>
        </View>
        <Text style={styles.balanceName} numberOfLines={1}>{item.username}</Text>
        {isSettled ? (
          <Text style={{color:'gray', fontSize:12}}>Settled</Text>
        ) : (
          <Text style={[styles.balanceValue, { color: isPositive ? '#1D976C' : '#D9534F' }]}>
            {isPositive ? '+' : ''}₹{item.balance.toFixed(0)}
          </Text>
        )}
      </View>
    );
  };

  const renderExpenseItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.expenseItem}
      onPress={() => router.push(`/expense/${item._id}`)}
    >
      <View style={styles.expenseIcon}>
        <Ionicons name="receipt" size={20} color="#1D976C" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseDesc}>{item.description}</Text>
        <Text style={styles.expenseMeta}>
            {new Date(item.date).toLocaleDateString()} • {item.contributions?.length > 1 ? 'Multiple Payers' : `Paid by ${item.contributions?.[0]?.user?.username || 'Unknown'}`}
        </Text>
      </View>
      <Text style={styles.expenseAmount}>₹{item.amount.toFixed(2)}</Text>
      <Ionicons name="chevron-forward" size={16} color="#ccc" />
    </TouchableOpacity>
  );

  if (loading || !group) return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1D976C" /></View>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: group.name }} />
      
      <FlatList
        data={expenses}
        renderItem={renderExpenseItem}
        keyExtractor={(item) => item._id}
        ListHeaderComponent={
          <View style={styles.headerContainer}>
             <Text style={styles.sectionTitle}>Member Balances</Text>
             <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginVertical:10}}>
                {memberBalances.map(renderBalanceItem)}
             </ScrollView>

             {/* My Actions */}
             <View style={styles.mySettlements}>
                {settlements.filter(s => s.isCurrentUserDebtor && s.status !== 'completed').length > 0 && (
                   <TouchableOpacity 
                     style={styles.actionAlert}
                     onPress={() => router.push({ pathname: '/settle-payment', params: { groupId: id } })} // Redirect to settle generic or specific
                   >
                     <Ionicons name="alert-circle" size={20} color="white" />
                     <Text style={{color:'white', fontWeight:'bold', marginLeft:5}}>You have pending debts!</Text>
                   </TouchableOpacity>
                )}
             </View>

             <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginTop:20}}>
               <Text style={styles.sectionTitle}>Expenses</Text>
               <Text style={{color:'gray'}}>{expenses.length} items</Text>
             </View>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* Floating Action Bar */}
      <View style={styles.fabBar}>
        <Link href={{ pathname: "/add-members", params: { groupId: id, groupName: group.name } }} asChild>
            <TouchableOpacity style={styles.fabButtonSecondary}>
                <Ionicons name="person-add" size={20} color="#1D976C" />
                <Text style={styles.fabTextSec}>Invite</Text>
            </TouchableOpacity>
        </Link>
        <Link href={{ pathname: "/add-expense", params: { groupId: id } }} asChild>
            <TouchableOpacity style={styles.fabButtonPrimary}>
                <Ionicons name="add" size={24} color="white" />
                <Text style={styles.fabTextPri}>Add Expense</Text>
            </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { padding: 20, backgroundColor:'white', paddingBottom:10, borderBottomLeftRadius:20, borderBottomRightRadius:20, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:5, elevation:3 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  
  balanceCard: { 
    alignItems:'center', marginRight:15, padding:10, 
    backgroundColor:'#f9f9f9', borderRadius:10, minWidth:80, borderWidth:1, borderColor:'#eee' 
  },
  avatarSmall: {
    width: 36, height: 36, borderRadius: 18, backgroundColor:'#e6fff0', 
    justifyContent:'center', alignItems:'center', marginBottom:5
  },
  balanceName: { fontSize:12, fontWeight:'600', color:'#333', maxWidth:70 },
  balanceValue: { fontSize:14, fontWeight:'bold', marginTop:2 },
  
  mySettlements: { marginTop: 10 },
  actionAlert: {
    backgroundColor: '#D9534F', flexDirection:'row', padding:12, borderRadius:8,
    alignItems:'center', justifyContent:'center'
  },

  expenseItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    padding: 15, marginHorizontal: 20, marginTop: 10, borderRadius: 12,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1
  },
  expenseIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#f0fdf4', alignItems:'center', justifyContent:'center', marginRight:12 },
  expenseDesc: { fontSize: 16, fontWeight: '600', color: '#333' },
  expenseMeta: { fontSize: 12, color: '#888', marginTop: 2 },
  expenseAmount: { fontSize: 16, fontWeight: 'bold', color: '#333', marginRight: 10 },
  
  fabBar: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between', gap: 10
  },
  fabButtonSecondary: {
    flex: 1, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 15, borderRadius: 30, borderWidth: 1, borderColor: '#1D976C', elevation: 4
  },
  fabButtonPrimary: {
    flex: 2, backgroundColor: '#1D976C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 15, borderRadius: 30, elevation: 4
  },
  fabTextSec: { color: '#1D976C', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  fabTextPri: { color: 'white', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
});