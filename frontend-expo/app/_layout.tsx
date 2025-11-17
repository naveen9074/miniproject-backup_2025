// (app)/_layout.tsx
import { Stack } from 'expo-router';
import React from 'react';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen 
        name="register" 
        options={{ 
          title: 'Create Account', 
          headerStyle: { backgroundColor: '#000000ff' }, 
          headerTintColor: 'white',
          headerBackTitle: 'Back'
        }} 
      />
      <Stack.Screen name="groups" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      
      {/* --- NEW SCREEN --- */}
      <Stack.Screen 
        name="edit-profile" 
        options={{ title: 'Edit Profile', presentation: 'modal' }} 
      />
      {/* --- END NEW SCREEN --- */}
      
      <Stack.Screen name="create-group" options={{ title: 'Create New Group' }} />
      <Stack.Screen name="add-members" options={{ title: 'Add Members' }} />
      <Stack.Screen name="group/[id]" options={{ title: 'Group Details' }} />
      <Stack.Screen name="add-expense" options={{ title: 'Add Expense' }} />
      <Stack.Screen name="settle-payment" options={{ title: 'Settle Payment' }} />
      <Stack.Screen name="verify-payment/[settlementId]" options={{ title: 'Verify Payment' }} />
    </Stack>
  );
}