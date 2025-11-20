// (app)/add-expense.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, StyleSheet, Alert, 
  Image, ScrollView, Platform, TouchableOpacity, 
  ActivityIndicator, KeyboardAvoidingView 
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../src/api';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

type GroupMember = { _id: string; username: string; };
type Contribution = { user: string; amount: string; };

export default function AddExpenseScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>(); 
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [image, setImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  
  // "Who Paid" logic
  const [payerMode, setPayerMode] = useState<'single' | 'multiple'>('single');
  const [singlePayer, setSinglePayer] = useState<string>(''); // ID
  const [contributions, setContributions] = useState<Contribution[]>([]);

  // Split logic
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal'); 
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);

  useEffect(() => {
    const fetchGroupMembers = async () => {
      try {
        const response = await api.get(`/groups/${groupId}`);
        const members = response.data.group.members;
        setGroupMembers(members);
        if (members.length > 0) setSinglePayer(members[0]._id);
        
        // Initialize contributions with 0
        const initContrib = members.map((m: GroupMember) => ({ user: m._id, amount: '0' }));
        setContributions(initContrib);
      } catch (error) {
        Alert.alert('Error', 'Could not load group members.');
      }
    };
    fetchGroupMembers();
  }, [groupId]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Denied');
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5,
    });
    if (!result.canceled) setImage(result.assets[0]);
  };

  const updateContribution = (userId: string, val: string) => {
    setContributions(prev => prev.map(c => c.user === userId ? { ...c, amount: val } : c));
  };

  const handleAddExpense = async () => {
    if (!description || !amount) return Alert.alert('Error', 'Fill all fields');
    const total = parseFloat(amount);
    
    // Prepare contributions payload
    let finalContributions = [];
    if (payerMode === 'single') {
        finalContributions = [{ user: singlePayer, amount: total }];
    } else {
        finalContributions = contributions
          .map(c => ({ user: c.user, amount: parseFloat(c.amount) || 0 }))
          .filter(c => c.amount > 0);
        
        const contribSum = finalContributions.reduce((acc, c) => acc + c.amount, 0);
        if (Math.abs(contribSum - total) > 0.1) {
            return Alert.alert('Mismatch', `Paid amounts (${contribSum}) must equal Total (${total})`);
        }
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('description', description);
    formData.append('amount', amount);
    formData.append('group', groupId); 
    formData.append('splitType', splitType);
    formData.append('contributions', JSON.stringify(finalContributions)); // Send as JSON string

    if (image) {
      formData.append('billImage', {
        uri: Platform.OS === 'android' ? image.uri : image.uri.replace('file://', ''),
        type: image.mimeType || 'image/jpeg',
        name: 'receipt.jpg',
      } as any);
    }

    try {
      await api.post('/expenses', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Success', 'Expense added!');
      router.back(); 
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Stack.Screen options={{ title: 'Add Expense' }} />
        
        <Text style={styles.label}>Description</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription} placeholder="Dinner" />
        
        <Text style={styles.label}>Total Amount (₹)</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0.00" />

        {/* Payer Section */}
        <Text style={styles.label}>Who Paid?</Text>
        <View style={{flexDirection:'row', marginBottom:10}}>
            <TouchableOpacity onPress={() => setPayerMode('single')} style={[styles.pill, payerMode==='single' && styles.pillActive]}>
                <Text style={payerMode==='single'?{color:'white'}:{color:'#333'}}>Single</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPayerMode('multiple')} style={[styles.pill, payerMode==='multiple' && styles.pillActive]}>
                <Text style={payerMode==='multiple'?{color:'white'}:{color:'#333'}}>Multiple</Text>
            </TouchableOpacity>
        </View>

        {payerMode === 'single' ? (
             <View style={styles.card}>
                {groupMembers.map(m => (
                    <TouchableOpacity key={m._id} onPress={() => setSinglePayer(m._id)} style={{padding:10, flexDirection:'row', alignItems:'center'}}>
                        <Ionicons name={singlePayer===m._id?"radio-button-on":"radio-button-off"} size={20} color="#1D976C"/>
                        <Text style={{marginLeft:10}}>{m.username}</Text>
                    </TouchableOpacity>
                ))}
             </View>
        ) : (
            <View style={styles.card}>
                {groupMembers.map(m => (
                    <View key={m._id} style={{flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:5}}>
                        <Text>{m.username}</Text>
                        <TextInput 
                           style={styles.miniInput} 
                           placeholder="0" 
                           keyboardType="numeric"
                           onChangeText={(txt) => updateContribution(m._id, txt)}
                        />
                    </View>
                ))}
            </View>
        )}

        {/* Image Upload */}
        <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
            <Ionicons name="camera" size={20} color="#1D976C" />
            <Text style={{marginLeft:10, color:'#1D976C'}}>{image ? 'Receipt Attached' : 'Attach Receipt'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitBtn} onPress={handleAddExpense} disabled={loading}>
            {loading ? <ActivityIndicator color="white"/> : <Text style={{color:'white', fontWeight:'bold'}}>Save Expense</Text>}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight:'bold', marginTop:15, marginBottom:5 },
  input: { backgroundColor:'#f5f5f5', padding:12, borderRadius:8 },
  miniInput: { backgroundColor:'#f5f5f5', padding:8, borderRadius:6, width:100, textAlign:'right' },
  pill: { padding:8, paddingHorizontal:15, borderRadius:20, borderWidth:1, borderColor:'#ddd', marginRight:10 },
  pillActive: { backgroundColor:'#1D976C', borderColor:'#1D976C' },
  card: { borderWidth:1, borderColor:'#eee', borderRadius:8, padding:10 },
  imageBtn: { flexDirection:'row', justifyContent:'center', padding:15, borderWidth:1, borderColor:'#1D976C', borderStyle:'dashed', borderRadius:8, marginTop:20 },
  submitBtn: { backgroundColor:'#1D976C', padding:15, borderRadius:8, alignItems:'center', marginTop:20 }
});