import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card, Text, useTheme, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Mock data for orders
const orders = [
  {
    id: 'MED123456',
    date: '2024-03-20',
    status: 'In Transit',
    items: [
      { name: 'Paracetamol', quantity: 2 },
      { name: 'Vitamin C', quantity: 1 },
    ],
    total: 45.99,
    deliveryAddress: '123 Main St, City, State 12345',
    estimatedDelivery: '2024-03-22',
  },
  {
    id: 'MED123457',
    date: '2024-03-19',
    status: 'Delivered',
    items: [
      { name: 'Aspirin', quantity: 1 },
      { name: 'Bandages', quantity: 2 },
    ],
    total: 32.50,
    deliveryAddress: '456 Oak Ave, City, State 12345',
    estimatedDelivery: '2024-03-21',
  },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'In Transit':
      return 'truck-delivery';
    case 'Delivered':
      return 'check-circle';
    default:
      return 'information';
  }
};

const getStatusColor = (status: string, theme: any) => {
  switch (status) {
    case 'In Transit':
      return theme.colors.primary;
    case 'Delivered':
      return theme.colors.success;
    default:
      return theme.colors.secondary;
  }
};

export default function OrdersScreen() {
  const theme = useTheme();

  const renderOrder = ({ item }: { item: any }) => (
    <Card style={styles.orderCard}>
      <Card.Content>
        <View style={styles.orderHeader}>
          <View>
            <Text variant="titleMedium">Order #{item.id}</Text>
            <Text variant="bodySmall" style={styles.date}>
              Ordered on {item.date}
            </Text>
          </View>
          <View style={styles.statusContainer}>
            <MaterialCommunityIcons
              name={getStatusIcon(item.status)}
              size={24}
              color={getStatusColor(item.status, theme)}
              style={styles.statusIcon}
            />
            <Text
              variant="bodyMedium"
              style={{ color: getStatusColor(item.status, theme) }}
            >
              {item.status}
            </Text>
          </View>
        </View>

        <Divider style={styles.divider} />

        <View style={styles.itemsList}>
          {item.items.map((orderItem: any, index: number) => (
            <Text key={index} variant="bodyMedium">
              {orderItem.quantity}x {orderItem.name}
            </Text>
          ))}
        </View>

        <Text variant="bodySmall" style={styles.address}>
          Delivery to: {item.deliveryAddress}
        </Text>

        <View style={styles.footer}>
          <Text variant="titleMedium">Total: ₹{item.total}</Text>
          <Button
            mode="contained-tonal"
            onPress={() => {}}
            style={styles.trackButton}
          >
            Track Order
          </Button>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
  },
  orderCard: {
    marginBottom: 16,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  date: {
    opacity: 0.7,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    marginRight: 4,
  },
  divider: {
    marginVertical: 12,
  },
  itemsList: {
    marginBottom: 12,
  },
  address: {
    opacity: 0.7,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trackButton: {
    minWidth: 120,
  },
}); 