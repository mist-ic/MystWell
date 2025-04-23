import { Stack } from 'expo-router';

export default function MedicineLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="reorder"
        options={{
          headerShown: false,
          presentation: 'modal'
        }}
      />
      <Stack.Screen
        name="vendors"
        options={{
          title: 'Select Vendor',
          headerShown: true,
        }}
      />
    </Stack>
  );
} 