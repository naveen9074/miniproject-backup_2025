// (app)/group/[id].tsx
import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Alert, 
  ActivityIndicator, Button, TouchableOpacity, SafeAreaView
} from 'react-native';
import { Link, useLocalSearchParams, Stack, router, useFocusEffect } from 'expo-router';
import api from '../../src/api'; 
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); 
  const [group, setGroup] = useState<any>(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  
  // --- NEW STATE for collapsible list ---
  const [isMembersVisible, setMembersVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadAllData = async () => {
        const userInfo = await SecureStore.getItemAsync('userInfo');
        if (userInfo) {
          const parsed = JSON.parse(userInfo);
          const uId = parsed._id || (parsed.user && parsed.user._id);
          setCurrentUserId(uId);
        }
        if (id) {
          fetchGroupDetails();
        }
      };
      loadAllData();
      return () => {};
    }, [id])
  );

  const fetchGroupDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/groups/${id}`);
      setGroup(response.data.group);
      setExpenses(response.data.expenses);
      setSettlements(response.data.settlements);
    } catch (error: any) {
      console.error('Failed to fetch group details:', error.response?.data || error);
      Alert.alert('Error', 'Failed to fetch group details.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async () => {
    Alert.alert(
      "Delete Group",
      "Are you sure you want to delete this group? This will delete all expenses and settlements. This action cannot be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/groups/${id}`);
              Alert.alert('Success', 'Group deleted.');
              router.replace('/groups');
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Failed to delete group.');
            }
          }
        }
      ]
    );
  };

  // --- RENDER SECTION: SETTLEMENTS (Helper) ---
  const renderSettlementItem = (item: any, index: number) => {
    // (This function is unchanged)
    if (item.debtor._id === currentUserId && item.status !== 'verified') {
      const isPendingVerification = item.status === 'paid_pending_verification';
      return (
        <Animatable.View animation="fadeIn" delay={index * 100} key={item._id} style={styles.settlementItem}>
          <Ionicons name="arrow-up-circle" size={24} color="#D9534F" style={styles.settleIcon} />
          <Text style={styles.settlementText}>
            You owe <Text style={{fontWeight: 'bold'}}>{item.creditor.username}</Text> <Text style={{fontWeight: 'bold'}}>₹{item.amount.toFixed(2)}</Text>
          </Text>
          {isPendingVerification ? (
             <Text style={styles.pendingText}>Pending</Text>
          ) : (
            <Link 
              href={{
                pathname: '/settle-payment',
                params: { 
                  settlementId: item._id, 
                  amount: item.amount, 
                  creditorName: item.creditor.username,
                  creditorId: item.creditor._id 
                }
              }}
              asChild
            >
              <TouchableOpacity style={styles.payButton}>
                <Text style={styles.payButtonText}>Pay</Text>
              </TouchableOpacity>
            </Link>
          )}
        </Animatable.View>
      );
    } else if (item.creditor._id === currentUserId && item.status !== 'verified') {
      const isPendingVerification = item.status === 'paid_pending_verification';
      return (
        <Animatable.View animation="fadeIn" delay={index * 100} key={item._id} style={isPendingVerification ? styles.verifyItem : styles.settlementItemGreen}>
          <Ionicons name="arrow-down-circle" size={24} color="#1D976C" style={styles.settleIcon} />
          <Text style={styles.settlementText}>
            <Text style={{fontWeight: 'bold'}}>{item.debtor.username}</Text> owes you <Text style={{fontWeight: 'bold'}}>₹{item.amount.toFixed(2)}</Text>
          </Text>
          {isPendingVerification && (
            <Link href={`/verify-payment/${item._id}`} asChild>
              <TouchableOpacity style={styles.verifyButton}>
                <Text style={styles.verifyButtonText}>Verify</Text>
              </TouchableOpacity>
            </Link>
          )}
        </Animatable.View>
      );
    }
    return null; 
  };
  
  // --- RENDER SECTION: EXPENSES (For FlatList) ---
  const renderExpenseItem = ({ item, index }: { item: any, index: number }) => (
    // (This function is unchanged)
    <Animatable.View animation="fadeInUp" delay={index * 50} style={styles.expenseItem}>
      <View style={styles.expenseIcon}>
        <Ionicons name="receipt-outline" size={24} color="#1D976C" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.expenseDesc}>{item.description}</Text>
        <Text style={styles.expenseUser}>Paid by {item.paidBy.username}</Text>
      </View>
      <Text style={styles.expenseAmount}>₹{item.amount.toFixed(2)}</Text>
    </Animatable.View>
  );

  // --- RENDER HEADER (Settlements & Members) ---
  const ListHeader = () => {
    if (!group) return null;
    
    const relevantSettlements = settlements.filter(item => 
      (item.debtor._id === currentUserId || item.creditor._id === currentUserId) && item.status !== 'verified'
    );
    
    // Get the first few members for the abstract view
    const membersToShow = group.members.slice(0, 3);
    const remainingCount = group.members.length - membersToShow.length;

    return (
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        
        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color="gray" />
            <Text style={styles.infoText}>
              Created: {new Date(group.createdAt).toLocaleDateString()}
            </Text>
          </View>
          {group.dueDate && (
            <View style={styles.infoRow}>
              <Ionicons name="flag-outline" size={16} color="#D9534F" />
              <Text style={[styles.infoText, { color: '#D9534F' }]}>
                Due: {new Date(group.dueDate).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.subtitle}>Settlement Summary</Text>
        <View style={styles.listContainer}>
          {relevantSettlements.length > 0 ? (
            relevantSettlements.map(renderSettlementItem)
          ) : (
            <Text style={styles.emptyText}>No settlements needed. You're all square!</Text>
          )}
        </View>

        {/* --- THIS IS THE NEW COLLAPSIBLE MEMBER LIST --- */}
        <TouchableOpacity 
          style={styles.collapsibleHeader} 
          onPress={() => setMembersVisible(!isMembersVisible)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.subtitle}>Group Members</Text>
            {/* Abstract icon view */}
            <View style={styles.memberAbstractView}>
              {membersToShow.map((member: any, index: number) => (
                <View key={member._id} style={[styles.memberIcon, { marginLeft: index * -10 }]}>
                  <Ionicons name="person" size={16} color="white" />
                </View>
              ))}
              {remainingCount > 0 && (
                <Text style={styles.memberIconText}>+{remainingCount}</Text>
              )}
            </View>
          </View>
          <Ionicons 
            name={isMembersVisible ? "chevron-up-outline" : "chevron-down-outline"} 
            size={24} 
            color="#555" 
          />
        </TouchableOpacity>

        {/* The list itself, which is now conditional and animated */}
        {isMembersVisible && (
          <Animatable.View 
            animation="fadeIn" 
            duration={400} 
            style={styles.listContainer}
          >
            {group.members.map((member: any) => (
              <View key={member._id} style={styles.memberItem}>
                <Ionicons name="person-circle-outline" size={22} color="#555" />
                <Text style={styles.memberName}>{member.username}</Text>
              </View>
            ))}
          </Animatable.View>
        )}
        {/* --- END OF FIX --- */}
        
        <Text style={styles.subtitle}>All Expenses</Text>
      </View>
    );
  };

  // --- RENDER FOOTER (Delete Button) ---
  const ListFooter = () => {
    if (!group) return null;
    const isCreator = group.createdBy._id === currentUserId;

    return (
      <View style={{ padding: 20 }}>
        {expenses.length > 0 && <View style={styles.separator} />}
        {isCreator && (
          <View style={styles.deleteButtonContainer}>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteGroup}>
              <Ionicons name="trash-outline" size={20} color="#D9534F" />
              <Text style={styles.deleteButtonText}>Delete Group</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading || !group) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D976C" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: group.name }} />
      
      <FlatList
        data={expenses}
        renderItem={renderExpenseItem}
        keyExtractor={(item: any) => item._id}
        ListHeaderComponent={ListHeader} 
        ListFooterComponent={ListFooter} 
        ListEmptyComponent={
          <>
            {ListHeader()}
            <Text style={styles.emptyText}>No expenses added yet.</Text>
            {ListFooter()}
          </>
        }
        onRefresh={fetchGroupDetails}
        refreshing={loading}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <View style={styles.buttonRow}>
        <Link 
          href={{ pathname: "/add-members", params: { groupId: id, groupName: group.name } }} 
          style={styles.buttonLink}
        >
          <Ionicons name="person-add-outline" size={20} color="#1D976C" />
          <Text style={styles.buttonText}>Add Members</Text>
        </Link>
        <Link 
          href={{ pathname: "/add-expense", params: { groupId: id } }} 
          style={[styles.buttonLink, styles.buttonPrimary]}
        >
          <Ionicons name="add-outline" size={24} color="white" />
          <Text style={[styles.buttonText, styles.buttonTextPrimary]}>Add Expense</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}

// --- ALL STYLES ---
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'white' },
  container: { flex: 1, backgroundColor: 'white' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  subtitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 15, marginTop: 20 },
  listContainer: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden', 
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  expenseIcon: {
    marginRight: 10,
    backgroundColor: '#e6fff0',
    padding: 8,
    borderRadius: 20,
  },
  expenseDesc: { fontSize: 16, fontWeight: 'bold' },
  expenseUser: { fontSize: 12, color: 'gray', marginTop: 2 },
  expenseAmount: { fontSize: 16, fontWeight: 'bold', color: '#1D976C' },
  settlementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fffbe6', 
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settlementItemGreen: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#e6fff0',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  verifyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#e6f7ff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settleIcon: {
    marginRight: 10,
  },
  settlementText: { fontSize: 16, flex: 1, flexWrap: 'wrap' },
  pendingText: { color: 'orange', fontWeight: 'bold', marginLeft: 10 },
  payButton: {
    backgroundColor: '#007bff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginLeft: 10,
  },
  payButtonText: { color: 'white', fontWeight: 'bold' },
  verifyButton: {
    backgroundColor: '#1D976C', // Green
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    marginLeft: 10,
  },
  verifyButtonText: { color: 'white', fontWeight: 'bold' },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  memberName: {
    fontSize: 16,
    marginLeft: 10,
  },
  emptyText: { textAlign: 'center', padding: 20, color: 'gray', fontSize: 16 },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 30, 
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  buttonLink: {
    flex: 1,
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1D976C', // Green
    marginHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center'
  },
  buttonText: {
    color: '#1D976C',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
  },
  buttonPrimary: {
    backgroundColor: '#1D976C', // Green
  },
  buttonTextPrimary: {
    color: 'white',
  },
  deleteButtonContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    alignItems: 'center',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9534F',
  },
  deleteButtonText: {
    color: '#D9534F',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  infoBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  infoText: {
    fontSize: 14,
    color: 'gray',
    marginLeft: 10,
  },
  // --- NEW STYLES for Collapsible List ---
  collapsibleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 10, // So the arrow has space
    marginBottom: 10,
  },
  memberAbstractView: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  memberIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1D976C',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  memberIconText: {
    marginLeft: -5,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    paddingLeft: 10,
  },
});