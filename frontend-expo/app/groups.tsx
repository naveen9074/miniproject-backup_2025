// (app)/groups.tsx
import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, Alert, 
  ActivityIndicator, TouchableOpacity, SafeAreaView
} from 'react-native';
import { Link, router, useFocusEffect, Stack } from 'expo-router'; 
import * as SecureStore from 'expo-secure-store';
import api from '../src/api';
import { Ionicons } from '@expo/vector-icons'; 
import * as Animatable from 'react-native-animatable';
import SidebarMenu from '../src/components/SidebarMenu';

export default function GroupListScreen() {
  const [groups, setGroups] = useState([]); 
  const [loading, setLoading] = useState(true); 
  const [username, setUsername] = useState(''); 
  const [isMenuVisible, setMenuVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0); // New state for badge

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const userInfo = await SecureStore.getItemAsync('userInfo');
        if (userInfo) {
          const parsed = JSON.parse(userInfo);
          setUsername(parsed.username || (parsed.user && parsed.user.username) || 'User');
        }
        fetchGroups();
        fetchUnreadNotifications(); // Check for notifications
      };
      loadData(); 
      return () => {};
    }, [])
  );

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const response = await api.get('/groups'); 
      setGroups(response.data); 
    } catch (error: any) {
      console.error('Failed to fetch groups:', error.response?.data || error);
      Alert.alert('Error', 'Failed to fetch your groups.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      // Simple count of unread items
      const unread = res.data.filter((n: any) => !n.isRead).length;
      setUnreadCount(unread);
    } catch (e) {
      console.log('Failed to fetch notifications');
    }
  };

  const handleLogout = async () => {
    setMenuVisible(false);
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userInfo');
    delete api.defaults.headers.common['Authorization'];
    router.replace('/login');
  };

  const renderGroupItem = ({ item, index }: { item: any, index: number }) => (
    <Animatable.View animation="fadeInUp" duration={500} delay={index * 100}>
      <Link href={`/group/${item._id}`} asChild>
        <TouchableOpacity style={styles.groupItem}>
          <Ionicons name="people-sharp" size={24} color="#1D976C" style={styles.groupIcon} />
          <View>
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={styles.groupMeta}>{item.members?.length || 0} members</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#ccc" style={{marginLeft:'auto'}}/>
        </TouchableOpacity>
      </Link>
    </Animatable.View>
  );

  if (loading && groups.length === 0) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#1D976C" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <SidebarMenu 
        isVisible={isMenuVisible}
        onClose={() => setMenuVisible(false)}
        onLogout={handleLogout}
      />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.title}>{username}</Text>
        </View>
        
        <View style={styles.headerActions}>
          {/* Notification Bell */}
          <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={28} color="#333" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* Menu Button */}
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.iconButton}>
            <Ionicons name="menu" size={32} color="#333" />
          </TouchableOpacity>
        </View>
      </View>
      
      <Text style={styles.subtitle}>Your Groups</Text>

      <FlatList
        data={groups}
        renderItem={renderGroupItem}
        keyExtractor={(item: any) => item._id} 
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={60} color="#ddd" />
            <Text style={styles.emptyText}>No groups yet. Create one!</Text>
          </View>
        }
        refreshing={loading} 
        onRefresh={() => { fetchGroups(); fetchUnreadNotifications(); }}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      
      {/* FAB */}
      <Animatable.View animation="zoomIn" delay={300} style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={() => router.push('/create-group')}>
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      </Animatable.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  welcomeText: { fontSize: 16, color: 'gray' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333' },
  iconButton: { padding: 5 },
  
  subtitle: { fontSize: 20, fontWeight: '600', marginBottom: 10, paddingHorizontal: 20, marginTop: 10 },
  
  groupItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9F9F9', padding: 20, borderRadius: 12, marginBottom: 10, marginHorizontal: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  groupIcon: { marginRight: 15, padding: 10, backgroundColor: '#e6fff0', borderRadius: 10 },
  groupName: { fontSize: 18, fontWeight: '600', color: '#333' },
  groupMeta: { fontSize: 12, color: 'gray', marginTop: 2 },
  
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { textAlign: 'center', marginTop: 15, fontSize: 16, color: 'gray' },
  
  fabContainer: { position: 'absolute', bottom: 30, right: 30, shadowColor: '#1D976C', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fab: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#1D976C', justifyContent: 'center', alignItems: 'center' },
  
  badge: { position: 'absolute', top: 0, right: 0, backgroundColor: '#D9534F', borderRadius: 10, width: 18, height: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'white' },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' }
});