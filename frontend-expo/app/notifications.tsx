import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator 
} from 'react-native';
import { router, Stack } from 'expo-router';
import api from '../src/api';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePress = async (item: any) => {
    // Mark as read
    if (!item.isRead) {
      try {
        await api.patch(`/notifications/${item._id}`);
        // Update local state to show as read immediately
        setNotifications(prev => prev.map((n: any) => 
          n._id === item._id ? { ...n, isRead: true } : n
        ));
      } catch (e) { console.log(e); }
    }

    // Navigate based on type
    if (item.relatedId && item.type === 'payment') {
       router.push(`/verify-payment/${item.relatedId}`);
    } else if (item.relatedId && item.type === 'reminder') {
       router.push('/groups'); // Or specific settlement screen
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={[styles.card, !item.isRead && styles.unread]} 
      onPress={() => handlePress(item)}
    >
      <View style={styles.iconContainer}>
        <Ionicons 
          name={item.type === 'payment' ? "cash" : "notifications"} 
          size={24} 
          color={item.type === 'payment' ? "#1D976C" : "#555"} 
        />
      </View>
      <View style={{flex:1}}>
        <Text style={styles.message}>{item.message}</Text>
        <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
      </View>
      {!item.isRead && <View style={styles.dot} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Notifications' }} />
      {loading ? (
        <ActivityIndicator size="large" color="#1D976C" style={{marginTop:20}} />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item: any) => item._id}
          ListEmptyComponent={<Text style={styles.empty}>No notifications yet.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  card: { flexDirection:'row', padding:15, borderBottomWidth:1, borderBottomColor:'#eee', alignItems:'center' },
  unread: { backgroundColor: '#f0fdf4' },
  iconContainer: { marginRight: 15 },
  message: { fontSize: 16, color: '#333' },
  date: { fontSize: 12, color: 'gray', marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1D976C', marginLeft: 10 },
  empty: { textAlign: 'center', marginTop: 50, color: 'gray' }
});